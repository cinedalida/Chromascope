import argparse
import ast
import csv
import hashlib
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Philippine retailers only. Ulta (US) is left out on purpose.
STORES = ("sephora", "rustans", "maybelline")

# AR region -> scraper (category, subcategory) pairs. Cheeks use Blush only.
REGION_MAP = {
    "lips": [
        ("lip", "Lipstick"),
        ("lip", "Lip color"),
        ("lip", "Lip gloss"),
        ("lip", "Lip stain & tint"),
    ],
    "cheeks": [
        ("cheek", "Blush"),
    ],
    "eyeshadow": [
        ("eye", "Eye shadow"),
        ("eye", "Eyeshadow"),
    ],
}

REPO_ROOT   = Path(__file__).resolve().parents[2]
DEFAULT_SRC = REPO_ROOT.parent / "MakeUp_Scraper" / "data" / "decoded"
DEFAULT_OUT = REPO_ROOT / "frontend" / "public" / "data"
SAMPLE_SEED = 42
SAMPLE_SIZE = 5

PAIR_TO_REGION = {pair: region for region, pairs in REGION_MAP.items() for pair in pairs}


def parse_args():
    parser = argparse.ArgumentParser(description="Build the AR Browse shade catalog from the scraper CSVs.")
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC, help="decoded scraper data folder")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output folder for the JSON files")
    return parser.parse_args()


def parse_triplet(text):
    value = ast.literal_eval(text)
    if not isinstance(value, tuple) or len(value) != 3:
        raise ValueError("expected 3 values")
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in value):
        raise ValueError("expected numbers")
    return value


def parse_price(text):
    text = text.strip()
    if not text:
        return None
    value = float(text)
    return int(value) if value.is_integer() else value


def clean_product_name(name):
    # Drop a trailing size such as " • 3.6g".
    if " • " in name:
        name = name.rsplit(" • ", 1)[0]
    return name.strip()


def shade_id(store, url, shade_name, shade_lab_text):
    key = f"{store}|{url}|{shade_name}|{shade_lab_text}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def build_entry(store, row, rgb, lab):
    finish = (row.get("finish") or "").strip() if store == "sephora" else ""
    return {
        "id":       shade_id(store, row["product_url"], row["shade_name"], row["shade_lab"]),
        "store":    store,
        "brand":    row["product_brand"],
        "product":  clean_product_name(row["product_name"]),
        "shade":    row["shade_name"],
        "hex":      "#{:02X}{:02X}{:02X}".format(*rgb),
        "lab":      list(lab),
        "price":    parse_price(row["price"]),
        "currency": row["price_currency"],
        "finish":   finish or None,
        "url":      row["product_url"],
    }


def read_catalog(src):
    entries = {region: [] for region in REGION_MAP}
    seen    = {region: set() for region in REGION_MAP}
    drops   = Counter()
    rows_read = 0

    for store_dir in sorted(p for p in src.iterdir() if p.is_dir()):
        store = store_dir.name
        for csv_path in sorted(store_dir.glob("csv_*.csv")):
            with open(csv_path, encoding="utf-8-sig", newline="") as fh:
                for row in csv.DictReader(fh):
                    rows_read += 1

                    if store not in STORES:
                        drops["store not allowed"] += 1
                        continue

                    region = PAIR_TO_REGION.get((row["category"], row["subcategory"]))
                    if region is None:
                        drops["not in map"] += 1
                        continue

                    if not row["shade_rgb"].strip() or not row["shade_lab"].strip():
                        drops["blank color"] += 1
                        continue

                    try:
                        rgb = parse_triplet(row["shade_rgb"])
                        lab = parse_triplet(row["shade_lab"])
                        valid = all(isinstance(v, int) and 0 <= v <= 255 for v in rgb) and 0 <= lab[0] <= 100
                    except (ValueError, SyntaxError):
                        valid = False
                    if not valid:
                        drops["invalid value"] += 1
                        continue

                    key = (store, row["product_url"], row["shade_name"], row["shade_lab"])
                    if key in seen[region]:
                        drops["duplicate"] += 1
                        continue
                    seen[region].add(key)

                    entries[region].append(build_entry(store, row, rgb, lab))

    for region_entries in entries.values():
        region_entries.sort(key=lambda e: (e["brand"].casefold(), e["product"].casefold(), e["shade"].casefold(), e["id"]))

    return entries, drops, rows_read


def write_catalog(entries, out):
    out.mkdir(parents=True, exist_ok=True)
    paths = {}
    for region, region_entries in entries.items():
        path = out / f"ar-shades-{region}.json"
        text = json.dumps(region_entries, ensure_ascii=False, separators=(",", ":")) + "\n"
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        paths[region] = path
    return paths


def print_report(entries, drops, rows_read, paths):
    kept = sum(len(e) for e in entries.values())

    print("\n[Rows]")
    print(f"  Read:    {rows_read}")
    print(f"  Kept:    {kept}")
    print(f"  Dropped: {sum(drops.values())}")
    for reason in ("store not allowed", "not in map", "blank color", "invalid value", "duplicate"):
        print(f"    {reason}: {drops[reason]}")

    print("\n[Regions]")
    for region, region_entries in entries.items():
        products = {(e["store"], e["url"]) for e in region_entries}
        print(f"  {region}: {len(region_entries)} shades, {len(products)} products")
        by_store = defaultdict(list)
        for e in region_entries:
            by_store[e["store"]].append(e)
        for store in STORES:
            store_entries = by_store.get(store, [])
            store_products = {e["url"] for e in store_entries}
            print(f"    {store}: {len(store_entries)} shades, {len(store_products)} products")

    print("\n[Files]")
    for region, path in paths.items():
        print(f"  {path.name}: {path.stat().st_size:,} bytes")

    print("\n[Samples]")
    rng = random.Random(SAMPLE_SEED)
    for region, region_entries in entries.items():
        print(f"  {region}:")
        for e in rng.sample(region_entries, min(SAMPLE_SIZE, len(region_entries))):
            print(f"    {e['id']}  {e['hex']}  {e['store']} | {e['brand']} | {e['product']} | {e['shade']}")


if __name__ == "__main__":
    # Product names contain characters some Windows consoles cannot print.
    sys.stdout.reconfigure(errors="replace")

    args = parse_args()
    if not args.src.is_dir():
        print(f"[ERROR] Source folder not found: {args.src}")
        sys.exit(1)

    print(f"[Source] {args.src}")
    print(f"[Output] {args.out}")

    entries, drops, rows_read = read_catalog(args.src)
    paths = write_catalog(entries, args.out)
    print_report(entries, drops, rows_read, paths)

    print("\n✓ AR shade catalog built\n")
