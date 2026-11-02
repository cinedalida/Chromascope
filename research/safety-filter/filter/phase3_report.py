"""Phase 3 validation report (PLAN.md). DEV POOL ONLY; the synthetic TEST set is not touched.

Writes $CHROMASCOPE_DATA_DIR/review/phase3_report.md and review/spotcheck_50.csv (blank `correct` column for a
researcher). "If all approved" columns are hypothetical: they apply every proposal in memory and change nothing.
"""
import collections, csv, functools, io, json, os, random, subprocess, sys, time
import pandas as pd
import dev_pool, product_db as pdb, safety_filter as sf
from propose_aliases import PROPOSALS
from safety_filter import Matcher, load_review

# The original lookup() is pure; caching it changes no result, only speed (caching proper is Phase 4).
sf.lookup = functools.lru_cache(maxsize=None)(sf.lookup)
def md(df): return '```\n' + df.to_string() + '\n```'

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = io.StringIO()
def say(*a): print(*a); print(*a, file=OUT)

root = pdb.data_dir()
F, P = dev_pool.load()
cpt = sf.build_cpts(pd.read_csv(os.path.join(root, 'survey', 'chromascope_500_balanced.csv')))
th = json.load(open(os.path.join(HERE, 'chosen_thresholds.json')))
approved = load_review(dev_pool.review_path())
everything = {'add': {a: g for a, g, c, *_ in PROPOSALS if c == 'add'},
              'remove': {a for a, g, c, *_ in PROPOSALS if c == 'remove'},
              'exclude': {a for a, g, c, *_ in PROPOSALS if c == 'exclude'}}
n_appr = sum(map(len, approved.values()))
M = {'baseline': None, 'v2 (approved rows only)': Matcher(review=approved), 'v2 if ALL proposals approved': Matcher(review=everything)}

def hits(m, inci):
    if m is None:
        return [(i, t, *r) for i, t in enumerate(sf.normalize(inci)) for r in [sf.lookup(t)] if r[0]]
    return m.matches(inci)

say(f'# Phase 3 report (dev pool only)\n\nDev pool: {len(F)} formulas, {len(P)} products. Approved review rows: {n_appr}.\n')
t0 = time.time(); H = {k: [hits(m, s) for s in F.ingredients] for k, m in M.items()}; dt = time.time() - t0
say(f'Matching all dev formulas with all three matchers: {dt:.1f} s\n')

say('## 1. Matches per group (token hits / formulas)\n')
rows = collections.defaultdict(dict)
for k, hs in H.items():
    for g in sorted(sf.GROUPS):
        n = sum(1 for h in hs for x in h if x[2] == g); f = sum(1 for h in hs if any(x[2] == g for x in h))
        rows[g][k] = f'{n} / {f}'
say(md(pd.DataFrame(rows).T))
say('\nBy tier:', {k: dict(collections.Counter(x[4] for h in hs for x in h)) for k, hs in H.items()}, '\n')

say('## 2. Baseline false hits (from the analysis): token occurrences under each matcher\n')
FALSE = ['ethylhexylglycerin', 'dipropylene glycol', 'methylpropanediol', 'menthoxypropanediol', 'polyglycerin 3',
         'polyglycerin 6', 'diglycerin', 'dimethicone polyglycerin 3 crosspolymer', 'propanediol', 'squalene',
         'aminomethyl propanediol', 'menthone glycerin acetal']
fh = {k: collections.Counter(sf.canon(x[1]) for h in hs for x in h) for k, hs in H.items()}
t = pd.DataFrame({k: [fh[k][sf.canon(x)] for x in FALSE] for k in M}, index=FALSE)
t['status'] = ['fixed by code' if r['v2 (approved rows only)'] == 0 else
               ('pending researcher approval' if r['v2 if ALL proposals approved'] == 0 else 'STILL MATCHING') for _, r in t.iterrows()]
say(md(t), '\n')

say('## 3. Fuzzy-tier matches under v2 (approved rows only), for review\n')
fz = collections.Counter((x[1], x[2]) for h in H['v2 (approved rows only)'] for x in h if x[4] == 'fuzzy')
say('\n'.join(f'- `{a}` -> {g}: {n}' for (a, g), n in fz.most_common()) or '- none', '\n')

