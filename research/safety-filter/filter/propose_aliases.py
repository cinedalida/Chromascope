"""Write / refresh $CHROMASCOPE_DATA_DIR/review/alias_review.csv (PLAN.md Phase 3).

Proposals come from the DEV POOL analysis only. Nothing here changes the filter: a row takes effect only after a
researcher fills in `approved_by` and `approved_date`. Re-running keeps every existing approval, note and any row a
researcher added; it only refreshes `formulas_affected` and `example_product`.

change = add      -> alias is added to `group`
change = remove   -> alias is removed from the alias table
change = exclude  -> this exact ingredient name never matches any group (approve = exclude; leave blank = keep matching)
"""
import collections, csv, os
import dev_pool
from safety_filter import Matcher, REVIEW_COLUMNS, canon

U = ' [researcher decides]'
EU = 'EU Cosmetics Regulation 1223/2009 Annex III labelled fragrance allergen [TO VERIFY against current Annex III]'
PROPOSALS = (
    [('paraffinum liquidum', 'jojoba_cetyl_mineraloil', 'add', 'INCI name of mineral oil (Appendix C: mineral oil)', 'INCI'),
     ('butyrospermum parkii butter', 'squalane_sunflower_shea', 'add', 'INCI name of shea butter (Appendix C: shea butter)', 'INCI'),
     ('sodium hyaluronate', 'glycerin_ha_zno', 'add', 'salt of hyaluronic acid (Appendix C: hyaluronic acid, rating 0)', 'INCI'),
     ('hydrolyzed sodium hyaluronate', 'glycerin_ha_zno', 'add', 'hyaluronic acid derivative' + U, 'INCI'),
     ('sodium acetylated hyaluronate', 'glycerin_ha_zno', 'add', 'hyaluronic acid derivative' + U, 'INCI'),
     ('sodium hyaluronate crosspolymer', 'glycerin_ha_zno', 'add', 'hyaluronic acid derivative' + U, 'INCI'),
     ('potassium hyaluronate', 'glycerin_ha_zno', 'add', 'salt of hyaluronic acid', 'INCI'),
     ('isobutylparaben', 'paraben', 'add', 'a paraben; no longer caught once substring matching became whole-word', 'INCI'),
     ('methylchloroisothiazolinone', 'mi', 'add', 'usually sold with MI (MCI/MI). NOTE: the MI group is a HARD BLOCK, '
      'so this would exclude every product containing it for every user [TO VERIFY with Appendix B]', 'Appendix B'),
     ('jojoba esters', 'jojoba_cetyl_mineraloil', 'add', 'jojoba derivative; comedogenicity may differ from jojoba oil' + U, 'INCI')]
    + [(a, 'ipm_algae', 'add', 'algae extract (Appendix C: algae extract)' + U, 'Appendix C')
       for a in ('chlorella vulgaris extract', 'chlorella emersonii extract', 'spirulina platensis extract',
                 'laminaria digitata extract', 'laminaria cloustoni extract', 'laminaria saccharina extract',
                 'laminaria ochroleuca extract')]
    + [(a, 'fragrance', 'add', EU, 'EU 1223/2009')
       for a in ('citronellol', 'hexyl cinnamal', 'amyl cinnamal', 'cinnamal', 'coumarin', 'eugenol', 'isoeugenol',
                 'citral', 'benzyl benzoate', 'benzyl salicylate', 'alpha isomethyl ionone', 'farnesol',
                 'hydroxycitronellal', 'cinnamyl alcohol', 'butylphenyl methylpropional')]
    + [('benzyl alcohol', 'fragrance', 'add', EU + '; also widely used as a preservative' + U, 'EU 1223/2009'),
       ('propanediol', 'propyleneglycol', 'remove', '1,3-propanediol is a different chemical from propylene glycol '
        '(1,2-propanediol)', 'chemistry'),
       ('squalene', '', 'exclude', 'different from squalane; only matched through the fuzzy tier', 'chemistry'),
       ('aminomethyl propanediol', '', 'exclude', 'pH adjuster, not propylene glycol', 'chemistry'),
       ('menthone glycerin acetal', '', 'exclude', 'cooling agent, not glycerin', 'chemistry')]
    + [(a, '', 'exclude', 'propylene glycol ester, a different ingredient from propylene glycol' + U, 'chemistry')
       for a in ('propylene glycol dicaprylate dicaprate', 'propylene glycol dibenzoate', 'propylene glycol dicaprate',
                 'propylene glycol laurate', 'propylene glycol stearate')]
    + [(a, '', 'exclude', 'derivative of a listed ingredient: approve to stop matching, leave blank to keep' + U, 'chemistry')
       for a in ('hydrogenated jojoba oil', 'hydrolyzed hyaluronic acid', 'helianthus annuus seed oil unsaponifiables',
                 'hydrogenated olive oil stearyl esters', 'hydrogenated olive oil unsaponifiables',
                 'hydrogenated olive oil myristyl esters', 'hydrogenated olive oil decyl esters',
                 'hydrogenated coconut oil', 'shea butter ethyl esters', 'squalane polyacrylate 13')])


def main():
    F, P = dev_pool.load()
    name = dict(zip(P.product_id, P.product_brand + ' - ' + P.product_name))
    m = Matcher()
    seen = collections.defaultdict(list)                       # canonical token -> dev product_ids (one per formula)
    for pid, ing in zip(F.product_id, F.ingredients):
        for alts in m.tokens(ing):
            for a in set(alts):
                seen[canon(a)].append(pid)
    path = dev_pool.review_path()
    old = {}
    if os.path.exists(path):
        with open(path, encoding='utf-8', newline='') as fh:
            old = {(r['proposed_alias'], r['group'], r['change']): r for r in csv.DictReader(fh)}
    rows = []
    for alias, group, change, why, src in PROPOSALS:
        pids = seen.get(canon(alias), [])
        r = old.pop((alias, group, change), {})
        rows.append(dict(proposed_alias=alias, group=group, change=change, formulas_affected=len(pids),
                         example_product=name[sorted(pids)[0]] if pids else '', rationale=why, source=src,
                         approved_by=r.get('approved_by', ''), approved_date=r.get('approved_date', ''),
                         notes=r.get('notes', '')))
    rows += list(old.values())                                 # rows a researcher added by hand are kept
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=REVIEW_COLUMNS, lineterminator='\n'); w.writeheader(); w.writerows(rows)
    print(f'{path}: {len(rows)} rows, {sum(bool(r["approved_by"]) for r in rows)} approved')


if __name__ == '__main__':
    main()
