"""Import the scraped PH product database (Sephora PH, Rustan's PH, Maybelline PH) and build three tables.

    products.csv  one row per product (product_url), with a primary category for stratification
    formulas.csv  one row per distinct (product_url, ingredients): the unit the safety filter judges
    shades.csv    one row per shade, pointing to its product_id and formula_id

Input : $CHROMASCOPE_DATA_DIR/products/decoded/<store>/*.csv   (private data repo; never commit it here)
Output: $CHROMASCOPE_DATA_DIR/derived/{products,formulas,shades}.csv + manifest.json

Rules (PLAN.md Phase 1):
- Only the three PH stores; Ulta is never read.
- Cross-listing duplicates (same product_url + shade_name + shade_lab in several subcategory files) are dropped.
  In the committed data they always carry identical ingredients and price; this is asserted, not assumed.
- Ingredient strings are kept exactly as decoded (order = concentration).
- IDs are SHA-1 prefixes of their natural keys, so they are stable across runs and machines.
- primary_category = the category with the most shade rows for that product; ties -> alphabetical.
"""
import glob, hashlib, json, os, sys
import pandas as pd

STORES = ('sephora', 'rustans', 'maybelline')
PRODUCT_COLS = ['product_brand', 'product_name', 'price', 'price_currency', 'product_img_url',
                'finish', 'coverage', 'oil_free', 'paraben_free', 'sulphate_free', 'fragrance_free', 'silicone_free']


def data_dir():
    return os.environ.get('CHROMASCOPE_DATA_DIR',
                          os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data'))


def sha(*parts, n=12):
    return hashlib.sha1('\n'.join(parts).encode('utf-8')).hexdigest()[:n]


def load_raw(root):
    frames = []
    for store in STORES:
        files = sorted(glob.glob(os.path.join(root, 'products', 'decoded', store, '*.csv')))
        if not files:
            sys.exit(f'no CSVs for {store} under {root}/products/decoded/ (set CHROMASCOPE_DATA_DIR)')
        for f in files:
            d = pd.read_csv(f, dtype=str, keep_default_na=False)
            d['store'], d['source_file'] = store, os.path.basename(f)
            frames.append(d)
    df = pd.concat(frames, ignore_index=True)
    for c in PRODUCT_COLS:
        if c not in df:
            df[c] = ''
    return df


def build(root):
    raw = load_raw(root)
    key = ['product_url', 'shade_name', 'shade_lab']
    grp = raw.groupby(key, sort=False)
    assert (grp.ingredients.nunique() == 1).all(), 'duplicate shade rows with different ingredients'
    assert (grp.price.nunique() == 1).all(), 'duplicate shade rows with different prices'

    # product-level facts from ALL listings (before de-dupe), so every subcategory is recorded
    listings = raw.groupby('product_url').agg(
        categories=('category', lambda s: ';'.join(sorted(set(s)))),
        subcategories=('subcategory', lambda s: ';'.join(sorted(set(s)))),
        source_files=('source_file', lambda s: ';'.join(sorted(set(s)))))
    cat_counts = raw.drop_duplicates(key + ['category']).groupby(['product_url', 'category']).size().reset_index(name='n')
    cat_counts = cat_counts.sort_values(['product_url', 'n', 'category'], ascending=[True, False, True])
    primary = cat_counts.drop_duplicates('product_url').set_index('product_url').category.rename('primary_category')

    shades = raw.drop_duplicates(key, keep='first').copy()
    shades['product_id'] = shades.product_url.map(lambda u: sha(u, n=10))
    shades['formula_id'] = [sha(u, i) for u, i in zip(shades.product_url, shades.ingredients)]
    shades['shade_id'] = [sha(u, n, l) for u, n, l in zip(shades.product_url, shades.shade_name, shades.shade_lab)]
    shades['has_lab'] = (shades.shade_lab.str.strip() != '').astype(int)

    formulas = (shades.groupby('formula_id', sort=False)
                .agg(product_id=('product_id', 'first'), store=('store', 'first'), product_url=('product_url', 'first'),
                     ingredients=('ingredients', 'first'), n_shades=('shade_id', 'size')).reset_index())

    products = shades.drop_duplicates('product_url')[['product_id', 'store', 'product_url'] + PRODUCT_COLS].copy()
    products = products.join(listings, on='product_url').join(primary, on='product_url')
    counts = shades.groupby('product_id').agg(n_shades=('shade_id', 'size'), n_formulas=('formula_id', 'nunique'))
    products = products.join(counts, on='product_id')

    shades = shades[['shade_id', 'product_id', 'formula_id', 'store', 'shade_name', 'shade_lab', 'shade_rgb',
                     'shade_hsv', 'has_lab']]
    order = lambda d, k: d.sort_values(k, kind='mergesort').reset_index(drop=True)
    products = order(products, ['store', 'product_id'])
    formulas = order(formulas, ['store', 'product_id', 'formula_id'])
    shades = order(shades, ['store', 'product_id', 'shade_id'])
    stats = dict(raw_rows=len(raw), duplicate_rows_dropped=len(raw) - len(shades))
    return products, formulas, shades, stats


def file_sha256(path):
    with open(path, 'rb') as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def main(out=None):
    root = data_dir()
    out = out or os.path.join(root, 'derived')
    os.makedirs(out, exist_ok=True)
    products, formulas, shades, stats = build(root)
    for name, d in (('products', products), ('formulas', formulas), ('shades', shades)):
        d.to_csv(os.path.join(out, f'{name}.csv'), index=False, lineterminator='\n')
    src = sorted(glob.glob(os.path.join(root, 'products', 'decoded', '*', '*.csv')))
    manifest = dict(
        stores=list(STORES), **stats,
        counts={s: dict(products=int((products.store == s).sum()), formulas=int((formulas.store == s).sum()),
                        shades=int((shades.store == s).sum())) for s in STORES},
        totals=dict(products=len(products), formulas=len(formulas), shades=len(shades)),
        inputs={os.path.relpath(f, root).replace(os.sep, '/'): file_sha256(f) for f in src},
        outputs={f'{n}.csv': file_sha256(os.path.join(out, f'{n}.csv')) for n in ('products', 'formulas', 'shades')})
    with open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)
    print(json.dumps({k: manifest[k] for k in ('raw_rows', 'duplicate_rows_dropped', 'counts', 'totals')}, indent=1))
    return out


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
