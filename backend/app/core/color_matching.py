import math


# ─────────────────────────────────────────────────────────────────────────────
# CIEDE2000 — Full perceptual color difference formula
# Reference: Sharma et al. (2005)
# ─────────────────────────────────────────────────────────────────────────────

def delta_e_ciede2000(lab1: tuple, lab2: tuple) -> float:
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    # Step 1 — Compute C* and adjusted a'
    C1     = math.sqrt(a1**2 + b1**2)
    C2     = math.sqrt(a2**2 + b2**2)
    C_avg  = (C1 + C2) / 2
    C_avg7 = C_avg**7
    G      = 0.5 * (1 - math.sqrt(C_avg7 / (C_avg7 + 25**7)))

    a1p = a1 * (1 + G)
    a2p = a2 * (1 + G)

    C1p = math.sqrt(a1p**2 + b1**2)
    C2p = math.sqrt(a2p**2 + b2**2)

    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360

    # Step 2 — Delta L*, C*, h*, H*
    dLp = L2 - L1
    dCp = C2p - C1p

    if C1p * C2p == 0:
        dhp = 0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    elif h2p - h1p > 180:
        dhp = h2p - h1p - 360
    else:
        dhp = h2p - h1p + 360

    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))

    # Step 3 — Averages
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

    # Step 4 — Weighting functions
    T  = (1
          - 0.17 * math.cos(math.radians(hp_avg - 30))
          + 0.24 * math.cos(math.radians(2 * hp_avg))
          + 0.32 * math.cos(math.radians(3 * hp_avg + 6))
          - 0.20 * math.cos(math.radians(4 * hp_avg - 63)))

    SL = 1 + 0.015 * (Lp_avg - 50)**2 / math.sqrt(20 + (Lp_avg - 50)**2)
    SC = 1 + 0.045 * Cp_avg
    SH = 1 + 0.015 * Cp_avg * T

    Cp_avg7 = Cp_avg**7
    RC      = 2 * math.sqrt(Cp_avg7 / (Cp_avg7 + 25**7))
    d_theta = 30 * math.exp(-((hp_avg - 275) / 25)**2)
    RT      = -math.sin(math.radians(2 * d_theta)) * RC

    # Step 5 — Final Delta E
    return math.sqrt(
        (dLp / SL)**2 +
        (dCp / SC)**2 +
        (dHp / SH)**2 +
        RT * (dCp / SC) * (dHp / SH)
    )


# ─────────────────────────────────────────────────────────────────────────────
# SEASONAL LABEL FILTERING
# ─────────────────────────────────────────────────────────────────────────────

def filter_by_season(products: list, seasonal_label: str) -> list:
    """
    Filters safe products by the user's predicted seasonal label.
    Checks both season_tags and season_tag_computed fields.

    Parameters
    ----------
    products       : list — safe products from Jan's safety filter
    seasonal_label : str  — from Marti's classifier e.g. "SP-TRUE"

    Returns
    -------
    list of products whose season tags include the predicted label
    """
    if not seasonal_label:
        return products

    return [
        p for p in products
        if seasonal_label in p.get("season_tags", "")
        or seasonal_label == p.get("season_tag_computed", "")
    ]


# ─────────────────────────────────────────────────────────────────────────────
# DELTA E RANKING
# ─────────────────────────────────────────────────────────────────────────────

def rank_by_delta_e(
    products: list,
    user_lab: tuple,
    threshold: float = 5.0,
    top_k: int = 10,
) -> list:
    """
    Ranks products by CIEDE2000 Delta E distance from user's skin LAB.
    Used for Foundation / skin-tone base products.

    Parameters
    ----------
    products  : list  — safe products from Jan's filter
    user_lab  : tuple — (L, a, b) from Marti's facial image processing
    threshold : float — max Delta E to include (default 5.0 per diagram)
    top_k     : int   — max number of results to return

    Returns
    -------
    list sorted by delta_e ascending (closest match first)
    """
    if not user_lab:
        return products

    scored = []
    for p in products:
        L = p.get("lab_L")
        a = p.get("lab_a")
        b = p.get("lab_b")

        if not all([L is not None, a is not None, b is not None]):
            continue

        de = delta_e_ciede2000(user_lab, (float(L), float(a), float(b)))

        if de <= threshold:
            scored.append({**p, "delta_e": round(de, 4)})

    scored.sort(key=lambda x: x["delta_e"])
    return scored[:top_k]


# ─────────────────────────────────────────────────────────────────────────────
# SEASON CENTROID RANKING
# ─────────────────────────────────────────────────────────────────────────────

SEASON_CENTROIDS = {
    "SP-TRUE":   (72.0,  18.5,  22.0),
    "SP-LIGHT":  (82.0,  12.0,  15.0),
    "SP-BRIGHT": (65.0,  35.0,  30.0),
    "SP-SOFT":   (68.0,  14.0,  18.0),
    "SU-TRUE":   (70.0,   8.0,   5.0),
    "SU-LIGHT":  (85.0,   5.0,   3.0),
    "SU-SOFT":   (62.0,   6.0,   2.0),
    "SU-DEEP":   (42.0,   8.0,   3.0),
    "AU-TRUE":   (55.0,  18.0,  28.0),
    "AU-DEEP":   (35.0,  20.0,  22.0),
    "AU-SOFT":   (65.0,  12.0,  18.0),
    "AU-LIGHT":  (75.0,  10.0,  20.0),
    "WI-TRUE":   (45.0,  10.0,  -8.0),
    "WI-DEEP":   (28.0,  12.0,  -5.0),
    "WI-BRIGHT": (60.0,  25.0,  -5.0),
    "WI-SOFT":   (55.0,   8.0,  -3.0),
}


def rank_by_centroid(
    products: list,
    seasonal_label: str,
    top_k: int = 10,
) -> list:
    """
    Ranks seasonally-filtered products by proximity to the
    season's LAB centroid (anchor point).
    Used for Lip, Blush, Eye, Concealer, Multi-Use products.

    Parameters
    ----------
    products       : list — already filtered by filter_by_season()
    seasonal_label : str  — e.g. "SP-TRUE"
    top_k          : int  — max results to return

    Returns
    -------
    list sorted by season_distance ascending (closest to centroid first)
    """
    centroid = SEASON_CENTROIDS.get(seasonal_label)
    if not centroid:
        return products[:top_k]

    scored = []
    for p in products:
        L = p.get("lab_L")
        a = p.get("lab_a")
        b = p.get("lab_b")

        if all([L is not None, a is not None, b is not None]):
            distance = delta_e_ciede2000(centroid, (float(L), float(a), float(b)))
        else:
            distance = 999.0

        scored.append({**p, "season_distance": round(distance, 4)})

    scored.sort(key=lambda x: x["season_distance"])
    return scored[:top_k]


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def run_color_matching(safe_products: list, seasonal_label: str, user_lab: tuple = None, category: str = None, top_k: int = 10,) -> list:
    if category == "Face":
        # Foundation — match by skin tone Delta E
        return rank_by_delta_e(safe_products, user_lab, top_k=top_k)
    else:
        # Everything else — filter by season then rank by centroid
        season_filtered = filter_by_season(safe_products, seasonal_label)
        return rank_by_centroid(season_filtered, seasonal_label, top_k=top_k)