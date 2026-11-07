"""Classify products into the 12 color seasons and (optionally) store the tags in Firestore.

Default is a DRY RUN: it classifies every product, prints a summary and writes review reports. Nothing is written to the
database unless --apply is given, and the REAL database additionally needs --production (same safety rules as
import_catalog.py: without --production the script refuses unless it is pointed at the emulator).

  python scripts/classify_products_season.py --from-json products_v2.json                 # dry run from a dump
  python scripts/classify_products_season.py                                              # dry run, reads the DB
  python scripts/classify_products_season.py --from-json products_v2.json --fit-norms     # (re)fit season_norms.json
  python scripts/classify_products_season.py --production --apply                         # write (backup is saved first)
  python scripts/classify_products_season.py --production --rollback out/season_X/backup_Y.json

Run from the backend folder. The method is in app/core/season_classifier.py (the live API uses the same module).
Reports (in --out, default scripts/out/season_<date>/): summary.json, products.csv, shades.csv, contact_sheet.html,
and weak_consistency.json when --old-products is given.
"""
import argparse
import csv
import datetime
import html
import json
import os
import re
import sys
from collections import Counter

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

from app.core import season_classifier as sc  # noqa: E402

WRITE_FIELDS = ("season_tag_computed", "season_tags", "season_scores", "match_basis", "season_classifier_version")
MISSING = "__missing__"  # marker in the backup for a field that did not exist


# ------------------------------------------------------------------------------------------------ data

def load_products(args):
    if args.from_json:
        with open(args.from_json, encoding="utf-8") as fh:
            return json.load(fh), None
    from app.firebase_init import init_firebase, using_emulators
    if not using_emulators() and not args.production:
        sys.exit("Refusing to read the real database without --production (or use --from-json).")
    init_firebase()
    from firebase_admin import firestore
    db = firestore.client()
    docs = list(db.collection(args.collection).stream())
    return [{**d.to_dict(), "product_id": d.id} for d in docs], db


# ------------------------------------------------------------------------------------------------ reports

def shade_rows(products, norms):
    """One row per usable harmony shade, with its 12 season scores."""
    rows = []
    for p in products:
        region = sc.product_region(p)
        if sc.REGION_BASIS.get(region) != "harmony":
            continue
        for shade in sc.product_shades(p):
            lab = sc.shade_lab(shade)
            if not lab:
                continue
            t, v, c, _ = sc.shade_axes(lab, region, norms)
            scores = sc.season_scores(lab, region, norms)
            ranked = sorted(scores, key=scores.get, reverse=True)
            rows.append({
                "product_id": p.get("product_id"), "brand": p.get("brand", ""), "product": p.get("product_name", ""),
                "region": region, "shade": shade.get("name", ""), "hex": shade.get("hex") or "",
                "L": round(lab[0], 1), "a": round(lab[1], 1), "b": round(lab[2], 1),
                "T": round(t, 2), "V": round(v, 2), "C": round(c, 2),
                "top": ranked[0], "top_score": round(scores[ranked[0]], 3), "second": ranked[1],
                "margin": round(scores[ranked[0]] - scores[ranked[1]], 3), "scores": scores,
            })
    return rows


def write_csvs(out, products, results, rows):
    with open(os.path.join(out, "products.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["product_id", "brand", "product", "category", "sub_category", "region", "basis",
                    "old_season_tags", "old_season_tag_computed", "new_season_tag_computed", "new_season_tags",
                    "top3", "strong_seasons", "usable_shades", "flag"])
        for p in products:
            r = results.get(p.get("product_id"))
            dbg = (r or {}).get("_debug", {})
            flag = "unclassifiable" if r is None else ""
            if r and r["season_tags"] == "ALL" and r["match_basis"] == "harmony":
                flag = "broad"
            w.writerow([p.get("product_id"), p.get("brand", ""), p.get("product_name", ""), p.get("category", ""),
                        p.get("sub_category", ""), sc.product_region(p) or "", (r or {}).get("match_basis", ""),
                        p.get("season_tags", ""), p.get("season_tag_computed", ""),
                        (r or {}).get("season_tag_computed", ""), (r or {}).get("season_tags", ""),
                        " ".join(dbg.get("top3", [])), dbg.get("strong", ""), dbg.get("usable_shades", ""), flag])
    with open(os.path.join(out, "shades.csv"), "w", newline="", encoding="utf-8") as fh:
        cols = ["product_id", "brand", "product", "region", "shade", "hex", "L", "a", "b", "T", "V", "C",
                "top", "top_score", "second", "margin"]
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def swatch(row):
    label = html.escape(f"{row['brand']} {row['product'][:40]} | {row['shade'][:28]}")
    return (f'<div class="sw" title="{label} ({row["region"]}, score {row["top_score"]})">'
            f'<span style="background:{html.escape(row["hex"] or "#ccc")}"></span>'
            f'<small>{html.escape(row["product"][:22])}<br>{html.escape(row["shade"][:22])}<br>'
            f'{row["top_score"]:.2f} · T{row["T"]:+.1f} V{row["V"]:.1f} C{row["C"]:.1f}</small></div>')


