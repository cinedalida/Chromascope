"""Phase 3 unit tests (PLAN.md). Run: python -m unittest test_matching -v   (from filter/)"""
import csv, json, os, tempfile, unittest
import pandas as pd
import safety_filter as sf
from safety_filter import Matcher, load_review

V2 = Matcher()                                    # all fixes on, no approved review rows
NONE = {'add': {}, 'remove': set(), 'exclude': set()}
HERE = os.path.dirname(os.path.abspath(__file__))


def group(m, tok):
    return m.lookup((tok,))[0]


def review_file(rows):
    fh = tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False, encoding='utf-8', newline='')
    w = csv.DictWriter(fh, fieldnames=sf.REVIEW_COLUMNS); w.writeheader()
    for r in rows:
        w.writerow({**{c: '' for c in sf.REVIEW_COLUMNS}, **r})
    fh.close()
    return fh.name


class WholeWord(unittest.TestCase):
    def test_baseline_false_hits_gone(self):
        for t in ('ethylhexylglycerin', 'dipropylene glycol', 'methylpropanediol', 'menthoxypropanediol',
                  'polyglycerin 3', 'polyglycerin 6', 'diglycerin', 'dimethicone polyglycerin 3 crosspolymer',
                  'trimethylsiloxyphenyl dimethicone diglycerin', 'octyldodecyl shea butterate', 'quaternium 18'):
            self.assertIsNone(group(V2, t), t)

    def test_fuzzy_still_catches_typos(self):
        for t, g in (('methylisothiazolinon', 'mi'), ('triticum vlgare germ oil', 'wheatgerm_lanolin'),
                     ('quaternium 15', 'formaldehyde'), ('quaternum 15', 'formaldehyde'),
                     ('neolone 90', 'mi'), ('c.i. 76006', 'ppd')):          # hard blocks tolerate a 1-edit digit typo
            self.assertEqual(group(V2, t), g, t)

    def test_run_on_lists(self):
        inci = ('Water, VA Copolymer Propylene Carbonate Parfum Sodium Citrate Hexadecene Aluminum Hydroxide '
                'Hydrogenated Polyisobutene Glycerin, Talc')
        self.assertEqual(sorted(x[2] for x in V2.matches(inci)), ['fragrance', 'glycerin_ha_zno'])
        long_ex = 'Water, Talc Mica Aminomethyl Propanediol Silica Dimethicone Polybutene Isododecane Octyldodecanol'
        rev = {'add': {}, 'remove': set(), 'exclude': {'aminomethyl propanediol'}}
        self.assertEqual(Matcher(review=rev).matches(long_ex), [])                 # exclusions respected in run-ons

    def test_old_matcher_still_has_them(self):         # proves the flag really switches the fix
        old = Matcher(whole_word=False)
        self.assertEqual(group(old, 'ethylhexylglycerin'), 'glycerin_ha_zno')
        self.assertEqual(group(old, 'dipropylene glycol'), 'propyleneglycol')

    def test_whole_word_still_matches_real_names(self):
        self.assertEqual(group(V2, 'lanolin oil'), 'lanolin')
        self.assertEqual(group(V2, 'sodium methylparaben'), 'paraben')
        self.assertEqual(group(V2, 'cocos nucifera oil'), 'coconut_cocoa')

    def test_pending_review_items_unchanged_without_approval(self):
        self.assertEqual(group(V2, 'propanediol'), 'propyleneglycol')        # remove: pending
        self.assertEqual(group(V2, 'squalene'), 'squalane_sunflower_shea')   # exclude: pending
        self.assertEqual(group(V2, 'aminomethyl propanediol'), 'propyleneglycol')
        self.assertIsNone(group(V2, 'sodium hyaluronate'))                   # add: pending
        self.assertIsNone(group(V2, 'paraffinum liquidum'))


class Punctuation(unittest.TestCase):
    def test_shared_rules(self):
        for t, g in (('p phenylenediamine', 'ppd'), ('p-phenylenediamine', 'ppd'), ('benzophenone 3', 'oxybenzone'),
                     ('benzophenone-3', 'oxybenzone'), ('1 2 propanediol', 'propyleneglycol'),
                     ('1,2-propanediol', 'propyleneglycol'), ('1 4 diaminobenzene', 'ppd'), ('ci 76060', 'ppd'),
                     ('c.i. 76060', 'ppd')):
            g2, conf, how, _ = V2.lookup((t,))
            self.assertEqual((g2, how), (g, 'exact'), t)

    def test_canon(self):
        self.assertEqual(sf.canon('C.I. 76060'), 'ci 76060')
        self.assertEqual(sf.canon('Caprylic/Capric  Triglyceride'), 'caprylic capric triglyceride')


