# AR Real-Shade Integration: Execution Plan (v2, manuscript-aligned)

For Claude, working in the Chromascope repo. Read this whole file and `CLAUDE.md` before doing anything. If this file and `CLAUDE.md` disagree, `CLAUDE.md` wins.

Branch for this work: `feature/ar-real-shades`, created from `feature/ar-tryon-enhancements` in Phase 0.

Version note: v2 was checked against research manuscript v7 (`BCS32 Research Paper ... _7.pdf`). It adds a recommended-first shade source, an in-app performance display, and a store allowlist, because v1 conflicted with the manuscript (see section 2).

---

## 0. How to work with this plan

### Per-phase loop

This is `CLAUDE.md` section 1 applied to every phase.

1. Wait for the user to say which phase to start (for example "start Phase 1"). Never start the next phase on your own.
2. Read every file listed under "Read first" for that phase, plus anything else relevant. Edit nothing yet.
3. Reply with a change plan: files reviewed, each file to change and what changes, new or deleted files, risks and open questions.
4. Wait for an explicit go-ahead ("go", "proceed", "approved").
5. Implement only the approved plan. If you find something else that needs changing, stop and report it.
6. Run the automated checks for the phase and report them as a table: check, command, result, pass or fail.
7. Summarize what changed, file by file. List the manual checks the user has to do, since you cannot test the camera yourself. Then stop and wait for the user's results.
8. Only after the user confirms the manual checks passed: show the staged files and the proposed commit message, wait for confirmation, then commit. Never push.

### Hard rules

- Never run `git push`. The user pushes.
- Ask before pulling. If a pull conflicts, do not resolve it. List the conflicts and wait.
- Stage specific files with `git add <file>`. Never `git add .` or `git add -A`. Never stage `.vscode/`, `.env`, `.venv/`, `node_modules/`, or service account files.
- Conventional Commits, imperative lowercase summary, max about 72 characters. One logical change per commit. Suggested messages are given per phase.
- No Claude or AI attribution anywhere: not in commits, not in code comments, not in docs.
- No em dashes in code comments, docs, or UI text. Keep comments short and plain.
- Never invent data. If a value is missing in a source, drop the row and count it in the report.
- Do not touch Firestore data, `serviceAccountKey.*`, `backend/app/api/*`, or `backend/app/core/*`. Read-only requests to the local API are allowed only with the user's approval.
- Do not edit anything in the sibling repo `MakeUp_Scraper`. Read only. If it is not readable from this session, ask the user to grant access.
- Do not edit the research manuscript or any file in the Claude project. Manuscript changes are listed in section 8 for the user to make.
- CI runs lint and build on the frontend. From `frontend/`, `npm run lint` and `npm run build` must pass before any commit. Record the baseline in Phase 0 and never leave it worse.
- The user is on Windows. Prefer commands that work in any shell, such as `python -c ...`, over shell-specific syntax.

### Progress tracker

Update this table only as part of an approved change plan, after the user says a phase passed.

| Phase | Status |
|---|---|
| 0 Baseline and branch | [x] |
| 1 Build the Browse shade catalog | [x] |
| 2 Recommended-source investigation (read only) | [x] |
| 3 Frontend data layer (Recommended + Browse) | [ ] |
| 4 Selected shade drives overlay | [x] |
| 4b Blend comparison (only if needed) | [ ] |
| 5 Applied Products panel | [ ] |
| 6 In-app performance display | [ ] |
| 7 Phone test and manuscript notes | [ ] |

---

## 1. Goal and scope

Goal: replace the placeholder AR colors (`DEFAULT_COLORS` in `AROverlayCanvas.jsx`) with real product shades, painted on the live face for lips, cheeks, and eyeshadow. The user picks shades from two sources:

- **Recommended** (default, shown first): the products the safety filter and matching engine return for this user. This is what the manuscript says AR renders.
- **Browse**: a larger shade catalog built from the MakeUp_Scraper dataset, clearly labeled as not checked by the safety filter.

In scope: Browse catalog build script, frontend data layer for both sources, wiring selected shades to the overlay, the real Applied Products panel, and the in-app performance display the manuscript requires.

Out of scope: Firestore data changes, backend routes and engine code, the Excel migration scripts, the `lab_L/a/b` backend gap, PWA packaging, any change to face tracking or smoothing.

## 2. Manuscript alignment rules (manuscript v7)

Every phase must respect these. If a phase would break one, stop and report.

