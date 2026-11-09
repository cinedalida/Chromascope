r"""Deploy the backend to Google Cloud Run in your own Google Cloud / Firebase project (pay with its credit).

What it does, in order (each step is safe to repeat):
  1. enables the Google APIs Cloud Run needs (Cloud Run, Cloud Build, Artifact Registry);
  2. creates a service account for the backend and gives it ONLY the Firestore and Firebase Auth roles it needs;
  3. stages the backend (code, product photos, the two trained models; no keys, no tests, no personal photos) and lets
     Cloud Build build the image from backend/cloudrun/Dockerfile;
  4. deploys it as a Cloud Run service that scales to zero, with a cap on instances so a traffic spike cannot run up a bill.

Usage (from backend/):
  venv\Scripts\python -m scripts.deploy_cloudrun --project chromascope-new --images-dir <catalog_images> [--dry-run]
      [--region us-central1] [--min-instances 0] [--max-instances 3] [--secrets-file <path outside the repo>]

Prerequisites: `gcloud auth login` as someone with Owner/Editor on the project, and billing enabled on it.
"""
import argparse
import os
import secrets
import shutil
import subprocess
import sys
import tempfile

from scripts.deploy_space import ALLOWED_ORIGINS, BACKEND, SKIP_DIRS, SKIP_FILES  # same rules as the Hugging Face deploy

import fnmatch

SERVICE = "chromascope-api"
ACCOUNT_ID = "chromascope-api"
APIS = ["run.googleapis.com", "cloudbuild.googleapis.com", "artifactregistry.googleapis.com"]
ROLES = ["roles/datastore.user", "roles/firebaseauth.admin"]  # Firestore read/write, and deleting a user's login
MODELS = ("final_model.pth", "final_sub_class_model.pth")
WEIGHTS_REL = os.path.join("app", "core", "skin_analysis", "ml", "weights")


