import json
import os
import re
import unittest
from unittest import mock

from app.core import season_classifier as sc

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SEASON_DB_JS = os.path.join(REPO, "frontend", "src", "constants", "seasonDatabase.js")


def neutral_norms():
    """Absolute norms: for structural tests that must not depend on the catalog."""
    return sc.default_norms()


def market_norms():
    """The committed norms fitted on the real catalog (season_norms.json), as the live API uses them."""
    return sc.get_norms()


class ProductKindTests(unittest.TestCase):
    def test_regions(self):
        cases = {
            "Lipstick": "lips", "Lip stain & tint": "lips", "Lip liner": "lipLiner", "Blush": "cheeks",
            "Eye shadow": "eyeshadow", "Eyeshadow;Eyeshadow palette": "eyeshadow", "Eyebrows": "brows",
            "Mascara": "mascara", "Foundation;Powder": "foundation", "Concealer;Under eye concealer": "concealer",
            "Bronzer;Contour": "bronzer", "Blush;Highlighter & illuminator": "cheeks", "Face primer": None,
            "Face primer;Foundation": "foundation", "": None,
        }
        for sub, expected in cases.items():
            with self.subTest(sub=sub):
                self.assertEqual(sc.product_region({"sub_category": sub}), expected)

    def test_powder_named_bronzer_is_a_bronzer(self):
        self.assertEqual(sc.product_region({"sub_category": "Powder", "product_name": "Smooth Blur Bronzer"}), "bronzer")
        self.assertEqual(sc.product_region({"sub_category": "Powder", "product_name": "Setting Powder"}), "powder")

    def test_bases(self):
        self.assertEqual(sc.product_basis({"sub_category": "Lipstick"}), "harmony")
        self.assertEqual(sc.product_basis({"sub_category": "Foundation"}), "skin")
        self.assertEqual(sc.product_basis({"sub_category": "Bronzer"}), "skin")
        self.assertEqual(sc.product_basis({"sub_category": "Mascara"}), "neutral")


class ColorMathTests(unittest.TestCase):
    def test_hex_to_lab_extremes(self):
        l, a, _b = sc.hex_to_lab("#FFFFFF")
        self.assertAlmostEqual(l, 100, delta=0.1)
        self.assertAlmostEqual(a, 0, delta=0.2)
        self.assertAlmostEqual(sc.hex_to_lab("#000000")[0], 0, delta=0.1)

    def test_shade_lab_rejects_placeholder_and_missing(self):
        self.assertIsNone(sc.shade_lab({"hex": "#FFFFFF", "lab": None}))
        self.assertIsNone(sc.shade_lab({"hex": "", "lab": None}))
        self.assertIsNotNone(sc.shade_lab({"hex": "#C94060", "lab": None}))  # falls back to hex
        self.assertEqual(sc.shade_lab({"hex": "#C94060", "lab": [45.0, 50.0, 10.0]}), (45.0, 50.0, 10.0))


