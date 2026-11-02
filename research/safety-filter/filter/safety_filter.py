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

# ---- Matcher v2 (PLAN.md Phase 3): shared punctuation rules, whole-word matching, noise stripping, reviewed aliases ----
# Every fix has its own flag so the ablation can switch it off. Matcher(all flags False, review=None) reproduces the
# original normalize() + lookup() exactly (tested in test_matching.py). Alias changes come ONLY from approved rows of
# alias_review.csv (approved_by and approved_date both filled in); unapproved rows are ignored.
import csv, os
REVIEW_COLUMNS = ['proposed_alias', 'group', 'change', 'formulas_affected', 'example_product', 'rationale', 'source',
                  'approved_by', 'approved_date', 'notes']
GROUPS = set(ALLERGEN) | set(COMED)

def canon(s):
    """Shared punctuation rules, applied to aliases and tokens alike: lowercase; drop dots ('c.i.' -> 'ci');
    hyphens, slashes and commas inside names -> space; collapse whitespace."""
    s = s.lower().replace('.', '')
    return re.sub(r'\s+', ' ', re.sub(r'[-/,]', ' ', s)).strip()

_CUT = re.compile(r'(may contain|peut contenir|\[\+/-|\+/-).*$', re.S)       # everything after it is optional colorants
_PCT = re.compile(r'\d+(?:\.\d+)?\s*%')
_SEP = re.compile(r'\s*(?:\.\s*:|:|\[|\]|;|\s\*\s)\s*')                       # mis-joined ingredients inside one token
_LABEL = re.compile(r'\b(?:in)?active ingredients?\b|\bingr\S*dients?(?: (?:in)?actifs?)?\b|\bingredients?\b|'
                    r'\bproduct name\b|\bdivision\b|\bhoupette\b|\bwhat it is\b')
_DROP = re.compile(r'\bfree\b|\bwithout\b|less th[ae]n|formulat|releasing|from time to time|may differ|'
                   r'region of purchase|commitment|compliance|please refer|packaging|listing')
LONG = 60

def load_review(path):
    """Approved alias changes from alias_review.csv. Returns {'add': {alias: group}, 'remove': set, 'exclude': set}."""
    out = {'add': {}, 'remove': set(), 'exclude': set()}
    if not path or not os.path.exists(path):
        return out
    with open(path, encoding='utf-8', newline='') as fh:
        for r in csv.DictReader(fh):
            if not (r.get('approved_by', '').strip() and r.get('approved_date', '').strip()):
                continue                                                     # not approved -> no effect
            ch, a, g = r['change'].strip(), r['proposed_alias'].strip().lower(), r['group'].strip()
            if ch not in ('add', 'remove', 'exclude'):
                raise ValueError(f'alias_review: unknown change {ch!r} for {a!r}')
            if ch in ('add', 'remove') and g not in GROUPS:
                raise ValueError(f'alias_review: unknown group {g!r} for {a!r}')
            if ch == 'add': out['add'][a] = g
            elif ch == 'remove': out['remove'].add(a)
            else: out['exclude'].add(a)
    return out

