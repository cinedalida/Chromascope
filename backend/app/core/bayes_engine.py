"""App adapter for the Bayesian-Chromascope Hybrid Safety Filter (PLAN_OPTIMIZATION.md, Phase A11; decision D1).

Runs the filter exactly as evaluated (bayes_filter/safety_filter.py, Matcher v2 with no extra aliases, frozen thresholds,
CPTs from the survey) and maps the app's profile onto the filter's profile:

  App                                             Filter (paper)
  skin type Normal / Oily / Dry / Combination  -> same skin type
  skin type Acne-prone                         -> skin type Normal + acne condition
  concern Sensitive                            -> skin type Sensitive (the paper's "sensitive users")
  concern Eczema / Rosacea                     -> eczema / rosacea conditions
  concern Metal allergy                        -> declared allergen: nickel
  avoid Fragrance, Parabens, Chemical UV filters, Formaldehyde releaser, Lanolin, MI/MIT, PPD, Metallic pigments,
        Propylene glycol, CAPB                 -> declared Appendix B allergen groups (Excluded when present)
  avoid Alcohol, Sulfates, Silicones, Essential oils, Coconut oil, Bismuth, Phthalates
                                               -> not in Appendix B; "you chose to avoid it" -> Excluded when present
  concerns Pregnancy-safe, Melasma, PIH        -> no rule in the paper's filter (no effect)
"""
import json
import os
import re

from .bayes_filter import safety_filter as sf
from .constants import AVOID_TRIGGER_MAP

_DIR = os.path.join(os.path.dirname(__file__), "bayes_filter")
# Filter v2 (default): probabilities from 1,064 real survey rows, thresholds tuned on dev (0.34 / 0.48).
# FILTER_VERSION=v1 rolls back to the version scored 0.903 on the first held-out set (500-row survey, 0.34 / 0.60).
FILTER_VERSION = os.environ.get("FILTER_VERSION", "v2").strip().lower()
_SUFFIX = "_v1" if FILTER_VERSION == "v1" else ""
_THRESHOLDS = json.load(open(os.path.join(_DIR, f"chosen_thresholds{_SUFFIX}.json"), encoding="utf-8"))
_CPT = {(t["group"], t["flag"]): (t["p"], t["weighted_n"])
        for t in json.load(open(os.path.join(_DIR, f"cpts{_SUFFIX}.json"), encoding="utf-8"))["tables"]}


class _CachedMatcher:
    """The evaluated Matcher (v2 rules, no approved alias changes) with its per-formula results cached.
    Same output as sf.Matcher(); only repeated work is skipped (catalog Phase 2: speed)."""

    def __init__(self):
        self._m = sf.Matcher()
        self._matches, self._tokens = {}, {}

    def matches(self, inci):
        if inci not in self._matches:
            self._matches[inci] = self._m.matches(inci)
        return self._matches[inci]

    def tokens(self, inci):
        if inci not in self._tokens:
            self._tokens[inci] = self._m.tokens(inci)
        return self._tokens[inci]


_MATCHER = _CachedMatcher()


def warm_cache(ingredient_lists) -> int:
    """Pre-match ingredient lists (e.g. at startup) so the first filter request is fast. Returns how many."""
    n = 0
    for inci in ingredient_lists:
        if inci:
            _MATCHER.matches(inci)
            _MATCHER.tokens(inci)
            n += 1
    return n

SKIN_TYPES = {"normal": "Normal", "oily": "Oily", "dry": "Dry", "combination": "Combination",
              "sensitive": "Sensitive", "pigmented": "Pigmented"}
# App "avoid" keys (schemas.avoid_key) that are Appendix B allergen groups in the paper's filter.
AVOID_TO_GROUP = {"fragrance": "fragrance", "parabens": "paraben", "octinoxate": "oxybenzone",
                  "formaldehyde": "formaldehyde", "lanolin": "lanolin", "mi": "mi", "ppd": "ppd",
                  "metallic_pigments": "nickel", "propylene_glycol": "propyleneglycol", "capb": "capb"}
GROUP_LABEL = {"fragrance": "Fragrance", "paraben": "Parabens", "oxybenzone": "Chemical UV filter (oxybenzone)",
               "formaldehyde": "Formaldehyde releaser", "nickel": "Nickel / metallic pigment", "lanolin": "Lanolin",
               "propyleneglycol": "Propylene glycol", "mi": "Methylisothiazolinone (MI)", "capb": "Cocamidopropyl betaine",
               "ppd": "p-Phenylenediamine (PPD)", "glycerin_ha_zno": "Glycerin / HA / zinc oxide (comedogenic 0)",
               "squalane_sunflower_shea": "Squalane / sunflower / shea (comedogenic 1)",
               "jojoba_cetyl_mineraloil": "Jojoba / cetyl alcohol / mineral oil (comedogenic 2)",
               "ipm_algae": "Isopropyl myristate / algae (comedogenic 3)", "coconut_cocoa": "Coconut oil / cocoa butter (comedogenic 4)",
               "wheatgerm_lanolin": "Wheat germ oil / acetylated lanolin (comedogenic 5)"}


