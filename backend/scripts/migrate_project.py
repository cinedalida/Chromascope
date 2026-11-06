r"""Copy Chromascope from the old Firebase project to a new one (PLAN_MIGRATION.md, Phases 1 and 2).

Reads the OLD project, writes only to the NEW one. Default is a PREVIEW (counts only); writes need --apply.
  Firestore: every top-level collection and all sub-collections, documents copied as-is (document references are
             re-pointed at the new project). Then every document is compared old vs new (fingerprints).
  Auth (--auth): every account with its password hash, same user ID; Google sign-ins keep their Google link.
             Needs the old project's "Password hash parameters" (Authentication > Users > ... menu) in a text file.

Usage (from backend/):
  venv\Scripts\python -m scripts.migrate_project --from OLD_KEY.json --to NEW_KEY.json                (preview)
  venv\Scripts\python -m scripts.migrate_project --from OLD_KEY.json --to NEW_KEY.json --apply        (copy Firestore)
  venv\Scripts\python -m scripts.migrate_project --from ... --to ... --auth --hash-params FILE --apply (copy logins)
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
import re
import sys

import firebase_admin
from firebase_admin import auth, credentials, firestore
from google.cloud.firestore_v1 import DocumentReference
from google.cloud.firestore_v1._helpers import GeoPoint


def open_app(key_file: str, name: str):
    if os.environ.get("FIRESTORE_EMULATOR_HOST") or os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"):
        sys.exit("Refusing: emulator variables are set; this script is for real projects only.")
    return firebase_admin.initialize_app(credentials.Certificate(key_file), name=name)


# ---------- Firestore ----------

def convert(value, new_db):
    """Values to write into the new project: document references must point at the new database."""
    if isinstance(value, DocumentReference):
        return new_db.document(value.path)
    if isinstance(value, dict):
        return {k: convert(v, new_db) for k, v in value.items()}
    if isinstance(value, list):
        return [convert(v, new_db) for v in value]
    return value


def canonical(value):
    """Project-independent form of a value, for the old-vs-new comparison."""
    if isinstance(value, DocumentReference):
        return {"$ref": value.path}
    if isinstance(value, datetime.datetime):
        return {"$time": value.astimezone(datetime.timezone.utc).isoformat()}
    if isinstance(value, GeoPoint):
        return {"$geo": [value.latitude, value.longitude]}
    if isinstance(value, bytes):
        return {"$bytes": base64.b64encode(value).decode()}
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    return value


def fingerprint(data: dict) -> str:
    return hashlib.sha256(json.dumps(canonical(data), sort_keys=True, default=str).encode()).hexdigest()


def walk(parent):
    """Yield (path, data) for every document under a client or document, including sub-collections."""
    for coll in parent.collections():
        for snap in coll.stream():
            yield snap.reference.path, snap.to_dict() or {}
            yield from walk(snap.reference)


def copy_firestore(old_db, new_db, apply: bool):
    docs = dict(walk(old_db))
    per_coll = {}
    for path in docs:
        top = path.split("/")[0]
        per_coll[top] = per_coll.get(top, 0) + 1
    existing = dict(walk(new_db))
    clash = sorted(set(docs) & set(existing))
    print(f"Firestore: {len(docs)} documents in the old project {per_coll}")
    print(f"  new project already has {len(existing)} documents ({len(clash)} with the same path)")
    if clash and apply:
        sys.exit("Refusing: the new project already has some of these documents. Nothing written.")
    if not apply:
        return
    batch, n = new_db.batch(), 0
    for path, data in docs.items():
        batch.set(new_db.document(path), convert(data, new_db))
        n += 1
        if n % 400 == 0:
            batch.commit()
            batch = new_db.batch()
    batch.commit()
    print(f"  written: {n}")
    copied = dict(walk(new_db))
    missing = [p for p in docs if p not in copied]
    different = [p for p in docs if p in copied and fingerprint(docs[p]) != fingerprint(copied[p])]
    new_counts = {}
    for path in copied:
        new_counts[path.split("/")[0]] = new_counts.get(path.split("/")[0], 0) + 1
    print(f"  CHECK new project counts {new_counts}")
    print(f"  CHECK missing: {len(missing)} | different: {len(different)} | identical: {len(docs) - len(missing) - len(different)}")
    if missing or different:
        print("  first problems:", (missing + different)[:10])
        sys.exit(1)


# ---------- Auth ----------

def read_hash_params(path: str) -> dict:
    text = open(path, encoding="utf-8").read()
    def field(name):
        m = re.search(rf"{name}\s*:\s*([^,\s}}]+)", text)
        if not m:
            sys.exit(f"Missing {name} in {path}")
        return m.group(1)
    if field("algorithm").upper() != "SCRYPT":
        sys.exit("Only Firebase SCRYPT hash parameters are supported.")
    return {"key": base64.b64decode(field("base64_signer_key")), "salt_separator": base64.b64decode(field("base64_salt_separator")),
            "rounds": int(field("rounds")), "memory_cost": int(field("mem_cost"))}


def b64any(s: str) -> bytes:
    """Firebase exports hashes/salts as URL-safe base64; accept either alphabet and missing padding."""
    s = s.replace("-", "+").replace("_", "/")
    return base64.b64decode(s + "=" * (-len(s) % 4))


def to_import_record(u):
    providers = [auth.UserProvider(uid=p.uid, provider_id=p.provider_id, email=p.email, display_name=p.display_name,
                                   photo_url=p.photo_url)
                 for p in u.provider_data if p.provider_id != "password"]
    meta = auth.UserMetadata(creation_timestamp=u.user_metadata.creation_timestamp,
                             last_sign_in_timestamp=u.user_metadata.last_sign_in_timestamp)
    return auth.ImportUserRecord(
        uid=u.uid, email=u.email, email_verified=u.email_verified, display_name=u.display_name,
        photo_url=u.photo_url, phone_number=u.phone_number, disabled=u.disabled, user_metadata=meta,
        provider_data=providers or None, custom_claims=u.custom_claims or None,
        password_hash=b64any(u.password_hash) if u.password_hash else None,
        password_salt=b64any(u.password_salt) if u.password_salt else None)


def copy_auth(old_app, new_app, hash_file: str, apply: bool):
    users = list(auth.list_users(app=old_app).iterate_all())
    already = {u.uid for u in auth.list_users(app=new_app).iterate_all()}
    with_pw = sum(1 for u in users if u.password_hash)
    print(f"Auth: {len(users)} accounts in the old project ({with_pw} with a password); new project already has {len(already)}")
    if not apply:
        return
    if not hash_file:
        sys.exit("--hash-params is required to copy passwords.")
    p = read_hash_params(hash_file)
    hash_alg = auth.UserImportHash.scrypt(key=p["key"], salt_separator=p["salt_separator"], rounds=p["rounds"],
                                          memory_cost=p["memory_cost"])
    todo = [u for u in users if u.uid not in already]
    for i in range(0, len(todo), 1000):
        result = auth.import_users([to_import_record(u) for u in todo[i:i + 1000]], hash_alg=hash_alg, app=new_app)
        print(f"  imported: {result.success_count}, failed: {result.failure_count}")
        for err in result.errors:
            print(f"    account #{i + err.index}: {err.reason}")
    new_uids = {u.uid for u in auth.list_users(app=new_app).iterate_all()}
    missing = [u.uid for u in users if u.uid not in new_uids]
    print(f"  CHECK new project accounts: {len(new_uids)} | old accounts missing in new: {len(missing)}")
    if missing:
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--from", dest="src", required=True, help="OLD project's service-account key file")
    ap.add_argument("--to", dest="dst", required=True, help="NEW project's service-account key file")
    ap.add_argument("--apply", action="store_true", help="write to the new project (default: preview)")
    ap.add_argument("--auth", action="store_true", help="copy login accounts instead of Firestore")
    ap.add_argument("--hash-params", default="", help="text file with the old project's password hash parameters")
    args = ap.parse_args()

    old_app, new_app = open_app(args.src, "old"), open_app(args.dst, "new")
    if old_app.project_id == new_app.project_id:
        sys.exit("Refusing: --from and --to are the same project.")
    print(f"From (read only): {old_app.project_id}  ->  To: {new_app.project_id}  | {'APPLY' if args.apply else 'PREVIEW'}")
    if args.auth:
        copy_auth(old_app, new_app, args.hash_params, args.apply)
    else:
        copy_firestore(firestore.client(old_app), firestore.client(new_app), args.apply)


if __name__ == "__main__":
    main()
