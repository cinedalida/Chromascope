import math

# Maps human-readable seasonal labels → product season tag codes
SEASON_CODE_MAP = {
    # Autumn
    "soft autumn":   "au-soft",
    "true autumn":   "au-true",
    "deep autumn":   "au-deep",
    # Spring
    "light spring":  "sp-light",
    "true spring":   "sp-true",
    "warm spring":   "sp-warm",
    # Summer
    "light summer":  "su-light",
    "true summer":   "su-true",
    "soft summer":   "su-soft",
    # Winter
    "deep winter":   "wi-deep",
    "true winter":   "wi-true",
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
    return round(math.sqrt((dLp/SL)**2 + (dCp/SC)**2 + (dHp/SH)**2), 2)

def _resolve_season_code(seasonal_label: str) -> str:
    """Translate 'Soft Autumn' → 'au-soft', or pass through if already a code."""
    if not seasonal_label:
        return ""
    return SEASON_CODE_MAP.get(seasonal_label.lower().strip(), seasonal_label.lower().strip())

def _product_season_codes(product: dict) -> list:
    """Return all season codes on the product as a lowercase list."""
    tags = product.get("season_tags", "")
    if isinstance(tags, list):
        return [t.lower().strip() for t in tags if t]
    if isinstance(tags, str) and tags:
        return [t.lower().strip() for t in tags.split(",") if t.strip()]
    # Fallback to computed single tag
    computed = product.get("season_tag_computed", "")
    return [computed.lower().strip()] if computed else []

def run_color_matching(products: list, seasonal_label: str, user_lab: tuple, category: str) -> list:
    scored = []
    is_face = category.lower() == "face"
    user_code = _resolve_season_code(seasonal_label)

    for p in products:
        product_codes = _product_season_codes(p)
        is_season = bool(user_code and user_code in product_codes)
        item = {**p, "is_season_match": is_season}

        # Only calculate color distance for face products
        if is_face:
            try:
                L, a, b = p.get('lab_L'), p.get('lab_a'), p.get('lab_b')
                if user_lab and L is not None:
                    prod_lab = (float(L), float(a or 0), float(b or 0))
                    if any(v != 0 for v in prod_lab):
                        item["delta_e"] = delta_e_ciede2000(user_lab, prod_lab)
            except Exception:
                pass

        scored.append(item)

    if is_face:
        scored.sort(key=lambda x: (
            x.get("delta_e", 999) * (0.5 if x.get("is_season_match", False) else 1.0)
        ))
    else:
        # Lips, Eyes, etc. — season matches first, then by verdict (safe → caution → excluded)
        verdict_order = {"safe": 0, "caution": 1, "excluded": 2}
        scored.sort(key=lambda x: (
            0 if x.get("is_season_match") else 1,
            verdict_order.get(x.get("verdict", "").lower(), 1)
        ))

    return scored