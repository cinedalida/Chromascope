from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
import hashlib
import io
import json
import logging
import os
from PIL import Image
from firebase_admin import auth as fb_auth, firestore

from .auth_utils import get_current_user
from .limits import ALLOWED_FORMATS, MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES, analysis_limiter
from . import result_receipt
from .http_cache import ApiGZipMiddleware, CachedStaticFiles, PRODUCTS_CACHE_CONTROL, etag_matches
from .schemas import AnalysisResultSave, FilterBatchRequest, FilterRequest, ProfileUpdate, avoid_key, concern_key, normalize_label
from ..core.engine import ChromascopeSafetyEngine
from ..core import bayes_engine
from ..core.retention import purge_inactive_face_data
import hmac
from fastapi import Header
from ..core.skin_analysis.pipeline import AnalyzerPipeline, CKPT_PATH, FARL_PATH
from ..core.color_matching import delta_e_ciede2000, run_color_matching
import threading
import copy
import time

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
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


app.add_middleware(ApiGZipMiddleware, minimum_size=1000)

# Product photos (scripts/fetch_catalog_images.py), served read-only at /catalog-images/<file>: free hosting
# without Firebase Storage (PLAN_MIGRATION.md). No directory listing.
CATALOG_IMAGES_DIR = os.environ.get("CATALOG_IMAGES_DIR") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "catalog_images")
if os.path.isdir(CATALOG_IMAGES_DIR):
    app.mount("/catalog-images", CachedStaticFiles(directory=CATALOG_IMAGES_DIR), name="catalog-images")
    log.info("Serving product photos from %s", CATALOG_IMAGES_DIR)

# Pillow refuses images above this many pixels (decompression-bomb guard), before any analysis runs.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_SIDE * MAX_IMAGE_SIDE

engine = ChromascopeSafetyEngine()
# "bayes" (default): the evaluated Bayesian-Chromascope Hybrid filter. "rules": the previous rule-based filter.
SAFETY_FILTER = os.environ.get("SAFETY_FILTER", "bayes").strip().lower()
# Which product collection the app reads: "products_v2" (scraped catalog, PLAN_CATALOG.md; default, as in
# production) or "products" (the previous 110-product catalog). Set PRODUCTS_COLLECTION=products to roll back.
PRODUCTS_COLLECTION = os.environ.get("PRODUCTS_COLLECTION", "products_v2").strip()
log.info("Safety filter: %s | products collection: %s", SAFETY_FILTER, PRODUCTS_COLLECTION)

# Products change only when the catalog is re-imported, so keep one copy in memory for a few minutes instead of reading
# all ~1,000 documents from Firestore on every request (a single catalog visit would otherwise cost ~2,000 reads).
PRODUCTS_CACHE_SECONDS = float(os.environ.get("PRODUCTS_CACHE_SECONDS", "600"))
_products_cache = {"at": 0.0, "items": None, "body": None, "etag": None}
_products_lock = threading.Lock()


def _refresh_products_if_stale() -> None:
    """Caller holds _products_lock."""
    if _products_cache["items"] is None or time.monotonic() - _products_cache["at"] > PRODUCTS_CACHE_SECONDS:
        _products_cache["items"] = [{**d.to_dict(), "product_id": d.id} for d in db.collection(PRODUCTS_COLLECTION).stream()]
        _products_cache["at"] = time.monotonic()
        _products_cache["body"] = None  # serialized again, on the next /api/products
        _products_cache["etag"] = None


def load_products(category: str | None = None) -> list:
    """All products (or one category), each a fresh dict copy so callers may modify them."""
    with _products_lock:
        _refresh_products_if_stale()
        items = _products_cache["items"]
    return [copy.deepcopy(p) for p in items if category is None or p.get("category") == category]


