"""Download the trained color-analysis models from the private Hugging Face model repo at Space startup.

The models are not uploaded to the public Space (they are trained on Deep Armocromia, research use only), so visitors
cannot browse them. HF_MODELS_TOKEN is a hidden Space secret: a fine-grained token with read access to that repo only.
It is read at runtime, never at build time, so it does not end up in an image layer. Standard library only.
"""
import os
import sys
import urllib.error
import urllib.request

REPO = os.environ.get("HF_MODELS_REPO", "cinedalida26/chromascope-models")
FILES = ("final_model.pth", "final_sub_class_model.pth")
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "core", "skin_analysis", "ml", "weights")


def main():
    token = os.environ.get("HF_MODELS_TOKEN", "").strip()
    if not token:
        sys.exit("fetch_models: HF_MODELS_TOKEN is not set. Add it as a Space secret.")
    os.makedirs(DEST, exist_ok=True)
    for name in FILES:
        path = os.path.join(DEST, name)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue
        req = urllib.request.Request(f"https://huggingface.co/{REPO}/resolve/main/{name}",
                                     headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp, open(path + ".part", "wb") as fh:
                while chunk := resp.read(1 << 20):
                    fh.write(chunk)
        except urllib.error.HTTPError as err:
            sys.exit(f"fetch_models: {name} download failed with HTTP {err.code}. Check HF_MODELS_TOKEN and its repo access.")
        os.replace(path + ".part", path)
        print(f"fetch_models: {name} {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
