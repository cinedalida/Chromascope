"""Writes frontend/src/utils/arFit.fixtures.json: reference values from the backend for the JS port in arFit.js.

The unit test (frontend/src/utils/arFit.test.js) checks that the browser code gives the backend's numbers for CIEDE2000
and for the skin-region fit. Seeded, so the file only changes when the backend maths does.

    python backend/scripts/gen_arfit_fixtures.py
"""
import json
import math
import os
import random
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

from app.core import color_matching as cm  # noqa: E402
from app.core import season_classifier as sc  # noqa: E402

OUT = os.path.join(os.path.dirname(BACKEND), "frontend", "src", "utils", "arFit.fixtures.json")


def rand_lab(rng):
    return [round(rng.uniform(10, 95), 2), round(rng.uniform(-10, 45), 2), round(rng.uniform(-15, 45), 2)]


def main():
    rng = random.Random(20261108)
    pairs = [{"a": a, "b": b, "dE": cm.delta_e_ciede2000(tuple(a), tuple(b))}
             for a, b in ((rand_lab(rng), rand_lab(rng)) for _ in range(150))]
    # Edge cases: identical colors, greys (zero chroma), hue wrap-around.
    for a, b in (([50, 0, 0], [50, 0, 0]), ([50, 0, 0], [60, 0, 0]), ([50, 40, 1], [50, 40, -1]), ([50, -30, 2], [50, -30, -2])):
        pairs.append({"a": a, "b": b, "dE": cm.delta_e_ciede2000(tuple(a), tuple(b))})

    skin_regions = list(sc.SKIN_TARGET_L_SHIFT)
    skin = []
    for _ in range(150):
        region = rng.choice(skin_regions)
        user, shade = rand_lab(rng), rand_lab(rng)
        # Same maths as color_matching._score_skin for a single shade.
        item = {"shades": [{"shade_id": "x", "name": "x", "lab": shade, "hex": "#808080"}]}
        cm._score_skin(item, tuple(user), region)
        skin.append({"region": region, "user_lab": user, "shade_lab": shade, "fit": item["fit_score"], "tier": item["fit_tier"]})

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"season_order": list(sc.SEASON_PROFILES), "pairs": pairs, "skin": skin}, fh, separators=(",", ":"))
    print("wrote", OUT, len(pairs), "pairs,", len(skin), "skin cases")


if __name__ == "__main__":
    main()
