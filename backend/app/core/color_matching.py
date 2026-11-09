import math
import re

from . import season_classifier as sc

# Maps human-readable seasonal labels → product season tag codes
# The season model says Warm/Cool where product tags say True, so both map to the same code.
SEASON_CODE_MAP = {
    # Autumn
    "soft autumn":   "au-soft",
    "true autumn":   "au-true",
    "warm autumn":   "au-true",
    "deep autumn":   "au-deep",
    # Spring
    "light spring":  "sp-light",
    "true spring":   "sp-true",
    "warm spring":   "sp-true",
    "bright spring": "sp-bright",
    # Summer
    "light summer":  "su-light",
    "true summer":   "su-true",
    "cool summer":   "su-true",
    "soft summer":   "su-soft",
    # Winter
    "deep winter":   "wi-deep",
    "true winter":   "wi-true",
    "cool winter":   "wi-true",
    "bright winter": "wi-bright",
}

def delta_e_ciede2000(lab1: tuple, lab2: tuple) -> float:
    if not lab1 or not lab2: return 999
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1 = math.sqrt(a1**2 + b1**2)
    C2 = math.sqrt(a2**2 + b2**2)
    C_avg = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(C_avg**7 / (C_avg**7 + 25**7)))
    a1p = a1 * (1 + G)
    a2p = a2 * (1 + G)
    C1p = math.sqrt(a1p**2 + b1**2)
    C2p = math.sqrt(a2p**2 + b2**2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp = L2 - L1
    dCp = C2p - C1p
    if C1p * C2p == 0: dhp = 0
    elif abs(h2p - h1p) <= 180: dhp = h2p - h1p
    elif h2p - h1p > 180: dhp = h2p - h1p - 360
    else: dhp = h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lp_avg = (L1 + L2) / 2
    Cp_avg = (C1p + C2p) / 2
    if C1p * C2p == 0:
        hp_avg = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hp_avg = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hp_avg = (h1p + h2p + 360) / 2
    else:
        hp_avg = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hp_avg - 30)) +
          0.24 * math.cos(math.radians(2 * hp_avg)) +
          0.32 * math.cos(math.radians(3 * hp_avg + 6)) -
          0.20 * math.cos(math.radians(4 * hp_avg - 63)))
    SL = 1 + 0.015 * (Lp_avg - 50)**2 / math.sqrt(20 + (Lp_avg - 50)**2)
    SC = 1 + 0.045 * Cp_avg
    SH = 1 + 0.015 * Cp_avg * T
    # Rotation term: corrects the blue region (hue about 275 degrees). Without it the result is not CIEDE2000;
    # for skin-like colors it is below 0.01, so it matters only for blue shades.
    d_theta = 30 * math.exp(-(((hp_avg - 275) / 25) ** 2))
    R_C = 2 * math.sqrt(Cp_avg**7 / (Cp_avg**7 + 25**7))
    R_T = -math.sin(math.radians(2 * d_theta)) * R_C
    return round(math.sqrt((dLp/SL)**2 + (dCp/SC)**2 + (dHp/SH)**2 + R_T * (dCp/SC) * (dHp/SH)), 2)

def _resolve_season_code(seasonal_label: str) -> tuple:
    """
    Translate 'Soft Autumn' → ('au-soft', 'au').
    Returns (full_code, family_prefix) so we can match both exact and broad.
    """
    if not seasonal_label:
        return ("", "")
    code = SEASON_CODE_MAP.get(seasonal_label.lower().strip(), seasonal_label.lower().strip())
    family = code.split("-")[0] if "-" in code else code   # "au-soft" → "au"
    return (code, family)

