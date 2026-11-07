"""
Chromascope allergen/irritation risk model: a from-scratch NumPy neural network.
  forward pass -> weighted binary cross-entropy loss -> backpropagation -> Adam update
Task: given a user's skin profile + an ingredient group, predict P(reaction).
Respondent-level splits (no person appears in both train and test).
"""
import numpy as np, pandas as pd, json
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score, confusion_matrix

SEED = 7
RX = ['fragrance','paraben','oxybenzone','formaldehyde','nickel','lanolin','propyleneglycol','mi','capb','ppd']
BO = ['glycerin_ha_zno','squalane_sunflower_shea','jojoba_cetyl_mineraloil','ipm_algae','coconut_cocoa','wheatgerm_lanolin']
ING = RX + BO
SKIN = ['Oily','Combination','Dry','Normal','Sensitive','Pigmented']
DIAG = ['diag_acne','diag_eczema','diag_rosacea','diag_melasma','diag_psoriasis','diag_pih']
REACT = ['Rarely reacts','Sometimes reacts','Often reacts']

def make_long(df):
    """One row per (respondent, ingredient they have used). Target = reacted / broke out."""
    rows = []
    for i, r in df.iterrows():
        prof = [float(r.skin_type == s) for s in SKIN] + [float(r[c] == 'Yes') for c in DIAG] \
             + [float(r.general_reactivity == g) for g in REACT] + [float(r.pregnant == 'Yes'), (r.age - 24) / 6]
        for k, ing in enumerate(ING):
            if r[f'used_{ing}'] != 'Yes': continue
            y = r[f'reacted_{ing}'] if ing in RX else r[f'broke_out_{ing}']
            onehot = np.zeros(len(ING)); onehot[k] = 1
            rows.append((i, np.concatenate([prof, onehot, [float(ing in RX)]]), int(y)))
    g = np.array([x[0] for x in rows]); X = np.stack([x[1] for x in rows]); y = np.array([x[2] for x in rows])
    return g, X, y

class MLP:
    """Input -> Dense+ReLU -> Dense+ReLU -> Dense+Sigmoid, trained with manual backprop + Adam."""
    def __init__(s, d, h1=32, h2=16, l2=1e-3, lr=3e-3, seed=0):
        r = np.random.default_rng(seed)
        s.p = {'W1': r.normal(0, np.sqrt(2/d), (d, h1)), 'b1': np.zeros(h1),      # He init for ReLU
               'W2': r.normal(0, np.sqrt(2/h1), (h1, h2)), 'b2': np.zeros(h2),
               'W3': r.normal(0, np.sqrt(1/h2), (h2, 1)), 'b3': np.zeros(1)}
        s.l2, s.lr = l2, lr
        s.m = {k: np.zeros_like(v) for k, v in s.p.items()}; s.v = {k: np.zeros_like(v) for k, v in s.p.items()}; s.t = 0
    def forward(s, X, train=False, drop=0.2, r=None):
        p = s.p; z1 = X @ p['W1'] + p['b1']; a1 = np.maximum(0, z1)
        mask = (r.random(a1.shape) > drop) / (1 - drop) if train else 1.0       # inverted dropout
        a1d = a1 * mask
        z2 = a1d @ p['W2'] + p['b2']; a2 = np.maximum(0, z2)
        z3 = a2 @ p['W3'] + p['b3']; out = 1 / (1 + np.exp(-z3))
        s.c = (X, z1, a1d, mask, z2, a2, out); return out.ravel()
    def loss_grad(s, y, w):
        X, z1, a1d, mask, z2, a2, out = s.c; n = len(y); out = np.clip(out, 1e-7, 1-1e-7); y = y.reshape(-1, 1); w = w.reshape(-1, 1)
        loss = -(w * (y*np.log(out) + (1-y)*np.log(1-out))).mean() + s.l2 * sum((v**2).sum() for k, v in s.p.items() if k[0] == 'W')
        d3 = w * (out - y) / n                                    # dL/dz3 (sigmoid + BCE simplifies)
        g = {'W3': a2.T @ d3, 'b3': d3.sum(0)}
        d2 = (d3 @ s.p['W3'].T) * (z2 > 0)                        # chain rule through ReLU
        g['W2'] = a1d.T @ d2; g['b2'] = d2.sum(0)
        d1 = (d2 @ s.p['W2'].T) * mask * (z1 > 0)
        g['W1'] = X.T @ d1; g['b1'] = d1.sum(0)
        for k in g:
            if k[0] == 'W': g[k] += 2 * s.l2 * s.p[k]             # L2 regularization gradient
        return loss, g
    def adam(s, g, b1=0.9, b2=0.999, eps=1e-8):
        s.t += 1
        for k in s.p:
            s.m[k] = b1*s.m[k] + (1-b1)*g[k]; s.v[k] = b2*s.v[k] + (1-b2)*g[k]**2
            s.p[k] -= s.lr * (s.m[k]/(1-b1**s.t)) / (np.sqrt(s.v[k]/(1-b2**s.t)) + eps)
    def fit(s, Xtr, ytr, Xva, yva, epochs=300, bs=64, patience=30, seed=0):
        r = np.random.default_rng(seed); pos = ytr.mean()
        wc = np.where(ytr == 1, 0.5/pos, 0.5/(1-pos))             # class-balanced weights
        best, bestp, bad, hist = 1e9, None, 0, []
        for ep in range(epochs):
            idx = r.permutation(len(ytr))
            for i in range(0, len(idx), bs):
                b = idx[i:i+bs]; s.forward(Xtr[b], True, r=r); _, g = s.loss_grad(ytr[b], wc[b]); s.adam(g)
            pv = s.forward(Xva); vl = -(np.where(yva==1,0.5/pos,0.5/(1-pos))*(yva*np.log(pv+1e-7)+(1-yva)*np.log(1-pv+1e-7))).mean()
            hist.append(vl)
            if vl < best - 1e-5: best, bestp, bad = vl, {k: v.copy() for k, v in s.p.items()}, 0
            else:
                bad += 1
                if bad >= patience: break
        s.p = bestp; return hist
    def predict_proba(s, X): return s.forward(X)

