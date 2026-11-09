import unittest

from app.core import season_classifier as sc
from app.core.color_matching import _season_tags, run_color_matching

SKIN = (68.0, 14.0, 22.0)  # a medium skin tone, Lab


def shade(name, hex_color):
    return {"shade_id": name, "name": name, "hex": hex_color, "lab": list(sc.hex_to_lab(hex_color))}


def product(pid, sub_category, shades, verdict="safe", **extra):
    return {"product_id": pid, "product_name": pid, "sub_category": sub_category, "verdict": verdict,
            "shades": shades, "hex_color": shades[0]["hex"] if shades else "", **extra}


def ids(items):
    return [p["product_id"] for p in items]


class SeasonTagParsingTests(unittest.TestCase):
    def test_code_is_exact_and_not_also_the_family(self):
        exact, family = _season_tags({"season_tags": "AU-SOFT, SP-LIGHT", "season_tag_computed": "Soft Autumn"})
        self.assertEqual(exact, {"au-soft", "sp-light"})
        self.assertEqual(family, set())  # the old regex also added "au" and "sp" here

    def test_legacy_prose_is_family_only(self):
        exact, family = _season_tags({"season_tags": "Warm shades: SP/AU. Cool shades: SU/WI"})
        self.assertEqual(exact, set())
        self.assertEqual(family, {"sp", "au", "su", "wi"})

    def test_all_and_empty_name_no_season(self):
        for tags in ("ALL", "ALL — match shade to undertone", ""):
            with self.subTest(tags=tags):
                self.assertEqual(_season_tags({"season_tags": tags}), (set(), set()))

    def test_list_and_true_labels(self):
        exact, _ = _season_tags({"season_tags": ["SP-TRUE", "Cool Winter"], "season_tag_computed": "True Summer"})
        self.assertEqual(exact, {"sp-true", "wi-true", "su-true"})


class HarmonyOrderingTests(unittest.TestCase):
    def setUp(self):
        self.coral = product("coral", "Lipstick", [shade("coral", "#FF7F50")])
        self.berry = product("berry", "Lipstick", [shade("berry", "#8E2A5B")])

    def test_order_follows_the_users_season(self):
        warm = run_color_matching([self.berry, self.coral], "Warm Spring", SKIN, "Lip")
        cool = run_color_matching([self.coral, self.berry], "Cool Winter", SKIN, "Lip")
        self.assertEqual(ids(warm), ["coral", "berry"])
        self.assertEqual(ids(cool), ["berry", "coral"])
        self.assertGreater(warm[0]["season_fit"], warm[1]["season_fit"])

    def test_fields_and_best_shade(self):
        palette = product("range", "Lipstick", [shade("berry", "#8E2A5B"), shade("coral", "#FF7F50")])
        item = run_color_matching([palette], "Warm Spring", SKIN, "Lip")[0]
        self.assertEqual(item["match_basis"], "harmony")
        self.assertEqual(item["best_shade"]["name"], "coral")
        self.assertEqual(item["hex_color"], "#FF7F50")  # older clients read the best shade
        self.assertIn(item["fit_tier"], ("best", "good", "fair", "low"))
        self.assertEqual(item["is_season_match"], item["season_fit"] >= 0.55)

    def test_excluded_last_and_safe_before_caution_regardless_of_fit(self):
        excluded = product("excluded", "Lipstick", [shade("coral", "#FF7F50")], verdict="excluded")
        caution = product("caution", "Lipstick", [shade("coral", "#FF7F50")], verdict="caution")
        safe_bad_fit = product("safe", "Lipstick", [shade("berry", "#8E2A5B")])
        order = ids(run_color_matching([excluded, caution, safe_bad_fit], "Warm Spring", SKIN, "Lip"))
        self.assertEqual(order, ["safe", "caution", "excluded"])

    def test_family_wide_tags_no_longer_match_every_season_in_the_family(self):
        legacy = {"product_id": "old", "product_name": "old", "sub_category": "Lipstick", "verdict": "safe",
                  "season_tags": "AU-SOFT", "season_tag_computed": "Soft Autumn", "hex_color": "", "shades": []}
        soft = run_color_matching([legacy], "Soft Autumn", SKIN, "Lip")[0]
        deep = run_color_matching([legacy], "Deep Autumn", SKIN, "Lip")[0]
        self.assertTrue(soft["is_season_match"])
        self.assertFalse(deep["is_season_match"])

    def test_no_season_means_no_fit_fields(self):
        item = run_color_matching([self.coral], None, SKIN, "Lip")[0]
        self.assertNotIn("fit_score", item)
        self.assertEqual(item["match_basis"], "harmony")


