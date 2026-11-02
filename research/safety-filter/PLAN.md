# PLAN: integrate the scraped PH product database with the safety filter

Status: APPROVED 2026-11-03. Phase 0 in progress. Branch `feat/product-db-integration` (stacked on `feat/safety-filter-research`, which is not
merged yet; rebase onto `main` once it is). Nothing in this plan is implemented. No commits until approved.

## Decisions already made (by you)
1. The scraped PH database **replaces** the old product database. Stores: **Sephora PH, Rustan's PH, Maybelline PH**.
   Ulta is left out.
2. Verdicts are **per shade**: the filter judges each distinct ingredient list (a "formula"); each shade row points to
   its formula ID. The **product-level headline is the worst verdict across its shades** (Excluded > Caution > Safe).
3. The data lives **only in a private repo**. Never the public app repo (`cinedalida/Chromascope`, which is public) and
   never the public scraper repo.

## Baseline facts (measured 2026-11-03 on `MakeUp_Scraper-main.zip`, decoded CSVs)
| Store | Shade rows | Products | Distinct formulas |
|---|---:|---:|---:|
| Sephora PH | 7,205 | 910 | 2,896 |
| Rustan's PH | 988 | 121 | 172 |
| Maybelline PH | 122 | 23 | 23 |
| **Total** | 8,315 | 1,054 | 3,091 |

Known filter problems on this data (from the analysis, to be fixed in Phase 3):
- Substring tier false hits: `ethylhexylglycerin` -> glycerin (761), `dipropylene glycol` / `methylpropanediol` /
  `menthoxypropanediol` -> propylene glycol (287), `polyglycerin`/`diglycerin` -> glycerin (63).
- Exact alias `propanediol` (1,3-propanediol) mapped to the propylene glycol group (261 formulas).
- Fuzzy tier: `squalene` -> squalane (110).
- Missing INCI synonyms: `paraffinum liquidum` (72), `butyrospermum parkii butter` (451), `sodium hyaluronate` (546);
  no `methylchloroisothiazolinone`.
- Punctuation mismatch: the decoder writes `1 2 hexanediol`, `benzophenone 3`; filter aliases keep hyphens and commas.
- 165 Sephora tokens > 60 characters (disclaimers, kit labels).
- MI, PPD, nickel, DMDM hydantoin, CAPB: 0 formulas.
- Uncached lookup: ~7 min per full pass; cached: ~14 s.

## Data location (applies to every phase)
- New **private** GitHub repo for data, working name `chromascope-data` `[name TO CONFIRM]`. Holds: the decoded CSVs
  (3 stores), the derived formula/shade tables, the frozen dev/held-out split, the precomputed lookups, the researcher
  labels, and the approved alias review file. The four survey CSVs move there too (approved 2026-11-03).
- The public app repo holds **code only**. Scripts read the data from `CHROMASCOPE_DATA_DIR` (env var, default
  `research/safety-filter/data/`, which is gitignored).
- Creating the private repo is an outward-facing action: you create it (or approve me doing it) before Phase 1.
- Validation for this rule, run at every commit: `git ls-files` in the app repo lists no `.csv`, no `data/` file, and no
  label/split file; `git check-ignore` confirms the data folder is ignored.

---

## Phase 0: setup (no code)
- Confirm the private repo exists and that you and the researchers can access it; it stays private (`Settings ->
  General -> Danger zone` shows "Private").
- Copy the three stores' `data/decoded/` folders into it (no Ulta, no `raw/`, no `inci_browser_profile/`). Record the
  zip's SHA-256 and the scraper's scrape/decode dates in a `SOURCE.md`.
- Add `research/safety-filter/data/` to the app repo's `.gitignore`.
- **Validation:** private repo visibility is Private; file count = 22 + 16 + 11 = 49 CSVs; SHA-256 of the zip recorded;
  app repo `git status` shows only `.gitignore` changed.

## Phase 1: import and dedupe
- New `filter/product_db.py`:
  - Loads the 49 decoded CSVs, adds `store`, keeps product, shade and ingredient columns plus `shade_lab`.
  - Drops cross-listing duplicates on `product_url + shade_name + shade_lab` (data guide: 125 Sephora and 18 Rustan's
    products appear in more than one subcategory). Keeps the first `subcategory` and records all of them.
  - `formulas` table: one row per distinct `(product_url, ingredients)`; `formula_id` = first 12 hex chars of SHA-1 of
    `product_url + "\n" + ingredients` (stable across runs and machines).
  - `shades` table: one row per shade with `formula_id`, `shade_name`, `shade_lab`, `shade_rgb`.
  - `products` table: one row per `product_url` with brand, name, store, category, subcategories, price.
  - Writes all three to the private data dir.
