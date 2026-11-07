"""Read-only dump of the products_v2 Firestore collection to one JSON file.

Used by frontend/scripts/build-ar-extra-catalogs.mjs to build the AR Browse shade catalogs. Writes nothing to Firestore.

    python backend/scripts/export_products_v2.py <serviceAccountKey.json> <out.json>
"""
import json
import sys

import firebase_admin
from firebase_admin import credentials, firestore

KEEP = ("product_id", "product_name", "brand", "category", "sub_category", "store", "price", "price_currency",
        "where_to_buy", "hex_color", "lab_L", "lab_a", "lab_b", "shades")


def main():
    key_path, out_path = sys.argv[1:3]
    firebase_admin.initialize_app(credentials.Certificate(key_path))
    docs = [{k: d.to_dict().get(k) for k in KEEP} for d in firestore.client().collection("products_v2").stream()]
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(docs, fh)
    print(f"wrote {len(docs)} products to {out_path}")


if __name__ == "__main__":
    main()
