r"""Convert the scraped product database into the app's catalog format (PLAN_CATALOG.md, Phase 1).

Input : <data dir>/derived/{products,shades,formulas}.csv   (private chromascope-data repo)
Output: <data dir>/derived/app_catalog.json                 (stays in the PRIVATE repo; retailer data, never commit it
                                                             to the public app repo)
One entry per product with its shades inside; each shade keeps its name, colour and formula.

Every product is tagged with its color season (season_tags, season_tag_computed, season_scores, match_basis) by
app/core/season_classifier.py. By default with the committed percentile norms (app/core/season_norms.json); pass
--fit-norms to refit those norms on this catalog first (a deliberate release: scores shift, so also bump
season_classifier.NORMS_VERSION and re-tag the database with scripts/classify_products_season.py).

Usage (from backend/): venv\Scripts\python -m scripts.build_catalog "C:\...\chromascope-data" [--fit-norms]
"""
import ast
import json
import os
import sys
from collections import Counter

import pandas as pd

from app.core import season_classifier as sc

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


def tag_seasons(products: list, refit_norms: bool = False) -> None:
    """Fill the season fields of every classifiable product in place (see app/core/season_classifier.py)."""
    if refit_norms:
        norms = sc.fit_norms(products)
        with open(sc.NORMS_PATH, "w", encoding="utf-8") as fh:
            json.dump(norms, fh, indent=1)
        sc._NORMS_CACHE.clear()
        print("refitted", sc.NORMS_PATH)
    else:
        norms = sc.get_norms()
    for p in products:
        result = sc.classify_product(p, norms)
        if result:
            p.update({k: v for k, v in result.items() if not k.startswith("_")})


def build(data_dir: str, refit_norms: bool = False) -> dict:
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
    tag_seasons(products, refit_norms)
    return {"catalog_version": CATALOG_VERSION, "products": products}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    data_dir = args[0]
    cat = build(data_dir, refit_norms="--fit-norms" in sys.argv)
    out = os.path.join(data_dir, "derived", "app_catalog.json")
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(cat, fh, ensure_ascii=False)
    prods = cat["products"]
    print(f"wrote {out}: {len(prods)} products, {sum(len(p['shades']) for p in prods)} shades, "
          f"{sum(len(p['formulas']) for p in prods)} formulas, {os.path.getsize(out) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
