"""Remove leftover fields from older app versions in users/{uid} (PLAN_OPTIMIZATION.md, Phase A7: minimal data).

Fields removed: ai_model_consent (AI-training opt-in, removed from the app), avoidIngredients (old spelling of
avoid_ingredients), dob and melanin_tier (never used by the app).
Safety: allergy choices found in the old avoidIngredients field are first merged into avoid_ingredients, so no
declared allergy is lost.

Default is a PREVIEW: nothing is written. Add --apply to make the changes.
    Production (needs backend/serviceAccountKey.json):   venv\\Scripts\\python -m scripts.cleanup_legacy_fields
    Emulator test (FIRESTORE_EMULATOR_HOST etc. set):     venv\\Scripts\\python -m scripts.cleanup_legacy_fields
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.firebase_init import init_firebase, using_emulators  # noqa: E402

LEGACY = ["ai_model_consent", "avoidIngredients", "dob", "melanin_tier"]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apply", action="store_true", help="actually write the changes (default: preview only)")
    args = ap.parse_args()

    init_firebase()
    from firebase_admin import firestore
    db = firestore.client()
    target = f"EMULATOR ({os.environ.get('GCLOUD_PROJECT')})" if using_emulators() else "REAL DATABASE"
    print(f"Target: {target} | mode: {'APPLY' if args.apply else 'PREVIEW (nothing is written)'}\n")

    counts = {f: 0 for f in LEGACY}
    migrate = 0
    touched = 0
    for snap in db.collection("users").stream():
        d = snap.to_dict() or {}
        present = [f for f in LEGACY if f in d]
        if not present:
            continue
        touched += 1
        for f in present:
            counts[f] += 1
        update = {f: firestore.DELETE_FIELD for f in present}
        # Keep every declared allergy: merge the old list into the current one (no duplicates, order kept).
        old_avoid = d.get("avoidIngredients") or []
        current = d.get("avoid_ingredients") or []
        merged = list(dict.fromkeys([*current, *old_avoid]))
        if merged != current:
            update["avoid_ingredients"] = merged
            migrate += 1
        if args.apply:
            snap.reference.update(update)

    print(f"Accounts with leftover fields: {touched}")
    for f, n in counts.items():
        print(f"  {f:18s} present in {n} account(s)")
    print(f"  allergy choices merged from avoidIngredients into avoid_ingredients: {migrate} account(s)")
    print("\nDone." if args.apply else "\nPreview only. Re-run with --apply to make these changes.")


if __name__ == "__main__":
    main()