def best_threshold(y, p):
    ts = np.linspace(0.1, 0.9, 81); f = [precision_recall_fscore_support(y, p >= t, average='binary', zero_division=0)[2] for t in ts]
    return ts[int(np.argmax(f))]

def metrics(y, p, t):
    yh = (p >= t).astype(int); pr, rc, f1, _ = precision_recall_fscore_support(y, yh, average='binary', zero_division=0)
    mf1 = precision_recall_fscore_support(y, yh, average='macro', zero_division=0)[2]
    return dict(accuracy=accuracy_score(y, yh), precision=pr, recall=rc, f1_reaction=f1, macro_f1=mf1, auc=roc_auc_score(y, p), threshold=float(t))

if __name__ == '__main__':
    df = pd.read_csv('chromascope_500_balanced.csv'); g, X, y = make_long(df)
    print(f'{len(df)} respondents -> {len(y)} respondent-ingredient samples, {y.mean():.1%} reacted')
    skin = df.skin_type.values; folds = StratifiedKFold(5, shuffle=True, random_state=SEED)
    res, oof_y, oof_p, base = [], [], [], []
    for f, (tr_r, te_r) in enumerate(folds.split(np.arange(len(df)), skin)):
        va_r = tr_r[::5]; tr_r = np.setdiff1d(tr_r, va_r)                       # split by RESPONDENT, not by row
        tr, va, te = [np.isin(g, z) for z in (tr_r, va_r, te_r)]
        mu, sd = X[tr].mean(0), X[tr].std(0) + 1e-8
        Z = lambda a: (a - mu) / sd
        net = MLP(X.shape[1], seed=f); net.fit(Z(X[tr]), y[tr], Z(X[va]), y[va], seed=f)
        t = best_threshold(y[va], net.predict_proba(Z(X[va])))                  # threshold chosen on validation only
        pt = net.predict_proba(Z(X[te])); r_ = metrics(y[te], pt, t); res.append(r_)
        oof_y.append(y[te]); oof_p.append(pt); base.append((y[te] == 0).mean())
        print(f'fold {f}: acc={r_["accuracy"]:.3f} F1(reaction)={r_["f1_reaction"]:.3f} macroF1={r_["macro_f1"]:.3f} AUC={r_["auc"]:.3f}')
    R = pd.DataFrame(res); print('\n5-fold mean ± sd'); print(pd.DataFrame({'mean': R.mean(), 'sd': R.std()}).round(3))
    print(f'majority-class baseline accuracy: {np.mean(base):.3f}')
    R.to_csv('cv_results.csv', index=False)