class ScoringTests(unittest.TestCase):
    def test_every_season_profile_ranks_itself_first(self):
        for code, (t, v, c) in sc.SEASON_PROFILES.items():
            with self.subTest(season=code):
                scores = sc.scores_from_axes(t, v, c)
                self.assertEqual(max(scores, key=scores.get), code)

    def test_season_profiles_are_distinct(self):
        # Seasons must differ by at least 0.2 on some axis, or they could not be told apart.
        codes = list(sc.SEASON_PROFILES)
        for i, a in enumerate(codes):
            for b in codes[i + 1:]:
                diff = max(abs(x - y) for x, y in zip(sc.SEASON_PROFILES[a], sc.SEASON_PROFILES[b]))
                self.assertGreaterEqual(diff, 0.2 - 1e-9, f"{a} vs {b}")

    def test_pink_and_coral_have_opposite_temperature_for_lips(self):
        pink = sc.shade_axes(sc.hex_to_lab("#E91E8C"), "lips", neutral_norms())[0]
        coral = sc.shade_axes(sc.hex_to_lab("#FF7F50"), "lips", neutral_norms())[0]
        self.assertLess(pink, 0)
        self.assertGreater(coral, 0)

    def test_greys_and_extremes_have_little_temperature_influence(self):
        for hex_color in ("#808080", "#F5F5F5", "#0A0A0A"):
            with self.subTest(hex=hex_color):
                t, _v, _c, weights = sc.shade_axes(sc.hex_to_lab(hex_color), "lips", neutral_norms())
                self.assertAlmostEqual(t, 0, delta=0.05)
                self.assertLess(weights[0], 0.1)

    def test_reference_lip_colors_land_in_expected_families(self):
        # Colors a color analyst would place in a season family (first two letters of the code). Uses the real norms.
        refs = {"#FF7F50": "sp", "#F4C2C2": "su", "#6B1E2E": "wi", "#A0442C": "au", "#E91E8C": "wi"}
        for hex_color, family in refs.items():
            with self.subTest(hex=hex_color):
                scores = sc.season_scores(sc.hex_to_lab(hex_color), "lips", market_norms())
                top = max(scores, key=scores.get)
                self.assertTrue(top.startswith(family), f"{hex_color} -> {top}")

    def test_palette_colors_rank_their_own_season_in_top_three(self):
        # The palettes on the Color Analysis page are clothing colors, not makeup, so this only checks that the axes
        # definition is consistent with them: at least 65% of the colors rank their season in the top 3. (Some palettes mix
        # warm and cool colors, e.g. Bright Spring has mint and pink, so a stricter bar would only fit noise.)
        text = open(SEASON_DB_JS, encoding="utf-8").read()
        blocks = re.findall(r'"([A-Za-z ]+)":\s*\{\s*colors:\s*\[([^\]]*)\]', text)
        self.assertEqual(len(blocks), 12)
        total_hit = total = 0
        for label, colors in blocks:
            code = sc.SEASON_CODE[label.lower()]
            for hex_color in re.findall(r"#[0-9A-Fa-f]{6}", colors):
                lab = sc.hex_to_lab(hex_color)
                if not 15 < lab[0] < 90:  # pure white / near-black clothing colors say nothing about makeup
                    continue
                scores = sc.season_scores(lab, "eyeshadow", neutral_norms())  # eyeshadow = all-hue temperature
                total += 1
                total_hit += code in sorted(scores, key=scores.get, reverse=True)[:3]
        self.assertGreaterEqual(total_hit / total, 0.65, f"only {total_hit}/{total} palette colors rank own season top 3")


class NormsTests(unittest.TestCase):
    def test_rank_is_monotonic_and_clamped(self):
        knots = sc._percentile_knots(list(range(0, 101)))
        ranks = [sc._rank(v, knots) for v in range(-10, 111)]
        self.assertEqual(ranks, sorted(ranks))
        self.assertEqual(ranks[0], 0.0)
        self.assertEqual(ranks[-1], 1.0)
        self.assertAlmostEqual(sc._rank(50, knots), 0.5, delta=0.01)

    def test_fit_norms_round_trips_through_json(self):
        catalog = [
            {"sub_category": "Lipstick", "shades": [{"hex": h, "lab": None} for h in ("#C94060", "#FF7F50", "#6B1E2E", "#F4C2C2")]}
            for _ in range(10)
        ]
        norms = sc.fit_norms(catalog)
        self.assertEqual(set(norms["groups"]), set(sc.HARMONY_REGIONS))
        self.assertEqual(json.loads(json.dumps(norms)), norms)
        for group in norms["groups"].values():
            self.assertEqual(len(group["L"]), 21)
            self.assertEqual(group["L"], sorted(group["L"]))