| # | Rule | Manuscript basis |
|---|---|---|
| R1 | AR renders the shades returned by the safety filter and the matching engine. Recommended is the default and appears first in the panel. | Sec. 3.3-D intro, user walkthrough (Sec. 4.1.1, p.100 to 101), Objective 3 ("renders recommended cosmetic shades"), `region_colors` input of the pseudocode |
| R2 | Products with verdict Excluded never appear in Recommended. | Walkthrough: Excluded products "are not recommended" |
| R3 | Browse shades are not checked by the safety filter. The panel must say so visibly, and the manuscript needs a paragraph describing Browse (section 8). Adviser sign-off needed. | Safety filter scope, Sec. 1.7 |
| R4 | Catalog is limited to the Philippine market. Browse uses an allowlist of stores: `sephora`, `rustans`, `maybelline`. Ulta (US) is excluded. | Sec. 1.7, Sec. 4.1.1 |
| R5 | Regions are lips, cheeks, eyeshadow. Full Face is only a UI shortcut that flips the three. 478 landmarks. Do not reintroduce per-triangle rendering. | Pseudocode (p.59), Sprint 5 deliverable |
| R6 | The app has a built-in performance display. After 30 seconds of try-on, participants read the average FPS and the latency in ms from it and enter them as TR1 and TR2. Latency is the time to process and render one camera frame. | Sec. 4.4.2 (Technical Performance Log), Sec. 4.4.4.2 |
| R7 | The camera feed is processed only on the device and is not recorded or transmitted. Capture saves a PNG locally only. Do not add any upload of frames. | Sec. 3.7 privacy paragraph (p.86 to 87) |
| R8 | No made-up match percentages. CIEDE2000 distance is computed only for Face products today, so lips, cheeks, and eyeshadow show no percentage. | Sec. 3.3-C, Step 4 |

## 3. Locked decisions

1. Browse catalog is static JSON generated from the scraper CSVs, committed in `frontend/public/data/`. One file per AR region.
2. Recommended comes from the existing `runFilter` call in `frontend/src/services/productService.js`. No backend change.
3. Both sources are normalized into one shade item shape (section 5, Phase 3) so the panel and overlay code are shared.
4. After Phase 5, a region with no selected shade is not drawn.
5. Cheeks in Browse use Blush only. The subcategory mapping lives in one dict in the build script.

## 4. Browse data reference

Source: `../MakeUp_Scraper/data/decoded/<store>/csv_<store>_<category>_<subcategory>.csv`. Read the scraper's `data/README.md` if anything about the columns is unclear.

- One row is one shade, not one product. Product columns repeat on every shade row.
- Files are UTF-8 with a byte-order mark. Open with `encoding="utf-8-sig"`.
- Columns used: `product_name`, `product_brand`, `category`, `subcategory`, `price`, `price_currency`, `finish` (Sephora only), `shade_name`, `shade_rgb`, `shade_lab`, `product_url`.
- `shade_rgb` and `shade_lab` are text such as `(204, 104, 90)` and `(55.56, 38.28, 26.09)`. Parse with `ast.literal_eval`. A blank means no usable swatch, so drop the row.
- Dedupe key: `(store, product_url, shade_name, shade_lab)`.

Default mapping and verified counts (Phase 1 output; deduped within each region, blank colors removed):

| AR region | Scraper (category / subcategory) | Shades | Products |
|---|---|---:|---:|
| lips | lip / Lipstick, lip / Lip color, lip / Lip gloss, lip / Lip stain & tint | 1,811 | 251 |
| cheeks | cheek / Blush | 541 | 99 |
| eyeshadow | eye / Eye shadow, eye / Eyeshadow | 484 | 64 |
| total | | 2,836 | |

Dedupe is per region. A shade the store lists in two regions (for example a lip and cheek tint) appears in both files.

Excluded by default: Lip balm, Lip liner, Lip plumper, Bronzer, Contour, Highlighter, Eyebrows, Eyeliner, Mascara, Rustan's Eyeshadow palette (no usable colors), and every Ulta file (R4).

Limits of the data (go in the paper notes): colors are averaged from small swatch images, so they are approximations and not calibrated. Two-tone chips become one blended color. Sephora and Rustan's Lab values are measured from images. Maybelline Lab is derived from the site's hex. Screens render colors differently, so the try-on is indicative only.

## 5. File map

New:
- `backend/scripts/build_ar_shade_catalog.py`
- `frontend/public/data/ar-shades-lips.json`, `ar-shades-cheeks.json`, `ar-shades-eyeshadow.json`
- `frontend/src/services/arShadeService.js` (Browse)
- `frontend/src/services/arRecommendedService.js` (Recommended)
- `frontend/src/hooks/useARShades.js`
- `frontend/src/utils/shadeGroups.js`
- `frontend/src/components/ar-tryon/ARPerformanceDisplay.jsx`
- `frontend/src/hooks/useARPerformance.js`

Modified:
- `frontend/src/pages/ARTryOnPage.jsx`
- `frontend/src/components/ar-tryon/AROverlayCanvas.jsx`
- `frontend/src/components/ar-tryon/AppliedProductsPanel.jsx`
- `frontend/src/components/ar-tryon/ProductSwatchPicker.jsx`

Do not modify (exception, approved by the user: `ARControlBar.jsx` got a styling-only change for smaller buttons on phones): `ARControlBar.jsx`, `CameraFeed.jsx`, `useARCamera.jsx`, `meshRegions.js`, `landmarkSmoothing.js`, `productService.js`, anything under `backend/app/`.