def products_payload() -> tuple[bytes, str]:
    """The whole catalog as ready-to-send JSON bytes and its ETag. Serialized once per reload, not per request, and never
    handed out as a mutable object. The ETag is a hash of the content, so an unchanged catalog keeps its ETag across
    reloads and server restarts (browsers then get a 304 instead of the list)."""
    with _products_lock:
        _refresh_products_if_stale()
        if _products_cache["body"] is None:
            body = json.dumps(jsonable_encoder(_products_cache["items"]), separators=(",", ":")).encode("utf-8")
            _products_cache["body"] = body
            _products_cache["etag"] = '"' + hashlib.md5(body).hexdigest() + '"'
        return _products_cache["body"], _products_cache["etag"]


def _warm_filter_cache():
    """Pre-match every ingredient list once, in the background, so the first filter request is fast."""
    try:
        lists = []
        for d in load_products():
            lists += list((d.get("formulas") or {}).values()) or [d.get("full_inci_list", "")]
        log.info("Filter cache warmed: %d ingredient lists", bayes_engine.warm_cache(lists))
    except Exception:
        log.warning("Could not warm the filter cache", exc_info=True)


threading.Thread(target=_warm_filter_cache, daemon=True).start()


def _use_closest_shade(products: list, user_lab) -> None:
    """Face products: match on the shade closest to the user's skin (CIEDE2000), not just the first shade."""
    if not user_lab or len(user_lab) != 3:
        return
    for p in products:
        best = min((sh for sh in p.get("shades") or [] if sh.get("lab")),
                   key=lambda sh: delta_e_ciede2000(tuple(user_lab), tuple(sh["lab"])), default=None)
        if best:
            p["lab_L"], p["lab_a"], p["lab_b"] = best["lab"]
            p["hex_color"] = best.get("hex") or p.get("hex_color", "")
            p["best_shade"] = {"name": best.get("name"), "hex": best.get("hex"), "verdict": best.get("verdict")}

# The color-analysis model loads in the background right after startup (see preload_analyzer), so the first photo
# doesn't wait for it, and the rest of the API (profile, safety filter, catalog) is up immediately. If the weights are
# not on this machine (e.g. local testing) the analysis endpoint answers 503 and everything else still runs.
_analyzer = None
_analyzer_lock = threading.Lock()

def get_analyzer():
    global _analyzer
    if _analyzer is None:
        with _analyzer_lock:  # one load at a time: a request arriving mid-preload waits for it instead of loading twice
            if _analyzer is None:
                missing = [os.path.basename(p) for p in (FARL_PATH, CKPT_PATH) if not os.path.exists(p)]
                if missing:
                    log.warning("Color analysis unavailable, missing model weights: %s", missing)
                    raise HTTPException(
                        status_code=503,
                        detail={"code": "model_unavailable", "message": "Color analysis is temporarily unavailable."},
                    )
                _analyzer = AnalyzerPipeline()
                try:
                    _analyzer.warm_up()
                except Exception:
                    log.exception("Analyzer warm-up failed (continuing without it)")
    return _analyzer

def preload_analyzer():
    try:
        get_analyzer()
    except HTTPException:
        pass  # weights missing: already logged
    except Exception:
        log.exception("Analyzer preload failed; it will be retried on the first analysis request")

@app.on_event("startup")
async def _preload_analyzer_on_startup():
    if os.getenv("PRELOAD_ANALYZER", "1") != "0":
        threading.Thread(target=preload_analyzer, name="analyzer-preload", daemon=True).start()

def server_error(where: str) -> HTTPException:
    """Log the full error on the server; the client only gets a generic message (no internals)."""
    log.exception("Unhandled error in %s", where)
    return HTTPException(status_code=500, detail="Something went wrong on our side. Please try again.")

@app.get("/")
async def root():
    return {"status": "Chromascope Safety API is running"}

@app.get("/api/products")
async def get_all_products(request: Request, user_id: str = Depends(get_current_user)):
    body, etag = products_payload()
    headers = {"ETag": etag, "Cache-Control": PRODUCTS_CACHE_CONTROL}
    if etag_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)

