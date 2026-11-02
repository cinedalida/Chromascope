"""Phase 2 validation for make_split.py (PLAN.md). Exit code 0 only if every check passes.

Usage: CHROMASCOPE_DATA_DIR=<private data repo> python check_split.py
"""
import hashlib, json, os, sys, tempfile
import pandas as pd
import make_split as ms
import product_db as pdb

root = pdb.data_dir()
sp = os.path.join(root, 'split')
results = []


def check(name, ok, detail=''):
    results.append(bool(ok))
    print(f'[{"PASS" if ok else "FAIL"}] {name}' + (f'  ({detail})' if detail else ''))


split = json.load(open(os.path.join(sp, 'split.json'), encoding='utf-8'))
P = pd.read_csv(os.path.join(root, 'derived', 'products.csv'), dtype=str, keep_default_na=False)
F = pd.read_csv(os.path.join(root, 'derived', 'formulas.csv'), dtype=str, keep_default_na=False).set_index('formula_id')
S = pd.read_csv(os.path.join(root, 'derived', 'shades.csv'), dtype=str, keep_default_na=False).set_index('shade_id')
C = pd.DataFrame(split['cases'])
test, ctrl = C[C.set == 'test'], C[C.set == 'controlled']
dev = set(split['dev_product_ids'])

# 1. sizes and overlap
check('1a 60 test + 20 controlled = 80 cases', len(test) == 60 and len(ctrl) == 20, f'{len(test)} + {len(ctrl)}')
check('1b 80 distinct products', C.product_id.nunique() == 80)
check('1c zero product overlap with dev pool', not (set(C.product_id) & dev))
check('1d test and controlled products disjoint', not (set(test.product_id) & set(ctrl.product_id)))
dev_formulas = set(F[F.product_id.isin(dev)].index)
check('1e zero formula overlap with dev pool', not (set(C.formula_id) & dev_formulas))
check('1f dev + held-out = all 1,054 products', len(dev) + 80 == len(P) and dev | set(C.product_id) == set(P.product_id))

# 2. links
check('2a each shade belongs to its product', all(S.at[s, 'product_id'] == p for s, p in zip(C.shade_id, C.product_id)))
check('2b each formula is its shade\'s formula', all(S.at[s, 'formula_id'] == f for s, f in zip(C.shade_id, C.formula_id)))
check('2c case IDs and blind label IDs unique', C.case_id.is_unique and C.label_id.is_unique)

# 3. strata
T = pd.DataFrame(split['strata']).T
P['stratum'] = P.store + '/' + P.primary_category
check('3a 15 strata, all non-empty', len(T) == 15 and (T.population > 0).all())
check('3b every stratum has >= 1 test product', (T.test >= 1).all())
check('3c strata counts match the cases', all((C.stratum == s).sum() == r.test + r.controlled for s, r in T.iterrows()))
T['pop_share_%'] = (100 * T.population / T.population.sum()).round(1)
T['held_share_%'] = (100 * (T.test + T.controlled) / 80).round(1)
print(T[['population', 'pop_share_%', 'eligible_controlled', 'controlled', 'test', 'held_share_%', 'dev']].to_string())

# 4. controlled cases: declared allergen present in the formula (exact match), profile declares it
ok = [c.declared_allergen in ms.exact_allergens(F.at[c.formula_id, 'ingredients']) and
      c.user['allergens'] == [c.declared_allergen] for c in ctrl.itertuples()]
check('4a every controlled allergen present by exact match and declared', all(ok), f'{sum(ok)}/20')
print('       controlled allergens:', ctrl.declared_allergen.value_counts().to_dict())

# 5. test profile design
decl = test.declared_allergen.fillna('none').value_counts().to_dict()
check('5a test profiles: 30 none + 3 per allergen group',
      decl.get('none') == 30 and all(decl.get(g) == 3 for g in ms.GROUPS), str(decl))
print('       test skin types:', test.user.map(lambda u: u['skin_type']).value_counts().to_dict())

# 6. blinding of label templates
for who in ('A', 'B'):
    L = pd.read_csv(os.path.join(sp, f'label_template_{who}.csv'), dtype=str, keep_default_na=False)
    check(f'6{who} template {who}: 80 rows, blank labels, no set / case_id / filter output',
          len(L) == 80 and (L.label == '').all() and not ({'set', 'case_id', 'verdict', 'expected', 'predicted'} & set(L.columns)))

# 7. reproducibility
h = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
with tempfile.TemporaryDirectory() as tmp:
    ms.main(tmp)
    same = all(h(os.path.join(tmp, f)) == h(os.path.join(sp, f))
               for f in ('split.json', 'label_template_A.csv', 'label_template_B.csv'))
check('7  same seed reproduces split.json and templates byte for byte', same)
print(f'\nsplit.json SHA-256: {h(os.path.join(sp, "split.json"))}')
print(f'{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
