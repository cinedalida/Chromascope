r"""Deploy the backend to a Hugging Face Space (PLAN_MIGRATION.md, Phase 4; free hosting, no card).

Stages ONLY what the server needs into a temporary folder and uploads it:
  Dockerfile + README.md + fetch_models.py (backend/space/), requirements.txt, app/ (Python code + filter tables),
  catalog_images/.
Never uploaded: test folders and any image inside app/ (they include personal face photos), __pycache__,
key files, .env files, and model weights (*.pth). The Space downloads FaRL from its official release at build time
and the trained models from the private model repo at startup (space/fetch_models.py).

Secrets (--set-secrets) are stored as hidden Space secrets, never in files:
  FIREBASE_KEY_JSON (contents of --key-file), ANALYSIS_RESULT_SECRET and CRON_SECRET (random, generated once and saved
  in --secrets-file so the GitHub Actions retention job can use CRON_SECRET), and HF_MODELS_TOKEN (contents of
  --models-token-file: a fine-grained read token for the private model repo).

Usage (from backend/):
  venv\Scripts\python -m scripts.deploy_space --token-file ..\..\hf_token.txt --images-dir <catalog_images>
      [--key-file <new key.json> --set-secrets --secrets-file ..\..\space_secrets.txt
       --models-token-file ..\..\hf_models_read_token.txt] [--dry-run]
"""
import argparse
import fnmatch
import os
import secrets
import shutil
import sys
import tempfile

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKIP_DIRS = {"__pycache__", "test", "tests", "test_images", "test_output"}
SKIP_FILES = ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.gif", "*.heic", "*.bmp", "*.env", ".env*", "*serviceAccount*",
              "*adminsdk*", "*.pyc", "desktop.ini", "*.pth", "*.pt"]
ALLOWED_ORIGINS = "https://chromascope-app.vercel.app,http://localhost:5173,http://127.0.0.1:5173"


def stage(images_dir: str) -> str:
    out = tempfile.mkdtemp(prefix="chromascope-space-")
    for f in ("Dockerfile", "README.md", "fetch_models.py"):
        shutil.copy(os.path.join(BACKEND, "space", f), out)
    shutil.copy(os.path.join(BACKEND, "requirements.txt"), out)
    skipped = []
    for root, dirs, files in os.walk(os.path.join(BACKEND, "app")):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS or skipped.append(os.path.join(root, d))]
        for f in files:
            src = os.path.join(root, f)
            if any(fnmatch.fnmatch(f.lower(), pat.lower()) for pat in SKIP_FILES):
                skipped.append(src)
                continue
            dst = os.path.join(out, os.path.relpath(src, BACKEND))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
    shutil.copytree(images_dir, os.path.join(out, "catalog_images"))
    # Safety net: no key material, no model weights, and no images outside catalog_images may be staged.
    for root, _dirs, files in os.walk(out):
        for f in files:
            path = os.path.join(root, f)
            rel = os.path.relpath(path, out)
            if not rel.startswith("catalog_images") and f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")):
                sys.exit(f"Refusing: image outside catalog_images staged: {rel}")
            if f.lower().endswith(".pth"):
                sys.exit(f"Refusing: model weights staged: {rel}")
            if f.endswith((".json", ".txt", ".py")) and "PRIVATE KEY" in open(path, encoding="utf-8", errors="ignore").read():
                sys.exit(f"Refusing: private key material in {rel}")
    print(f"staged {sum(len(f) for _, _, f in os.walk(out))} files in {out}; skipped {len(skipped)} test/image/cache items")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--token-file", required=True)
    ap.add_argument("--repo", default="", help="user/space-name (default: <your user>/chromascope-api)")
    ap.add_argument("--images-dir", required=True)
    ap.add_argument("--key-file", default="", help="NEW project's service-account key (for --set-secrets)")
    ap.add_argument("--set-secrets", action="store_true")
    ap.add_argument("--secrets-file", default="", help="where the generated ANALYSIS_RESULT_SECRET / CRON_SECRET are kept")
    ap.add_argument("--models-token-file", default="", help="read token for the private model repo (for --set-secrets)")
    ap.add_argument("--dry-run", action="store_true", help="stage and list only, upload nothing")
    args = ap.parse_args()

    from huggingface_hub import HfApi
    api = HfApi(token=open(args.token_file, encoding="utf-8").read().strip())
    repo = args.repo or f"{api.whoami()['name']}/chromascope-api"
    folder = stage(args.images_dir)
    if args.dry_run:
        for root, _d, files in os.walk(folder):
            if "catalog_images" not in root:
                for f in files:
                    print("  ", os.path.relpath(os.path.join(root, f), folder))
        return

    api.create_repo(repo, repo_type="space", space_sdk="docker", private=False, exist_ok=True)
    if args.set_secrets:
        if not (args.key_file and args.secrets_file and args.models_token_file):
            sys.exit("--set-secrets needs --key-file, --secrets-file and --models-token-file")
        kept = {}
        if os.path.exists(args.secrets_file):
            kept = dict(line.strip().split("=", 1) for line in open(args.secrets_file, encoding="utf-8") if "=" in line)
        for name in ("ANALYSIS_RESULT_SECRET", "CRON_SECRET"):
            kept.setdefault(name, secrets.token_urlsafe(32))
        with open(args.secrets_file, "w", encoding="utf-8") as fh:
            fh.writelines(f"{k}={v}\n" for k, v in kept.items())
        api.add_space_secret(repo, "FIREBASE_KEY_JSON", open(args.key_file, encoding="utf-8").read())
        api.add_space_secret(repo, "HF_MODELS_TOKEN", open(args.models_token_file, encoding="utf-8").read().strip())
        for name, value in kept.items():
            api.add_space_secret(repo, name, value)
        api.add_space_variable(repo, "ALLOWED_ORIGINS", ALLOWED_ORIGINS)
        api.add_space_variable(repo, "PRODUCTS_COLLECTION", "products_v2")
        # The server keeps the catalog in memory this long before re-reading it from Firestore (about 1,000 reads each
        # time). 6 hours keeps an always-busy server well inside the free plan's daily reads; a restart reloads it at once.
        api.add_space_variable(repo, "PRODUCTS_CACHE_SECONDS", "21600")
        print("secrets set: FIREBASE_KEY_JSON, HF_MODELS_TOKEN, ANALYSIS_RESULT_SECRET, CRON_SECRET; variables: ALLOWED_ORIGINS, PRODUCTS_COLLECTION, PRODUCTS_CACHE_SECONDS")
    api.upload_folder(repo_id=repo, repo_type="space", folder_path=folder, commit_message="Deploy Chromascope backend",
                      delete_patterns=["app/**", "catalog_images/**", "fetch_models.py"])
    shutil.rmtree(folder, ignore_errors=True)
    print(f"uploaded. Space: https://huggingface.co/spaces/{repo}  API: https://{repo.replace('/', '-').lower()}.hf.space")


if __name__ == "__main__":
    main()
