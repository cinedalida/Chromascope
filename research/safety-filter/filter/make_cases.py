"""Generate test cases + independent ground-truth labels.
Ground truth is assigned from the TRUE ingredient identities (known at generation time) using the Appendix B/C action
rules - it does not use the filter's parsing, fuzzy matching, or probabilities."""
import random, json, pandas as pd
from safety_filter import ALLERGEN, COMED, APPENDIX_FLAGS
FILLER = ['aqua','water','butylene glycol','dimethicone','phenoxyethanol','tocopherol','xanthan gum','sodium chloride',
          'cetearyl alcohol','cetyl palmitate','benzyl alcohol','citric acid','disodium edta','sodium hyaluronate','titanium dioxide',
          'caprylic/capric triglyceride','stearic acid','niacinamide','panthenol','allantoin','silica','talc','mica']
def typo(s, r):
    if len(s) < 6: return s
    i = r.randrange(1, len(s)-1); return s[:i] + s[i+1:] if r.random() < .5 else s[:i] + s[i+1] + s[i] + s[i+2:]
def label(true_groups, user):
    vul = user['skin_type']=='Sensitive' or user['eczema'] or user['rosacea']
    acne = user['acne']
    if any(g in user['allergens'] for g in true_groups) or {'mi','ppd'} & set(true_groups): return 'Excluded'
    if acne and 'wheatgerm_lanolin' in true_groups: return 'Excluded'
    for g in true_groups:
        if g in APPENDIX_FLAGS and APPENDIX_FLAGS[g](user): return 'Caution'
    return 'Safe'
def make(n, seed, controlled=False):
    r = random.Random(seed); out = []
    allg = list(ALLERGEN) + list(COMED)
    for k in range(n):
        user = dict(skin_type=r.choice(['Oily','Combination','Dry','Normal','Sensitive','Pigmented']),
                    eczema=r.random()<.18, rosacea=r.random()<.08, acne=r.random()<.35,
                    allergens=r.sample(list(ALLERGEN), r.choice([0,0,1,2])))
        ng = r.choice([0,1,1,2,2,3]); groups = r.sample(allg, ng)
        if controlled:
            user['allergens'] = r.sample(list(ALLERGEN), 1); groups = sorted(set(groups) | set(user['allergens']))
        toks, true = [], []
        for g in groups:
            al = (ALLERGEN.get(g) or COMED[g])[0]; a = r.choice([x for x in al if len(x) > 4] or al)
            if r.random() < .25: a = typo(a, r)
            toks.append(a); true.append(g)
        body = r.sample(FILLER, r.randint(6, 22)); inc = {}
        for t in toks: body.insert(r.randint(0, len(body)), t)
        inci = ', '.join(x.title() for x in body)
        if r.random() < .3:                                           # decoy allergen in "may contain" clause (must be ignored)
            inci += '. May contain: ' + r.choice(['Methylisothiazolinone','Fragrance','Nickel'])
        user_u = {**user}; user_u['conditions'] = None
        out.append(dict(case_id=f'{"C" if controlled else "T"}{seed}-{k:03d}', inci=inci, user=user, true_groups=true,
                        expected=label(true, user)))
    return out
if __name__ == '__main__':
    dev = make(300, 11); test = make(150, 44); ctrl = make(30, 55, controlled=True)
    json.dump(dict(dev=dev, test=test, controlled=ctrl), open('cases.json','w'), indent=1)
    for k,v in (('dev',dev),('test',test),('controlled',ctrl)):
        print(k, len(v), pd.Series([c['expected'] for c in v]).value_counts().to_dict())
