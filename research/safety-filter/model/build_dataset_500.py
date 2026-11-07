"""Build a 500-row, skin-type-balanced dataset.
Selection uses ONLY skin_type and source (never the outcome columns), so no cherry-picking."""
import pandas as pd, numpy as np
rng = np.random.default_rng(42)
m = pd.read_csv('../chromascope_merged_for_training.csv')
m = m.drop_duplicates(subset=[c for c in m.columns if c not in ('row_id',)])
types = ['Oily','Combination','Dry','Normal','Sensitive','Pigmented']
per = 500 // len(types)                      # 83 per type
extra = 500 - per*len(types)                 # 2 leftover rows -> first types
parts = []
for i, st in enumerate(types):
    n = per + (1 if i < extra else 0)
    g = m[m.skin_type == st]
    real = g[g.source == 'real']                         # always keep every real respondent
    syn = g[g.source != 'real']
    take = syn.sample(n - len(real), random_state=int(rng.integers(1e9)))
    parts.append(pd.concat([real, take]))
d = pd.concat(parts).sample(frac=1, random_state=42).reset_index(drop=True)
d['row_id'] = range(1, len(d)+1)
d.to_csv('chromascope_500_balanced.csv', index=False)
print(d.shape); print(d.skin_type.value_counts().to_dict()); print(d.source.value_counts().to_dict())
