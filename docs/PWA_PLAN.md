# PWA Plan: make Chromascope an installable, offline-aware PWA

Agent-facing execution plan (v1, written 2026-11-07). Branch: `feature/pwa`, created from `main`.
The repo copy of this file is the source of truth. Any copy in the Claude project can be stale.

---

## 0. How to work with this plan

### Default mode: one phase at a time

This is `CLAUDE.md` section 1 applied to every phase.

1. Wait for the user to say which phase to start (for example "start Phase 1"). Never start the next phase on your own.
2. Read every file listed under "Read first" for that phase, plus anything else relevant. Edit nothing yet.
3. Reply with a change plan: files reviewed, each file to change and what changes, new or deleted files, risks and open questions.
4. Wait for an explicit go-ahead ("go", "proceed", "approved").
5. Implement only the approved plan. If you find something else that needs changing, stop and report it.
6. Run the automated checks for the phase and report them as a table: check, command, result, pass or fail.
7. Summarize what changed, file by file. List the human checks the user has to do (phone, camera, accounts). Then stop and wait for the results.
8. Only after the user confirms the human checks: show the staged files and the proposed commit message, wait for confirmation, then commit. Never push.

### Loop mode (optional)

`CLAUDE.md` section 5 can run these phases without approval between phases, but only if the user writes "start loop" and names this plan and the branch `feature/pwa`. Section 5 was written for the AR plan, so the user's message must say that this plan and this branch replace the AR plan and `feature/ar-real-shades` for that run. If the message does not say so, stop at the branch check and ask.

Planned stops in loop mode, on top of the stops in `CLAUDE.md` section 5.6:

- Start of Phase 1. A dependency has to be installed, and loop mode never installs without asking.
- Phase 6. It needs a push and a Vercel preview that only the user can do, and an edit to `.github/` that needs approval.
- Phase 7. It needs real phones.

### Hard rules

- Never run `git push`. The user pushes.
- Ask before pulling. If a pull conflicts, do not resolve it. List the conflicts and wait.
- Stage specific files with `git add <file>`. Never `git add .` or `git add -A`. Never stage `.vscode/`, `.claude/`, `.loop/`, `.env*`, `.venv/`, `node_modules/`, service account files, `frontend/dist/`, `frontend/test-results/`, or `frontend/playwright-report/`.
- Conventional Commits, imperative lowercase summary, max about 72 characters. One logical change per commit. Suggested messages are given per phase.
- No Claude or AI attribution anywhere: not in commits, not in code comments, not in docs.
- No em dashes in code comments, docs, or UI text. Keep comments short and plain.
- Never invent data or results. A check that was not run is written as "not run".
- Do not touch: anything under `backend/`, `frontend/src/firebase.js`, `frontend/src/config.js`, `frontend/public/icons/`, Firestore data, `serviceAccountKey.*`.
- Dependencies: the only package this plan adds is `vite-plugin-pwa`, and only after the user approves the exact version in Phase 1. Anything else needs a new approval.
- CI runs `npm ci`, `npm run lint`, and `npm run build` from `frontend/`. `package-lock.json` must stay in sync with `package.json`. Lint and build must pass and never end worse than the Phase 0 baseline.
- The user is on Windows. Prefer commands that work in any shell, such as `node -e` or `python -c`, over shell-specific syntax.
- Plugin options and hosting syntax must come from the installed package's own docs and type files, or from the official docs, read at implementation time. `vite-plugin-pwa` 2.0.0 is a recent major release (published 2026-10-03) and its changes from 1.x were not checked when this plan was written. Do not rely on memory of older versions.

### Progress tracker

Update this table only as part of an approved change plan, after the user says a phase passed.