class SkinOrderingTests(unittest.TestCase):
    def test_foundation_closest_to_skin_wins_and_best_shade_is_applied(self):
        near = product("near", "Foundation", [shade("far", "#4A2C1C"), shade("near", "#D5A58A")], category="Face")
        far = product("far", "Foundation", [shade("pale", "#F2D7C5")], category="Face")
        out = run_color_matching([far, near], "Cool Winter", SKIN, "Face")
        self.assertEqual(ids(out), ["near", "far"])
        self.assertEqual(out[0]["best_shade"]["name"], "near")
        self.assertEqual(out[0]["delta_e"], out[0]["skin_delta_e"])  # legacy key kept
        self.assertEqual(out[0]["target_shift_L"], 0)
        self.assertEqual(out[0]["match_basis"], "skin")

    def test_season_does_not_matter_for_skin_products(self):
        item = product("f", "Foundation", [shade("a", "#D5A58A")])
        a = run_color_matching([item], "Warm Spring", SKIN, "Face")[0]["fit_score"]
        b = run_color_matching([item], "Deep Winter", SKIN, "Face")[0]["fit_score"]
        self.assertEqual(a, b)

    def test_bronzer_prefers_a_shade_deeper_than_the_skin(self):
        deeper = product("deeper", "Bronzer", [shade("tan", "#B07E5F")])  # about 10 L* below SKIN
        same = product("same", "Bronzer", [shade("skin", "#D5A58A")])
        out = run_color_matching([same, deeper], "Warm Spring", SKIN, "Cheek")
        self.assertEqual(ids(out), ["deeper", "same"])
        self.assertEqual(out[0]["target_shift_L"], -10)

    def test_concealer_and_no_skin_lab(self):
        concealer = product("c", "Concealer", [shade("a", "#D9AE95")], category="Concealer")
        scored = run_color_matching([concealer], None, SKIN, "Concealer")[0]
        self.assertIn("skin_delta_e", scored)
        unscored = run_color_matching([concealer], None, None, "Concealer")[0]
        self.assertNotIn("skin_delta_e", unscored)