### Facts verified in the code before this plan was written

Re-check them when you read the files, and tell the user if any changed.

- `AROverlayCanvas` is a `forwardRef` component. It takes `colors = DEFAULT_COLORS` as a default parameter and reads `colors.lips`, `colors.cheeks`, `colors.eyeshadow` directly. There is no merge, so a partial object gives `undefined`.
- The render effect lists `colors` and `toggles` in its dependency array. A new object on every render restarts the effect. Pass memoized values. Also check whether restarting the effect resets the smoothing state or restarts the animation loop. If it does, keep the colors in a ref so changing a shade does not cause a visible hiccup.
- Model loading is a separate effect. Changing a shade must not reload the model.
- The only timing call in the AR code is `performance.now()` passed to `landmarker.detectForVideo`. There is no FPS or latency display anywhere in `frontend/src`.
- `ARTryOnPage` owns `toggles`, and Full Face is a derived shortcut for lips + cheeks + eyeshadow. Capture is already implemented through `overlayRef.current.capture()`.
- `AppliedProductsPanel` is uncontrolled and uses a dummy `products` array with fake `deltaE` values and tabs LIPS, EYESHADOW, BLUSH. `ProductSwatchPicker` is a stub.
- `runFilter(payload)` in `productService.js` requires a signed-in user (`auth.currentUser`), posts to `/api/run-filter`, and on any failure returns `{ safety_results: [], color_matched: [] }`. The backend accepts category keys `lips`, `cheeks`, `eyes` and returns `color_matched`, already sorted by season match then verdict for non-Face categories. Each item is a Firestore product doc with fields such as `product_id`, `brand`, `product_name`, `sub_category`, `hex_color`, `lab_L`, `lab_a`, `lab_b`, `season_tag_computed`, `verdict`, and `is_season_match`. A product doc has one color, not one per shade.
- `backend/labcolormigration.py` writes `hex_color` as `#FFFFFF` and Lab as 0 when the Excel cell is blank. Treat `#FFFFFF` with Lab all zero as a placeholder, not a real shade.
- Vite has no custom `base`, so `import.meta.env.BASE_URL` is `/`.
- `.gitignore` does not ignore JSON or a `data` folder, so the generated files can be committed.

---

## 6. Phases

### Phase 0: Baseline and branch

Read first: `CLAUDE.md`, this file, `.github/workflows/*`, `frontend/package.json`.

Do:
1. Ask the user whether to pull the latest before starting.
2. `git status` and `git branch --show-current`. The base branch should be `feature/ar-tryon-enhancements` with only the untracked `.vscode/` and `docs/` showing. Report anything else.
3. After approval, create and switch to `feature/ar-real-shades`. If `.git/index.lock` blocks git, stop and tell the user. Do not delete it yourself.
4. From `frontend/`, run `npm run lint` and `npm run build`. Report the baseline result.
5. Confirm `../MakeUp_Scraper/data/decoded/{sephora,rustans,maybelline}` is readable.

Manual checks for the user:
- [ ] `npm run dev` starts, the AR page opens, the camera starts, and the face is tracked.
- [ ] Lips, Cheeks, Eyeshadow, and Full Face toggles behave as before. Capture saves a PNG.

Commit: none. Optionally the user may ask to commit this plan as `docs: add AR real-shade integration plan`.

---

### Phase 1: Build the Browse shade catalog

Read first: this file sections 2 and 4, the scraper's `data/README.md`, one CSV per store (header and a few rows), `backend/scripts/migrate_to_firebase.py` for the repo's script style.

Spec for `backend/scripts/build_ar_shade_catalog.py` (Python 3, standard library only, no new dependencies):
1. Arguments: `--src` (default `../MakeUp_Scraper/data/decoded`) and `--out` (default `frontend/public/data`).
2. Two constants at the top of the file: `STORES = ("sephora", "rustans", "maybelline")` (R4) and `REGION_MAP`, a dict of region -> list of `(category, subcategory)` pairs matching section 4. Skip any store folder not in `STORES` and count its rows as "store not allowed" in the report.
3. Read every CSV under `src/<store>/` with `csv.DictReader` and `utf-8-sig`. Keep only rows whose `(category, subcategory)` is in the map.
4. Drop rows with a blank `shade_rgb` or `shade_lab`. Parse both. Validate `0 <= R,G,B <= 255` and `0 <= L <= 100`. Drop failures.
5. Dedupe on `(store, product_url, shade_name, shade_lab)`.
6. Output one JSON file per region: `ar-shades-<region>.json`. Each entry has exactly these keys:

| Key | Type | Rule |
|---|---|---|
| `id` | string | first 12 hex characters of sha1 of `store\|product_url\|shade_name\|shade_lab`, using the CSV text for `shade_lab` |
| `store` | string | folder name |
| `brand` | string | `product_brand` |
| `product` | string | `product_name` with any trailing ` • <size>` removed |
| `shade` | string | `shade_name` |
| `hex` | string | `#RRGGBB`, uppercase, from `shade_rgb`. Example: `(204, 104, 90)` -> `#CC685A` |
| `lab` | [number, number, number] | `[L, a, b]` from `shade_lab` |
| `price` | number or null | from `price`, null if blank |
| `currency` | string | `price_currency` as written (`Peso` or `Dollar`) |
| `finish` | string or null | Sephora `finish`, otherwise null |
| `url` | string | `product_url` |

7. Sort entries by brand, product, shade, then id. Write compact JSON with `ensure_ascii=False`, UTF-8 without a byte-order mark, and `\n` line endings, so two runs give byte-identical files.
8. Print a report: rows read, rows kept, rows dropped by reason (store not allowed, not in map, blank color, invalid value, duplicate), shades and unique products per region and per store, output file sizes, and 5 sample entries per region with a fixed random seed.

Automated checks:
- [ ] Script runs without errors and prints the report.
- [ ] Counts match section 4. Any difference must be explained by a reason in the report.
- [ ] Each file parses as JSON, every entry has all keys, `hex` matches `^#[0-9A-F]{6}$`, `lab` has 3 numbers, `id` values are unique within each file, and no entry has `store` equal to `ulta`.
- [ ] Run twice and compare SHA-256 of each file with `python -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" <file>`. Hashes are identical.
- [ ] No file is over 1 MB.
- [ ] `git status` shows only the new script and the three JSON files.

Manual checks for the user:
- [ ] Pick 3 random sample entries, find them in the source CSV by `product_url` and `shade_name`, and confirm the hex equals the converted `shade_rgb`.
- [ ] Paste 10 hex values from the lips file into any color picker. They should read as reds, pinks, nudes, and berries.

Suggested commits (two):
- `feat(backend): add AR shade catalog build script`
- `chore(frontend): add generated AR shade catalog`

---

### Phase 2: Recommended-source investigation (read only, edit nothing)

Why: Recommended must come from the existing safety filter and matching engine (R1, R2). The Firestore catalog is built from an Excel file that is not in the repo, so we need to know what the API really returns for lips, cheeks, and eye products before building on it.

Read: `backend/app/api/api.py`, `backend/app/core/color_matching.py`, `engine.py`, `matcher.py`, `constants.py`, `frontend/src/services/productService.js`, the auth guard around the AR route (router and `App`), and `ARTryOnPage.jsx`.

To see real data, ask the user to either approve starting the backend locally for read-only GET requests, or paste the output of `http://localhost:8000/api/products`. Do not write to Firestore.

Report in under 400 words:
1. How the AR page is reached: does it require sign-in, and does the signed-in user always have `seasonal_label` and `user_lab` on their profile?
2. For categories Lip, Cheek, and Eye: how many products exist, the distinct `sub_category` values with counts, how many have a real `hex_color` (not empty and not the `#FFFFFF` placeholder with Lab all zero), and the distinct `season_tag_computed` values.
3. Which `sub_category` values correspond to eyeshadow, blush, and lip color products, so `arRecommendedService` can filter correctly. Do not guess.
4. What `/api/run-filter` returns for categories `lips`, `cheeks`, and `eyes`, including verdict values and the `is_season_match` flag.
5. Whether any existing function maps a Lab color to a season, so Browse shades could later be labeled by season. Say plainly if not.
6. Risks for the Recommended tab: for example an empty list when signed out, a profile with no season, or too few products with real colors.

Gate: the user reviews the report. Log decisions in the paper notes.

---

### Phase 3: Frontend data layer (Recommended + Browse)

Read first: `productService.js`, `ARTryOnPage.jsx`, `AppliedProductsPanel.jsx`, and the Phase 2 report.

Unified shade item shape used everywhere:

```
{ id, source ("recommended" | "browse"), brand, product, shade (string or null),
  hex, lab (array or null), price, currency, finish, url,
  verdict ("safe" | "caution" | null), seasonMatch (boolean) }
```

Spec:
1. `frontend/src/services/arShadeService.js` (Browse)
   - `export const REGION_KEYS = ["lips", "cheeks", "eyeshadow"]`
   - `export async function getShades(region)`: fetch `${import.meta.env.BASE_URL}data/ar-shades-${region}.json`, check it is an array, cache the promise per region in a module-level `Map`. Reject unknown region keys. Map each entry to the unified shape with `source: "browse"`, `verdict: null`, `seasonMatch: false`. On failure `console.error` and return `[]`.
