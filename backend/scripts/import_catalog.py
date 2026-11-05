r"""Load app_catalog.json (from scripts/build_catalog.py) into a Firestore collection (PLAN_CATALOG.md).

Default is a PREVIEW (nothing written). Writes need --apply. The REAL database additionally needs --production and the
service-account key at backend/serviceAccountKey.json; without --production the script refuses to run unless it is
pointed at the emulator (FIRESTORE_EMULATOR_HOST set).

  Sandbox:     (emulator env set)  venv\Scripts\python -m scripts.import_catalog <app_catalog.json> --collection products --apply
  Production:  venv\Scripts\python -m scripts.import_catalog <app_catalog.json> --production            (preview)
               venv\Scripts\python -m scripts.import_catalog <app_catalog.json> --production --apply    (writes products_v2)
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.firebase_init import init_firebase, using_emulators  # noqa: E402


IMAGE_FOLDER = "catalog_v2"   # separate from the old catalog's products/ folder, which is never touched
CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "avif": "image/avif"}


def upload_images(products: list, images_dir: str, apply: bool, production: bool) -> dict:
    """Upload local photos (scripts/fetch_catalog_images.py) to Storage and point image_url at our copy.
    Production: made public with the same Cloud Storage ACL method as the old catalog (no Storage rules change).
    Products without a local photo keep their original link (e.g. Maybelline, which loads fine in browsers)."""
    from concurrent.futures import ThreadPoolExecutor
    from urllib.parse import quote
    from firebase_admin import storage
    files = {f.rsplit(".", 1)[0]: f for f in os.listdir(images_dir)} if images_dir else {}
    bucket = storage.bucket()
    emulator = os.environ.get("STORAGE_EMULATOR_HOST", "").rstrip("/")

    def one(p):
        f = files.get(p["product_id"])
        if not f:
            return "kept original link"
        path = f"{IMAGE_FOLDER}/{f}"
        if apply:
            blob = bucket.blob(path)
            blob.cache_control = "public, max-age=31536000"
            blob.upload_from_filename(os.path.join(images_dir, f), content_type=CONTENT_TYPES.get(f.rsplit(".", 1)[1], "image/jpeg"))
            if production:
                blob.make_public()
                url = blob.public_url
            else:
                url = f"{emulator}/v0/b/{bucket.name}/o/{quote(path, safe='')}?alt=media"
            p["image_source_url"] = p.get("image_url", "")
            p["image_url"] = url
        return "uploaded" if apply else "would upload"

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(one, products))
    return {r: results.count(r) for r in set(results)} | {"bucket": bucket.name, "folder": IMAGE_FOLDER}


def import_catalog(db, products: list, collection: str, apply: bool) -> dict:
    existing = {d.id for d in db.collection(collection).select([]).stream()}
    new = [p for p in products if p["product_id"] not in existing]
    if apply:
        batch, n = db.batch(), 0
        for p in products:
            batch.set(db.collection(collection).document(p["product_id"]), p)
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()
    return {"collection": collection, "products": len(products), "already_there": len(existing & {p["product_id"] for p in products}),
            "new": len(new), "written": len(products) if apply else 0}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("catalog_json")
    ap.add_argument("--collection", default="products_v2", help="target collection (default products_v2)")
    ap.add_argument("--apply", action="store_true", help="write (default: preview only)")
    ap.add_argument("--production", action="store_true", help="allow the REAL database (needs the key file)")
    ap.add_argument("--images-dir", default="", help="folder of downloaded photos to upload to Storage (optional)")
    args = ap.parse_args()

    if not using_emulators() and not args.production:
        sys.exit("Refusing: not pointed at the emulator. Add --production to target the real database.")
    if args.production and using_emulators():
        sys.exit("Refusing: --production given but emulator variables are set.")
    if args.production and args.collection == "products":
        sys.exit("Refusing: in production, import into a new collection (default products_v2), never over 'products'.")

    init_firebase()
    from firebase_admin import firestore
    products = json.load(open(args.catalog_json, encoding="utf-8"))["products"]
    target = "REAL DATABASE" if args.production else f"EMULATOR ({os.environ.get('GCLOUD_PROJECT')})"
    print(f"Target: {target} | collection: {args.collection} | {'APPLY' if args.apply else 'PREVIEW (nothing is written)'}")
    if args.images_dir:
        print("images:", upload_images(products, args.images_dir, args.apply, args.production))
    print(import_catalog(firestore.client(), products, args.collection, args.apply))


if __name__ == "__main__":
    main()