class MatchingShadesTests(unittest.TestCase):
    """Every shade that fits the user is offered, best first, with no cap (the best shade is always included)."""

    def test_harmony_lists_every_fitting_shade_best_first(self):
        shades = [shade("berry", "#8E2A5B"), shade("coral", "#FF7F50"), shade("peach", "#FFB08A"), shade("plum", "#4B1F3F")]
        item = run_color_matching([product("range", "Lipstick", shades)], "Warm Spring", SKIN, "Lip")[0]
        listed = item["matching_shades"]
        fits = [s["fit"] for s in listed]
        self.assertEqual(fits, sorted(fits, reverse=True))
        self.assertEqual(listed[0]["shade_id"], item["best_shade"]["shade_id"])
        self.assertTrue(all(f >= 0.55 for f in fits[1:]))
        # none dropped: compare with the season classifier's own ranking
        expected = [s["shade_id"] for f, s in sc.rank_shades(item, "sp-true") if f >= 0.55]
        self.assertEqual([s["shade_id"] for s in listed if s["fit"] >= 0.55], expected)
        self.assertGreaterEqual(len(listed), 2)

    def test_harmony_has_no_cap(self):
        many = [shade(f"c{i}", h) for i, h in enumerate(["#FF7F50", "#FF8A5B", "#FF9068", "#FF6F4A", "#F97A55", "#FF8560",
                                                           "#FA8C6B", "#FF7B4F", "#F58360", "#FF8E66"])]
        item = run_color_matching([product("many", "Lipstick", many)], "Warm Spring", SKIN, "Lip")[0]
        self.assertGreater(len(item["matching_shades"]), 6)

    def test_every_listed_harmony_shade_carries_its_own_seasons(self):
        shades = [shade("berry", "#8E2A5B"), shade("coral", "#FF7F50")]
        item = run_color_matching([product("range", "Lipstick", shades)], "Warm Spring", SKIN, "Lip")[0]
        for entry in item["matching_shades"]:
            self.assertTrue(entry["seasons"])
            self.assertTrue(all(code in sc.SEASON_PROFILES for code in entry["seasons"]))
        self.assertEqual(item["best_shade"]["seasons"], item["matching_shades"][0]["seasons"])

    def test_a_shade_that_does_not_fit_is_left_out(self):
        item = run_color_matching([product("one", "Lipstick", [shade("coral", "#FF7F50"), shade("navy", "#101040")])],
                                  "Warm Spring", SKIN, "Lip")[0]
        self.assertEqual([s["name"] for s in item["matching_shades"]], ["coral"])

    def test_best_shade_is_kept_even_when_nothing_fits(self):
        item = run_color_matching([product("bad", "Lipstick", [shade("navy", "#101040")])], "Warm Spring", SKIN, "Lip")[0]
        self.assertEqual(len(item["matching_shades"]), 1)
        self.assertLess(item["matching_shades"][0]["fit"], 0.55)

    def test_skin_products_list_close_shades_without_seasons(self):
        shades = [shade("near", "#D5A58A"), shade("near2", "#D3A88F"), shade("dark", "#4A2C1C"), shade("pale", "#F2D7C5")]
        item = run_color_matching([product("f", "Foundation", shades, category="Face")], "Cool Winter", SKIN, "Face")[0]
        listed = item["matching_shades"]
        self.assertEqual(listed[0]["shade_id"], item["best_shade"]["shade_id"])
        self.assertNotIn("dark", [s["shade_id"] for s in listed])
        self.assertTrue(all("seasons" not in s for s in listed))
        self.assertTrue(all(f["fit"] >= 0.55 for f in listed[1:]))

    def test_neutral_products_have_none(self):
        item = run_color_matching([product("m", "Mascara", [shade("black", "#111111")])], "Warm Spring", SKIN, "Eye")[0]
        self.assertNotIn("matching_shades", item)


class NeutralAndLegacyTests(unittest.TestCase):
    def test_neutral_products_keep_order_and_have_no_fit(self):
        a = product("a", "Mascara", [shade("black", "#111111")])
        b = product("b", "Eyeliner", [shade("brown", "#4A3022")])
        out = run_color_matching([a, b], "Cool Winter", SKIN, "Eye")
        self.assertEqual(ids(out), ["a", "b"])
        for item in out:
            self.assertEqual(item["match_basis"], "neutral")
            self.assertNotIn("fit_score", item)

    def test_single_color_doc_without_shades_still_scores(self):
        old = {"product_id": "old", "product_name": "old", "sub_category": "Lipstick", "verdict": "safe",
               "hex_color": "#FF7F50", "lab_L": None, "lab_a": None, "lab_b": None, "season_tags": "", "shades": []}
        item = run_color_matching([old], "Warm Spring", SKIN, "Lip")[0]
        self.assertIn("season_fit", item)

    def test_unknown_products_pass_through(self):
        primer = product("p", "Face primer", [shade("a", "#E0C0A0")])
        out = run_color_matching([primer], "Warm Spring", SKIN, "Face")
        self.assertEqual(ids(out), ["p"])
        self.assertNotIn("match_basis", out[0])

    def test_malformed_shade_does_not_break_the_list(self):
        bad = product("bad", "Lipstick", [{"name": "x", "hex": None, "lab": "oops"}])
        good = product("good", "Lipstick", [shade("coral", "#FF7F50")])
        out = run_color_matching([bad, good], "Warm Spring", SKIN, "Lip")
        self.assertEqual(ids(out), ["good", "bad"])


if __name__ == "__main__":
    unittest.main()