2. `frontend/src/services/arRecommendedService.js` (Recommended)
   - `export async function getRecommended(region)` returns `{ status, items, seasonFilter, dropped }` where status is `"ok" | "signed_out" | "empty" | "error"`.
   - Wait for `auth.authStateReady()` first, because `auth.currentUser` is null until Firebase restores the saved session. If there is still no user, return `signed_out` without calling the API.
   - Call `runFilter({ category })` with `lips`, `cheeks`, or `eyes` for the region. Use `color_matched` from the response, keeping the backend's order. `runFilter` returns empty lists on any failure, so a response without `active_profile` is `error`.
   - Drop, in this order: items whose `sub_category` is not in the region allowlist, items with a placeholder or missing hex (see section 5), and items whose verdict is `excluded` (R2).
   - Sub-category allowlists (Phase 2 decision), kept as constants at the top of the file, matched after trimming and lowercasing:
     - lips: Lipstick, Lipstick (Matte), Lipstick - balm, Lip Tint, Lip Tint (Velvet), Lip (Liquid Matte), Lip Gloss, Lip Oil (Lip Balm / Treatment excluded)
     - cheeks: Blush, Powder Blush, Liquid Blush, Liquid Blush (Multi-use), Cream Blush Stick, Cream Cheek Tint, Lip and Cheek tint (highlighter, contour, bronzer, and "Blush / Highlight / Contour" excluded)
     - eyeshadow: Eyeshadow, Eyeshadow Stick
   - Season rule (Phase 2 decision, matches pseudocode step 5): if the user has a season and at least one remaining item has `is_season_match`, keep only the matches (`seasonFilter: "matched"`). If the user has a season but nothing matches, keep all remaining items in backend order (`"fallback"`). If the user has no season, keep all remaining items (`"no_season"`).
   - `dropped` reports `{ subCategory: { total, byValue }, placeholder, excluded }`.
   - Map to the unified shape with `source: "recommended"`, `shade: null`, `lab` from `lab_L/a/b` when they are not all zero, `seasonMatch` from `is_season_match`, `url: null` (Firestore has no product URL), `finish: null`. Firestore `price` is text such as `≈ ₱799`; parse the number, currency `Peso` when `₱` is present, null when blank.
   - Cache per user and region for the life of the mounted AR page, with a 5-minute expiry as a backstop. Do not cache `signed_out` or `error`. Provide `clearRecommendedCache()`.
3. `frontend/src/hooks/useARShades.js`
   - `export function useARShades(region, source)` returns `{ items, status, loading, seasonFilter }`. Ignore results that arrive after unmount or after the region or source changed. Follow the repo's react-hooks lint rules.
4. `frontend/src/utils/shadeGroups.js`
   - `groupByProduct(items)`: array of `{ key, source, brand, product, price, currency, finish, url, verdict, seasonMatch, shades }` in original order. For Recommended, each group has exactly one item.
   - `searchProducts(groups, query)`: case-insensitive match on brand, product, or any shade name. An empty query returns all groups.

Do not modify any existing component or `productService.js`. No new dependencies.

Automated checks:
- [ ] `npm run lint` and `npm run build` pass, no worse than baseline.

Manual checks for the user (browser console on the AR page):
- [ ] `const m = await import('/src/services/arShadeService.js'); (await m.getShades('lips')).length` returns the Phase 1 lips count. Repeat for cheeks and eyeshadow. A second call is instant and the Network tab shows each JSON fetched once.
- [ ] Signed in: `const r = await import('/src/services/arRecommendedService.js'); await r.getRecommended('lips')` returns `status: "ok"` with items that have no `excluded` verdict and no `#FFFFFF` hex. Signed out: `status: "signed_out"`.
- [ ] `dropped.subCategory.total` is exactly lips 2, cheeks 5, eyeshadow 14. If not, fix the allowlist strings.
- [ ] The AR page looks and behaves exactly as before.

Suggested commit: `feat(frontend): add AR shade services, hook, and search helpers`

---

### Phase 4: Selected shade drives the overlay color

Read first: `ARTryOnPage.jsx`, `AROverlayCanvas.jsx` (the whole file, especially the render effect and its dependency array).

Spec:
1. In `ARTryOnPage.jsx` add state `selectedShades = { lips: null, cheeks: null, eyeshadow: null }` with `selectShade(region, shade)` and `clearShades()`. Build `colors` with `useMemo`: for each region use `selectedShades[region]?.hex` and leave the key out when nothing is selected. Pass `colors` to `AROverlayCanvas`. Do not change the toggles logic.
2. In `AROverlayCanvas`, merge a partial `colors` prop over `DEFAULT_COLORS` so a missing key never becomes `undefined`. If changing `colors` restarts the render loop or resets smoothing in a visible way, store the colors in a ref instead, and tell the user why.
3. Add a DEV-only debug strip (render only when `import.meta.env.DEV`) above the controls with buttons: "Random lips", "Random cheeks", "Random eyeshadow" (Browse source), "Recommended lips" (first Recommended item), "Darkest lips", and "Lightest lips" (lowest and highest `lab[0]` in Browse). Each calls the service, applies the shade through `selectShade`, and shows `brand - product - shade (hex)` in small text. Mark the strip with a TODO saying it is removed in Phase 5.

Automated checks:
- [ ] `npm run lint` and `npm run build` pass.
- [ ] The strip is not present in the production build (`import.meta.env.DEV` guard).

