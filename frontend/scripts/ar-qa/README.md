# AR visual QA

Dev tools for checking that the AR try-on looks right on many faces, alone and stacked. Nothing here touches the real
Firebase project.

## Photos
A folder of 4:5 face photos (the lab page stretches any image to 720x900). Freely licensed portraits from Wikimedia
Commons work well; aim for a spread of skin tones, open and closed mouths, head turns, glasses and facial hair. Keep them
outside the repo.

## Render and measure (no login, no backend)
```
npx vite --mode emulators --port 5180        # any dev server; /dev/ar-lab is dev-only
export AR_QA_URL=http://localhost:5180
export AR_QA_CHROMIUM=<path to chrome.exe>   # only if Playwright's own browser build is not installed

node scripts/ar-qa/run.mjs detect <photos> <out>                        # which photos have a detectable face
node scripts/ar-qa/run.mjs matrix <photos> <out> <label> [list.json]    # render every look (AR_QA_ONLY=fnd_,stack_ to filter)

python scripts/ar-qa/analyze.py <out>/<label> base     # matched / lighter / darker / warm / cool foundation on the skin
python scripts/ar-qa/analyze.py <out>/<label> solo     # each skin product: visible, not overdone, even across skin tones
python scripts/ar-qa/analyze.py <out>/<label> stack    # matched and mismatched stacks, no mask, no cast
python scripts/ar-qa/analyze.py <out>/<label> mouth    # lips change, teeth and the skin around the mouth do not
python scripts/ar-qa/analyze.py <out>/<label> finish   # shimmer brighter than matte; matte = default look

python scripts/ar-qa/grid.py <out>/<label> grid.png <photo,photo> <look,look>   # face-cropped comparison grid
python scripts/ar-qa/sheet.py <out>/<label> <photo> <look> [<look> ...]          # contact sheet for one photo
node scripts/ar-qa/stability.mjs <photos> <list.json>                           # skin sampler spread over repeated renders
node scripts/ar-qa/perf.mjs <photo> <url1> <url2>                                # per-frame cost, original vs new code
```
Do not edit files under `src/` while a run is in progress: Vite reloads the page and the run fails.

## Whole app, on the local emulators (needs Java and a working `firebase` CLI)
`e2e.mjs` signs one throwaway account up through the real UI, edits its season and skin tone in the Firestore emulator
between scenarios, and uses a Y4M face video as the webcam so the real camera path tracks a face. It reads the product
order the panel shows and applies the top product of every group. See the header of the script for the setup: emulators,
a backend in emulator mode with the catalog imported (on a spare port if 8000 is taken), and the app with `VITE_API_URL`
pointing at that backend.

## Season scores for Browse
`backend/scripts/add_shade_season_scores.py` writes `ss` (12 season scores) on the lips, lip liner, blush and eyeshadow
shades in `public/data/ar-shades-*.json`. Re-run it after rebuilding the catalogs or changing the season classifier;
`backend/tests/test_shade_season_scores.py` fails when the files are out of date.
