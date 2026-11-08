"""Bayesian-Chromascope Hybrid Safety Filter (Section 3.3B).
support layer : INCI parsing -> 3-tier lookup (exact / substring / fuzzy>=85%) -> confidence + position weight -> hard-block
decision layer: Bayesian network (noisy-OR over CPTs calibrated from the survey) -> Clear/Monitor/Caution buckets
"""
import re, difflib, numpy as np, pandas as pd

# ---- Appendix B / C reference (name -> aliases, risk, rating) ----
ALLERGEN = {  # group: (aliases, risk)
 'fragrance': (['fragrance','parfum','linalool','limonene','geraniol'], 'High'),
 'paraben': (['methylparaben','ethylparaben','propylparaben','butylparaben','paraben'], 'High'),
 'oxybenzone': (['oxybenzone','benzophenone-3'], 'High'),
 'formaldehyde': (['dmdm hydantoin','imidazolidinyl urea','quaternium-15','formaldehyde'], 'High'),
 'nickel': (['nickel','nickel sulfate'], 'Medium'),
 'lanolin': (['lanolin','wool fat','wool wax','lanolin alcohol','adeps lanae'], 'Medium'),
 'propyleneglycol': (['propylene glycol','1,2-propanediol','propanediol'], 'Medium'),
 'mi': (['methylisothiazolinone','neolone 950','mit','mi'], 'High'),
 'capb': (['cocamidopropyl betaine','cocamide dea','capb'], 'Medium'),
 'ppd': (['p-phenylenediamine','1,4-diaminobenzene','c.i. 76060','ppd'], 'High')}
COMED = {  # group: (aliases, rating)
 'glycerin_ha_zno': (['glycerin','glycerol','hyaluronic acid','zinc oxide','zno','ha'], 0),
 'squalane_sunflower_shea': (['squalane','hydrogenated olive oil','sunflower oil','helianthus annuus seed oil','shea butter'], 1),
 'jojoba_cetyl_mineraloil': (['jojoba oil','simmondsia chinensis seed oil','cetyl alcohol','1-hexadecanol','mineral oil'], 2),
 'ipm_algae': (['isopropyl myristate','algae extract','seaweed extract'], 3),
 'coconut_cocoa': (['coconut oil','cocos nucifera oil','cocoa butter','theobroma cacao seed butter'], 4),
 'wheatgerm_lanolin': (['wheat germ oil','triticum vulgare germ oil','acetylated lanolin','acetylated lanolin alcohol'], 5)}
HARD_BLOCK = {'mi','ppd'}                      # Section 3.3B non-overridable list
ALIAS = {}
for g,(al,_) in {**ALLERGEN,**COMED}.items():
    for a in al: ALIAS[a] = g
SHORT = {a for a in ALIAS if len(a) <= 4}      # too short for substring/fuzzy -> exact only

def normalize(inci, comma_safe=True):
    s = inci.lower()
    s = re.sub(r'(may contain|\+/-|\[\+/-)[^.]*$', '', s)      # strip "may contain" / shade blocks
    s = re.sub(r'\(.*?\)', lambda m: m.group(0) if False else '', s)
    sep = r'(?<!\d),|,(?!\d)' if comma_safe else r','   # comma_safe keeps '1,4-diaminobenzene' intact; off = naive split (pre-fix)
    return [t.strip(' .') for t in re.split(sep, s) if t.strip(' .')]

def damerau(a, b):
    d = [[0]*(len(b)+1) for _ in range(len(a)+1)]
    for i in range(len(a)+1): d[i][0] = i
    for j in range(len(b)+1): d[0][j] = j
    for i in range(1, len(a)+1):
        for j in range(1, len(b)+1):
            c = a[i-1] != b[j-1]
            d[i][j] = min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+c)
            if i>1 and j>1 and a[i-1]==b[j-2] and a[i-2]==b[j-1]: d[i][j] = min(d[i][j], d[i-2][j-2]+1)
    return d[-1][-1]

def lookup(tok, guard=True):
    if tok in ALIAS: return ALIAS[tok], 1.0, 'exact'
    subs = [a for a in ALIAS if a not in SHORT and a in tok]
    if subs: a = max(subs, key=len); return ALIAS[a], 0.9, 'substring'
    best, ba = 0, None
    for a in ALIAS:
        if a in SHORT: continue
        r = difflib.SequenceMatcher(None, tok, a).ratio()
        if r > best: best, ba = r, a
    if guard:   # >=85% similarity expressed as edit distance (Damerau, so a transposition = 1 edit)
        for a in ALIAS:
            if a in SHORT: continue
            if damerau(tok, a) <= min(2, max(1, int(0.15*max(len(tok), len(a))))) : return ALIAS[a], 0.7, 'fuzzy'
        return None, 0, None
    if best >= 0.85: return ALIAS[ba], 0.7, 'fuzzy'
    return None, 0, None

