"""Phase 2 (PLAN.md): freeze the held-out evaluation split BEFORE any matching fix is developed.

Draws, at product level, stratified by store x primary_category (15 strata):
  - 20 CONTROLLED products: only from products whose formula contains an Appendix B allergen group by an EXACT alias
    match (no substring / fuzzy tier, and not the `propanediol` alias, which is flagged as wrong). Each case declares
    that allergen, so the expected verdict is Excluded. Allocation proportional to eligible products (largest remainder).
  - 60 TEST products: from the remaining products, proportional to stratum size, minimum 1 per stratum.
  - Everything else is the DEV pool (used to develop Phase 3 fixes).
For each held-out product one shade (hence one formula) is drawn. Test profiles: balanced design, 30 with no declared
allergen and 30 with one (each of the 10 groups 3 times); skin type and condition drawn uniformly from the grid.

Input : $CHROMASCOPE_DATA_DIR/derived/{products,formulas,shades}.csv
Output: $CHROMASCOPE_DATA_DIR/split/split.json and split/label_template_{A,B}.csv (identical blank sheets)
Same seed -> byte-identical outputs.
"""
import json, os, random, sys
import pandas as pd
import product_db as pdb
from safety_filter import ALLERGEN, normalize

SEED = 20261103                      # chosen 2026-11-03, before any held-out product was drawn or scored
N_TEST, N_CONTROLLED = 60, 20
SKIN_TYPES = ['Oily', 'Combination', 'Dry', 'Normal', 'Sensitive', 'Pigmented']
CONDITIONS = ['none', 'eczema', 'rosacea', 'acne']
GROUPS = sorted(ALLERGEN)
EXCLUDED_ALIASES = {'propanediol'}  # flagged wrong in the analysis (1,3-propanediol is not propylene glycol)
EXACT = {a: g for g, (al, _) in ALLERGEN.items() for a in al if a not in EXCLUDED_ALIASES}


def exact_allergens(ingredients):
    """Allergen groups present by exact alias match, with the first matching token for each."""
    found = {}
    for t in normalize(ingredients):
        g = EXACT.get(t)
        if g and g not in found:
            found[g] = t
    return found


def allocate(sizes, n, minimum):
    """Largest-remainder proportional allocation with a per-stratum minimum (capped at stratum size)."""
    keys = sorted(sizes)
    alloc = {k: min(minimum, sizes[k]) for k in keys}
    rest, total = n - sum(alloc.values()), sum(sizes.values())
    if rest < 0:
        sys.exit('minimum allocation exceeds n')
    quota = {k: rest * sizes[k] / total for k in keys}
    for k in keys:
        alloc[k] += min(int(quota[k]), sizes[k] - alloc[k])
    left = n - sum(alloc.values())
    for k in sorted(keys, key=lambda k: (-(quota[k] - int(quota[k])), k)):
        if left == 0:
            break
        if alloc[k] < sizes[k]:
            alloc[k] += 1; left -= 1
    assert sum(alloc.values()) == n
    return alloc


def profile(rng, allergen=None):
    cond = rng.choice(CONDITIONS)
    return dict(skin_type=rng.choice(SKIN_TYPES), eczema=cond == 'eczema', rosacea=cond == 'rosacea',
                acne=cond == 'acne', allergens=[allergen] if allergen else [])


