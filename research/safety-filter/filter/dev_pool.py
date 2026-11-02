"""The ONLY way Phase 3 code reads product formulas: dev pool only, held-out products removed and asserted absent."""
import hashlib, json, os
import pandas as pd
import product_db as pdb

FROZEN_SPLIT_SHA256 = '68a3a6d13a2e34a5f9d05ea19dfaa0f54a9f87426d2ef3833f3d7893fb9ac3b2'   # PLAN.md, Phase 2


def review_path():
    return os.path.join(pdb.data_dir(), 'review', 'alias_review.csv')


def load():
    """(dev formulas, dev products). Fails if the split is not the frozen one or any held-out product leaks in."""
    root = pdb.data_dir()
    sp = os.path.join(root, 'split', 'split.json')
    if hashlib.sha256(open(sp, 'rb').read()).hexdigest() != FROZEN_SPLIT_SHA256:
        raise SystemExit('split.json does not match the frozen SHA-256 in PLAN.md')
    split = json.load(open(sp, encoding='utf-8'))
    held = {c['product_id'] for c in split['cases']}
    dev_ids = set(split['dev_product_ids'])
    F = pd.read_csv(os.path.join(root, 'derived', 'formulas.csv'), dtype=str, keep_default_na=False)
    P = pd.read_csv(os.path.join(root, 'derived', 'products.csv'), dtype=str, keep_default_na=False)
    F, P = F[F.product_id.isin(dev_ids)].reset_index(drop=True), P[P.product_id.isin(dev_ids)].reset_index(drop=True)
    assert not (set(F.product_id) | set(P.product_id)) & held, 'held-out product in dev pool'
    assert not set(F.formula_id) & {c['formula_id'] for c in split['cases']}, 'held-out formula in dev pool'
    return F, P
