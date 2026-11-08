"""The AR Browse catalogs carry season scores (`ss`) computed by the season classifier. If the classifier, its norms or a
catalog changes without re-running scripts/add_shade_season_scores.py, Browse would rank on stale numbers."""
import json
import os
import sys
import unittest

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BACKEND, "scripts"))

import add_shade_season_scores as mod  # noqa: E402
from app.core import season_classifier as sc  # noqa: E402


class ShadeSeasonScoreTests(unittest.TestCase):
    def test_catalogs_are_up_to_date(self):
        norms = sc.get_norms()
        for region in sc.HARMONY_REGIONS:
            path, text, _scored, _total = mod.process(region, norms)
            with open(path, encoding="utf-8") as fh:
                self.assertEqual(fh.read(), text, f"{region}: run python scripts/add_shade_season_scores.py")

    def test_scores_are_12_ints_in_range_and_cover_every_usable_shade(self):
        for region in sc.HARMONY_REGIONS:
            with open(os.path.join(mod.DATA_DIR, f"ar-shades-{region}.json"), encoding="utf-8") as fh:
                shades = json.load(fh)
            self.assertTrue(shades)
            for entry in shades:
                usable = sc.shade_lab(entry) is not None
                self.assertEqual("ss" in entry, usable, f"{region} {entry['id']}")
                if usable:
                    self.assertEqual(len(entry["ss"]), len(mod.SEASON_ORDER))
                    self.assertTrue(all(isinstance(v, int) and 0 <= v <= 100 for v in entry["ss"]))

    def test_skin_regions_carry_no_scores(self):
        for region in ("foundation", "bronzer", "brows"):
            with open(os.path.join(mod.DATA_DIR, f"ar-shades-{region}.json"), encoding="utf-8") as fh:
                self.assertFalse(any("ss" in e for e in json.load(fh)))


if __name__ == "__main__":
    unittest.main()
