"""Face-cropped comparison grid: one row per photo, one column per look.

    python scripts/ar-qa/grid.py <outDir>/<label> <save.png> <photo>[,<photo>...] <look>[,<look>...] [--tile 230]

Each tile is cropped around that photo's own detected face (from landmarks.json), so faces fill the tile whatever the photo.
Photo names are matched by prefix.
"""
import json
import os
import sys

from PIL import Image, ImageDraw

root, save, photos, looks = sys.argv[1:5]
tile = int(sys.argv[sys.argv.index("--tile") + 1]) if "--tile" in sys.argv else 230
dirs = sorted(d for d in os.listdir(root) if os.path.isfile(os.path.join(root, d, "landmarks.json")))
rows = []
for want in photos.split(","):
    match = next((d for d in dirs if d.startswith(want)), None)
    if match:
        rows.append(match)
look_list = looks.split(",")
sheet = Image.new("RGB", (len(look_list) * tile, len(rows) * (tile + 12)), "white")
d = ImageDraw.Draw(sheet)
for r, photo in enumerate(rows):
    lm = json.load(open(os.path.join(root, photo, "landmarks.json")))
    pts = lm["points"]
    xs = [pts[i][0] for i in (234, 454)]
    ys = [pts[i][1] for i in (10, 152)]
    cx, cy = sum(xs) / 2, sum(ys) / 2
    half = max(max(xs) - min(xs), max(ys) - min(ys)) * 0.62
    for c, look in enumerate(look_list):
        path = os.path.join(root, photo, look + ".png")
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGB")
        k = im.width / lm["w"]
        box = tuple(int(v * k) for v in (cx - half, cy - half, cx + half, cy + half))
        sheet.paste(im.crop(box).resize((tile, tile), Image.LANCZOS), (c * tile, r * (tile + 12) + 12))
        if r == 0:
            d.text((c * tile + 3, 0), look, fill="black")
    d.text((3, r * (tile + 12)), photo[:30], fill="black")
sheet.save(save)
print(save, len(rows), "rows x", len(look_list), "cols")
