from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import io
import traceback
from PIL import Image
from firebase_admin import firestore

from .auth_utils import get_current_user
from ..core.engine import ChromascopeSafetyEngine
from ..core.skin_analysis.pipeline import AnalyzerPipeline
from ..core.color_matching import run_color_matching 

app = FastAPI()
db = firestore.client()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = ChromascopeSafetyEngine()
analyzer = AnalyzerPipeline()

class FilterRequest(BaseModel):
    skin_type: Optional[str] = None
    concerns: List[str] = []
    avoid_ingredients: List[str] = []
    category: str = "Face"
    user_lab: Optional[List[float]] = None
    seasonal_label: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    dob: Optional[str] = None
    melanin_tier: Optional[str] = None
    skin_type: Optional[str] = None 
    concerns: Optional[List[str]] = None 
    avoid_ingredients: Optional[List[str]] = None 
    seasonal_label: Optional[str] = None     
    user_lab: Optional[List[float]] = None
    season_confidence_level: Optional[float] = None 

def normalize_label(label: str) -> str:
    if not label or not isinstance(label, str): return label
    return label.lower().replace("-", "_").replace(" ", "_")

@app.get("/")
async def root():
    return {"status": "Chromascope Safety API is running", "database": "Firebase Firestore"}

@app.get("/api/products")
async def get_all_products():
    docs = db.collection("products").stream()
    return [{**doc.to_dict(), "product_id": doc.id} for doc in docs]

@app.get("/api/ingredients")
async def get_all_ingredients():
    return list(engine.db.ingredient_db.values())

@app.patch("/api/user/profile")
async def update_user_profile(data: ProfileUpdate, user_id: str = Depends(get_current_user)):
    try:
        user_ref = db.collection("users").document(user_id)
        update_data = {
            "display_name": data.display_name,
            "dob": data.dob,
            "melanin_tier": data.melanin_tier,
            "skin_type": normalize_label(data.skin_type) if data.skin_type else None,
            "concerns": [normalize_label(c) for c in data.concerns] if data.concerns else None,
            "avoid_ingredients": [normalize_label(a) for a in data.avoid_ingredients] if data.avoid_ingredients else None,
            "seasonal_label": data.seasonal_label, 
            "user_lab": data.user_lab, 
            "season_confidence_level": data.season_confidence_level,
            "profile_completed": True
        }
        update_data = {k: v for k, v in update_data.items() if v is not None}
        user_ref.set(update_data, merge=True)
        return {"status": "success", "message": "Profile updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/run-filter")
async def run_safety_and_color_logic(request_data: FilterRequest, user_id: str = Depends(get_current_user)):
    try:
        category_map = {"face": "Face", "concealer": "Concealer", "cheeks": "Cheek", "lips": "Lip", "eyes": "Eye", "multiuse": "Multi-Use"}
        target_cat = category_map.get(request_data.category.lower(), request_data.category.capitalize())
        
        product_docs = db.collection("products").where("category", "==", target_cat).stream()
        category_products = [{**doc.to_dict(), "product_id": doc.id} for doc in product_docs]

        # Build lookup BEFORE engine strips the fields
        product_lookup = {p["product_id"]: p for p in category_products}

        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        user_profile = user_doc.to_dict() if user_doc.exists else {}

        skin_type = normalize_label(request_data.skin_type or user_profile.get("skin_type", "normal"))
        
        results = engine.filter(
            products_list=category_products, 
            skin_type="normal" if skin_type == "sensitive" else skin_type,
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
        except Exception as match_err:
            print(f"[FATAL] run_color_matching crashed: {match_err}")
            traceback.print_exc()
            color_matched = results

        return {
            "safety_results": results, 
            "color_matched": color_matched, 
            "active_profile": {"skin_type": skin_type, "seasonal_label": ui_season}
        }
    except Exception as e:
        print(f"[CRITICAL ERROR] run_safety_and_color_logic: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal filter logic failure.")

@app.post("/api/analyze-color")
async def analyze_color(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        result = analyzer.analyze(image)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))