say('## 4. Noise stripping (v2)\n')
v2 = M['v2 (approved rows only)']
cut = [s for s in F.ingredients if sf._CUT.search(s.lower())]
lost = sum(len(sf.normalize(s)) - len(sf.normalize(sf._CUT.sub('', s.lower()))) for s in cut)
long_ = sum(1 for s in F.ingredients for a in v2.tokens(s) if max(map(len, a)) > sf.LONG)
say(f'- formulas with a "may contain" / "+/-" block cut: {len(cut)} ({lost} tokens after the marker dropped)')
say(f'- positions still longer than {sf.LONG} chars after cleanup (run-on lists: whole-word matched, no fuzzy): {long_}')
say(f'- positions per formula, median: baseline {pd.Series([len(sf.normalize(s)) for s in F.ingredients]).median():.0f}, '
    f'v2 {pd.Series([len(v2.tokens(s)) for s in F.ingredients]).median():.0f}\n')

say('## 5. Verdicts on dev formulas (frozen thresholds), % Safe / Caution / Excluded\n')
PROF = {'Normal, no conditions': dict(skin_type='Normal', allergens=[]),
        'Sensitive': dict(skin_type='Sensitive', allergens=[]),
        'Acne-prone (Oily)': dict(skin_type='Oily', acne=True, allergens=[]),
        'Declared: propylene glycol': dict(skin_type='Normal', allergens=['propyleneglycol']),
        'Declared: fragrance': dict(skin_type='Normal', allergens=['fragrance'])}
vt = {}
for pn, u in PROF.items():
    for k, m in M.items():
        c = collections.Counter(sf.evaluate(s, u, cpt, monitor=th['monitor_allergy'], monitor_b=th['monitor_breakout'],
                                            matcher=m) for s in F.ingredients)
        vt.setdefault(pn, {})[k] = ' / '.join(f'{100*c[v]/len(F):.0f}' for v in ('Safe', 'Caution', 'Excluded'))
say(md(pd.DataFrame(vt).T), '\n')

say('## 6. Synthetic DEV set ablation (300 cases, frozen thresholds, no re-tuning; synthetic TEST not scored)\n')
from sklearn.metrics import accuracy_score, cohen_kappa_score, f1_score
dev = json.load(open(os.path.join(HERE, 'cases.json'), encoding='utf-8'))['dev']
y = [c['expected'] for c in dev]
steps = [('baseline (current final filter)', None),
         ('+ shared punctuation rules', Matcher(canon_punct=True, whole_word=False, noise_strip=False)),
         ('+ whole-word matching', Matcher(canon_punct=True, whole_word=True, noise_strip=False)),
         ('+ noise stripping (= v2, approved rows only)', Matcher(review=approved)),
         ('v2 if ALL proposals approved', Matcher(review=everything))]
ab = {}
for n, m in steps:
    p = [sf.evaluate(c['inci'], c['user'], cpt, monitor=th['monitor_allergy'], monitor_b=th['monitor_breakout'], matcher=m) for c in dev]
    ab[n] = dict(acc=round(accuracy_score(y, p), 3), kappa=round(cohen_kappa_score(y, p), 3),
                 macroF1=round(f1_score(y, p, labels=['Safe', 'Caution', 'Excluded'], average='macro'), 3))
say(md(pd.DataFrame(ab).T), '\n')

say('## 7. Spot-check sample\n')
rng = random.Random(20261103)
pool = [(fid, pid, x) for fid, pid, h in zip(F.formula_id, F.product_id, H['v2 (approved rows only)']) for x in h]
sample = rng.sample(pool, 50)
name = dict(zip(P.product_id, P.product_brand + ' - ' + P.product_name))
sc = os.path.join(os.path.dirname(dev_pool.review_path()), 'spotcheck_50.csv')
with open(sc, 'w', encoding='utf-8', newline='') as fh_:
    w = csv.writer(fh_, lineterminator='\n')
    w.writerow(['n', 'formula_id', 'product', 'position', 'matched_token', 'group', 'tier', 'correct (y/n)', 'reviewer', 'notes'])
    for i, (fid, pid, x) in enumerate(sorted(sample, key=lambda s: (s[0], s[2][0])), 1):
        w.writerow([i, fid, name[pid], x[0] + 1, x[1], x[2], x[4], '', '', ''])
say(f'- 50 random v2 matches (seed 20261103) written to `review/spotcheck_50.csv`; tiers: '
    f'{dict(collections.Counter(s[2][4] for s in sample))}\n')

say('## 8. Data-location check\n')
ls = subprocess.run(['git', 'ls-files'], cwd=HERE, capture_output=True, text=True).stdout.split()
bad = [f for f in ls if f.lower().endswith('.csv') or '/data/' in f or 'review/' in f or 'split/' in f]
say(f'- app repo tracked data files: {len(bad)} {bad[:5]}')
with open(os.path.join(os.path.dirname(dev_pool.review_path()), 'phase3_report.md'), 'w', encoding='utf-8', newline='\n') as fh_:
    fh_.write(OUT.getvalue())
