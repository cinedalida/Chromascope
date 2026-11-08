"""Adds season scores to the AR Browse shade catalogs so the try-on can rank them for the signed-in user.

Browse shades are a static file (frontend/public/data/ar-shades-<region>.json), so the server never scores them per user.
For the "harmony" regions (lips, lip liner, blush, eyeshadow) this script writes `ss` on every shade: the season
classifier's score (0..100, integer) for each of the 12 seasons, in `SEASON_ORDER`. The app picks the entry for the
user's season. Skin regions (foundation, bronzer, ...) need no scores: they are ranked on the device by colour
distance to the user's skin tone, the same way color_matching.py does it.

Uses season_classifier.season_scores, so there is exactly one definition of "fits this season". Re-run it after
rebuilding the catalogs or after changing the classifier (PROFILE_VERSION / season_norms.json). Idempotent. Needs no
database and no network.

    python backend/scripts/add_shade_season_scores.py            # rewrite the files
    python backend/scripts/add_shade_season_scores.py --check    # exit 1 if any file is out of date (for CI)
"""
import argparse
import json
import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

from app.core import season_classifier as sc  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(BACKEND), "frontend", "public", "data")
# The order of `ss`. frontend/src/utils/arFit.js must list the same codes in the same order.
SEASON_ORDER = list(sc.SEASON_PROFILES)


def scores_for(entry, region, norms):
    lab = sc.shade_lab(entry)
    if not lab:
        return None  # no usable colour (placeholder white or missing)
    scores = sc.season_scores(lab, region, norms)
    return [int(round(scores[code] * 100)) for code in SEASON_ORDER]


def process(region, norms):
    path = os.path.join(DATA_DIR, f"ar-shades-{region}.json")
    with open(path, encoding="utf-8") as fh:
        shades = json.load(fh)
    scored = 0
    for entry in shades:
        ss = scores_for(entry, region, norms)
        if ss is None:
            entry.pop("ss", None)
        else:
            entry["ss"] = ss
            scored += 1
    text = json.dumps(shades, ensure_ascii=False, separators=(",", ":"))
    return path, text, scored, len(shades)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="do not write; exit 1 if a file is out of date")
    args = ap.parse_args()

    norms = sc.get_norms()
    stale = False
    for region in sc.HARMONY_REGIONS:
        path, text, scored, total = process(region, norms)
        with open(path, encoding="utf-8") as fh:
            current = fh.read()
        if current == text:
            print(f"{region}: up to date ({scored}/{total} shades scored)")
            continue
        stale = True
        if args.check:
            print(f"{region}: OUT OF DATE")
            continue
        with open(path, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        print(f"{region}: wrote {scored}/{total} shades scored")
    print("season order:", ",".join(SEASON_ORDER))
    if args.check and stale:
        sys.exit(1)


if __name__ == "__main__":
    main()