def pos_weight(i): return 1.5 if i < 5 else (0.5 if i >= 20 else 1.0)

# ---- Appendix B/C 'Chromascope action' flags: which user profile each ingredient group is flagged for ----
def _vul(u): return u['skin_type']=='Sensitive' or bool(u.get('eczema')) or bool(u.get('rosacea'))
APPENDIX_FLAGS = {
 'fragrance': _vul, 'paraben': lambda u: u['skin_type']=='Sensitive', 'oxybenzone': _vul, 'formaldehyde': _vul,
 'lanolin': lambda u: u['skin_type']=='Sensitive', 'propyleneglycol': lambda u: u['skin_type']=='Sensitive',
 'capb': lambda u: u['skin_type']=='Sensitive' or bool(u.get('eczema')),
 'ipm_algae': lambda u: bool(u.get('acne')), 'coconut_cocoa': lambda u: bool(u.get('acne'))}
FLAG_FLOOR = 0.5          # literature prior: P(reaction/breakout) for an Appendix-flagged (ingredient, user) pair

# ---- user profile helpers ----
def vulnerable(u): return u['skin_type']=='Sensitive' or u.get('eczema') or u.get('rosacea')
def acne_prone(u): return bool(u.get('acne'))

# ---- CPT calibration from survey (Beta smoothing against literature prior) ----
def build_cpts(df, prior_strength=20):
    """P(reaction | group, vulnerable?) and P(breakout | group, acne-prone?) as Beta posterior means.
    Survey rows weighted by df.weight (real=1.0, synthetic=0.3)."""
    cpt = {}
    vul = (df.skin_type=='Sensitive') | (df.diag_eczema=='Yes') | (df.diag_rosacea=='Yes')
    acn = df.diag_acne=='Yes'
    for g,(_,risk) in ALLERGEN.items():
        used = df[f'used_{g}']=='Yes'
        for flag, mask in ((True, vul), (False, ~vul)):
            sub = df[used & mask]; w = sub.weight.values; y = sub[f'reacted_{g}'].values
            prior = (0.35 if flag else 0.12) if risk=='High' else (0.25 if flag else 0.08)
            a = prior*prior_strength + (w*y).sum(); b = (1-prior)*prior_strength + (w*(1-y)).sum()
            cpt[(g,flag)] = (a/(a+b), float(w.sum()))
    for g,(_,rating) in COMED.items():
        used = df[f'used_{g}']=='Yes'
        for flag, mask in ((True, acn), (False, ~acn)):
            sub = df[used & mask]; w = sub.weight.values; y = sub[f'broke_out_{g}'].values
            prior = min(0.8, 0.05 + 0.12*rating*(1.5 if flag else 0.7))
            a = prior*prior_strength + (w*y).sum(); b = (1-prior)*prior_strength + (w*(1-y)).sum()
            cpt[(g,flag)] = (a/(a+b), float(w.sum()))
    return cpt

def noisy_or(ps): return 1 - np.prod([1-min(0.99,p) for p in ps]) if ps else 0.0

def bucket(p, caution=0.7, monitor=0.3): return 'Caution' if p >= caution else ('Monitor' if p >= monitor else 'Clear')

def evaluate(inci, user, cpt, caution=0.7, monitor=0.3, monitor_b=None, guard=True, acne_block=True, flags=True, comma_safe=True, return_detail=False):
    toks = normalize(inci, comma_safe); declared = set(user.get('allergens', []))
    allergy_p, breakout_p, detail = [], [], []
    for i, t in enumerate(toks):
        g, conf, how = lookup(t, guard)
        if g is None: continue
        detail.append((t, g, how))
        if g in HARD_BLOCK or g in declared or (acne_block and g == 'wheatgerm_lanolin' and acne_prone(user)):  # Appendix C: block for acne-prone                     # non-overridable hard-block
            return ('Excluded', detail) if return_detail else 'Excluded'
        w = pos_weight(i)
        flagged = flags and g in APPENDIX_FLAGS and APPENDIX_FLAGS[g](user)
        if g in ALLERGEN:
            p = cpt[(g, bool(vulnerable(user)))][0]; allergy_p.append((max(p, FLAG_FLOOR) if flagged else p) * w * conf)
        else:
            p = cpt[(g, acne_prone(user))][0]; breakout_p.append((max(p, FLAG_FLOOR) if flagged else p) * w * conf)
    pa, pb = noisy_or(allergy_p), noisy_or(breakout_p)
    tiers = (bucket(pa, caution, monitor), bucket(pb, caution, monitor if monitor_b is None else monitor_b))
    v = 'Safe' if tiers == ('Clear','Clear') else 'Caution'
    return (v, detail, pa, pb) if return_detail else v
