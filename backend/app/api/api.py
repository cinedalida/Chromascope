from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
import io
import logging
import os
from PIL import Image
from firebase_admin import firestore

from .auth_utils import get_current_user
from .limits import ALLOWED_FORMATS, MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES, analysis_limiter
from . import result_receipt
from .schemas import AnalysisResultSave, FilterRequest, ProfileUpdate, normalize_label
from ..core.engine import ChromascopeSafetyEngine
from ..core.skin_analysis.pipeline import AnalyzerPipeline, CKPT_PATH, FARL_PATH
from ..core.color_matching import run_color_matching

log = logging.getLogger("chromascope.api")
app = FastAPI()
db = firestore.client()

# Only the app's own sites may call the API from a browser. Production: set ALLOWED_ORIGINS on Cloud Run to the
# Vercel domain(s), comma-separated (e.g. https://chromascope.vercel.app). Default = local development only.
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

# Pillow refuses images above this many pixels (decompression-bomb guard), before any analysis runs.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_SIDE * MAX_IMAGE_SIDE

engine = ChromascopeSafetyEngine()

# The color-analysis model loads on the first analysis request, not at startup, so the rest of the API (profile,
# safety filter, catalog) still runs when the model weights are not on this machine (e.g. local testing).
_analyzer = None

def get_analyzer():
    global _analyzer
    if _analyzer is None:
        missing = [os.path.basename(p) for p in (FARL_PATH, CKPT_PATH) if not os.path.exists(p)]
        if missing:
            log.warning("Color analysis unavailable, missing model weights: %s", missing)
            raise HTTPException(
                status_code=503,
                detail={"code": "model_unavailable", "message": "Color analysis is temporarily unavailable."},
            )
        _analyzer = AnalyzerPipeline()
    return _analyzer

def server_error(where: str) -> HTTPException:
    """Log the full error on the server; the client only gets a generic message (no internals)."""
    log.exception("Unhandled error in %s", where)
    return HTTPException(status_code=500, detail="Something went wrong on our side. Please try again.")

@app.get("/")
async def root():
    return {"status": "Chromascope Safety API is running"}

@app.get("/api/products")
async def get_all_products(user_id: str = Depends(get_current_user)):
    docs = db.collection("products").stream()
    return [{**doc.to_dict(), "product_id": doc.id} for doc in docs]

@app.get("/api/ingredients")
async def get_all_ingredients(user_id: str = Depends(get_current_user)):
    return list(engine.db.ingredient_db.values())

@app.patch("/api/user/profile")
async def update_user_profile(data: ProfileUpdate, user_id: str = Depends(get_current_user)):
    try:
        update_data = {
            "display_name": data.display_name,
            "skin_type": normalize_label(data.skin_type) if data.skin_type else None,
            "concerns": [normalize_label(c) for c in data.concerns] if data.concerns is not None else None,
            "avoid_ingredients": [normalize_label(a) for a in data.avoid_ingredients] if data.avoid_ingredients is not None else None,
        }
        update_data = {k: v for k, v in update_data.items() if v is not None}
        if update_data:
            db.collection("users").document(user_id).set(update_data, merge=True)
        return {"status": "success", "message": "Profile updated"}
    except Exception:
        raise server_error("update_user_profile")