class ProductClassificationTests(unittest.TestCase):
    def test_skin_and_neutral_products_have_no_season_target(self):
        skin = sc.classify_product({"sub_category": "Foundation", "shades": [{"hex": "#D09C77", "lab": None}]})
        self.assertEqual((skin["match_basis"], skin["season_tags"], skin["season_scores"]), ("skin", "ALL", {}))
        neutral = sc.classify_product({"sub_category": "Mascara", "shades": [{"hex": "#111111", "lab": None}]})
        self.assertEqual((neutral["match_basis"], neutral["season_tags"]), ("neutral", "ALL"))

    def test_unclassifiable_products_return_none(self):
        self.assertIsNone(sc.classify_product({"sub_category": "Face primer"}))
        self.assertIsNone(sc.classify_product({"sub_category": "Lipstick", "shades": [{"hex": "", "lab": None}]}))

    def test_harmony_product_gets_codes_and_full_label(self):
        result = sc.classify_product({"sub_category": "Lipstick", "shades": [{"hex": "#6B1E2E", "lab": None}]}, neutral_norms())
        self.assertEqual(result["match_basis"], "harmony")
        self.assertIn(result["season_tag_computed"], sc.SEASON_LABEL.values())
        self.assertTrue(all(re.fullmatch(r"[A-Z]{2}-[A-Z]+", t.strip()) for t in result["season_tags"].split(",")))
        self.assertEqual(len(result["season_scores"]), 12)

    def test_single_shade_gets_few_tags(self):
        result = sc.classify_product({"sub_category": "Lipstick", "shades": [{"hex": "#C94060", "lab": None}]}, market_norms())
        self.assertLessEqual(len(result["season_tags"].split(",")), 3)

    def test_scattered_shades_become_all_seasons(self):
        # 12 shades, each fitting a different season: no season holds a real share, so the product is broad.
        codes = list(sc.SEASON_PROFILES)
        shades = [{"hex": f"#C0{i:02d}40", "lab": None} for i in range(12)]
        calls = iter(range(12))

        def one_hot(_lab, _region, _norms=None):
            hot = codes[next(calls)]
            return {c: (0.95 if c == hot else 0.05) for c in codes}

        with mock.patch.object(sc, "season_scores", one_hot):
            result = sc.classify_product({"sub_category": "Lipstick", "shades": shades}, neutral_norms())
        self.assertEqual(result["season_tags"], "ALL")

    def test_clear_core_keeps_narrow_tags(self):
        # 12 shades, all fitting the same season: tagged for that season only, however many shades there are.
        codes = list(sc.SEASON_PROFILES)
        shades = [{"hex": f"#C0{i:02d}40", "lab": None} for i in range(12)]
        with mock.patch.object(sc, "season_scores", lambda *_a, **_k: {c: (0.95 if c == "wi-deep" else 0.05) for c in codes}):
            result = sc.classify_product({"sub_category": "Lipstick", "shades": shades}, neutral_norms())
        self.assertEqual(result["season_tags"], "WI-DEEP")
        self.assertEqual(result["season_tag_computed"], "Deep Winter")

    def test_rank_shades_prefers_the_matching_season(self):
        product = {"sub_category": "Lipstick", "shades": [
            {"name": "coral", "hex": "#FF7F50", "lab": None}, {"name": "berry", "hex": "#8E2A5B", "lab": None}]}
        warm = sc.rank_shades(product, "sp-true", neutral_norms())
        cool = sc.rank_shades(product, "wi-true", neutral_norms())
        self.assertEqual(warm[0][1]["name"], "coral")
        self.assertEqual(cool[0][1]["name"], "berry")
        self.assertEqual(sc.rank_shades({"sub_category": "Foundation", "shades": []}, "sp-true"), [])


class CatalogBuildTests(unittest.TestCase):
    def test_tag_seasons_fills_fields_in_place(self):
        try:
            from scripts.build_catalog import tag_seasons
        except ImportError as exc:  # pandas is only installed in the backend venv
            self.skipTest(str(exc))
        products = [
            {"sub_category": "Lipstick", "season_tags": "", "shades": [{"hex": "#6B1E2E", "lab": None}]},
            {"sub_category": "Foundation", "season_tags": "", "shades": [{"hex": "#D09C77", "lab": None}]},
            {"sub_category": "Face primer", "season_tags": "", "shades": []},
        ]
        tag_seasons(products)
        self.assertEqual(products[0]["match_basis"], "harmony")
        self.assertNotEqual(products[0]["season_tags"], "")
        self.assertEqual(products[1]["season_tags"], "ALL")
        self.assertEqual(products[2]["season_tags"], "")  # unclassifiable: left as it was
        self.assertTrue(all("_debug" not in p for p in products))


if __name__ == "__main__":
    unittest.main()
