"""Contact sheet for AR QA output.

    python scripts/ar-qa/sheet.py <outDir>/<label> <photoFolderName> <look> [<look> ...] [--cols N] [--save file.png] [--crop x0,y0,x1,y1]

Lays out the named renders (bare, solo_lips, stack_full_face, ...) for one photo in a grid, labelled, so a run can be
reviewed at a glance. Use `--photos` instead of a photo folder to compare one look across several photos:

    python scripts/ar-qa/sheet.py <outDir>/<label> --photos stack_full_face --save sheet.png
"""
import os
import sys

from PIL import Image, ImageDraw

args = sys.argv[1:]
cols, save = 6, "sheet.png"
if "--cols" in args:
    i = args.index("--cols"); cols = int(args[i + 1]); del args[i:i + 2]
if "--save" in args:
    i = args.index("--save"); save = args[i + 1]; del args[i:i + 2]
crop = None
if "--crop" in args:  # fractions of the image: x0,y0,x1,y1 (e.g. 0.12,0.05,0.88,0.72 for the face)
    i = args.index("--crop"); crop = [float(v) for v in args[i + 1].split(",")]; del args[i:i + 2]
by_photo = "--photos" in args
if by_photo:
    args.remove("--photos")
root, rest = args[0], args[1:]

if by_photo:
    look = rest[0]
    items = [(p, os.path.join(root, p, look + ".png")) for p in sorted(os.listdir(root)) if os.path.isdir(os.path.join(root, p))]
else:
    photo, looks = rest[0], rest[1:]
    items = [(l, os.path.join(root, photo, l + ".png")) for l in looks]
items = [(n, p) for n, p in items if os.path.exists(p)]

W = 300
tiles = []
for name, path in items:
    im = Image.open(path).convert("RGB")
    if crop:
        w0, h0 = im.size
        im = im.crop((int(crop[0] * w0), int(crop[1] * h0), int(crop[2] * w0), int(crop[3] * h0)))
    h = int(im.height * W / im.width)
    tiles.append((name, im.resize((W, h), Image.LANCZOS)))
H = max(t.height for _, t in tiles)
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * (H + 14)), "white")
d = ImageDraw.Draw(sheet)
for i, (name, t) in enumerate(tiles):
    x, y = (i % cols) * W, (i // cols) * (H + 14)
    sheet.paste(t, (x, y + 14))
    d.text((x + 3, y + 1), name[:48], fill="black")
sheet.save(save)
print(save, len(tiles), "tiles")