def _season_tags(product: dict) -> tuple:
    """
    (exact, family) season codes a product's stored tags name, both lowercase sets.

    exact:  specific codes ("au-soft"), from season_tag_computed (a full label such as "Soft Autumn") and from
            season_tags written as codes ("AU-SOFT, SP-LIGHT") or as a list.
    family: bare families ("au"), only from legacy prose such as "Warm shades: SP/AU. Cool: SU/WI". A code like
            "AU-SOFT" does NOT also count as the bare family "au": that made every tag a family-wide match.
    """
    exact, family = set(), set()

    computed = str(product.get("season_tag_computed") or "")
    if computed:
        code = SEASON_CODE_MAP.get(computed.lower().strip())
        if code:
            exact.add(code)

    tags = product.get("season_tags") or ""
    parts = [str(t) for t in tags] if isinstance(tags, list) else (re.split(r"[,;]", tags) if isinstance(tags, str) else [])
    for part in parts:
        token = part.strip().lower()
        code = SEASON_CODE_MAP.get(token) or (token if token in SEASON_CODE_MAP.values() else None)
        if code:
            exact.add(code)
        elif token in ("sp", "au", "su", "wi"):
            family.add(token)
    if isinstance(tags, str):
        # Bare 2-letter families in prose, but not the start of a code ("AU-SOFT").
        family.update(f.lower() for f in re.findall(r"(?<![-\w])(SP|AU|SU|WI)(?![-\w])", tags, re.IGNORECASE))
    return exact, family


# Fit (0..1) above which a product counts as a good match. Season fit comes from season_classifier; a skin-tone fit
# is derived from the colour distance, exp(-dE^2 / (2 * SKIN_SIGMA^2)): dE 3 is 0.84, dE 6 is 0.49, dE 10 is 0.14.
FIT_TIERS = ((0.75, "best"), (0.55, "good"), (0.35, "fair"))
SKIN_SIGMA = 5.0
MATCH_MIN_FIT = FIT_TIERS[1][0]  # a shade "fits" the user at the good tier or better; every such shade is offered
VERDICT_RANK = {"safe": 0, "caution": 1, "excluded": 2}


def _tier(fit: float) -> str:
    for minimum, name in FIT_TIERS:
        if fit >= minimum:
            return name
    return "low"


def _shade_summary(shade: dict, lab, fit=None, seasons=None) -> dict:
    summary = {"shade_id": shade.get("shade_id"), "name": shade.get("name"), "hex": shade.get("hex"),
               "lab": list(lab) if lab else None, "verdict": shade.get("verdict")}
    if fit is not None:
        summary["fit"] = round(fit, 3)
    if seasons is not None:
        summary["seasons"] = seasons
    return summary


def _use_shade(item: dict, shade: dict, lab, seasons=None) -> None:
    """Make the product's own color fields (what older clients read) those of the best shade for this user."""
    item["lab_L"], item["lab_a"], item["lab_b"] = lab
    if shade.get("hex"):
        item["hex_color"] = shade["hex"]
    item["best_shade"] = _shade_summary(shade, lab, seasons=seasons)


def _score_harmony(item: dict, user_code: str) -> None:
    """Lips, lip liner, blush, eyeshadow: how well the product's best shade fits the user's season. Every shade that
    also fits (fit >= MATCH_MIN_FIT) is listed in `matching_shades`, best first, each with the seasons it belongs to."""
    ranked = sc.rank_shades(item, user_code)
    if not ranked:
        return
    region = sc.product_region(item)
    fit, shade = ranked[0]
    lab = sc.shade_lab(shade)
    _use_shade(item, shade, lab, seasons=sc.shade_season_codes(lab, region))
    item["matching_shades"] = []
    for shade_fit, other in ranked:
        if other is not shade and shade_fit < MATCH_MIN_FIT:
            break  # ranked is best first: nothing after this fits
        other_lab = sc.shade_lab(other)
        item["matching_shades"].append(
            _shade_summary(other, other_lab, shade_fit, sc.shade_season_codes(other_lab, region)))
    item["season_fit"] = round(fit, 3)
    item["fit_score"] = fit
    item["fit_tier"] = _tier(fit)
    item["is_season_match"] = fit >= FIT_TIERS[1][0]


