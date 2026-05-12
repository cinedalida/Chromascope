from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import io
import traceback
from PIL import Image
from firebase_admin import firestore

from .auth_utils import get_current_user
from ..core.engine import ChromascopeSafetyEngine
from ..core.skin_analysis.pipeline import AnalyzerPipeline
from ..core.color_matching import run_color_matching 

SEASON_MAP = {
    "Bright Spring": "SP-BRIGHT",
    "Warm Spring": "SP-TRUE",
    "Light Spring": "SP-LIGHT",
    "Light Summer": "SU-LIGHT",
    "Cool Summer": "SU-TRUE",
    "Soft Summer": "SU-SOFT",
    "Soft Autumn": "AU-SOFT",
    "Warm Autumn": "AU-TRUE",
    "Deep Autumn": "AU-DEEP",
    "Deep Winter": "WI-DEEP",
    "Cool Winter": "WI-TRUE",
    "Bright Winter": "WI-BRIGHT"
}

def normalize_label(label: str) -> str:
    if not label or not isinstance(label, str): return label
    return label.lower().replace("-", "_").replace(" ", "_")

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
    skin_type: str
    concerns: List[str] = []
    avoid_ingredients: List[str] = []

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

@app.get("/")
async def root():
    return {"status": "Chromascope Safety API is running", "database": "Firebase Firestore"}

@app.get("/api/products")
async def get_all_products():
    docs = db.collection("products").stream()
    return [doc.to_dict() for doc in docs]

@app.get("/api/ingredients")
async def get_all_ingredients():
    return list(engine.db.ingredient_db.values())

@app.patch("/api/user/profile")
async def update_user_profile(
    data: ProfileUpdate, 
    user_id: str = Depends(get_current_user)
):
    try:
        user_ref = db.collection("users").document(user_id)
        update_data = {
            "display_name": data.display_name,
            "dob": data.dob,
            "melanin_tier": data.melanin_tier,
            "skin_type": normalize_label(data.skin_type),
            "concerns": [normalize_label(c) for c in data.concerns],
            "avoid_ingredients": [normalize_label(a) for a in data.avoid_ingredients],
            "profile_completed": True
        }
        update_data = {k: v for k, v in update_data.items() if v is not None}
        user_ref.set(update_data, merge=True)
        return {"status": "success", "message": "Profile updated"}
    except Exception as e:
        print(f" [ERROR] Profile Update Failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/run-filter")
async def run_safety_and_color_logic(
    request_data: FilterRequest, 
    user_id: str = Depends(get_current_user)
):
    try:
        category_map = {
            "face": "Face",           
            "concealer": "Concealer", 
            "cheeks": "Cheek",        
            "lips": "Lip",            
            "eyes": "Eye",           
            "multiuse": "Multi-Use"   
        }
        raw_cat = request_data.category.lower()
        target_cat = category_map.get(raw_cat, request_data.category.capitalize())
        
        product_docs = db.collection("products").where("category", "==", target_cat).stream()
        category_products = []
        for doc in product_docs:
            p = doc.to_dict()
            p['product_id'] = doc.id
            category_products.append(p)

        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        user_profile = user_doc.to_dict() if user_doc.exists else {}

        skin_type = normalize_label(request_data.skin_type or user_profile.get("skin_type", "normal"))
        concerns = [normalize_label(c) for c in (request_data.concerns or user_profile.get("concerns", []))]
        avoid_ingredients = [normalize_label(a) for a in (request_data.avoid_ingredients or user_profile.get("avoid_ingredients", []))]
        
        engine_skin_type = "normal" if skin_type == "sensitive" else skin_type
        
        results = engine.filter(
            products_list=category_products, 
            skin_type=engine_skin_type,
            concerns=concerns,
            avoid_ingredients=avoid_ingredients,
            category=target_cat,
        )
        
        safe_only = [r for r in results if r.get("verdict") == "safe"]
        
        color_matched = []
        user_lab = request_data.user_lab or user_profile.get("user_lab")
        ui_season = request_data.seasonal_label or user_profile.get("seasonal_label")

        if safe_only:
            try:
                internal_season_code = SEASON_MAP.get(ui_season, "WI-TRUE")
                user_lab_tuple = tuple(user_lab) if user_lab else None
                
                color_matched = run_color_matching(
                    safe_products=safe_only,
                    seasonal_label=internal_season_code,
                    user_lab=user_lab_tuple,
                    category=target_cat,
                    top_k=10
                )
            except Exception as match_err:
                print(f" [WARNING] Color matching pipeline failed: {match_err}")
        
        return {
            "safety_results": results,
            "color_matched": color_matched,
            "match_count": len(color_matched),
            "active_profile": {
                "skin_type": skin_type,
                "seasonal_label": ui_season
            }
        }

    except Exception as e:
        print(f" [ERROR] API Integration Crash (User: {user_id}): {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Safety and Color matching logic integration failed.")

@app.post("/api/analyze-color")
async def analyze_color(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        result = analyzer.analyze(image)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        print(f" [ERROR] Analysis Pipeline Crash (User: {user_id}): {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))