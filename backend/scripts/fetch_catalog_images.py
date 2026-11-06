r"""Download each catalog product photo once, into the PRIVATE data repo (PLAN_CATALOG.md, Phase 2: images).

Sephora's image server refuses browsers embedding its photos on other sites (403), so the app serves its own copy
(uploaded by import_catalog.py --images-dir). A plain server-side download works. Adviser OK on showing retailer photos.
Files go to <data dir>/derived/catalog_images/<product_id>.<ext>; already-downloaded files are skipped.

Usage (from backend/): venv\Scripts\python -m scripts.fetch_catalog_images "C:\...\chromascope-data"
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif"}
JPEG_SIG = bytes([0xFF, 0xD8, 0xFF])
PNG_SIG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])


def sniff(data: bytes):
    """Image type from the file's own first bytes (some servers label images 'binary/octet-stream')."""
    if data[:3] == JPEG_SIG:
        return "image/jpeg"
    if data[:8] == PNG_SIG:
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[4:12] in (b"ftypavif", b"ftypavis"):
        return "image/avif"
    return None


def fetch(product, out_dir):
    pid, url = product["product_id"], product.get("image_url", "")
    if any(os.path.exists(os.path.join(out_dir, f"{pid}.{e}")) for e in set(EXT.values())):
        return pid, "cached"
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=30) as r:
            ctype = r.headers.get("Content-Type", "").split(";")[0].strip().lower()
            data = r.read()
        if ctype not in EXT:
            ctype = sniff(data) or ctype
        if ctype not in EXT or not data:
            return pid, f"not an image ({ctype or 'no type'})"
        with open(os.path.join(out_dir, f"{pid}.{EXT[ctype]}"), "wb") as fh:
            fh.write(data)
        return pid, "downloaded"
    except Exception as e:  # noqa: BLE001
        return pid, f"failed ({type(e).__name__} {getattr(e, 'code', '')})".strip()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    data_dir = sys.argv[1]
    products = json.load(open(os.path.join(data_dir, "derived", "app_catalog.json"), encoding="utf-8"))["products"]
    out_dir = os.path.join(data_dir, "derived", "catalog_images")
    os.makedirs(out_dir, exist_ok=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda p: fetch(p, out_dir), products))
    status = {}
    for _pid, s in results:
        key = s.split(" (")[0]
        status[key] = status.get(key, 0) + 1
    print(f"{len(products)} products -> {status}")
    for pid, s in results:
        if s not in ("cached", "downloaded"):
            print(f"  {pid}: {s}")
    size = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
    print(f"folder: {out_dir} ({len(os.listdir(out_dir))} files, {size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
