from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import io
from PIL import Image

from ..core.engine import ChromascopeSafetyEngine
from ..core.skin_analysis.pipeline import AnalyzerPipeline



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = ChromascopeSafetyEngine()
print("Initializing ML Pipeline...")
analyzer = AnalyzerPipeline()

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


@app.post("/api/analyze-color")
async def analyze_color(file: UploadFile = File(...)):
    try:
        # Read the uploaded file into memory
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Run the ML pipeline
        result = analyzer.analyze(image)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"status": "Chromascope Safety API is running", "database": "Firebase Firestore"}