def to_filter_profile(skin_type: str, concerns: list, avoid_keys: list) -> tuple[dict, list]:
    """App profile -> (filter user dict, extra non-Appendix avoid keys)."""
    concerns = set(concerns or [])
    skin = (skin_type or "normal").lower()
    acne = skin == "acne_prone"
    filter_skin = "Sensitive" if "sensitive" in concerns else SKIN_TYPES.get("normal" if acne else skin, "Normal")
    allergens = sorted({AVOID_TO_GROUP[a] for a in avoid_keys or [] if a in AVOID_TO_GROUP}
                       | ({"nickel"} if "metal_allergy" in concerns else set()))
    extra = sorted({a for a in avoid_keys or [] if a not in AVOID_TO_GROUP and a in AVOID_TRIGGER_MAP})
    user = dict(skin_type=filter_skin, eczema="eczema" in concerns, rosacea="rosacea" in concerns, acne=acne,
                allergens=allergens)
    return user, extra


def _avoided_present(inci: str, extra: list) -> list:
    """Non-Appendix ingredients the user chose to avoid that appear in the list (whole-word match)."""
    tokens = [" ".join(alts).lower() for alts in _MATCHER.tokens(inci)]
    hits = []
    for key in extra:
        for trigger in AVOID_TRIGGER_MAP.get(key, []):
            pat = re.compile(r"(?<![a-z0-9])" + re.escape(trigger.lower()) + r"(?![a-z0-9])")
            if any(pat.search(t) for t in tokens):
                hits.append(f"You chose to avoid {key.replace('_', ' ')} ({trigger})")
                break
    return hits


ORDER = {"safe": 0, "caution": 1, "excluded": 2}


def evaluate_formula(inci: str, user: dict, extra: list) -> tuple[str, list, list]:
    """(verdict lower-case, reasons, matched groups) for one ingredient list."""
    result = sf.evaluate(inci, user, _CPT, monitor=_THRESHOLDS["monitor_allergy"],
                         monitor_b=_THRESHOLDS["monitor_breakout"], matcher=_MATCHER, return_detail=True)
    verdict, detail = result[0], result[1]
    matched = [f"{GROUP_LABEL.get(g, g)}: {tok}" for tok, g, _how in detail]
    if verdict == "Excluded":
        declared = set(user["allergens"])
        reasons = [f"Declared allergen: {GROUP_LABEL.get(g, g)} ({tok})" for tok, g, _ in detail if g in declared]
        reasons += [f"Always excluded (hard block): {GROUP_LABEL.get(g, g)} ({tok})" for tok, g, _ in detail
                    if g in sf.HARD_BLOCK and g not in declared]
        reasons += [f"Blocked for acne-prone skin: {GROUP_LABEL.get(g, g)} ({tok})" for tok, g, _ in detail
                    if g == "wheatgerm_lanolin" and user.get("acne")]
        flagged = reasons or matched
    else:
        flagged = matched
    avoided = _avoided_present(inci, extra)
    if avoided:
        verdict = "Excluded"
        flagged = avoided + flagged
    return verdict.lower(), flagged, sorted({g for _t, g, _h in detail})


def evaluate_product(product: dict, user: dict, extra: list) -> dict:
    """Verdict per formula; each shade takes its formula's verdict; the product shows its WORST shade.
    Products without shade data (old catalog) are evaluated on full_inci_list as before."""
    main_inci = product.get("full_inci_list", "") or ""
    formulas = product.get("formulas") or {"main": main_inci}
    per_formula = {fid: evaluate_formula(inci or "", user, extra) for fid, inci in formulas.items()}
    shades = product.get("shades") or []
    shade_out = [{"shade_id": sh.get("shade_id"), "name": sh.get("name"), "hex": sh.get("hex"), "lab": sh.get("lab"),
                  "verdict": per_formula.get(sh.get("formula_id"), per_formula[next(iter(per_formula))])[0]}
                 for sh in shades]
    if shade_out:
        counts = {v: sum(1 for x in shade_out if x["verdict"] == v) for v in ORDER}
        worst_fid = max((sh.get("formula_id") for sh in shades if sh.get("formula_id") in per_formula),
                        key=lambda f: ORDER[per_formula[f][0]], default=next(iter(per_formula)))
    else:
        counts = None
        worst_fid = max(per_formula, key=lambda f: ORDER[per_formula[f][0]])
    v, flagged, groups = per_formula[worst_fid]
    return {
        "product_id": product.get("product_id"),
        "product_name": product.get("product_name", ""),
        "brand": product.get("brand", ""),
        "category": product.get("category", ""),
        "sub_category": product.get("sub_category", ""),
        "verdict": v,
        "flagged_ingredients": flagged,
        "matched_groups": groups,
        "severity": {"excluded": "high", "caution": "medium"}.get(v, "low"),
        "filter": "bayes",
        "shade_count": len(shade_out),
        "shade_verdicts": counts,          # e.g. {"safe": 27, "caution": 3, "excluded": 0}; None for old products
        "shades": shade_out,
        "season_tags": product.get("season_tags", ""),
        "hex_color": product.get("hex_color", ""),
        "lab_L": product.get("lab_L"), "lab_a": product.get("lab_a"), "lab_b": product.get("lab_b"),
        "where_to_buy": product.get("where_to_buy", ""),
        "price": product.get("price", ""),
        "image_url": product.get("image_url", ""),
        "full_inci_list": main_inci,
        "key_actives": product.get("key_actives", ""),
    }


def filter_products(products: list, skin_type: str, concerns: list, avoid_keys: list) -> list:
    user, extra = to_filter_profile(skin_type, concerns, avoid_keys)
    return sorted((evaluate_product(p, user, extra) for p in products), key=lambda r: ORDER[r["verdict"]])
