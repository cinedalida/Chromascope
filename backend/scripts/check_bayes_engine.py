"""Validation for Phase A11 (decision D1): the app runs the evaluated filter unchanged.

(a) Shipped CPTs (cpts.json) == CPTs rebuilt from the survey, and verdicts on the 300 synthetic DEV cases are identical
    to the research filter run the way the evaluation ran it (build_cpts from the CSV + frozen thresholds).
    The held-out set is NOT scored here (it was scored once).
(b) Profile mapping from the app to the filter (PLAN_OPTIMIZATION.md table).
(c) End-to-end examples through the adapter: one product per verdict.

Usage (from backend/): venv\\Scripts\\python -m scripts.check_bayes_engine <survey csv> <research cases.json>
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import pandas as pd  # noqa: E402
from app.core import bayes_engine as be  # noqa: E402
from app.core.bayes_filter import safety_filter as sf  # noqa: E402

fails = []
def check(name, cond, info=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name} {info}")
    if not cond:
        fails.append(name)

csv_path, cases_path = sys.argv[1], sys.argv[2]
priors_path = sys.argv[3] if len(sys.argv) > 3 else ""   # v3: app/core/bayes_filter/priors_essca.json
from scripts.build_cpts import compute  # noqa: E402

print(f"(a) same filter, same numbers, same verdicts (FILTER_VERSION={be.FILTER_VERSION})")
live = compute(csv_path, priors_path)
check("cpts.json equals CPTs rebuilt from the survey", set(live) == set(be._CPT) and
      all(abs(live[k][0] - be._CPT[k][0]) < 1e-12 for k in live), f"({len(live)} entries)")
th = be._THRESHOLDS
dev = json.load(open(cases_path, encoding="utf-8"))["dev"]
research = [sf.evaluate(c["inci"], c["user"], live, monitor=th["monitor_allergy"], monitor_b=th["monitor_breakout"],
                        matcher=sf.Matcher()) for c in dev]
app = [sf.evaluate(c["inci"], c["user"], be._CPT, monitor=th["monitor_allergy"], monitor_b=th["monitor_breakout"],
                   matcher=be._MATCHER) for c in dev]
check("verdicts identical on the 300 synthetic dev cases", research == app,
      f"({sum(r == a for r, a in zip(research, app))}/{len(dev)}; Safe/Caution/Excluded = "
      f"{[research.count(v) for v in ('Safe', 'Caution', 'Excluded')]})")

print("(b) profile mapping")
u, extra = be.to_filter_profile("acne_prone", ["eczema"], ["fragrance", "coconut_oil"])
check("acne-prone skin -> Normal + acne; eczema kept", u["skin_type"] == "Normal" and u["acne"] and u["eczema"])
check("Fragrance -> declared allergen; Coconut oil -> 'avoid anyway'", u["allergens"] == ["fragrance"] and extra == ["coconut_oil"])
u, _ = be.to_filter_profile("oily", ["sensitive", "metal_allergy", "pregnancy"], ["octinoxate", "metallic_pigments", "propylene_glycol", "capb"])
check("Sensitive concern -> Sensitive skin type", u["skin_type"] == "Sensitive")
check("UV filters/metallic/PG/CAPB + metal allergy -> Appendix B groups",
      u["allergens"] == ["capb", "nickel", "oxybenzone", "propyleneglycol"], str(u["allergens"]))
check("Pregnancy-safe sets only the pregnant flag", u["pregnant"] and not u["acne"] and not u["eczema"] and not u["rosacea"])

print("(b2) Pregnancy-safe (app-level rule)")
P2 = lambda inci: {"product_id": "x", "product_name": "x", "full_inci_list": inci}
preg = lambda inci: be.filter_products([P2(inci)], "normal", ["pregnancy"], [])[0]
r = preg("Water, Glycerin, Retinol")
check("retinol -> excluded", r["verdict"] == "excluded" and "retinoid" in r["flagged_ingredients"][0], f"{r['verdict']} {r['flagged_ingredients'][:1]}")
r = preg("Water, Hydroquinone")
check("hydroquinone -> excluded", r["verdict"] == "excluded", r["verdict"])
r = preg("Water, Glycerin, Homosalate")
check("homosalate -> caution", r["verdict"] == "caution", f"{r['verdict']} {r['flagged_ingredients'][:1]}")
r = preg("Water, Glycerin, Dimethicone")
check("plain product stays safe", r["verdict"] == "safe", r["verdict"])
r = be.filter_products([P2("Water, Glycerin, Retinol")], "normal", [], [])[0]
check("retinol without Pregnancy-safe -> unchanged (safe)", r["verdict"] == "safe", r["verdict"])

print("(c) one product per verdict through the adapter")
P = lambda inci: {"product_id": "x", "product_name": "x", "full_inci_list": inci}
r = be.filter_products([P("Water, Glycerin, Dimethicone")], "normal", [], [])[0]
check("plain product, no profile flags -> safe", r["verdict"] == "safe", r["verdict"])
r = be.filter_products([P("Water, Glycerin, Parfum, Limonene, Linalool")], "normal", ["sensitive", "eczema"], [])[0]
check("fragrance for a sensitive + eczema user -> caution", r["verdict"] == "caution", f"{r['verdict']} {r['flagged_ingredients'][:2]}")
r = be.filter_products([P("Water, Glycerin, Parfum")], "normal", [], ["fragrance"])[0]
check("declared fragrance allergy -> excluded", r["verdict"] == "excluded", str(r["flagged_ingredients"][:1]))
r = be.filter_products([P("Water, Methylisothiazolinone")], "normal", [], [])[0]
check("MI -> excluded for every user (hard block)", r["verdict"] == "excluded", str(r["flagged_ingredients"][:1]))
r = be.filter_products([P("Water, Sodium Lauryl Sulfate")], "normal", [], ["sulfates"])[0]
check("'avoid anyway' choice (sulfates) -> excluded", r["verdict"] == "excluded", str(r["flagged_ingredients"][:1]))
r = be.filter_products([P("Triticum Vulgare Germ Oil, Water")], "acne_prone", [], [])[0]
check("wheat germ oil for acne-prone skin -> excluded", r["verdict"] == "excluded", str(r["flagged_ingredients"][:1]))

print("\nALL PASS" if not fails else f"\n{len(fails)} FAILED: {fails}")
sys.exit(1 if fails else 0)
