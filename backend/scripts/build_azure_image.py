r"""Build the backend container image locally for Azure Container Apps (docs/AZURE_DEPLOY_PLAN.md, Phase 1).

Reuses stage() from deploy_space.py, so the image gets exactly what the Hugging Face Space gets:
  Dockerfile + README.md + fetch_models.py (backend/space/), requirements.txt, app/ (Python code + filter tables),
  catalog_images/.
Never included: test folders and any image inside app/ (they include personal face photos), __pycache__,
key files, .env files, and model weights (*.pth). FaRL is downloaded by the Dockerfile at build time and the trained
models by fetch_models.py at container startup (HF_MODELS_TOKEN). No secret is read or written by this script.

Pushing is off unless --push is given; log in to the registry yourself first (docker login / az acr login).

Usage (from backend/):
  venv\Scripts\python -m scripts.build_azure_image --images-dir <catalog_images> --dry-run
  venv\Scripts\python -m scripts.build_azure_image --images-dir <catalog_images> [--tag chromascope-api:local]
  venv\Scripts\python -m scripts.build_azure_image --images-dir <catalog_images> --tag <registry>/chromascope-api:<sha> --push
"""
import argparse
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.deploy_space import stage  # noqa: E402


def list_staged(folder: str) -> None:
    images = 0
    for root, _dirs, files in os.walk(folder):
        rel_root = os.path.relpath(root, folder)
        if rel_root == "catalog_images" or rel_root.startswith("catalog_images" + os.sep):
            images += len(files)
            continue
        for f in files:
            print("  ", os.path.normpath(os.path.join(rel_root, f)))
    print(f"   catalog_images/: {images} files")


def image_size(tag: str) -> int:
    out = subprocess.run(["docker", "image", "inspect", "--format", "{{.Size}}", tag],
                         check=True, capture_output=True, text=True)
    return int(out.stdout.strip())


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--images-dir", required=True, help="folder with the catalog product photos")
    ap.add_argument("--tag", default="chromascope-api:local", help="image tag (default: chromascope-api:local)")
    ap.add_argument("--push", action="store_true", help="push the tag after building (registry login needed)")
    ap.add_argument("--keep", action="store_true", help="keep the staged folder for inspection")
    ap.add_argument("--dry-run", action="store_true", help="stage and list files only, build nothing")
    args = ap.parse_args()

    if not os.path.isdir(args.images_dir):
        sys.exit(f"--images-dir not found: {args.images_dir}")
    folder = stage(args.images_dir)
    try:
        if args.dry_run:
            list_staged(folder)
            return
        subprocess.run(["docker", "build", "--platform", "linux/amd64", "-t", args.tag, folder], check=True)
        print(f"built {args.tag}: {image_size(args.tag) / 1e9:.2f} GB")
        if args.push:
            subprocess.run(["docker", "push", args.tag], check=True)
            print(f"pushed {args.tag}")
    finally:
        if args.keep:
            print(f"staged folder kept: {folder}")
        else:
            shutil.rmtree(folder, ignore_errors=True)


if __name__ == "__main__":
    main()