| Phase                                    | Status |
| ---------------------------------------- | ------ |
| 0 Branch and baseline                    | [ ]    |
| 1 Service worker: precache the app shell | [ ]    |
| 2 Runtime caching and the privacy guard  | [ ]    |
| 3 Update prompt                          | [ ]    |
| 4 Offline awareness                      | [ ]    |
| 5 Install button and standalone polish   | [ ]    |
| 6 Hosting config and optional CI job     | [ ]    |
| 7 Device test and manuscript notes       | [ ]    |

---

## 1. Goal and scope

Goal: the installed Chromascope app opens fast, survives a bad connection, updates safely, and tells the user plainly what needs internet.

In scope:

- **Installable.** Mostly done already (section 3). Add the install button and iOS instructions.
- **Reliable.** A service worker that caches the app shell and the AR try-on runtime, so the AR page can start offline after one online visit.
- **Updatable.** A prompt when a new version is ready. Never an automatic reload.
- **Honest offline behavior.** A banner and clear messages for features that need the backend.
- **Standalone polish.** Safe-area padding and back navigation for an app with no browser bar.

Out of scope (do not start these):

- Push notifications, background sync, queued offline writes, Firestore offline persistence.
- Image compression, code splitting, or any other bundle-size work. Section 3 shows the need. It belongs on a separate branch.
- Any backend change. Any change to sign-in logic (see open decision 5).
- App store packaging.

---

## 2. Rules for the service worker (P1 to P8)

These tie every phase to the privacy claims in the manuscript and the consent forms.

- **P1. Static assets only.** Caches hold app code, icons, fonts, the AR runtime and model, and the Browse shade JSON. Never API responses, user data, photos, camera frames, canvas data, tokens, or anything fetched with an `Authorization` header.
- **P2. Allowlist, no catch-all.** Only routes written down in Phase 2 are cached. Everything else goes to the network untouched, including the backend origin, Firebase, and Google sign-in.
- **P3. No silent reloads.** A new version waits until the user taps Reload. The user may be in the middle of a camera session.
- **P4. Dev and emulator modes unchanged.** No service worker in `npm run dev` or `npm run dev:emulators`, so the existing Playwright suites behave as before.
- **P5. Online behavior unchanged.** With a network, every page works exactly as on `main`.
- **P6. Keep the app identity.** Do not change `id`, `scope`, or `start_url` in the manifest. Changing `id` makes the browser treat it as a different app.
- **P7. Precache budget.** The precache holds the app shell only. Report its size after every build. Stop if it passes 3 MB or if it contains any `.jpg`.
- **P8. Verify, do not assume.** Every claim in a report comes from a command that ran.

---

## 3. What exists today (verified in the repo on 2026-11-07)

