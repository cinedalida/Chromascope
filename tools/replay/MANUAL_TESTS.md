# Manual system tests: TC-S1 to TC-S4

Run by the researchers on real devices (report Sec. 12). Run them **after tuning**, so TC-S2 uses the
final One Euro settings (the tuned values set as the defaults in `frontend/src/utils/smoothing/smootherConfig.js`).
Fill in every blank from what you actually saw. Write "not run" for anything you did not run. A failed
test stays failed; note any rerun in the report's deviation log.

## Setup

- **Deployed app:** the Vercel preview of branch `se2/ar-smoothing` (after it is pushed), or the
  production URL once merged. Write the URL here: `______________________`
- **Devices:** the same devices used for the recordings. Write the models below.
- Sign in, open the try-on (`/ar-tryon`), select a lip shade, start the camera.
- Turn on the performance readout (the pulse icon, top right). It must show the `Smoother:` line.
- The 30 s average starts at the first frame with a face and then stays fixed. Keep your face in view for
  the whole 30 s.

## TC-S1: EMA keeps 30 FPS or more

1. Open `/ar-tryon` with **no** URL settings. The readout says `Smoother: EMA α 0.5`.
2. Wait for the green `30 s avg` line. Screenshot the whole readout.
3. Pass if the 30 s average FPS is 30 or more.

| Device | 30 s avg FPS | Median FPS | Latency ms | Smoothing ms (p95) | Pass/Fail | Screenshot file |
|---|---|---|---|---|---|---|
| | | | | | | |
| | | | | | | |

## TC-S2: One Euro keeps 30 FPS or more

1. Open `/ar-tryon?smoother=oneeuro`. The readout shows `Smoother: One Euro` with the tuned values.
2. Wait for the `30 s avg` line. Screenshot it.
3. Pass if the 30 s average FPS is 30 or more. Also note the smoothing time against NFR1 (2 ms or less).

| Device | 30 s avg FPS | Median FPS | Latency ms | Smoothing ms (p95) | NFR1 (≤ 2 ms) | Pass/Fail | Screenshot file |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| | | | | | | | |

## TC-S3: no slide-in after the face leaves and comes back

Do this in both modes (no URL settings, then `?smoother=oneeuro`).

1. With a shade on, move your face fully out of the camera view for about 2 s.
2. Move back into view at a different spot in the frame.
3. Pass if the makeup appears directly on your face. Fail if it glides in from where the face was before.

| Device | EMA: Pass/Fail | One Euro: Pass/Fail | Notes |
|---|---|---|---|
| | | | |
| | | | |

## TC-S4: the recorder is not in the production build

1. On the deployed app, open the try-on and start the camera.
2. Pass if there is no **Record landmarks (dev)** button anywhere on the page, and `/dev/ar-page` does
   not open the try-on.
3. Automated cross-check (run by Francine on the PC):
   `cd frontend && npm run build`, then search `dist/assets/` for `Record landmarks` and
   `createLandmarkRecorder`. Pass if there are 0 matches.

| Check | Result | Pass/Fail |
|---|---|---|
| No recorder button on the deployed try-on | | |
| `/dev/ar-page` not available on the deployed app | | |
| Build search: 0 matches | | |

## Sign-off

| Researcher | Date | Tests run |
|---|---|---|
| | | |