- **Validation:**
  1. Products per store = 910 / 121 / 23; formulas = 3,091 (the de-dupe changes shade-row counts, not these).
  2. Every shade has a `formula_id` that exists in `formulas`; no empty `ingredients`; no Ulta rows.
  3. Shade rows after de-dupe reported per store, with the number removed and why.
  4. Run twice: identical file hashes (IDs stable).

## Phase 2: freeze the evaluation split (before any fix is developed)
This comes before the matching fixes on purpose: the held-out products must not influence the fixes.
- New `filter/make_split.py` (fixed seed, recorded):
  - Strata = store x `category` (`face`, `eye`, `lip`, `cheek`, `concealer`); 15 strata, all non-empty (each
    store has files in all five categories).
  - Draws **80 products** at product level (not formula level): proportional to stratum size, minimum 1 per stratum.
    60 -> **test set**, 20 -> **controlled set** (stratified the same way).
  - For each held-out product, picks one shade (seeded) and therefore one formula to label.
  - Everything else is the **dev pool** used to develop and tune Phase 3.
  - Each test case = (formula, user profile). Profiles are drawn from a fixed profile grid (skin type x
    eczema/rosacea/acne x declared allergens), seeded, so labels are about a concrete user.
  - Controlled cases: (formula, profile with a declared allergen that **is** in the formula). Because MI/PPD/nickel
    do not occur in this database, the controlled set tests declared-allergen exclusion, not the MI/PPD hard-block.
    The MI/PPD hard-block keeps its synthetic controlled cases, reported separately and labeled as synthetic.
  - Writes `split.json` (product_url -> dev/test/controlled, seed, strata table) to the private repo and **freezes** it
    (SHA-256 recorded in this plan once made).
  - **Frozen 2026-11-03:** seed `20261103`; `split.json` SHA-256
    `68a3a6d13a2e34a5f9d05ea19dfaa0f54a9f87426d2ef3833f3d7893fb9ac3b2` (`make_split.py` version 1).
- Labeling protocol (for the researchers, not code): two researchers label each case Safe / Caution / Excluded
  **independently**, from Appendix B/C and their own judgement, without seeing filter output. Disagreements are
  adjudicated and logged. Inter-rater Cohen's kappa is reported.
- **Validation:**
  1. 60 + 20 = 80 distinct products; zero overlap with the dev pool (checked on `product_url` and on `formula_id`).
  2. Strata table: count per store x category for test, controlled and dev, against the population proportions.
  3. Re-running with the same seed reproduces `split.json` byte for byte.
  4. Every controlled case's declared allergen is present in its formula (checked with the **new** matcher from
     Phase 3, re-checked after that phase; any case that fails is reported, not silently swapped).

## Phase 3: matching fixes (developed on the dev pool only)
Each fix gets an on/off flag (like `comma_safe`), so the ablation can show its effect.
- **Shared punctuation rules:** one `canon()` function applied to both aliases and tokens: lowercase; hyphens, slashes
  and commas inside names -> space; collapse whitespace; strip parentheses content as today. Result:
  `p-phenylenediamine` and `p phenylenediamine` match; `benzophenone-3` = `benzophenone 3` (exact, not fuzzy).
- **Whole-word matching:** replace the raw substring tier with word-boundary matching on `canon()` output (alias must
  match whole words inside the token), plus an explicit **exclusion list** for chemically distinct names
  (`ethylhexylglycerin`, `dipropylene glycol`, `methylpropanediol`, `menthoxypropanediol`, `aminomethyl
  propanediol`, `polyglycerin *`, `diglycerin`, ...).