def build(root):
    d = os.path.join(root, 'derived')
    P = pd.read_csv(os.path.join(d, 'products.csv'), dtype=str, keep_default_na=False)
    F = pd.read_csv(os.path.join(d, 'formulas.csv'), dtype=str, keep_default_na=False).set_index('formula_id')
    S = pd.read_csv(os.path.join(d, 'shades.csv'), dtype=str, keep_default_na=False)
    rng = random.Random(SEED)
    P = P.sort_values('product_id').reset_index(drop=True)
    P['stratum'] = P.store + '/' + P.primary_category
    shades_of = {pid: sorted(g.shade_id) for pid, g in S.groupby('product_id')}
    shade_formula = dict(zip(S.shade_id, S.formula_id))
    shade_name = dict(zip(S.shade_id, S.shade_name))

    # one shade per product, drawn up front for every product in a fixed order, so eligibility is defined per draw
    pick = {pid: rng.choice(shades_of[pid]) for pid in P.product_id}
    P['shade_id'] = P.product_id.map(pick)
    P['formula_id'] = P.shade_id.map(shade_formula)
    P['allergens_exact'] = P.formula_id.map(lambda f: exact_allergens(F.at[f, 'ingredients']))
    P['eligible_controlled'] = P.allergens_exact.map(bool)

    strata = sorted(P.stratum.unique())
    pop = P.stratum.value_counts().to_dict()
    elig = P[P.eligible_controlled].stratum.value_counts().to_dict()
    ctrl_alloc = allocate({s: elig.get(s, 0) for s in strata if elig.get(s, 0)}, N_CONTROLLED, 0)
    chosen = {}
    for s in strata:
        pool = sorted(P[(P.stratum == s) & P.eligible_controlled].product_id)
        for pid in rng.sample(pool, ctrl_alloc.get(s, 0)):
            chosen[pid] = 'controlled'
    remaining = P[~P.product_id.isin(chosen)]
    test_alloc = allocate(remaining.stratum.value_counts().to_dict(), N_TEST, 1)
    for s in strata:
        pool = sorted(remaining[remaining.stratum == s].product_id)
        for pid in rng.sample(pool, test_alloc.get(s, 0)):
            chosen[pid] = 'test'

    held = P[P.product_id.isin(chosen)].copy()
    held['set'] = held.product_id.map(chosen)
    held = held.sort_values(['set', 'stratum', 'product_id']).reset_index(drop=True)
    test_allergens = [None] * 30 + [g for g in GROUPS for _ in range(3)]
    rng.shuffle(test_allergens)
    cases, ti, ci = [], 0, 0
    for _, r in held.iterrows():
        if r.set == 'test':
            prof, decl, tok = profile(rng, test_allergens[ti]), test_allergens[ti], None
            ti += 1; cid = f'RT-{ti:03d}'
        else:
            decl = rng.choice(sorted(r.allergens_exact)); tok = r.allergens_exact[decl]
            prof = profile(rng, decl); ci += 1; cid = f'RC-{ci:03d}'
        cases.append(dict(case_id=cid, set=r.set, stratum=r.stratum, product_id=r.product_id, store=r.store,
                          primary_category=r.primary_category, product_url=r.product_url, shade_id=r.shade_id,
                          formula_id=r.formula_id, user=prof, declared_allergen=decl, allergen_token_exact=tok))

    # blind label IDs: researchers see L-xxx in shuffled order, not the set (controlled cases would hint "Excluded")
    order = list(range(len(cases))); rng.shuffle(order)
    for n, i in enumerate(order, 1):
        cases[i]['label_id'] = f'L-{n:03d}'

    dev = sorted(P[~P.product_id.isin(chosen)].product_id)
    table = {s: dict(population=int(pop[s]), eligible_controlled=int(elig.get(s, 0)),
                     controlled=int(ctrl_alloc.get(s, 0)), test=int(test_alloc.get(s, 0)),
                     dev=int(pop[s] - ctrl_alloc.get(s, 0) - test_alloc.get(s, 0))) for s in strata}
    split = dict(seed=SEED, version=1, n_test=N_TEST, n_controlled=N_CONTROLLED,
                 rules=dict(strata='store x primary_category', controlled='exact alias match only, propanediol alias '
                            'excluded; proportional to eligible products', test='proportional, minimum 1 per stratum',
                            test_profiles='30 none + 30 with one declared allergen (each group x3); skin type and '
                            'condition uniform'),
                 strata=table, cases=cases, dev_product_ids=dev)

    tmpl = pd.DataFrame([dict(label_id=c['label_id'], store=c['store'],
                              brand=P.set_index('product_id').at[c['product_id'], 'product_brand'],
                              product=P.set_index('product_id').at[c['product_id'], 'product_name'],
                              shade=shade_name[c['shade_id']], ingredients=F.at[c['formula_id'], 'ingredients'],
                              skin_type=c['user']['skin_type'],
                              conditions=','.join(k for k in ('eczema', 'rosacea', 'acne') if c['user'][k]) or 'none',
                              declared_allergens=','.join(c['user']['allergens']) or 'none',
                              label='', notes='') for c in cases]).sort_values('label_id').reset_index(drop=True)
    return split, tmpl


def main(out=None):
    root = pdb.data_dir()
    out = out or os.path.join(root, 'split')
    os.makedirs(out, exist_ok=True)
    split, tmpl = build(root)
    with open(os.path.join(out, 'split.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(split, fh, indent=1, sort_keys=True)
    for who in ('A', 'B'):
        tmpl.to_csv(os.path.join(out, f'label_template_{who}.csv'), index=False, lineterminator='\n')
    print(pd.DataFrame(split['strata']).T.to_string())
    return out


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