def stage(images_dir: str) -> str:
    out = tempfile.mkdtemp(prefix="chromascope-cloudrun-")
    shutil.copy(os.path.join(BACKEND, "cloudrun", "Dockerfile"), out)
    shutil.copy(os.path.join(BACKEND, "requirements.txt"), out)
    for root, dirs, files in os.walk(os.path.join(BACKEND, "app")):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if any(fnmatch.fnmatch(f.lower(), pat.lower()) for pat in SKIP_FILES):
                continue
            dst = os.path.join(out, os.path.relpath(os.path.join(root, f), BACKEND))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(os.path.join(root, f), dst)
    # The two trained models go into the (private) image. The FaRL backbone is downloaded by the Dockerfile instead.
    os.makedirs(os.path.join(out, WEIGHTS_REL), exist_ok=True)
    for name in MODELS:
        src = os.path.join(BACKEND, WEIGHTS_REL, name)
        if not os.path.exists(src):
            sys.exit(f"Missing model file: {src}")
        shutil.copy2(src, os.path.join(out, WEIGHTS_REL, name))
    shutil.copytree(images_dir, os.path.join(out, "catalog_images"))
    # Safety net, like the Hugging Face deploy: no key material, no images outside catalog_images, no big weights.
    for root, _dirs, files in os.walk(out):
        for f in files:
            path = os.path.join(root, f)
            rel = os.path.relpath(path, out)
            if not rel.startswith("catalog_images") and f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")):
                sys.exit(f"Refusing: image outside catalog_images staged: {rel}")
            if f.lower().endswith(".pth") and f not in MODELS:
                sys.exit(f"Refusing: unexpected model weights staged: {rel}")
            if f.endswith((".json", ".txt", ".py")) and "PRIVATE KEY" in open(path, encoding="utf-8", errors="ignore").read():
                sys.exit(f"Refusing: private key material in {rel}")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--project", required=True)
    ap.add_argument("--images-dir", required=True)
    ap.add_argument("--region", default="us-central1", help="next to Firestore (nam5 = US) keeps the backend's database calls fast")
    ap.add_argument("--min-instances", type=int, default=0, help="0 = scales to zero (cheapest, first request after idle is slow); 1 = always warm (about $40/month)")
    ap.add_argument("--max-instances", type=int, default=3, help="a cap on cost: more traffic than this waits instead of spending more")
    ap.add_argument("--secrets-file", default=os.path.abspath(os.path.join(BACKEND, "..", "..", "cloudrun_secrets.txt")))
    ap.add_argument("--dry-run", action="store_true", help="stage and print the commands, change nothing in Google Cloud")
    args = ap.parse_args()

    repo_root = os.path.abspath(os.path.join(BACKEND, ".."))
    if os.path.abspath(args.secrets_file).startswith(repo_root + os.sep):
        sys.exit("Refusing: keep the secrets file outside the repository.")
    gcloud = shutil.which("gcloud") or shutil.which("gcloud.cmd")
    if not gcloud:
        sys.exit("gcloud not found. Install the Google Cloud CLI and run `gcloud auth login`.")

    kept = {}
    if os.path.exists(args.secrets_file):
        kept = dict(line.strip().split("=", 1) for line in open(args.secrets_file, encoding="utf-8") if "=" in line)
    for name in ("ANALYSIS_RESULT_SECRET", "CRON_SECRET"):
        kept.setdefault(name, secrets.token_urlsafe(32))
    sa = f"{ACCOUNT_ID}@{args.project}.iam.gserviceaccount.com"

    def run(*cmd, check=True):
        shown = " ".join(cmd)
        print(f"$ gcloud {shown}")
        if args.dry_run:
            return None
        result = subprocess.run([gcloud, *cmd], text=True)
        if check and result.returncode != 0:
            sys.exit(f"gcloud failed ({result.returncode}): {shown}")
        return result

    folder = stage(args.images_dir)
    print(f"staged in {folder}")
    try:
        run("services", "enable", *APIS, "--project", args.project)
        exists = run("iam", "service-accounts", "describe", sa, "--project", args.project, check=False)
        if args.dry_run or (exists and exists.returncode != 0):
            run("iam", "service-accounts", "create", ACCOUNT_ID, "--project", args.project, "--display-name", "Chromascope backend")
        for role in ROLES:
            run("projects", "add-iam-policy-binding", args.project, "--member", f"serviceAccount:{sa}", "--role", role, "--condition=None", "--quiet")
        if not args.dry_run:
            with open(args.secrets_file, "w", encoding="utf-8") as fh:
                fh.writelines(f"{k}={v}\n" for k, v in kept.items())
        env_vars = {
            "ALLOWED_ORIGINS": ALLOWED_ORIGINS, "PRODUCTS_COLLECTION": "products_v2", "PRODUCTS_CACHE_SECONDS": "21600",
            "ANALYSIS_RESULT_SECRET": kept["ANALYSIS_RESULT_SECRET"], "CRON_SECRET": kept["CRON_SECRET"],
        }
        # "^@^" makes @ the separator, because ALLOWED_ORIGINS itself contains commas.
        env_arg = "^@^" + "@".join(f"{k}={v}" for k, v in env_vars.items())
        run("run", "deploy", SERVICE, "--source", folder, "--project", args.project, "--region", args.region,
            "--service-account", sa, "--allow-unauthenticated", "--cpu", "2", "--memory", "4Gi", "--cpu-boost",
            "--concurrency", "8", "--timeout", "300", "--min-instances", str(args.min_instances),
            "--max-instances", str(args.max_instances), "--set-env-vars", env_arg, "--quiet")
        if not args.dry_run:
            url = subprocess.run([gcloud, "run", "services", "describe", SERVICE, "--project", args.project, "--region", args.region,
                                  "--format", "value(status.url)"], text=True, capture_output=True).stdout.strip()
            print(f"\nDeployed. Service URL: {url}\nSet VITE_API_URL={url}/api in the Vercel project, then redeploy the frontend.")
    finally:
        shutil.rmtree(folder, ignore_errors=True)


if __name__ == "__main__":
    main()
