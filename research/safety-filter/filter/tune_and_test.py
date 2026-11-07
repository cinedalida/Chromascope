"""Ablation + threshold tuning on DEV only, then ONE scoring of the frozen TEST and controlled sets."""
import json, itertools, numpy as np, pandas as pd
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support, accuracy_score, cohen_kappa_score
from safety_filter import build_cpts, evaluate, bucket
CL = ['Safe','Caution','Excluded']
d = json.load(open('cases.json')); cpt = build_cpts(pd.read_csv('../model/chromascope_500_balanced.csv'))

def probs(cases, **kw):   # parse + lookup + BN once per case -> (excluded?, P_allergy, P_breakout)
    out = []
    for c in cases:
        r = evaluate(c['inci'], c['user'], cpt, return_detail=True, **kw)
        out.append(('Excluded', 0, 0) if r[0] == 'Excluded' else ('x', r[2], r[3]))
    return out
def verdicts(P, ma, mb):
    return ['Excluded' if e == 'Excluded' else ('Safe' if (bucket(pa,0.7,ma), bucket(pb,0.7,mb)) == ('Clear','Clear') else 'Caution') for e,pa,pb in P]
def summ(y, p):
    pr, rc, f1, _ = precision_recall_fscore_support(y, p, labels=CL, zero_division=0)
    return dict(acc=accuracy_score(y,p), kappa=cohen_kappa_score(y,p), macroF1=f1.mean(), f1=dict(zip(CL,map(float,f1.round(3)))), recall=dict(zip(CL,map(float,rc.round(3)))), cm=confusion_matrix(y,p,labels=CL))
row = lambda n, r: print(f'{n:46s} acc={r["acc"]:.3f} kappa={r["kappa"]:.3f} macroF1={r["macroF1"]:.3f}  F1={r["f1"]}')
yd = [c['expected'] for c in d['dev']]
print('--- ABLATION on DEV (300 cases) ---')
row('v1 as specified (monitor 0.3, no guard)', summ(yd, verdicts(probs(d['dev'], guard=False, acne_block=False, comma_safe=False), .3, .3)))
row('+ edit-distance guard on fuzzy tier', summ(yd, verdicts(probs(d['dev'], guard=True, acne_block=False, comma_safe=False), .3, .3)))
row('+ Appendix C acne block rule', summ(yd, verdicts(probs(d['dev'], flags=False, comma_safe=False), .3, .3)))
row('+ comma-safe INCI parser (bug fix)', summ(yd, verdicts(probs(d['dev'], flags=False, comma_safe=True), .3, .3)))
Pd = probs(d['dev']); row('+ Appendix flag priors (floor 0.5)', summ(yd, verdicts(Pd, .3, .3)))
grid = sorted(((summ(yd, verdicts(Pd, ma, mb))['macroF1'], summ(yd, verdicts(Pd, ma, mb))['acc'], round(float(ma),2), round(float(mb),2))
               for ma, mb in itertools.product(np.arange(0.10, 0.62, 0.02), repeat=2)), key=lambda x: (-x[0], -x[1], -x[2], -x[3]))
print('top-5 dev (macroF1, acc, allergy_thr, breakout_thr):'); [print('  ', g) for g in grid[:5]]
_, _, ma, mb = grid[0]; rd = summ(yd, verdicts(Pd, ma, mb)); row(f'+ tuned thresholds A={ma} B={mb}  (DEV)', rd); print(rd['cm'])
json.dump(dict(monitor_allergy=ma, monitor_breakout=mb), open('chosen_thresholds.json','w'))
print('\n--- FROZEN TEST (150 fresh cases, scored once) ---')
yt = [c['expected'] for c in d['test']]; pt = verdicts(probs(d['test']), ma, mb); rt = summ(yt, pt)
row('final filter (TEST)', rt); print('recall', rt['recall']); print('confusion (rows=expected, cols=predicted; Safe/Caution/Excluded)'); print(rt['cm'])
pc = verdicts(probs(d['controlled']), ma, mb); print(f'controlled allergen cases Excluded: {sum(p=="Excluded" for p in pc)}/30')
json.dump({c['case_id']:dict(expected=c['expected'],predicted=p) for c,p in zip(d['test'],pt)}, open('test_predictions.json','w'), indent=1)
wrong = [(c['case_id'],c['expected'],p,c['true_groups']) for c,p in zip(d['test'],pt) if c['expected']!=p]; print('\nTEST errors:'); [print(' ',w) for w in wrong]