def _score_skin(item: dict, skin_lab: tuple, region: str) -> None:
    """Foundation, concealer, powder, bronzer, contour, highlighter: distance to the user's skin, shifted deeper or
    lighter where the product should be (e.g. a bronzer about 10 L* below the skin)."""
    shift = sc.SKIN_TARGET_L_SHIFT[region]
    target = (skin_lab[0] + shift, skin_lab[1], skin_lab[2])
    scored = []
    for shade in sc.product_shades(item):
        lab = sc.shade_lab(shade)
        if not lab:
            continue
        d = delta_e_ciede2000(target, lab)
        scored.append((d, shade, lab, math.exp(-(d ** 2) / (2 * SKIN_SIGMA ** 2))))
    if not scored:
        return
    scored.sort(key=lambda entry: entry[0])  # closest first; the sort is stable, so ties keep the product's order
    d, shade, lab, fit = scored[0]
    _use_shade(item, shade, lab)
    # Every shade that also suits the skin (best always first), so the app can offer them all.
    item["matching_shades"] = [
        _shade_summary(s, l, f) for _d, s, l, f in scored if s is shade or f >= MATCH_MIN_FIT
    ]
    item["skin_delta_e"] = d
    item["delta_e"] = d  # kept for older clients
    item["target_shift_L"] = shift
    item["fit_score"] = fit
    item["fit_tier"] = _tier(fit)


def run_color_matching(products: list, seasonal_label: str, user_lab: tuple, category: str) -> list:
    """
    Scores and orders products for one user. Order: excluded last, safe before caution, then best fit first.

    Added to each product (all optional, absent when there is nothing to score):
      match_basis    "harmony" (lips, lip liner, blush, eyeshadow) | "skin" (foundation, concealer, powder, bronzer,
                     contour, highlighter) | "neutral" (brows, eyeliner, mascara), from season_classifier
      fit_score      0..1 how well the best shade suits the user; fit_tier: best | good | fair | low
      matching_shades  every shade that fits the user (fit >= MATCH_MIN_FIT), best first, the best always included:
                     {shade_id, name, hex, lab, fit, seasons (harmony only)}; best_shade also carries `seasons`
      season_fit     (harmony) the season classifier's fit of the best shade for the user's season
      skin_delta_e   (skin) CIEDE2000 distance of the best shade to the user's (shifted) skin; also as delta_e
      best_shade     {shade_id, name, hex, lab}; the product's hex_color / lab_* are set to it
      is_season_match  harmony: fit >= 0.55; otherwise whether a stored tag names the user's season
    Neutral products and users without a season / skin Lab are not scored and keep the incoming order within a verdict.
    """
    user_code, user_family = _resolve_season_code(seasonal_label)
    skin = None
    if user_lab is not None and len(user_lab) == 3:
        try:
            skin = tuple(float(v) for v in user_lab)
        except (TypeError, ValueError):
            skin = None

    scored = []
    for p in products:
        item = {**p}
        exact, family = _season_tags(p)
        item["is_season_match"] = bool(user_code and (user_code in exact or user_family in family))
        region = sc.product_region(p)
        basis = sc.REGION_BASIS.get(region) if region else None
        if basis:
            item["match_basis"] = basis
        try:
            if basis == "harmony" and user_code in sc.SEASON_PROFILES:
                _score_harmony(item, user_code)
            elif basis == "skin" and skin:
                _score_skin(item, skin, region)
        except Exception:  # a malformed shade must never break the whole list
            pass
        scored.append(item)

    def sort_key(x):
        verdict = VERDICT_RANK.get(str(x.get("verdict", "")).lower(), 1)
        fit = x.get("fit_score")
        return (verdict, fit is None, -(fit or 0.0))

    scored.sort(key=sort_key)
    return scored
