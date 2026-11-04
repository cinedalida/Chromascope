r"""Remove face data (season, skin LAB colour, confidence) of users inactive for 30+ days (decision D2, Phase A12).

Same logic as the daily endpoint /internal/retention/purge-face-data (app/core/retention.py). Default is a PREVIEW;
add --apply to write. Production needs backend/serviceAccountKey.json; the emulator needs FIRESTORE_EMULATOR_HOST.
    venv\Scripts\python -m scripts.purge_inactive_face_data [--apply]
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.firebase_init import init_firebase, using_emulators  # noqa: E402

ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
ap.add_argument("--apply", action="store_true", help="actually delete (default: preview only)")
args = ap.parse_args()
init_firebase()
from firebase_admin import firestore  # noqa: E402
from app.core.retention import INACTIVE_DAYS, purge_inactive_face_data  # noqa: E402

target = f"EMULATOR ({os.environ.get('GCLOUD_PROJECT')})" if using_emulators() else "REAL DATABASE"
print(f"Target: {target} | {'APPLY' if args.apply else 'PREVIEW (nothing is written)'} | inactive >= {INACTIVE_DAYS} days")
print(purge_inactive_face_data(firestore.client(), apply=args.apply))