@app.post("/api/run-filter")
async def run_safety_and_color_logic(request_data: FilterRequest, user_id: str = Depends(get_current_user)):
    try:
        category_map = {"face": "Face", "concealer": "Concealer", "cheeks": "Cheek", "cheek": "Cheek", "lips": "Lip",
                        "lip": "Lip", "eyes": "Eye", "eye": "Eye", "multiuse": "Multi-Use", "multi-use": "Multi-Use"}
        target_cat = category_map[request_data.category.lower()]

        product_docs = db.collection("products").where("category", "==", target_cat).stream()
        category_products = [{**doc.to_dict(), "product_id": doc.id} for doc in product_docs]

        # Build lookup BEFORE engine strips the fields
        product_lookup = {p["product_id"]: p for p in category_products}

        user_doc = db.collection("users").document(user_id).get()
        user_profile = user_doc.to_dict() if user_doc.exists else {}

        skin_type = normalize_label(request_data.skin_type or user_profile.get("skin_type") or "normal")

        results = engine.filter(
            products_list=category_products,
            skin_type="normal" if skin_type == "sensitive" else skin_type,  # TODO(D1, PLAN_OPTIMIZATION.md)
            concerns=[normalize_label(c) for c in (request_data.concerns or user_profile.get("concerns", []))],
            avoid_ingredients=[normalize_label(a) for a in (request_data.avoid_ingredients or user_profile.get("avoid_ingredients", []))],
            category=target_cat,
        )

        # Re-merge original Firestore fields (lab_L, lab_a, lab_b, etc.) back in
        # Engine fields (verdict, etc.) take priority via right-side **r
        results = [{**product_lookup.get(r.get("product_id"), {}), **r} for r in results]

        user_lab = request_data.user_lab or user_profile.get("user_lab")
        ui_season = request_data.seasonal_label or user_profile.get("seasonal_label")

        color_matched = []
        try:
            user_lab_tuple = tuple(user_lab) if (user_lab and len(user_lab) == 3) else None
            color_matched = run_color_matching(
                products=results,  # all verdicts — safe/caution/excluded sorted in color_matching
                seasonal_label=ui_season,
                user_lab=user_lab_tuple,
                category=target_cat
            )
        except Exception:
            log.exception("run_color_matching failed; returning unmatched results")
            color_matched = results

        return {
            "safety_results": results,
            "color_matched": color_matched,
            "active_profile": {"skin_type": skin_type, "seasonal_label": ui_season}
        }
    except Exception:
        raise server_error("run_safety_and_color_logic")

@app.post("/api/analyze-color")
async def analyze_color(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    allowed, retry_after = analysis_limiter.allow(user_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={"code": "rate_limited", "message": "Too many analyses. Please try again later."},
            headers={"Retry-After": str(retry_after)},
        )

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"code": "file_too_large", "message": f"Please use a photo under {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."},
        )
    try:
        image = Image.open(io.BytesIO(contents))
        if image.format not in ALLOWED_FORMATS:
            raise ValueError(f"format {image.format}")
        if max(image.size) > MAX_IMAGE_SIDE:
            raise ValueError(f"size {image.size}")
        image = image.convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_image", "message": "Please choose a JPG or PNG photo."},
        )

    try:
        result = get_analyzer().analyze(image)
    except HTTPException:
        raise
    except Exception:
        raise server_error("analyze_color")

    # Photo problems (blurry, dark, no face...) — the frontend shows a pop-up for each code
    if "error" in result:
        raise HTTPException(
            status_code=422,
            detail={"code": result.get("error_code", "unknown"), "message": result["error"]},
        )

    # Not saved yet: the app saves it via /api/user/analysis-result only if the user does not cancel, using this
    # signed receipt so the values cannot be altered. The photo itself is never stored (memory only).
    result["result_token"] = result_receipt.issue(user_id, result["season"], result["lab_color"], result["confidence"])
    return result

@app.post("/api/user/analysis-result")
async def save_analysis_result(data: AnalysisResultSave, user_id: str = Depends(get_current_user)):
    if not result_receipt.verify(data.result_token, user_id, data.season, data.lab_color, data.confidence):
        raise HTTPException(
            status_code=403,
            detail={"code": "invalid_result", "message": "This result could not be verified. Please run the analysis again."},
        )
    try:
        db.collection("users").document(user_id).set({
            "seasonal_label": data.season,
            "user_lab": data.lab_color,
            "season_confidence_level": data.confidence,
            "profile_completed": True,
        }, merge=True)
        return {"status": "success"}
    except Exception:
        raise server_error("save_analysis_result")
