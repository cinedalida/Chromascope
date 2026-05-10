from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ..core.engine import ChromascopeSafetyEngine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = ChromascopeSafetyEngine()

@app.get("/api/products")
async def get_all_products():
    return engine.db.products

@app.get("/api/ingredients")
async def get_all_ingredients():
    return list(engine.db.ingredient_db.values())

@app.post("/api/run-filter")
async def run_safety_logic(request: Request):
    try:
        data = await request.json()
        results = engine.filter(
            skin_type=data.get("skin_type"),
            concerns=data.get("concerns", []),
            avoid_ingredients=data.get("avoid_ingredients", []),
            category=data.get("category"),
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"status": "Chromascope Safety API is running", "database": "Firebase Firestore"}