@app.get("/api/catalog/summary")
async def catalog_summary(user_id: str = Depends(get_current_user)):
    """Real verdict counts over the whole catalog for this user's profile (replaces the catalog page's made-up
    '95% safe' statistic)."""
    try:
        profile = (db.collection("users").document(user_id).get().to_dict() or {})
        skin = normalize_label(profile.get("skin_type") or "normal")
        concerns = [concern_key(c) for c in profile.get("concerns", [])]
        avoid = [avoid_key(a) for a in profile.get("avoid_ingredients", [])]
        products = load_products()
        results = bayes_engine.filter_products(products, skin, concerns, avoid)
        counts = {v: sum(1 for r in results if r["verdict"] == v) for v in ("safe", "caution", "excluded")}
        return {"total": len(results), **counts, "filter": "bayes"}
    except Exception:
        raise server_error("catalog_summary")

@app.get("/api/ingredients")
async def get_all_ingredients(user_id: str = Depends(get_current_user)):
    return list(engine.db.ingredient_db.values())

@app.patch("/api/user/profile")
async def update_user_profile(data: ProfileUpdate, user_id: str = Depends(get_current_user)):
    try:
        update_data = {
            "display_name": data.display_name,
            "skin_type": normalize_label(data.skin_type) if data.skin_type else None,
            "concerns": [concern_key(c) for c in data.concerns] if data.concerns is not None else None,
            "avoid_ingredients": [avoid_key(a) for a in data.avoid_ingredients] if data.avoid_ingredients is not None else None,
        }
        update_data = {k: v for k, v in update_data.items() if v is not None}
        if update_data:
            db.collection("users").document(user_id).set(update_data, merge=True)
        return {"status": "success", "message": "Profile updated"}
    except Exception:
        raise server_error("update_user_profile")

CATEGORY_MAP = {"face": "Face", "concealer": "Concealer", "cheeks": "Cheek", "cheek": "Cheek", "lips": "Lip",
                "lip": "Lip", "eyes": "Eye", "eye": "Eye", "multiuse": "Multi-Use", "multi-use": "Multi-Use"}


def _filter_inputs(request_data: FilterRequest, user_id: str) -> dict:
    """The profile the filter runs on: fields sent in the request win, the rest comes from users/{uid} (one read)."""
    user_doc = db.collection("users").document(user_id).get()
    user_profile = user_doc.to_dict() if user_doc.exists else {}
    return {
        "skin_type": normalize_label(request_data.skin_type or user_profile.get("skin_type") or "normal"),
        "concerns": [concern_key(c) for c in (request_data.concerns or user_profile.get("concerns", []))],
        "avoid": [avoid_key(a) for a in (request_data.avoid_ingredients or user_profile.get("avoid_ingredients", []))],
        "user_lab": request_data.user_lab or user_profile.get("user_lab"),
        "ui_season": request_data.seasonal_label or user_profile.get("seasonal_label"),
    }