Manual checks for the user:
- [ ] Each button changes only its matching region on the live face.
- [ ] Toggles still work. Full Face still flips all three. A toggled-off region does not draw even with a shade selected.
- [ ] Capture PNG includes the new colors.
- [ ] No console errors. Tracking smoothness looks unchanged when a shade changes.
- [ ] Blend check: apply "Darkest lips", then "Lightest lips". They should look clearly different. If they look too alike, run Phase 4b before continuing, and send screenshots of both.

Suggested commit: `feat(frontend): drive AR overlay colors from selected shades`

### Phase 4b: Blend comparison (only if the blend check failed)

Why: the overlay uses the `"color"` blend mode, which keeps the skin's brightness and takes only the shade's hue and saturation. Dark and light shades of a similar hue can look the same.

Spec:
1. In `AROverlayCanvas.jsx` add a `REGION_RENDER` constant: `{ lips: { blend, opacity }, cheeks: { blend, opacity }, eyeshadow: { blend, opacity } }`, seeded with the current values (`"color"` and `0.75`). Use it in the `fillRegion` calls instead of the single `blendMode` and `opacity` props.
2. Add a DEV-only control with one dropdown per region for blend (`color`, `multiply`, `soft-light`, `overlay`, `hard-light`) and one slider per region for opacity (0.3 to 1). Changes apply live.
3. Do not choose a winner. The user compares by eye using the darkest and lightest shade of each region and reports the choice.
4. After the user decides, a follow-up approved change hardcodes the chosen values in `REGION_RENDER` and removes the dev controls.

Manual check for the user: a blend and opacity are chosen per region.

Suggested commit: `feat(frontend): set per-region blend and opacity for AR overlay`

---

### Phase 5: Applied Products panel (Recommended first, Browse second)

Behavior change to confirm in the change plan: after this phase, a region with no selected shade is not drawn. Placeholder colors no longer paint the face on load, and "Clear all" leaves a clean face.

Read first: `AppliedProductsPanel.jsx`, `ProductSwatchPicker.jsx`, `ARTryOnPage.jsx`, `AROverlayCanvas.jsx`.

Keep the current look: tabs, chips, toggle style, and the Tailwind tokens already used. Only the data and behavior change.

Spec:
1. Delete the dummy `products` array and the `MatchBadge` / `deltaE` display (R8). Do not show any percentage.
2. Make `AppliedProductsPanel` controlled. Props: `selectedShades`, `onSelectShade(region, shade)`, `onClear()`. Region tabs LIPS, EYESHADOW, BLUSH map to `lips`, `eyeshadow`, `cheeks`.
3. Inside each region tab add a two-option switch: **Recommended** (default, first) and **Browse**. Use `useARShades(region, source)` and `groupByProduct`.
4. Recommended list: show a verdict badge (Safe or Caution) and a "Season match" tag when `seasonMatch` is true. Empty states by status: `signed_out` ("Sign in to see products matched to you"), `empty` ("No matched products for this category yet"), `error` ("Could not load your matches"). Each empty state offers a link or button to switch to Browse. Notices by `seasonFilter`: `fallback` shows "Showing everything that passed your ingredient check." (do not say "safe matches", because Caution items are included); `no_season` shows a hint to run Color Analysis, with a link.
5. Browse list: show a short visible note at the top, "Browse shades are not checked by the ingredient safety filter." (R3). Search input using `searchProducts`, debounced 150 ms. Render at most 20 product cards with a "Show more" button that adds 20 more. Reset the count when the tab, source, or query changes.
6. Each product card shows brand (small caps), product name, price with currency, finish if present, and a `ProductSwatchPicker` row. Recommended cards have one swatch. Browse cards have all of the product's shades.
7. `ProductSwatchPicker({ shades, selectedId, onSelect })`: a horizontally scrollable row of round swatches (background is `shade.hex`). The selected swatch gets a ring. Each swatch has `title` and `aria-label` set to the shade name, or the product name when there is no shade name.
8. Applied chips at the top come from `selectedShades`, one per region: a dot with the real hex, the shade or product name, and the brand. Chips for Browse items carry a small "Browse" label. The x button clears that region only. "Clear all" calls `onClear`. The count line reads "N active".
9. Loading and error states for each fetch, and an empty state for no search results.
10. In `ARTryOnPage.jsx` pass the new props, delete the Phase 4 debug strip, and remove the old Task 7 TODO comment. Call `clearRecommendedCache()` when the AR page mounts, so changed allergens or a new season never show stale results. Use `useLayoutEffect` for this: a parent's plain effect runs after its children's effects, so the panel would read the old cache first.
11. Phase 5 decisions: the per-product on/off switch is removed, since a shade is applied by tapping its swatch and removed by tapping it again. The verdict badge copies the `StatusBadge` colors from the Ingredient Filter page instead of sharing the component, so that page is not edited. Swatches are 40 px to pass the tap-target audit. The "signed out" manual check no longer applies, because `/ar-tryon` now requires login.
12. Later UI additions (user request): the Recommended / Browse switch sits above the region tabs and is styled purple as the main choice. A full-screen button (top-right of the camera frame, next to the performance toggle) expands the camera to the whole window and also uses the browser's full screen where supported. iPhone Safari has no element full screen, so there it fills the window only. Esc, the button, or leaving browser full screen exits. The shade panel is hidden while expanded. In `AROverlayCanvas`, skip drawing a region when `colors` has no entry for it, and stop falling back to `DEFAULT_COLORS` for rendering.

