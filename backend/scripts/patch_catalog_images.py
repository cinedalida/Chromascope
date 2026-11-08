"""Point products at the photos uploaded to Firebase Storage, WITHOUT touching any other field (season tags etc.).

Takes the catalog built by the image upload (derived/app_catalog_firebase.json) and updates only IMAGE_FIELDS on the
products that carry a Firebase image. It uses Firestore update(), never set(), so the other fields stay as they are.
Default is a DRY RUN. The real database needs --production; a backup of the previous values is saved before writing.

  python scripts/patch_catalog_images.py <app_catalog_firebase.json> --production            # dry run (reads ~1k docs)
  python scripts/patch_catalog_images.py <app_catalog_firebase.json> --production --apply
  python scripts/patch_catalog_images.py --production --rollback out/images_X/backup_Y.json
"""
import argparse
import datetime
import json
import os
import sys

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

IMAGE_FIELDS = ("image_url", "image_url_source", "image_storage_path")
MISSING = "__missing__"


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("catalog_json", nargs="?")
    ap.add_argument("--collection", default=os.environ.get("PRODUCTS_COLLECTION", "products_v2"))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--production", action="store_true")
    ap.add_argument("--rollback", metavar="BACKUP_JSON")
    ap.add_argument("--out", default=os.path.join(BACKEND, "scripts", "out", f"images_{datetime.date.today():%Y%m%d}"))
    args = ap.parse_args()

    from app.firebase_init import init_firebase, using_emulators
    if not using_emulators() and not args.production:
        sys.exit("Refusing: not pointed at the emulator. Add --production to target the real database.")
    if args.production and using_emulators():
        sys.exit("Refusing: --production given but emulator variables are set.")
    if args.collection == "products":
        sys.exit("Refusing: 'products' is the old hand-tagged catalog.")
    init_firebase()
    from firebase_admin import firestore
    db = firestore.client()
    col = db.collection(args.collection)

    if args.rollback:
        saved = json.load(open(args.rollback, encoding="utf-8"))
        col = db.collection(saved["collection"])
        batch, n = db.batch(), 0
        for pid, old in saved["values"].items():
            batch.update(col.document(pid), {f: (firestore.DELETE_FIELD if v == MISSING else v) for f, v in old.items()})
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()
        print(f"restored {n} products")
        return

    if not args.catalog_json:
        sys.exit("catalog_json is required")
    products = json.load(open(args.catalog_json, encoding="utf-8"))["products"]
    wanted = {}
    for p in products:
        if "firebasestorage" in str(p.get("image_url", "")) and p.get("image_storage_path"):
            wanted[p["product_id"]] = {f: p[f] for f in IMAGE_FIELDS if f in p}
    print(f"{len(wanted)} products carry a Firebase image in the file")

    ids = list(wanted)
    current = {}
    for part in chunks(ids, 300):  # one read per document
        for d in db.get_all([col.document(i) for i in part]):
            if d.exists:
                current[d.id] = d.to_dict()
    missing = [i for i in ids if i not in current]
    todo = {i: new for i, new in wanted.items() if i in current and any(current[i].get(f, MISSING) != v for f, v in new.items())}
    print(f"in database: {len(current)}, missing there: {len(missing)}, need an update: {len(todo)}, already done: {len(current) - len(todo)}")
    if missing:
        print("missing ids (skipped):", missing[:10])
    if not args.apply:
        print("DRY RUN: nothing written. Sample:")
        for i in list(todo)[:3]:
            print(" ", i, "\n    old:", current[i].get("image_url"), "\n    new:", todo[i]["image_url"])
        return
    if not todo:
        return
    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, f"backup_{datetime.datetime.now():%Y%m%d_%H%M%S}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"collection": args.collection, "values": {i: {f: current[i].get(f, MISSING) for f in IMAGE_FIELDS} for i in todo}}, fh)
    print("backup saved:", path)
    batch, n = db.batch(), 0
    for pid, fields in todo.items():
        batch.update(col.document(pid), fields)
        n += 1
        if n % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()
    print(f"wrote {n} products")


if __name__ == "__main__":
    main()
