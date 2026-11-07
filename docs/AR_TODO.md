# AR Try-On: Remaining Work

Follow-up list for `feature/ar-real-shades`. Details live in [AR_REAL_SHADES_PLAN.md](AR_REAL_SHADES_PLAN.md); this file only tracks what is left.

## 1. Recommended check: cheeks and eyeshadow

Lips was checked on 2026-11-03, before the season map fix (`3d812c2`). Re-check all three.

- [ ] Start the backend and `npm run dev`, sign in, open the app, then run in the browser console:
  ```js
  const r = await import('/src/services/arRecommendedService.js');
  for (const region of ['lips', 'cheeks', 'eyeshadow']) {
    const res = await r.getRecommended(region);
    console.log(region, res.status, res.seasonFilter, res.items.length, res.dropped);
  }
  ```
- [ ] Each region returns `status: "ok"` with items.
- [ ] `dropped.subCategory.total` is exactly lips 2, cheeks 5, eyeshadow 14. If not, the allowlist in `arRecommendedService.js` needs fixing.
- [ ] Record the results in plan section 8, next to the existing lips note.

## 2. Phase 7: phone test over HTTPS

Phones only allow the camera over HTTPS. Pick one:
- ngrok (or similar) tunnel to the dev or preview server.
- Vite HTTPS. May need a new dependency, so approve it first.

Checks (plan Phase 7):
- [ ] Note device model, browser, and the 30-second average FPS and latency from the perf stats badge.
- [ ] Worst case: lips, cheeks, and eyeshadow all on.
- [ ] Browse JSON loads quickly on mobile data (`npm run build`, then `npm run preview`).
- [ ] No uncaught errors in the phone console.
- [ ] Compare with the manuscript targets: at least 30 FPS (Objective 3), at most 100 ms latency (Hypothesis 2). Record the real numbers whatever they are.

Note: the Phase 4b blend change draws the camera frame into the canvas, renders at up to 2x pixel density, and uses two layers per region. Any FPS or latency measured before `de9b82a` is out of date.

## 3. Adviser decisions (plan section 7)

- [ ] Browse as a feature: ship it, or Recommended only.
- [ ] Eq. D.2 wording to match the per-region blend layers.
- [ ] Long-term catalog source of truth: Firestore `PH-` catalog or the scraper catalog.

## 4. Manuscript edits (plan section 8)

- [ ] Wording fixes: p.58, p.59, p.66 (Eq. D.2, use the Phase 4b values), p.71 to 72, Sec. 4.1.3.
- [ ] New content: data source paragraph, shade color method, performance display, blend values, removed AR match score, catalog size, season filtering, approximate prices.
- [ ] Sec. 4.4.5: replace the 38 FPS / 72 ms claim with real participant data, or mark it as pending.

## 5. Wrap-up

- [ ] Push `feature/ar-real-shades` and open the pull request.
- [ ] Tick the plan's section 9 definition of done.

## 6. Future improvements (optional)

- [ ] Tune blends per finish (matte, satin, gloss) with the dev blend tuning panel (Profile, App Settings, "AR blend tuning (dev)").
- [ ] Check `ctx.filter` blur support on iPhone Safari. Feathering may not show there.
- [ ] Code-split the main JS bundle (about 1.09 MB) to clear the Vite chunk size warning.