- **Fuzzy tier:** keep the edit-distance guard; add `squalene` (and any other pair found) to the exclusion list.
- **Noise tokens:** strip known disclaimer patterns ("formulations are updated", "ingredient lists or claims may
  differ", "product name:", "active ingredient", bilingual labels) before splitting; tokens > 60 chars after
  stripping are logged, not matched by substring.
- **Alias review list:** `alias_review.csv` in the private repo with columns `proposed_alias, group, change (add /
  remove / exclude), formulas_affected, example_product, rationale, source, approved_by, approved_date`. Initial
  entries: remove `propanediol` from propylene glycol; add `paraffinum liquidum` (mineral oil),
  `butyrospermum parkii butter` (shea), `sodium hyaluronate` (HA), `methylchloroisothiazolinone` (MI group
  `[TO VERIFY with Appendix B]`); plus every exclusion above. **Nothing changes in `ALIAS` until a researcher fills
  `approved_by`.** The code loads only approved rows.
- **Thresholds:** unchanged unless re-tuned on the dev pool / synthetic dev set only. Any re-tune is reported with
  before/after values.
- **Validation:**
  1. Unit tests (`filter/test_matching.py`): each listed false hit no longer matches; each approved alias matches;
     `p phenylenediamine` -> ppd and `1 2 propanediol` -> propylene glycol (if approved); MI/PPD hard-blocks still fire.
  2. Dev pool before/after: match counts per group and per tier; false-hit table from the baseline is empty.
  3. Precision spot-check: 50 random matches from the dev pool, reviewed by a researcher; count reported.
  4. Synthetic **dev** set ablation still runs and is reported. The synthetic **test** set is not re-scored with the
     new matcher (it was already scored once).
  5. `git ls-files` check from "Data location" passes.

## Phase 4: caching and precomputed lookups
- `lookup()` memoized (`functools.lru_cache` on the canonical token).
- New `filter/precompute.py`: for every formula, store the user-independent part: list of
  `(position, token, group, confidence, tier)`. Written to the private data dir with the matcher version and the
  approved-alias file hash, so stale caches are detected.
- New `evaluate_precomputed(matches, user, cpt, ...)` that does only the per-user hard-block + Bayesian step.
- **Validation:**
  1. `evaluate_precomputed` == `evaluate` for every dev formula x every profile in the grid (100% identical verdicts and
     probabilities to 1e-12).
  2. Full precompute pass time reported (target < 30 s); per-user scoring of all 3,091 formulas reported (target < 1 s).
  3. Changing `alias_review.csv` invalidates the cache (test).

## Phase 5: per-shade verdicts and product headline
- `verdicts_for_user(user)` -> per formula verdict; shades inherit their formula's verdict; product headline = worst
  shade verdict, with a count ("Caution: 3 of 30 shades").
- **Validation:**
  1. Unit tests on a hand-made product with Safe / Caution / Excluded shades -> headline Excluded, counts correct.
  2. On the dev pool: number of products whose shades disagree, per store (Sephora expected highest, Maybelline 0).
  3. Every shade row in `shades` gets exactly one verdict.

## Phase 6: held-out evaluation (run once)
- Preconditions: Phases 3 to 5 approved and frozen (matcher version + alias file hash recorded); researcher labels
  complete and adjudicated.
- Score the 60 test cases and 20 controlled cases **once**: accuracy, Cohen's kappa, macro F1 (Objective 2 target
  > 0.90), per-class F1 and recall, confusion matrix; controlled: number Excluded / 20; inter-rater kappa.
- Results are reported as they come out. If test errors lead to further fixes, a **new** held-out set is drawn from the
  dev pool's remaining products (Phase 2 again) before any new score is reported.
- **Validation:** the scoring script refuses to run if `split.json`, the label file, or the matcher version hash differ
  from the frozen values; output is saved with those hashes.

## Phase 7: paper sections to update (list only; I won't edit the paper without your OK)
Section numbers come from CLAUDE.md where known; the rest are `[TO VERIFY]` against the thesis.
- **Section 3.3B** (filter spec): lookup tiers (whole-word instead of substring; shared punctuation rules; exclusion
  list), noise stripping, caching / precomputation, per-shade verdicts + product headline.
- **Section 3.8.3** (test design): 60 test + 20 controlled real products, stratified by store x category, held out
  before fix development; labeling protocol and inter-rater agreement; controlled set now tests declared allergens.
- **Section 4.4.5** (results): replace the 120-product / 30-controlled description and the synthetic results with the
  Phase 6 results. Resolves the 3.8.3 vs 4.4.5 conflict (60 + 20).
- **Appendix B** (allergens) and **Appendix C** (comedogenicity): approved alias additions/removals from
  `alias_review.csv`.
- Product database / data collection section `[section TO VERIFY]`: the scraped PH database (3 stores, scrape and
  decode dates, product/shade/formula counts), replacing the 120 products / 104 ingredients description; Ulta excluded.
- Ethics / data handling section `[section TO VERIFY]`: data kept in a private repo; retailer ownership of product data.
- Shade matching (CIEDE2000) section `[section TO VERIFY]`: shade colors now come from measured `shade_lab`.
- Limitations `[section TO VERIFY]`: MI/PPD absent from real makeup data (hard-block tested only synthetically); one
  formula per held-out product; INCIDecoder normalization residue in Sephora.

## Out of scope (separate plan if wanted)
- Wiring this into the app backend / Firestore and mapping the app's user schema (`acne_prone` skin type, 15 avoid
  keys) to the filter's 10 allergen groups.
- Decoding Ulta.

## Approvals needed
- This plan as a whole; then each phase before it starts.
- Private repo creation and name (Phase 0).
- Each commit and each push, separately.
