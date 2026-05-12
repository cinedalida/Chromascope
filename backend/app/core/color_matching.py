import math

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
    T = (1 - 0.17 * math.cos(math.radians(Lp_avg - 30)) +
         0.24 * math.cos(math.radians(2 * Lp_avg)) +
         0.32 * math.cos(math.radians(3 * Lp_avg + 6)) -
         0.20 * math.cos(math.radians(4 * Lp_avg - 63)))
    SL = 1 + 0.015 * (Lp_avg - 50)**2 / math.sqrt(20 + (Lp_avg - 50)**2)
    SC = 1 + 0.045 * Cp_avg
    SH = 1 + 0.015 * Cp_avg * T
    return round(math.sqrt((dLp/SL)**2 + (dCp/SC)**2 + (dHp/SH)**2), 2)

def run_color_matching(safe_products: list, seasonal_label: str, user_lab: tuple, category: str) -> list:
    scored = []
    print(f"--- START MATCHING: {category} ---")
    
    for p in safe_products:
        p_name = p.get("product_name", "")
        if "VICE COSMETICS ONE & DONE BRONTOUR" in p_name.upper():
            continue
            
        is_season = (str(seasonal_label).lower() == str(p.get("season_tag_computed")).lower())
        item = {**p, "is_season_match": is_season}
        try:
            L, a, b = p.get('lab_L'), p.get('lab_a'), p.get('lab_b')
            if user_lab and L is not None:
                prod_lab = (float(L), float(a or 0), float(b or 0))
                if any(v != 0 for v in prod_lab):
                    item["delta_e"] = delta_e_ciede2000(user_lab, prod_lab)
                    print(f"[MATCH] {p_name} -> delta_e: {item['delta_e']}")
        except Exception as e:
            print(f"[ERROR] Math crash on {p_name}: {e}")
        scored.append(item)
        
    scored.sort(key=lambda x: (
        x.get("delta_e", 999) * (0.5 if x.get("is_season_match", False) else 1.0)
    ))
    return scored