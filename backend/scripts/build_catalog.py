r"""Convert the scraped product database into the app's catalog format (PLAN_CATALOG.md, Phase 1).

Input : <data dir>/derived/{products,shades,formulas}.csv   (private chromascope-data repo)
Output: <data dir>/derived/app_catalog.json                 (stays in the PRIVATE repo; retailer data, never commit it
                                                             to the public app repo)
One entry per product with its shades inside; each shade keeps its name, colour and formula.

Usage (from backend/): venv\Scripts\python -m scripts.build_catalog "C:\...\chromascope-data"
"""
import ast
import json
import os
import sys
from collections import Counter

import pandas as pd

CATEGORY = {"face": "Face", "eye": "Eye", "lip": "Lip", "cheek": "Cheek", "concealer": "Concealer"}
CATALOG_VERSION = "scraped-2026-10"


def _tuple(text):
    try:
        v = ast.literal_eval(text) if text else None
        return [float(x) for x in v] if v and len(v) == 3 else None
    except (ValueError, SyntaxError):
        return None


def _hex(rgb):
    return "#{:02x}{:02x}{:02x}".format(*(max(0, min(255, round(c))) for c in rgb)) if rgb else ""


def _price(text):
    try:
        return float(str(text).replace(",", ""))
    except ValueError:
        return None


def build(data_dir: str) -> dict:
    d = os.path.join(data_dir, "derived")
    P = pd.read_csv(os.path.join(d, "products.csv"), dtype=str, keep_default_na=False)
    S = pd.read_csv(os.path.join(d, "shades.csv"), dtype=str, keep_default_na=False)
    F = pd.read_csv(os.path.join(d, "formulas.csv"), dtype=str, keep_default_na=False)
    formulas = dict(zip(F.formula_id, F.ingredients))
    shades_by_product = {pid: g for pid, g in S.groupby("product_id", sort=False)}

    products = []
    for p in P.itertuples(index=False):
        g = shades_by_product.get(p.product_id)
        shades = []
        for s in (g.itertuples(index=False) if g is not None else []):
            lab = _tuple(s.shade_lab) if s.has_lab == "1" else None
            shades.append({"shade_id": s.shade_id, "name": s.shade_name, "lab": lab,
                           "hex": _hex(_tuple(s.shade_rgb)), "formula_id": s.formula_id})
        used = Counter(s["formula_id"] for s in shades)
        main_formula = used.most_common(1)[0][0] if used else ""
        first_lab = next((s["lab"] for s in shades if s["lab"]), None)
        products.append({
            "product_id": p.product_id,
            "product_name": p.product_name,
            "brand": p.product_brand,
            "category": CATEGORY.get(p.primary_category, p.primary_category.title()),
            "sub_category": p.subcategories,
            "price": _price(p.price),
            "price_currency": p.price_currency,
            "image_url": p.product_img_url,
            "where_to_buy": p.product_url,
            "store": p.store,
            "full_inci_list": formulas.get(main_formula, ""),
            "formulas": {fid: formulas[fid] for fid in used if fid in formulas},
            "shades": shades,
            "lab_L": first_lab[0] if first_lab else None,
            "lab_a": first_lab[1] if first_lab else None,
            "lab_b": first_lab[2] if first_lab else None,
            "hex_color": next((s["hex"] for s in shades if s["lab"]), ""),
            "season_tags": "",
            "source": f"scraped ({p.store})",
            "catalog_version": CATALOG_VERSION,
        })
    return {"catalog_version": CATALOG_VERSION, "products": products}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    data_dir = sys.argv[1]
    cat = build(data_dir)
    out = os.path.join(data_dir, "derived", "app_catalog.json")
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(cat, fh, ensure_ascii=False)
    prods = cat["products"]
    print(f"wrote {out}: {len(prods)} products, {sum(len(p['shades']) for p in prods)} shades, "
          f"{sum(len(p['formulas']) for p in prods)} formulas, {os.path.getsize(out) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