class Noise(unittest.TestCase):
    def toks(self, s):
        return V2.tokens(s)

    def test_claims_dropped(self):
        self.assertEqual(V2.matches('Water, Fragrance-Free, Paraben-free, Talc'), [])
        self.assertEqual(V2.matches('Mica]. What it is formulated without: - Parabens - Sulfates'), [])

    def test_misjoined_separators(self):
        self.assertEqual(self.toks('BHT. : Octyldodecanol, Talc'), [('bht',), ('octyldodecanol',), ('talc',)])
        self.assertEqual(self.toks('Carmine ] Polybutene'), [('carmine',), ('polybutene',)])

    def test_may_contain_mid_list(self):
        t = self.toks('Mica, Linalool. May contain: Titanium Dioxide, CI 77491')
        self.assertEqual(t, [('mica',), ('linalool',)])

    def test_labels_and_percentages(self):
        m = V2.matches('Active Ingredient / Ingrédient actif: Zinc Oxide 15% / Oxyde de zinc 15%'
                       'Inactive Ingredients / Ingrédients inactifs: Aqua/Water/Eau')
        self.assertEqual([x[2] for x in m], ['glycerin_ha_zno'])

    def test_bracket_duplicate(self):
        self.assertEqual(self.toks('Jasminum Sambac Leaf Cell Extract [Jasminum Sambac Leaf Cell Extract'),
                         [('jasminum sambac leaf cell extract',)])


class HardBlocks(unittest.TestCase):
    cpt = {k: (0.1, 1.0) for k in [(g, f) for g in list(sf.ALLERGEN) + list(sf.COMED) for f in (True, False)]}
    user = dict(skin_type='Normal', allergens=[])

    def test_mi_ppd_still_excluded(self):
        for inci in ('Water, Methylisothiazolinone', 'Aqua, P-Phenylenediamine', 'Aqua, 1,4-Diaminobenzene',
                     'Aqua, Methylisothiazolinone. May contain: Mica'):
            self.assertEqual(sf.evaluate(inci, self.user, self.cpt, matcher=V2), 'Excluded', inci)

    def test_declared_allergen_excluded(self):
        u = dict(skin_type='Normal', allergens=['fragrance'])
        self.assertEqual(sf.evaluate('Water, Parfum, Mica', u, self.cpt, matcher=V2), 'Excluded')

    def test_acne_block(self):
        u = dict(skin_type='Oily', acne=True, allergens=[])
        self.assertEqual(sf.evaluate('Water, Triticum Vulgare Germ Oil', u, self.cpt, matcher=V2), 'Excluded')


class Review(unittest.TestCase):
    def test_unapproved_rows_have_no_effect(self):
        p = review_file([dict(proposed_alias='sodium hyaluronate', group='glycerin_ha_zno', change='add'),
                         dict(proposed_alias='squalene', change='exclude', approved_by='X'),       # no date
                         dict(proposed_alias='propanediol', group='propyleneglycol', change='remove', approved_date='2026-11-03')])
        self.assertEqual(load_review(p), NONE)
        os.unlink(p)

    def test_approved_rows_apply(self):
        p = review_file([dict(proposed_alias='sodium hyaluronate', group='glycerin_ha_zno', change='add', approved_by='R1', approved_date='2026-11-04'),
                         dict(proposed_alias='squalene', change='exclude', approved_by='R1', approved_date='2026-11-04'),
                         dict(proposed_alias='propanediol', group='propyleneglycol', change='remove', approved_by='R1', approved_date='2026-11-04')])
        m = Matcher(review=load_review(p)); os.unlink(p)
        self.assertEqual(group(m, 'sodium hyaluronate'), 'glycerin_ha_zno')
        self.assertIsNone(group(m, 'squalene'))
        self.assertIsNone(group(m, 'propanediol'))
        self.assertEqual(group(m, '1,2-propanediol'), 'propyleneglycol')   # other aliases untouched

    def test_bad_rows_rejected(self):
        p = review_file([dict(proposed_alias='x', group='not_a_group', change='add', approved_by='R1', approved_date='d')])
        self.assertRaises(ValueError, load_review, p); os.unlink(p)


class Equivalence(unittest.TestCase):
    """Matcher with every fix off must reproduce the original path exactly."""
    def test_synthetic_dev_cases(self):
        with open(os.path.join(HERE, 'cases.json'), encoding='utf-8') as fh:
            d = json.load(fh)['dev']
        cpt = sf.build_cpts(pd.read_csv(os.path.join(sf.os.environ.get('CHROMASCOPE_DATA_DIR', ''), 'survey',
                                                     'chromascope_500_balanced.csv'))) \
            if os.environ.get('CHROMASCOPE_DATA_DIR') else HardBlocks.cpt
        off = Matcher(canon_punct=False, whole_word=False, noise_strip=False)
        for c in d:
            a = sf.evaluate(c['inci'], c['user'], cpt, return_detail=True)
            b = sf.evaluate(c['inci'], c['user'], cpt, return_detail=True, matcher=off)
            self.assertEqual(a, b, c['case_id'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