def write_contact_sheet(out, rows):
    """One section per season: its best-fitting shades and its most borderline ones, for a human to judge."""
    parts = ["<!doctype html><meta charset=utf-8><title>Season contact sheet</title><style>"
             "body{font:13px system-ui;margin:20px;color:#222}h2{margin:28px 0 4px}.g{display:flex;flex-wrap:wrap;gap:8px}"
             ".sw{width:112px}.sw span{display:block;height:46px;border-radius:6px;border:1px solid #0002}"
             "small{font-size:10px;color:#555;line-height:1.25;display:block;margin-top:2px}"
             "p{margin:2px 0 8px;color:#666}</style><h1>Season contact sheet</h1>"
             "<p>For each season: shades that fit it best, then shades that landed in it only just (small margin to the "
             "runner-up). Judge whether each swatch really suits the season. Hover for product names.</p>"]
    for code, label in sc.SEASON_LABEL.items():
        mine = [r for r in rows if r["top"] == code]
        best = sorted(mine, key=lambda r: -r["top_score"])[:24]
        border = sorted(mine, key=lambda r: r["margin"])[:16]
        parts.append(f"<h2>{html.escape(label)} <small>({code}, {len(mine)} shades land here)</small></h2>"
                     f'<p>Best fits</p><div class="g">{"".join(swatch(r) for r in best)}</div>'
                     f'<p>Borderline</p><div class="g">{"".join(swatch(r) for r in border)}</div>')
    with open(os.path.join(out, "contact_sheet.html"), "w", encoding="utf-8") as fh:
        fh.write("".join(parts))


def summarize(products, results, rows):
    basis = Counter((r or {}).get("match_basis", "unclassifiable") for r in map(lambda p: results.get(p.get("product_id")), products))
    harmony = [r for r in results.values() if r["match_basis"] == "harmony"]
    primary = Counter(r["season_tag_computed"] for r in harmony)
    broad = sum(1 for r in harmony if r["season_tags"] == "ALL")
    tag_counts = [len(r["season_tags"].split(",")) for r in harmony if r["season_tags"] != "ALL"]
    shade_top = Counter(r["top"] for r in rows)
    n = len(harmony) or 1
    summary = {
        "classifier_version": sc.CLASSIFIER_VERSION,
        "products": len(products), "basis": dict(basis),
        "harmony_primary_season": dict(primary.most_common()),
        "harmony_broad_ALL": broad, "harmony_broad_share": round(broad / n, 3),
        "avg_tags_per_narrow_product": round(sum(tag_counts) / len(tag_counts), 2) if tag_counts else None,
        "harmony_shades": len(rows), "harmony_shades_by_top_season": {SEASON: shade_top[c] for c, SEASON in sc.SEASON_LABEL.items()},
    }
    max_share = max(primary.values()) / n if primary else 0
    summary["gates"] = {
        "all_12_seasons_used": len(primary) == 12,
        "largest_primary_share": round(max_share, 3), "largest_share_le_25pct": max_share <= 0.25,
        "broad_share_lt_15pct": broad / n < 0.15,
        "avg_tags_2_to_3": bool(tag_counts) and 2 <= sum(tag_counts) / len(tag_counts) <= 3,
    }
    return summary


def _norm_name(p):
    return re.sub(r"\s*•.*$", "", str(p.get("product_name", ""))).strip().lower() + "|" + str(p.get("brand", "")).strip().lower()


def weak_consistency(products, results, old_products):
    """Family-level agreement with the old hand tags. The old tags are broad (about 3 of 4 families), so this is only a
    sanity check: chance agreement is already high."""
    old = {_norm_name(p): p for p in old_products}
    pairs = agree = 0
    for p in products:
        r = results.get(p.get("product_id"))
        o = old.get(_norm_name(p))
        if not r or r["match_basis"] != "harmony" or r["season_tags"] == "ALL" or not o:
            continue
        families = set(re.findall(r"\b(SP|SU|AU|WI)\b", str(o.get("season_tags", "")).upper()))
        if not families:
            continue
        pairs += 1
        agree += r["season_tag_computed"] and sc.SEASON_CODE[r["season_tag_computed"].lower()][:2].upper() in families
    return {"matched_products_with_old_family_tags": pairs, "primary_season_family_inside_old_tags": int(agree),
            "note": "weak check only: old tags list about 3 of 4 families per product, so chance agreement is high"}


