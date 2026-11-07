"""Seed the Firebase EMULATOR with a small, clearly synthetic test catalog (Phase 0 tests).

Refuses to run unless FIRESTORE_EMULATOR_HOST is set and the project ID starts with "demo-" (see app/firebase_init.py),
so it can never write to the real Chromascope database.

Usage (from backend/, emulators running):
    set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
    set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
    set GCLOUD_PROJECT=demo-chromascope
    venv\\Scripts\\python -m scripts.seed_emulator
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.firebase_init import init_firebase, using_emulators  # noqa: E402

if not os.environ.get("FIRESTORE_EMULATOR_HOST") or not using_emulators():
    sys.exit("Refusing to seed: FIRESTORE_EMULATOR_HOST is not set (this script only writes to the emulator).")
init_firebase()
from firebase_admin import firestore  # noqa: E402

db = firestore.client()

INGREDIENTS = [
    {"inci_name": "Glycerin", "common_aliases": "glycerol", "severity": "low", "comedogenic_rating": 0},
    {"inci_name": "Parfum", "common_aliases": "fragrance", "concern_category": "fragrance_sensitizer",
     "severity": "medium", "comedogenic_rating": 0},
    {"inci_name": "Cocos Nucifera Oil", "common_aliases": "coconut oil", "severity": "low", "comedogenic_rating": 4},
]
PRODUCTS = [
    {"product_id": "TEST-FACE-1", "product_name": "[TEST] Plain Foundation", "brand": "TestBrand", "category": "Face",
     "full_inci_list": "Water, Glycerin, Dimethicone", "hex_color": "#C99A7B", "lab_L": 66.0, "lab_a": 12.0, "lab_b": 20.0},
    {"product_id": "TEST-FACE-2", "product_name": "[TEST] Scented Foundation", "brand": "TestBrand", "category": "Face",
     "full_inci_list": "Water, Glycerin, Parfum", "hex_color": "#B98568", "lab_L": 60.0, "lab_a": 14.0, "lab_b": 22.0},
    {"product_id": "TEST-FACE-3", "product_name": "[TEST] Coconut Foundation", "brand": "TestBrand", "category": "Face",
     "full_inci_list": "Cocos Nucifera Oil, Water, Glycerin", "hex_color": "#D8AE90", "lab_L": 72.0, "lab_a": 10.0, "lab_b": 18.0},
]

for ing in INGREDIENTS:
    db.collection("ingredients").document(ing["inci_name"].lower().replace(" ", "_")).set(ing)
for p in PRODUCTS:
    db.collection("products").document(p["product_id"]).set(p)
print(f"Seeded emulator project {os.environ.get('GCLOUD_PROJECT')}: {len(INGREDIENTS)} ingredients, {len(PRODUCTS)} products.")