Automated checks:
- [ ] `npm run lint` and `npm run build` pass.
- [ ] `grep` finds no remaining `deltaE`, `MatchBadge`, or dummy product data in the panel.
- [ ] No code sends camera frames or canvas data anywhere (R7). Capture still saves locally only.

Manual checks for the user:
- [ ] Each region tab opens on Recommended. Recommended shows no Excluded products and no white placeholder swatches.
- [ ] Signed out, Recommended shows the sign-in message and Browse still works.
- [ ] Browse shows the safety note. Search "fenty" shows Fenty products only. A nonsense query shows the empty state.
- [ ] Tapping a swatch changes the overlay, the chip shows the same color, and the count updates.
- [ ] The chip x clears only that region. "Clear all" clears the face.
- [ ] Eyeshadow toggled off with a shade selected draws nothing until toggled on.
- [ ] "Show more" works. Scrolling the long list does not make the camera feed stutter.
- [ ] Capture includes the applied colors.
- [ ] At phone width the panel stacks under the camera and swatch rows scroll sideways.

Suggested commit: `feat(frontend): replace dummy applied products with real shades`

---

### Phase 6: In-app performance display

Why: the manuscript (R6) has participants read the 30-second average FPS and latency from "the app's built-in performance display". This must exist in the build participants use, so it is not dev-only. Latency is defined as the time to process and render one camera frame.

Read first: `AROverlayCanvas.jsx` (the detect and render loop), `ARTryOnPage.jsx`, and manuscript Sec. 4.4.2 as summarized in R6.

