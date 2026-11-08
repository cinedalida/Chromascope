import json, sys, numpy as np, pandas as pd
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support, accuracy_score, cohen_kappa_score
from safety_filter import build_cpts, evaluate
CL = ['Safe','Caution','Excluded']
def score(cases, cpt, **kw):
    y = [c['expected'] for c in cases]; p = [evaluate(c['inci'], c['user'], cpt, **kw) for c in cases]
    pr, rc, f1, _ = precision_recall_fscore_support(y, p, labels=CL, zero_division=0)
    return dict(acc=accuracy_score(y,p), kappa=cohen_kappa_score(y,p), macroF1=f1.mean(), f1=dict(zip(CL,f1.round(3))),
                recall=dict(zip(CL,rc.round(3))), cm=confusion_matrix(y,p,labels=CL)), p
if __name__ == '__main__':
    d = json.load(open('cases.json')); df = pd.read_csv('../model/chromascope_500_balanced.csv')
    cpt = build_cpts(df)
    for k,(a,b) in {'(g,vul)':None} .items() if False else []: pass
    print('CPT (reaction/breakout prob; n_eff):')
    for key,(p,n) in sorted(cpt.items(), key=lambda x:(x[0][0],x[0][1])): print(f'  {key[0]:26s} {"flag" if key[1] else "base"}  p={p:.3f}  n={n:.0f}')
    r, _ = score(d['dev'], cpt)
    print('\nDEV, paper thresholds (0.7/0.3):', {k:v for k,v in r.items() if k!='cm'}); print(r['cm'])
