"""Phase 1 validation for product_db.py (PLAN.md). Recomputes expectations from the source CSVs independently.

Usage: CHROMASCOPE_DATA_DIR=<private data repo> python check_product_db.py
Exit code 0 only if every check passes.
"""
import glob, hashlib, os, sys, tempfile
import pandas as pd
import product_db as pdb

root = pdb.data_dir()
out = os.path.join(root, 'derived')
results = []


def check(name, ok, detail=''):
    results.append(ok)
    print(f'[{"PASS" if ok else "FAIL"}] {name}' + (f'  ({detail})' if detail else ''))


# independent recount from the source files
src = {s: pd.concat([pd.read_csv(f, dtype=str, keep_default_na=False)
                     for f in sorted(glob.glob(os.path.join(root, 'products', 'decoded', s, '*.csv')))])
       for s in pdb.STORES}
exp_products = {s: d.product_url.nunique() for s, d in src.items()}
exp_formulas = sum(len(d.drop_duplicates(['product_url', 'ingredients'])) for d in src.values())
exp_shades = {s: len(d.drop_duplicates(['product_url', 'shade_name', 'shade_lab'])) for s, d in src.items()}

P = pd.read_csv(os.path.join(out, 'products.csv'), dtype=str, keep_default_na=False)
F = pd.read_csv(os.path.join(out, 'formulas.csv'), dtype=str, keep_default_na=False)
S = pd.read_csv(os.path.join(out, 'shades.csv'), dtype=str, keep_default_na=False)

# 1. counts
got = P.groupby('store').size().to_dict()
check('1a products per store = 910 / 121 / 23',
      got == {'sephora': 910, 'rustans': 121, 'maybelline': 23} == exp_products, f'got {got}')
check('1b distinct formulas = 3,091', len(F) == 3091 == exp_formulas, f'got {len(F)}, recount {exp_formulas}')

# 2. integrity
check('2a every shade has a formula_id present in formulas', S.formula_id.isin(F.formula_id).all())
check('2b every shade has a product_id present in products', S.product_id.isin(P.product_id).all())
check('2c every formula belongs to a known product', F.product_id.isin(P.product_id).all())
check('2d no empty ingredients', (F.ingredients.str.strip() != '').all())
check('2e no Ulta rows anywhere', not any((d.store == 'ulta').any() for d in (P, F, S)))
check('2f IDs unique (no hash collisions)',
      P.product_id.is_unique and F.formula_id.is_unique and S.shade_id.is_unique and P.product_url.is_unique)
check('2g formula ingredients identical to source text',
      set(zip(F.product_url, F.ingredients)) ==
      {t for d in src.values() for t in zip(d.product_url, d.ingredients)})
check('2h primary_category is one of the product categories',
      all(p in c.split(';') for p, c in zip(P.primary_category, P.categories)))
check('2i n_shades per formula sums to shade rows', F.n_shades.astype(int).sum() == len(S))

# 3. de-dupe report
raw_rows = {s: len(d) for s, d in src.items()}
shade_rows = S.groupby('store').size().to_dict()
check('3a shade rows after de-dupe match independent recount', shade_rows == exp_shades, f'got {shade_rows}')
for s in pdb.STORES:
    multi = int((src[s].groupby('product_url').source_file.nunique() > 1).sum()) if 'source_file' in src[s] else \
        int((P[P.store == s].source_files.str.contains(';')).sum())
    print(f'       {s:10s} raw {raw_rows[s]:5d} -> {shade_rows[s]:5d} shades '
          f'({raw_rows[s] - shade_rows[s]} cross-listing duplicates dropped; {multi} products listed in >1 file)')
print(f'       shades without measured shade_lab (kept, has_lab=0): {int((S.has_lab == "0").sum())}')
print(f'       products in >1 category: {int(P.categories.str.contains(";").sum())}; '
      f'primary_category counts: {P.groupby(["store", "primary_category"]).size().unstack(fill_value=0).to_dict("index")}')

# 4. determinism: rebuild into a temp dir and compare file hashes
h = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
with tempfile.TemporaryDirectory() as tmp:
    pdb.main(tmp)
    same = all(h(os.path.join(tmp, f)) == h(os.path.join(out, f))
               for f in ('products.csv', 'formulas.csv', 'shades.csv', 'manifest.json'))
check('4  second run produces byte-identical outputs', same)

print(f'\n{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