Spec (revised after merging `main`, which already has Jan's display: `usePerfStats.js`, `PerfStatsBadge.jsx`, the Profile setting "Show performance stats (FPS)", and the `onFrame` callback in `AROverlayCanvas.jsx`):
1. Build on Jan's files. No `useARPerformance.js` or `ARPerformanceDisplay.jsx`.
2. `AROverlayCanvas.jsx`: `onFrame(latencyMs, hasFace)`. Latency stays `performance.now()` after drawing minus `performance.now()` just before `detectForVideo`. Do not change what is drawn.
3. `usePerfStats.js`: the 30-second window starts at the first frame with a face. When 30 seconds have passed, the result is computed once and stays fixed until the setting is turned off or the page is left. The live line keeps updating. Samples stay in refs; state updates every 500 ms.
4. Frames with no face (decision): FPS counts every processed frame, so a lost face does not lower FPS. The latency average uses only frames with a face, because frames without one skip drawing. The display shows the share of frames with a face.
5. `PerfStatsBadge.jsx`: "Waiting for camera", then "Waiting for a face", then the live line and "Measuring", then the fixed line `30 s avg: <fps> FPS · <ms> ms` (Jan's wording, which Jan's test reads) and "Face in N% of frames".
6. Visibility (decision, revised): on by default, with a toggle button in the top-right of the camera frame as well as Jan's Profile setting; both use the same saved setting. A settings migration turns it on once for browsers that saved "off" before. Participants do not need to visit Profile first. Jan's test `setting is off by default and survives a reload` no longer matches and is left for Jan to update.
7. Jan's Playwright test `badge shows live FPS/latency, then the 30 s average` uses Chromium's fake camera, which shows no face, so it cannot reach the fixed result any more. Left for Jan to update (decision).
8. Remove nothing else. No frame data leaves the device (R7).

Automated checks:
- [ ] `npm run lint` and `npm run build` pass.
- [ ] The display renders in the production build (`npm run build`, then `npm run preview`).

Manual checks for the user:
- [ ] After 30 seconds the fixed average appears and matches what the live values were showing.
- [ ] Turning on lips, cheeks, and eyeshadow together (heaviest case) raises latency visibly, as expected.
- [ ] The display does not reduce frame rate when hidden or shown.

Suggested commit: `feat(frontend): fix the AR performance average to a 30 s face-tracked window`

---

### Phase 7: Phone test and manuscript notes

Phones only allow camera access over HTTPS. Use an HTTPS tunnel such as ngrok or Vite HTTPS, not a plain LAN address.

Manual checks for the user:
- [ ] On a real phone over HTTPS: note device model, browser, and the 30-second average FPS and latency from the display.
- [ ] Worst case: lips, cheeks, and eyeshadow all on, with feathering.
- [ ] Browse JSON loads quickly on mobile data (`npm run build`, then `npm run preview`).
- [ ] No uncaught errors in the phone console.
- [ ] Targets from the manuscript: at least 30 FPS (Objective 3) and at most 100 ms latency (Hypothesis 2). Record the real numbers whatever they are.

Then the user works through section 8.

---

## 7. Open decisions for the user or adviser

1. Browse as a feature (R3): needs adviser sign-off and a manuscript paragraph. If the adviser says no, ship Recommended only and skip the Browse tab.
2. Eyeshadow as documented scope. The manuscript already lists it in Sprint 5 and the walkthrough, but Sec. 3.3-D should say so explicitly.
3. Which catalog is the long-term source of truth: the Excel and Firestore `PH-` catalog (120 products in the manuscript) or the scraper catalog. Ask the teammate who maintains them.
4. Eq. D.2 (see section 8): the formula needs rewording to match the `"color"` blend. Your call with the adviser.
5. The Firestore `lab_L/a/b` gap is separate from this plan, but it can leave Recommended items with placeholder colors, which the service drops.
6. `SEASON_CODE_MAP` in `backend/app/core/color_matching.py` has no entry for four labels the season model outputs, so those users never get a season match. Proposed fix, as a separate change on its own branch after Phase 3, for approval: Warm Autumn to `au-true`, Cool Summer to `su-true`, Cool Winter to `wi-true`, Bright Spring to `sp-bright`, Warm Spring to `sp-true`. Products carry True, not Warm or Cool, in `season_tag_computed` and `season_tags`.

## 8. Manuscript changes (the user makes these; do not edit manuscript files)

Page numbers are the printed numbers in manuscript v7.

Wording that still disagrees with the corrected pseudocode and complexity text:
- p.58: "returns 468 points" -> 478 (468 base mesh points plus 10 iris points).
- p.59: "lips, cheeks, or full face" -> lips, cheeks, or eyeshadow. Replace "a subset of triangles from MediaPipe's canonical face mesh topology ... each triangle ... filled" with the boundary-ring description used in the pseudocode (single smoothed path per region, fill, feather).
- p.66, Eq. D.2 "Region Triangle Fill": the code does not do a per-triangle alpha mix. It fills a smoothed region path with the canvas `"color"` blend (shade hue and saturation, skin brightness) at opacity 0.75, with edge feathering. Reword the name and the definition of the symbols to match. Decide the exact formula with the adviser.
- p.71 to 72 (overall complexity, E): remove "active-region triangles", "triangle buffers", and "canonical mesh topology table". Use landmarks, boundary points, and the region index tables, as in D.
- Sec. 4.1.3 module list, item 5 (AR Visualization): "lips, cheeks, or full face" -> lips, cheeks, or eyeshadow. Full Face is a UI shortcut, not a region.

New content to add:
- Data source paragraph (if Browse ships): Trance, M. (2026). Make-Up Web Scraper: a shade-color and ingredient dataset from four make-up retailers. https://github.com/KMarttt/MakeUp_Scraper. Snapshots: Sephora PH and Rustan's PH 2026-09-23, Maybelline PH 2026-09-29. Say that only the Philippine retailers are used, give the Browse counts per region, and state that Browse shades are not checked by the safety filter.
- How shade color was obtained (swatch image averages, approximation, not calibrated) and that retailer data rights remain with the retailers.
- The performance display: what it shows, the 30-second window, and how latency is measured (detect plus render per frame, frames with no face excluded).
- Blend mode and opacity chosen per region (Phase 4b), if that phase was needed.
- The AR match percentage in the old panel was dummy data and was removed. Do not describe an AR match score in the thesis.
- Catalog size: Firestore has 110 products (20 each in Lip, Cheek, Eye, Face, Concealer, 10 in Multi-Use), but the manuscript says 120.
- Season filtering: `color_matching.py` only sorts Lip, Cheek, and Eye products by season match and never filters. Recommended applies the pseudocode step 5 filter on the frontend, with a fallback to all products that passed the ingredient check when none match.
- Firestore prices are approximate (`≈ ₱799`); Recommended shows the number only.
- Phase 3 Recommended check, lips (2026-11-03, one signed-in test profile): status ok, seasonFilter matched, 5 items shown. Dropped: sub-category 2, placeholder 0, excluded 11. Cheeks and eyeshadow not checked yet.

Results to check before submission:
- Sec. 4.4.5 says "Across the 50 sessions, the average frame rate was 38 FPS and the average rendering latency was 72 ms." No measurement exists behind these numbers yet: the app had no performance display, and the Chapter 5 table marks the same row as pending the survey. Replace with real participant data, or mark as pending, before submission.

## 9. Definition of done

- [ ] Phases 0 to 6 pass their checks and are committed locally on `feature/ar-real-shades`.
- [ ] Phase 2 findings and the adviser's decision on Browse are logged.
- [ ] Phase 7 phone numbers are recorded.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] Section 8 manuscript changes are made by the user.
- [ ] The user has pushed the branch and opened the pull request.
