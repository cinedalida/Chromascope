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
_THRESHOLDS = json.load(open(os.path.join(_DIR, "chosen_thresholds.json"), encoding="utf-8"))
_CPT = {(t["group"], t["flag"]): (t["p"], t["weighted_n"])
        for t in json.load(open(os.path.join(_DIR, "cpts.json"), encoding="utf-8"))["tables"]}
_MATCHER = sf.Matcher()  # as evaluated: v2 rules, no approved alias changes

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


def evaluate_product(product: dict, user: dict, extra: list) -> dict:
    inci = product.get("full_inci_list", "") or ""
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
    v = verdict.lower()
    return {
        "product_id": product.get("product_id"),
        "product_name": product.get("product_name", ""),
        "brand": product.get("brand", ""),
        "category": product.get("category", ""),
        "sub_category": product.get("sub_category", ""),
        "verdict": v,
        "flagged_ingredients": flagged,
        "matched_groups": sorted({g for _t, g, _h in detail}),
        "severity": {"excluded": "high", "caution": "medium"}.get(v, "low"),
        "filter": "bayes",
        "season_tags": product.get("season_tags", ""),
        "hex_color": product.get("hex_color", ""),
        "where_to_buy": product.get("where_to_buy", ""),
        "price": product.get("price", ""),
        "image_url": product.get("image_url", ""),
        "full_inci_list": inci,
        "key_actives": product.get("key_actives", ""),
    }


def filter_products(products: list, skin_type: str, concerns: list, avoid_keys: list) -> list:
    user, extra = to_filter_profile(skin_type, concerns, avoid_keys)
    order = {"safe": 0, "caution": 1, "excluded": 2}
    return sorted((evaluate_product(p, user, extra) for p in products), key=lambda r: order[r["verdict"]])