def _filter_category(category: str, inputs: dict) -> tuple[list, list]:
    """Safety verdicts and color matching for one category: (safety_results, color_matched)."""
    skin_type, concerns, avoid = inputs["skin_type"], inputs["concerns"], inputs["avoid"]
    user_lab, ui_season = inputs["user_lab"], inputs["ui_season"]
    target_cat = CATEGORY_MAP[category.lower()]

    category_products = load_products(target_cat)

    # Build lookup BEFORE engine strips the fields
    product_lookup = {p["product_id"]: p for p in category_products}

    if SAFETY_FILTER == "rules":
        # Previous rule-based filter, kept for one release as a fallback (set SAFETY_FILTER=rules).
        results = engine.filter(
            products_list=category_products,
            skin_type="normal" if skin_type == "sensitive" else skin_type,
            concerns=concerns,
            avoid_ingredients=avoid,
            category=target_cat,
        )
    else:
        # Decision D1: the Bayesian-Chromascope Hybrid filter evaluated in the paper (see core/bayes_engine.py).
        results = bayes_engine.filter_products(category_products, skin_type, concerns, avoid)

    # Re-merge original Firestore fields (lab_L, lab_a, lab_b, etc.) back in
    # Engine fields (verdict, etc.) take priority via right-side **r
    results = [{**product_lookup.get(r.get("product_id"), {}), **r} for r in results]

    color_matched = []
    try:
        user_lab_tuple = tuple(user_lab) if (user_lab and len(user_lab) == 3) else None
        if target_cat == "Face":
            _use_closest_shade(results, user_lab_tuple)
        color_matched = run_color_matching(
            products=results,  # all verdicts — safe/caution/excluded sorted in color_matching
            seasonal_label=ui_season,
            user_lab=user_lab_tuple,
            category=target_cat
        )
    except Exception:
        log.exception("run_color_matching failed; returning unmatched results")
        color_matched = results

    return results, color_matched


@app.post("/api/run-filter")
async def run_safety_and_color_logic(request_data: FilterRequest, user_id: str = Depends(get_current_user)):
    try:
        inputs = _filter_inputs(request_data, user_id)
        results, color_matched = _filter_category(request_data.category, inputs)
        return {
            "safety_results": results,
            "color_matched": color_matched,
            "active_profile": {"skin_type": inputs["skin_type"], "seasonal_label": inputs["ui_season"]}
        }
    except Exception:
        raise server_error("run_safety_and_color_logic")


@app.post("/api/run-filter-batch")
async def run_safety_and_color_batch(request_data: FilterBatchRequest, user_id: str = Depends(get_current_user)):
    """Several categories in one request: the user's profile is read once, and each category is answered exactly as
    /api/run-filter would (the `color_matched` list). The duplicate `safety_results` copy is left out: the app does not
    read it, and it doubled the size of every response."""
    try:
        inputs = _filter_inputs(request_data, user_id)
        categories = {name: {"color_matched": _filter_category(name, inputs)[1]} for name in request_data.categories}
        return {
            "categories": categories,
            "active_profile": {"skin_type": inputs["skin_type"], "seasonal_label": inputs["ui_season"]}
        }
    except Exception:
        raise server_error("run_safety_and_color_batch")

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

@app.delete("/api/user/account")
async def delete_account(user_id: str = Depends(get_current_user)):
    """Permanently delete the signed-in user's profile record and login (RA 10173 right to erasure).

    Photos are never stored. Saved favorites (users/{uid}/favorites) are removed first: Firestore does not delete a
    document's subcollections with it. Runs with admin rights so it works without the "please log in again" step
    Firebase requires for deletes from the browser.
    """
    try:
        user_ref = db.collection("users").document(user_id)
        for favorite in user_ref.collection("favorites").stream():
            favorite.reference.delete()
        user_ref.delete()
        try:
            fb_auth.delete_user(user_id)
        except fb_auth.UserNotFoundError:
            pass
        log.info("Deleted account %s", user_id)
        return {"status": "deleted"}
    except Exception:
        raise server_error("delete_account")

@app.post("/api/user/active")
async def mark_active(user_id: str = Depends(get_current_user)):
    """Called by the app when a signed-in user opens it; get_current_user records last_active (30-day retention)."""
    return {"status": "ok"}

@app.post("/internal/retention/purge-face-data")
async def run_face_data_retention(x_cron_secret: str = Header(default="")):
    """Daily job (Cloud Scheduler -> this URL, header X-Cron-Secret): removes face data of users inactive 30+ days.

    Disabled unless CRON_SECRET is set on the server. Not reachable from the app (no CORS, no user login).
    """
    secret = os.environ.get("CRON_SECRET", "")
    if not secret or not hmac.compare_digest(secret, x_cron_secret):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return purge_inactive_face_data(db, apply=True)
    except Exception:
        raise server_error("run_face_data_retention")