- `frontend/public/manifest.webmanifest`: name, short_name, `id` "/", `start_url` "/", `scope` "/", `display` "standalone", `orientation` "portrait", theme `#6d4ec6`, and icons 192, 512, and maskable 512. On `main`.
- `frontend/public/icons/`: `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
- `frontend/index.html`: manifest link, `theme-color`, Apple meta tags. The viewport meta has no `viewport-fit=cover`.
- `frontend/tests/pwa.spec.js` (needs the Firebase emulators): checks the manifest, the icon sizes, and that Chromium reports no installability errors.
- No service worker, no `vite-plugin-pwa`, no offline handling (`navigator.onLine` is not used anywhere in `frontend/src`), no `safe-area` CSS, no `vercel.json`, no lazy loading.
- Build output (from the existing `frontend/dist/`): one JavaScript file of 1,094,423 bytes, one CSS file of 131,474 bytes, and five splash JPGs of about 3.4 to 3.6 MB each (about 17.7 MB in total). The splash JPGs are imported by `SplashPage.jsx` and `AuthPage.jsx`.
- `frontend/public/product-images/`: 108 files, 7.2 MB. `frontend/public/data/`: three Browse JSON files, about 0.9 MB.
- AR runtime is loaded from the network at run time in `AROverlayCanvas.jsx`: the MediaPipe wasm from `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm`, and the face model from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`. The same two URLs exist on `main`.
- Fonts are `@import`ed from `fonts.googleapis.com` in `frontend/src/styles/variables.css`.
- Backend base URL comes from `VITE_API_URL` in `frontend/src/config.js`. In production it is a different origin (the file's comment says Cloud Run). `App.jsx` sends `POST /user/active` with the Firebase ID token on every sign-in.
- Router: `BrowserRouter` in `frontend/src/routes/AppRouter.jsx`. Sign-in is `signInWithPopup` in `AuthPage.jsx`, with `authDomain` `chromascope-new.firebaseapp.com`.
- CI (`.github/workflows/ci.yml`): gitleaks, then frontend `npm ci`, `npm run lint`, `npm run build` on Node 22.
- `vite-plugin-pwa` 2.0.0: peer range includes Vite 8 (the repo uses `^8.0.10`), requires Node 20.19 or newer, depends on `workbox-build` and `workbox-window` 7.4.1, MIT license.
- `main` contains the AR branch since PR #6 (`05dbac2`, merged 2026-11-08). Four later AR commits (`be0f5d7`, `def1d30`, `7acb6e5`, `5485505`) were not in that merge and need a follow-up PR. This plan does not need them, and nothing here edits the AR files.

## 3a. Not verified when this plan was written

Treat each of these as unknown until a phase proves it.

- Whether `cdn.jsdelivr.net` and `storage.googleapis.com` answer with CORS headers for these URLs. This decides if the AR runtime can be cached (Phase 2 tests it).
- The Vercel project settings: root directory, whether SPA rewrites exist, and the headers served for `sw.js` and the manifest. No `vercel.json` is in the repo, and the Vercel connector showed no projects for this account.
- Whether Google sign-in with a popup works inside an iOS home-screen app.
- What the signed-in app shows when the profile read in `App.jsx` fails offline.
- Whether the manuscript says anything about PWA or offline use. A search of manuscript v7 for "PWA", "offline", "service worker", and "home screen" found no matches.

---

## 4. Locked decisions

Defaults chosen so the work can start. The user can change any of them before the phase that uses it.

1. Plugin: `vite-plugin-pwa` 2.0.0 with the `generateSW` strategy. No hand-written service worker.
2. `registerType` is `"prompt"`. The plugin does not generate the manifest (`manifest: false`). The static `manifest.webmanifest` stays the single source.
3. The service worker is off in dev (`devOptions.enabled` stays false).
4. Offline scope: the app shell, the AR try-on page with the Browse source, the public pages (privacy, terms, user manual), and the sign-in page. Features that call the backend show a clear "needs internet" message instead of failing.
5. New code lives in `frontend/src/hooks/`, `frontend/src/components/common/`, and `frontend/tests-pwa/`.
6. Tests use the existing Playwright install, against a production build served by `vite preview`. No new test dependency.

---

## 5. File map

New:

- `frontend/playwright.pwa.config.js`
- `frontend/tests-pwa/` (spec files added phase by phase)
- `frontend/src/hooks/usePwaUpdate.js`
- `frontend/src/hooks/useOnlineStatus.js`
- `frontend/src/hooks/useInstallPrompt.js`
- `frontend/src/components/common/PwaUpdatePrompt.jsx`
- `frontend/src/components/common/OfflineBanner.jsx`
- `frontend/src/components/common/InstallAppButton.jsx`
- `frontend/vercel.json` (Phase 6, only if open decision 1 says it is needed there)

Modified:

- `frontend/package.json` and `frontend/package-lock.json` (Phase 1, `vite-plugin-pwa` and a `test:pwa` script)
- `frontend/vite.config.js`
- `frontend/src/main.jsx` (Phase 1 only, registers the worker)
- `frontend/src/App.jsx` (mounts the update prompt and the offline banner)
- `frontend/index.html` (`viewport-fit=cover`)
- `frontend/public/manifest.webmanifest` (adds `lang` and `shortcuts` only)
- `frontend/src/layouts/MainLayout.jsx`, `frontend/src/components/navigation/Sidebar.jsx`, `frontend/src/styles/globals.css`, `frontend/src/styles/variables.css` (safe-area, Phase 5)
- Up to 6 page files for offline messages and back controls. The exact list is set in the Phase 4 and Phase 5 change plans. Candidates: `ColorAnalysisPage.jsx`, `ColorAnalysisProcessingPage.jsx`, `ProductCatalogPage.jsx`, `IngredientFilterPage.jsx`, `ARTryOnPage.jsx`, `ProfilePage.jsx`.
- `.github/workflows/ci.yml` (Phase 6, optional, needs approval)

Do not modify: `frontend/src/firebase.js`, `frontend/src/config.js`, `frontend/public/icons/*`, `frontend/src/components/ar-tryon/*`, `frontend/src/services/*`, `frontend/tests/*`, `frontend/tests-emulator/*`, anything under `backend/`.

---

## 6. Phases

### Phase 0: Branch and baseline

Goal: a clean branch from `main` and a recorded baseline to compare against.

Read first: `CLAUDE.md`, this plan, `.github/workflows/ci.yml`, `frontend/package.json`.

Steps:

1. `git status --short` must show no modified or staged tracked files. Untracked files such as `.claude/`, `.vscode/`, and the user's own notes in `docs/` are left alone: list them and never stage them. If any tracked file is modified or staged, list it and stop.
2. Ask the user whether to pull `main`. Then `git switch -c feature/pwa main`. The untracked `docs/PWA_PLAN.md` carries over.
3. Record the baseline: `node -v` (must be 20.19 or newer), `npm ci` result, `npm run lint` error and warning counts, `npm run build` exit code, size of every file in `frontend/dist/assets/`, and `npm audit` summary counts (report only).
4. Try the existing e2e: `npm run test:e2e -- --project=android pwa.spec.js` from `frontend/`. It needs Java for the Firebase emulators. If it cannot run, record the exact reason. Do not install anything to make it run.

Checks:

- [ ] `git branch --show-current` prints `feature/pwa`.
- [ ] Baseline recorded: Node version, lint counts, build result, per-file sizes, audit counts, e2e result or reason.
- [ ] `frontend/public/manifest.webmanifest`, `frontend/tests/pwa.spec.js`, and the four icon files exist on the branch.
- [ ] `grep -n "jsdelivr\|googleapis" frontend/src/components/ar-tryon/AROverlayCanvas.jsx` shows the two runtime URLs from section 3.

Suggested commit: `docs: add PWA plan` (this file only).

### Phase 1: Service worker, precache the app shell

Goal: a registered service worker that precaches only the app shell and serves the app offline. Nothing else changes.

Read first: `frontend/vite.config.js`, `frontend/src/main.jsx`, `frontend/index.html`, `frontend/playwright.config.js`, and the installed `node_modules/vite-plugin-pwa` README and type definitions after install.

Approval gate: ask the user to approve `npm install -D vite-plugin-pwa@2.0.0` from `frontend/`. After install, run `npm ls vite-plugin-pwa workbox-build workbox-window` and report what resolved. Do not add other packages unless the build cannot resolve one, and then ask first.

Slices (check each before the next):

1. **Plugin config.** In `vite.config.js` add `VitePWA` with: `registerType: "prompt"`, `manifest: false`, no dev worker, `navigateFallback` to `index.html`, a navigation denylist for `/api/` and any path with a file extension, `cleanupOutdatedCaches` on, and precache patterns that exclude `**/splash-animation-*.jpg`, `product-images/**`, and `data/**`. Confirm every option name against the installed type definitions first.
2. **Register.** In `main.jsx`, import `registerSW` from `virtual:pwa-register` and call it with no automatic reload. Phase 3 replaces this with a hook.
3. **Test setup.** Add `frontend/playwright.pwa.config.js` (testDir `./tests-pwa`, web server `npm run build` then `npm run preview -- --port 4173 --strictPort`, service workers allowed, no Firebase emulators) and the script `"test:pwa": "playwright test -c playwright.pwa.config.js"`.
4. **Shell tests** in `frontend/tests-pwa/sw-shell.spec.js`.

Checks:

- [ ] `npm run lint` and `npm run build` pass, no worse than baseline. The build prints a precache list. Report the entry count and total size.
- [ ] The precache has no `.jpg` and no `product-images/` or `data/` entry, and its total is under the P7 budget of 3 MB.
- [ ] `npm ci --dry-run` succeeds, so the lock file is in sync.
- [ ] `npm run test:pwa`: the worker registers and activates, controls the page after a reload, and the precache contains `index.html`, the main JS and CSS, and the manifest.
- [ ] Offline test: after the first load, `context.setOffline(true)`, then reloading `/` and a public deep link such as `/privacy` still render the app (not the browser's offline page).
- [ ] Dev test: against `npm run dev`, `navigator.serviceWorker.getRegistrations()` is empty.
- [ ] `git diff --stat` shows only files from the file map.
- [ ] `npm audit` counts are reported against the baseline. Any new high or critical item is reported to the user.

Human checks: none. Everything here is automated.

Suggested commits: `chore(frontend): add vite-plugin-pwa`, `feat(frontend): precache the app shell with a service worker`, `test(frontend): add PWA preview e2e config and shell tests`.

### Phase 2: Runtime caching and the privacy guard

Goal: the AR runtime, fonts, and Browse shades work offline after one online visit, and nothing private is ever cached.

Read first: `frontend/vite.config.js`, `frontend/src/components/ar-tryon/AROverlayCanvas.jsx` (the loader only), `frontend/src/services/arShadeService.js`, `frontend/src/styles/variables.css`.

The allowlist (P2). Only these routes are cached:

| Route                                                               | Strategy             | Cache name           | Notes                                                      |
| ------------------------------------------------------------------- | -------------------- | -------------------- | ---------------------------------------------------------- |
| `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm/*` | CacheFirst           | `mediapipe-runtime`  | Version is pinned in the URL. Accept status 200 only.      |
| `https://storage.googleapis.com/mediapipe-models/face_landmarker/*` | CacheFirst           | `mediapipe-model`    | Status 200 only.                                           |
| same origin `/data/ar-shades-*.json`                                | StaleWhileRevalidate | `ar-shades`          | The files are not hashed.                                  |
| same origin `/assets/splash-animation-*.jpg`                        | CacheFirst           | `splash-images`      | Hashed names, so safe. Max 6 entries. See open decision 2. |
| same origin `/assets/*.{png,jpg}` (after the splash route)          | CacheFirst           | `page-images`        | Page photos bundled since `8f27d4c`. Kept out of the precache (P7, option A, 2026-11-08). Max 20 entries. |
| `https://fonts.googleapis.com/*`                                    | StaleWhileRevalidate | `google-fonts-css`   |                                                            |
| `https://fonts.gstatic.com/*`                                       | CacheFirst           | `google-fonts-files` | Status 200 only.                                           |

Not cached on purpose: the backend origin (all of it), `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `*.firebaseapp.com`, `accounts.google.com`, the backend's `/catalog-images/*` (these are image tags, so the responses would be opaque), and anything else not in the table.

Slices:

1. The two MediaPipe routes and their test.
2. The Browse JSON route and its test.
3. Fonts and splash images.
4. The privacy guard test.

Checks:

- [ ] **CORS check (resolves an unknown from section 3a).** In the browser, `fetch` each MediaPipe URL with `mode: "cors"`. It must return `ok` and `type === "cors"`. If either fails, stop and report. The fallback is to host the files under `frontend/public/` (open decision 6, needs approval).
- [ ] Prime-then-offline test: fetch each cached URL once online through the page, go offline, fetch again, and get status 200 from the cache.
- [ ] Privacy guard test: after visiting `/`, `/auth`, `/privacy`, and `/terms`, list every request URL in every cache. Each one must match the allowlist table or the precache. None may contain `/api/`, the backend origin, `firestore.googleapis.com`, `identitytoolkit`, `securetoken`, `blob:`, or `data:`.
- [ ] A request that carries an `Authorization` header (simulated with a route mock) is never stored.
- [ ] Cache names match the table and total entries stay under the limits set in the config.
- [ ] Lint, build, precache budget, `npm ci --dry-run`, and all Phase 1 tests still pass.

Human check (can wait for Phase 7): the signed-in AR page starts offline after one online visit.

Suggested commits: `feat(frontend): cache the AR runtime and fonts for offline use`, `test(frontend): add runtime cache and privacy guard tests`.

### Phase 3: Update prompt

Goal: when a new version is ready, the user sees a small prompt and chooses when to reload.

Read first: `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/styles/variables.css`, one existing component in `frontend/src/components/common/` for style.

Slices:

1. `usePwaUpdate.js`: wraps `registerSW` and exposes `needRefresh`, `updateNow`, and `dismiss`. State is set only inside callbacks, never synchronously at the start of an effect (react-hooks rule 7 fails the CI lint).
2. `PwaUpdatePrompt.jsx`: a fixed bottom card, "A new version is ready." with Reload and Later. Use the design tokens in `variables.css`, no hardcoded hex.
3. Mount it in `App.jsx` and remove the Phase 1 registration from `main.jsx`.

Checks:

- [ ] Lint and build pass. All earlier tests pass.
- [ ] `grep -rn "registerSW" frontend/src` shows one call site only.
- [ ] No code reloads the page without a user tap (grep for `location.reload` and `updateServiceWorker`; each hit is explained in the report).
- [ ] If an automated update test is possible without new dependencies (two builds served in turn by a small script in `tests-pwa/`), add it. If not, say so and rely on the human check.

Human check (update flow): run `npm run build` then `npm run preview`, open the app, change a visible string, rebuild, wait for the preview server to serve the new build, and reload. The prompt appears. Tapping Later keeps the old version. Tapping Reload loads the new one.

Suggested commit: `feat(frontend): prompt the user when a new app version is ready`.

### Phase 4: Offline awareness

Goal: the user always knows when the device is offline and which features need internet.

Read first: `frontend/src/App.jsx` (the profile sync), `ColorAnalysisPage.jsx`, `ColorAnalysisProcessingPage.jsx`, `ProductCatalogPage.jsx`, `IngredientFilterPage.jsx`, `ARTryOnPage.jsx`, `frontend/src/services/arRecommendedService.js` (read only).

Slices:

1. `useOnlineStatus.js` using `useSyncExternalStore` on the `online` and `offline` events.
2. `OfflineBanner.jsx`: a thin bar, "You are offline. Some features need internet." Mounted in `App.jsx`.
3. Feature messages, one page per slice. Before each edit, write down what the page does today when the request fails offline. Show the message before the user uploads or taps, where possible. Do not change service files.
4. Report what the signed-in app shows offline when the profile read in `App.jsx` fails. Fix only if it is a small change inside the approved plan, otherwise report it.

Checks:

- [ ] Lint, build, and all earlier tests pass.
- [ ] Playwright: on `/auth` the banner appears after `setOffline(true)` and disappears after `setOffline(false)`.
- [ ] With a network, no page shows the banner or any new message (P5).
- [ ] No new `fetch` calls were added (grep the diff).
- [ ] The list of files changed is at most 6 pages plus the new files.

Human check: signed in, turn on airplane mode, and open Color analysis, Catalog, Ingredient filter, and AR try-on. Each shows a clear message or works from cache (AR with Browse). Record what you see, including anything confusing.

Suggested commits: `feat(frontend): show an offline banner`, `feat(frontend): explain which features need internet`.

### Phase 5: Install button and standalone polish

Goal: users can install from inside the app, and the installed app has no dead ends.

Read first: `frontend/index.html`, `frontend/public/manifest.webmanifest`, `frontend/src/layouts/MainLayout.jsx`, `frontend/src/components/navigation/Sidebar.jsx`, `frontend/src/pages/ProfilePage.jsx`, `frontend/tests/mobile-layout.spec.js`.

Slices:

1. `useInstallPrompt.js`: captures `beforeinstallprompt` and `appinstalled`, and reports `isStandalone` (display-mode media query, plus `navigator.standalone` for iOS).
2. `InstallAppButton.jsx`: shown only when not standalone. Chromium: calls the saved prompt. iOS Safari: shows the steps "Share, then Add to Home Screen". Place it on the Profile page (open decision 4).
3. Manifest: add `lang` and `shortcuts` (AR try-on at `/ar-tryon`, Color analysis at `/color-analysis`) with the existing 192 icon. Do not touch `id`, `scope`, `start_url`, or the icons. Confirm the shortcut member names against the web manifest spec or MDN before writing.
4. Safe area: add `viewport-fit=cover` to the viewport meta, and use `env(safe-area-inset-*)` where fixed bars meet the screen edges.
5. Back navigation audit: list every page a user can reach that has no in-app way back (an installed iOS app has no browser back button). Report first. If more than 3 pages need a control, stop and ask. Otherwise add a back control per page, one slice each.

Checks:

- [ ] Lint, build, and all earlier tests pass. `frontend/tests/pwa.spec.js` still passes if the emulators can run (Phase 0 result).
- [ ] Playwright: a synthetic `beforeinstallprompt` event makes the button appear, and clicking it calls `prompt()`. With an iPhone user agent and `navigator.standalone` false, the instructions appear. With `display-mode: standalone` emulated, the button is hidden.
- [ ] The manifest parses as JSON, `id`, `scope`, `start_url`, and the three icons are byte for byte unchanged except for the additions (diff reported).
- [ ] `grep -rn "safe-area" frontend/src frontend/index.html` shows the insets in the files listed in the file map.
- [ ] `frontend/tests/mobile-layout.spec.js` still passes if it can run, otherwise "not run" with the reason.

Human check (needs an iPhone): the top and bottom bars are not hidden behind the notch or the home bar. Every page can be left without the browser back button.

Suggested commits: `feat(frontend): add an install button with iOS instructions`, `feat(frontend): add manifest shortcuts and language`, `style(ui): respect safe-area insets in the installed app`.

### Phase 6: Hosting config and optional CI job

Goal: the host serves the worker and the manifest correctly, and CI guards the PWA tests.

Read first: open decision 1 (the user answers it), the official Vercel docs for rewrites and headers, `.github/workflows/ci.yml`.

Slices:

1. `frontend/vercel.json` (only if open decision 1 says the project root is `frontend`, or at the repo root if it says so): SPA rewrite for non-file paths to `/index.html`, `Cache-Control: no-cache` for `/sw.js`, and a manifest content type if the host does not already send one. Take the exact syntax from the Vercel docs. Do not guess it.
2. Optional, needs approval: a `pwa` job in `.github/workflows/ci.yml` that installs Chromium and runs `npm run test:pwa`. Commit it separately as `ci:`.

Checks:

- [ ] `vercel.json` parses as JSON and `npm run build` still passes.
- [ ] The CI job, if added, uses the same Node version and `npm ci` as the existing job.
- [ ] The user pushes `feature/pwa` and opens the Vercel preview. Then, with the preview URL: a deep link such as `/privacy` returns 200 on a hard refresh, `/sw.js` has `Cache-Control` containing `no-cache` or `max-age=0` with `must-revalidate`, and `/manifest.webmanifest` returns a JSON content type. Record the real headers in the report.
- [ ] CI on the pull request is green, including the new job if added.

Suggested commits: `chore(config): add vercel rewrites and service worker headers`, `ci: run PWA e2e tests`.

### Phase 7: Device test and manuscript notes

Goal: prove it on real phones and write down what happened.

Needs the Vercel preview or production URL over HTTPS. All of this is done by the user. Claude only prepares the record sheet.

Checks, per device (record model, OS version, browser version):

- [ ] **Android Chrome:** installs from the in-app button, opens in its own window, and the home-screen icon is correct (maskable).
- [ ] **iPhone Safari:** Add to Home Screen from the instructions, opens without the browser bar.
- [ ] Camera works in the installed app for AR try-on and for color analysis.
- [ ] **Google sign-in works in the installed app.** On iPhone this is the known risk (open decision 5). If it fails, report it and stop. Do not change sign-in code without approval.
- [ ] After one online visit to the AR page, airplane mode: the AR page starts and the Browse tab works. Recommended says it needs internet.
- [ ] Airplane mode: Color analysis, Catalog, and Ingredient filter show the offline message.
- [ ] Redeploy a new version. The installed app shows the update prompt, and Reload loads it.
- [ ] Optional: record the 30 second AR average FPS and latency from the on-screen display, installed app versus browser tab, as extra data. Do not claim an improvement unless the numbers show it.

Manuscript and ethics notes: see section 8.

Suggested commit: `docs: record PWA device test results` (a short results table appended to this plan).

---

## 7. Open decisions for the user or adviser

1. **Vercel setup.** What is the project's Root Directory (`frontend` or the repo root), and do SPA rewrites already exist in the dashboard settings? Phase 6 depends on this. If it is not known, test a deep link on the live site first.
2. **Cache the splash JPGs at run time?** Default yes, six entries, about 17.7 MB on the device. The better fix is to compress them, on a separate branch.
3. **Offline scope.** The default is in section 4, item 4. Say so if you want more or less.
4. **Where the install button lives.** Default: the Profile page only.
5. **Google sign-in in an iOS home-screen app.** If the popup fails there, the fix (a redirect flow, and possibly a custom auth domain) changes sign-in code and needs its own plan and approval.
6. **If a MediaPipe CDN does not allow CORS.** Fallback: host the wasm files and the model under `frontend/public/`. That adds several MB to the repo and the deploy, so it needs approval.
7. **A CI job for PWA tests.** It adds a few minutes to every pull request. Default: add it.
8. **Adviser.** Does the manuscript scope cover a PWA? Manuscript v7 has no mention of one (section 3a).

---

## 8. Manuscript and ethics notes (the user makes these; do not edit manuscript files)

- Add the PWA only if the adviser agrees it is in scope. Possible places: the system description (installable, works from the home screen), the limitations (offline use is partial), and the tools list (service worker through `vite-plugin-pwa`).
- Privacy statement that the work supports, backed by the Phase 2 privacy guard test: the service worker stores only app code, icons, fonts, the AR runtime and model, and the Browse shade list. It never stores photos, camera frames, analysis results, or API responses.
- Consent forms and the DERC checklist are not expected to change because no new data is collected. That is a judgment for the adviser. Do not assume it.
- Report device tests (Phase 7) with the device, OS, browser, and what was tested. Report only what was measured.

---

## 9. Definition of done

- [ ] Phases 0 to 6 pass their checks and are committed locally on `feature/pwa`.
- [ ] Phase 7 device results are recorded in this file, including any failure.
- [ ] `npm run lint`, `npm run build`, and `npm run test:pwa` pass, and `npm ci` works from a clean checkout.
- [ ] The precache stays under 3 MB and has no JPG.
- [ ] The privacy guard test passes.
- [ ] Open decisions 1, 5, and 8 are answered.
- [ ] The user has pushed the branch, the Vercel preview checks passed, and CI is green on the pull request.
