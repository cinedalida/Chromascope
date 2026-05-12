import math

def delta_e_ciede2000(lab1: tuple, lab2: tuple) -> float:
    """
    CIEDE2000 Perceptual Color Difference.
    Calculates distance between two LAB values. Lower = Closer match.
    """
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    # Step 1: Compute C and a adjusted
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

    # Step 2: Delta L, C, H
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

    Lp_avg = (L1 + L2) / 2
    Cp_avg = (C1p + C2p) / 2
    
    T = (1 - 0.17 * math.cos(math.radians(Lp_avg - 30)) +
         0.24 * math.cos(math.radians(2 * Lp_avg)) +
         0.32 * math.cos(math.radians(3 * Lp_avg + 6)) -
         0.20 * math.cos(math.radians(4 * Lp_avg - 63)))

    SL = 1 + 0.015 * (Lp_avg - 50)**2 / math.sqrt(20 + (Lp_avg - 50)**2)
    SC = 1 + 0.045 * Cp_avg
    SH = 1 + 0.015 * Cp_avg * T

    # Step 4: Final calculation
    return round(math.sqrt((dLp/SL)**2 + (dCp/SC)**2 + (dHp/SH)**2), 2)

def run_color_matching(safe_products: list, user_lab: tuple, category: str, top_k: int = 5) -> list:
    """
    Ranks safe products from the database by shade accuracy.
    """
    scored = []
    for p in safe_products:
        try:
            # Pull numbers directly from your 'products' collection
            prod_lab = (float(p.get('lab_L', 0)), float(p.get('lab_a', 0)), float(p.get('lab_b', 0)))
            
            # Skip products that have no color data
            if sum(prod_lab) == 0: continue
            
            diff = delta_e_ciede2000(user_lab, prod_lab)
            scored.append({**p, "delta_e": diff})
        except:
            continue

    # Closest match (lowest ΔE) first
    scored.sort(key=lambda x: x["delta_e"])
    return scored[:top_k]