# ------------------------------------------------------------------------------------------------ write / rollback

def classify_all(products, norms):
    results = {}
    for p in products:
        r = sc.classify_product(p, norms)
        if r:
            results[p["product_id"]] = r
    return results


def apply_changes(db, args, products, results, out):
    from firebase_admin import firestore
    col = db.collection(args.collection)
    todo = {}
    backup = {}
    for p in products:
        r = results.get(p.get("product_id"))
        if not r:
            continue
        new = {f: r[f] for f in WRITE_FIELDS}
        if all(p.get(f, MISSING) == new[f] for f in WRITE_FIELDS):
            continue  # already up to date: running twice changes nothing
        todo[p["product_id"]] = new
        backup[p["product_id"]] = {f: p.get(f, MISSING) for f in WRITE_FIELDS}
    print(f"{len(todo)} of {len(results)} classified products need an update")
    if not todo:
        return
    path = os.path.join(out, f"backup_{datetime.datetime.now():%Y%m%d_%H%M%S}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"collection": args.collection, "values": backup}, fh)
    print("backup of previous values saved:", path)
    batch, n = db.batch(), 0
    for pid, fields in todo.items():
        batch.update(col.document(pid), fields)
        n += 1
        if n % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()
    print(f"wrote {n} products to {args.collection}")


def rollback(db, args):
    from firebase_admin import firestore
    with open(args.rollback, encoding="utf-8") as fh:
        saved = json.load(fh)
    col = db.collection(saved["collection"])
    batch, n = db.batch(), 0
    for pid, old in saved["values"].items():
        fields = {f: (firestore.DELETE_FIELD if v == MISSING else v) for f, v in old.items()}
        batch.update(col.document(pid), fields)
        n += 1
        if n % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()
    print(f"restored {n} products in {saved['collection']}")


# ------------------------------------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--from-json", help="product dump (export_products_v2.py) instead of reading the database")
    ap.add_argument("--collection", default=os.environ.get("PRODUCTS_COLLECTION", "products_v2"))
    ap.add_argument("--fit-norms", action="store_true", help="refit and overwrite app/core/season_norms.json")
    ap.add_argument("--old-products", help="dump of the old hand-tagged 'products' collection (weak consistency check)")
    ap.add_argument("--out", help="report folder (default scripts/out/season_<date>)")
    ap.add_argument("--apply", action="store_true", help="write the tags to the database (default: dry run)")
    ap.add_argument("--production", action="store_true", help="allow the REAL database")
    ap.add_argument("--rollback", metavar="BACKUP_JSON", help="restore the values saved by a previous --apply")
    args = ap.parse_args()

    if args.rollback or args.apply:
        from app.firebase_init import using_emulators
        if not using_emulators() and not args.production:
            sys.exit("Refusing: not pointed at the emulator. Add --production to target the real database.")
        if args.production and using_emulators():
            sys.exit("Refusing: --production given but emulator variables are set.")
        if args.production and args.collection == "products":
            sys.exit("Refusing: 'products' is the old hand-tagged catalog; never write season tags over it.")

    if args.rollback:
        from app.firebase_init import init_firebase
        from firebase_admin import firestore
        init_firebase()
        rollback(firestore.client(), args)
        return

    products, db = load_products(args)
    print(f"{len(products)} products loaded")

    if args.fit_norms:
        norms = sc.fit_norms(products)
        with open(sc.NORMS_PATH, "w", encoding="utf-8") as fh:
            json.dump(norms, fh, indent=1)
        sc._NORMS_CACHE.clear()
        print("fitted norms ->", sc.NORMS_PATH, {r: g["n"] for r, g in norms["groups"].items()})
    norms = sc.get_norms()

    out = args.out or os.path.join(BACKEND, "scripts", "out", f"season_{datetime.date.today():%Y%m%d}")
    os.makedirs(out, exist_ok=True)

    results = classify_all(products, norms)
    rows = shade_rows(products, norms)
    summary = summarize(products, results, rows)
    if args.old_products:
        with open(args.old_products, encoding="utf-8") as fh:
            summary["weak_consistency_vs_old_hand_tags"] = weak_consistency(products, results, json.load(fh))
    with open(os.path.join(out, "summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=1, ensure_ascii=False)
    write_csvs(out, products, results, rows)
    write_contact_sheet(out, rows)
    print(json.dumps(summary, indent=1, ensure_ascii=False))
    print("reports in", out)

    if args.apply:
        if db is None:
            from app.firebase_init import init_firebase
            from firebase_admin import firestore
            init_firebase()
            db = firestore.client()
        apply_changes(db, args, products, results, out)
    else:
        print("DRY RUN: nothing was written to the database.")


if __name__ == "__main__":
    main()