class Matcher:
    def __init__(self, canon_punct=True, whole_word=True, noise_strip=True, review=None, guard=True):
        self.canon_punct, self.whole_word, self.noise_strip, self.guard = canon_punct, whole_word, noise_strip, guard
        review = review or {'add': {}, 'remove': set(), 'exclude': set()}
        c = canon if canon_punct else (lambda s: s)
        alias = {a: g for a, g in ALIAS.items() if a not in review['remove'] and c(a) not in {c(x) for x in review['remove']}}
        alias.update(review['add'])
        self.alias = {c(a): g for a, g in alias.items()}
        self.short = {a for a in self.alias if len(a) <= 4}
        self.exclude = {c(x) for x in review['exclude']}
        self._words = {a: re.compile(r'(?<![a-z0-9])' + re.escape(a) + r'(?![a-z0-9])') for a in self.alias}
        self._cache = {}

    def tokens(self, inci):
        """List of positions; each position is a tuple of alternative spellings (bilingual '/' variants)."""
        if not self.noise_strip:
            return [(t,) for t in normalize(inci)]
        s = _CUT.sub('', inci.lower())
        s = _PCT.sub(' ', re.sub(r'\(.*?\)', '', s))
        out = []
        for t in re.split(r'(?<!\d),|,(?!\d)', s):
            for part in _SEP.split(t):
                part = _LABEL.sub(' ', part).strip(' .()*•-')
                part = re.sub(r'\s+', ' ', part)
                if not part or _DROP.search(part):
                    continue
                alts = tuple(a for a in (x.strip(' .()*•-') for x in re.split(r'\s/\s|/', part)) if a)
                if alts and (not out or out[-1] != alts):                     # '[same name' duplicates
                    out.append(alts)
        return out

    def _lookup_one(self, tok):
        c = canon(tok) if self.canon_punct else tok
        if c in self.exclude: return None, 0, None
        if c in self.alias: return self.alias[c], 1.0, 'exact'
        if self.whole_word:
            if len(c) <= LONG:
                subs = [a for a in self.alias if a not in self.short and a in c and self._words[a].search(c)]
                if subs: a = max(subs, key=len); return self.alias[a], 0.9, 'word'
        else:
            subs = [a for a in self.alias if a not in self.short and a in c]
            if subs: a = max(subs, key=len); return self.alias[a], 0.9, 'substring'
        if self.noise_strip and len(c) > LONG: return None, 0, None
        cand = [a for a in self.alias if a not in self.short]
        if self.whole_word:   # an alias the word tier rejected as part of a longer word ('dipropylene glycol') is not a typo
            cand = [a for a in cand if a not in c]
        if self.canon_punct:  # numbers name different chemicals (quaternium-15 vs -18): fuzzy only if the numbers agree.
            # Asymmetric on purpose: for HARD_BLOCK groups (MI, PPD) a 1-edit digit typo still matches ('neolone 90',
            # 'c.i. 76006'), because missing a hard block is worse than a wrong exclusion.
            nums = ' '.join(re.findall(r'\d+', c))
            cand = [a for a in cand if ' '.join(re.findall(r'\d+', a)) == nums or
                    (self.alias[a] in HARD_BLOCK and damerau(' '.join(re.findall(r'\d+', a)), nums) <= 1)]
        if self.guard:
            for a in cand:
                if damerau(c, a) <= min(2, max(1, int(0.15*max(len(c), len(a))))): return self.alias[a], 0.7, 'fuzzy'
            return None, 0, None
        best, ba = 0, None
        for a in cand:
            r = difflib.SequenceMatcher(None, c, a).ratio()
            if r > best: best, ba = r, a
        return (self.alias[ba], 0.7, 'fuzzy') if best >= 0.85 else (None, 0, None)

    def lookup(self, alts):
        if alts not in self._cache:
            self._cache[alts] = next(((g, conf, how, a) for a in alts for g, conf, how in [self._lookup_one(a)] if g),
                                     (None, 0, None, None))
        return self._cache[alts]

    def _run_on(self, alts):
        """Positions longer than LONG are usually several ingredients run together without commas. Report every group
        found as a whole word (excluded names blanked out first); no fuzzy matching on them."""
        found = {}
        for x in alts:
            c = canon(x) if self.canon_punct else x
            for e in self.exclude:
                c = re.sub(r'(?<![a-z0-9])' + re.escape(e) + r'(?![a-z0-9])', ' ', c)
            for a in sorted(self.alias, key=len, reverse=True):
                if a not in self.short and a in c and self._words[a].search(c) and self.alias[a] not in found:
                    found[self.alias[a]] = a
                    c = self._words[a].sub(' ', c)        # longest alias wins its words ('acetylated lanolin')
        return found

    def matches(self, inci):
        """[(position, token, group, confidence, tier)] for every matched position."""
        out = []
        for i, alts in enumerate(self.tokens(inci)):
            if self.noise_strip and self.whole_word and max(map(len, alts)) > LONG:
                out += [(i, a, g, 0.9, 'word-long') for g, a in self._run_on(alts).items()]
                continue
            g, conf, how, a = self.lookup(alts)
            if g: out.append((i, a, g, conf, how))
        return out

def evaluate(inci, user, cpt, caution=0.7, monitor=0.3, monitor_b=None, guard=True, acne_block=True, flags=True, comma_safe=True, return_detail=False, matcher=None):
    declared = set(user.get('allergens', []))
    if matcher is None:   # original path, unchanged
        hits = [(i, t) + lookup(t, guard) for i, t in enumerate(normalize(inci, comma_safe))]
        hits = [h for h in hits if h[2] is not None]
    else:
        hits = matcher.matches(inci)
    allergy_p, breakout_p, detail = [], [], []
    for i, t, g, conf, how in hits:
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
