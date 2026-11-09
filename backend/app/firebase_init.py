"""One place that initializes Firebase Admin for the backend.

Production: uses the service-account key file (serviceAccountKey.json in backend/, git-ignored).
Local tests: if FIRESTORE_EMULATOR_HOST or FIREBASE_AUTH_EMULATOR_HOST is set, connects to the Firebase Emulator
Suite with no key at all. The project ID must start with "demo-" so a test can never reach a real project.
"""
import os

import firebase_admin
from firebase_admin import credentials

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class _EmulatorCredential(credentials.Base):
    """The emulators accept any credential; this avoids looking up Google login credentials on the machine."""

    def get_credential(self):
        from google.auth.credentials import AnonymousCredentials
        return AnonymousCredentials()


def using_emulators() -> bool:
    return bool(os.environ.get("FIRESTORE_EMULATOR_HOST") or os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"))


def init_firebase(key_filename: str = "serviceAccountKey.json"):
    if firebase_admin._apps:
        return firebase_admin.get_app()
    if using_emulators():
        project_id = os.environ.get("GCLOUD_PROJECT", "demo-chromascope")
        if not project_id.startswith("demo-"):
            raise RuntimeError(f"Emulator mode needs a demo- project ID, got {project_id!r}")
        return firebase_admin.initialize_app(_EmulatorCredential(), options={
            "projectId": project_id, "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", f"{project_id}.appspot.com")})
    # FIREBASE_KEY_JSON: the key's contents in a hosting secret (Hugging Face Space); FIREBASE_KEY_FILE: a path outside
    # the repo (never copy the key into git-tracked folders).
    key_json = os.environ.get("FIREBASE_KEY_JSON", "").strip()
    key_file = os.environ.get("FIREBASE_KEY_FILE") or os.path.join(BACKEND_DIR, key_filename)
    if key_json:
        import json
        cred = credentials.Certificate(json.loads(key_json))
    elif os.path.exists(key_file):
        cred = credentials.Certificate(key_file)
    elif os.environ.get("K_SERVICE"):
        # Google Cloud Run: the service's own identity (its service account), so no key file exists anywhere.
        cred = credentials.ApplicationDefault()
    else:
        cred = credentials.Certificate(key_file)  # raises a clear "file not found" error, as before
    return firebase_admin.initialize_app(cred, options={
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "chromascope-new.firebasestorage.app")})
