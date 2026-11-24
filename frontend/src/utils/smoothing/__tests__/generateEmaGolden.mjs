// One-off: writes ema_alpha0.5_golden.json from the ORIGINAL smoothLandmarks.
// Run from frontend/: node src/utils/smoothing/__tests__/generateEmaGolden.mjs
// Do not re-run after the Phase 2 refactor; the file is the record of the old behavior.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GOLDEN_ALPHA, runOriginalEma } from "./emaGolden.js";
import { DEFAULT_SEED, FRAME_COUNT, FRAME_STEP_MS, POINT_COUNT } from "./fixtures.js";

const out = fileURLToPath(new URL("./ema_alpha0.5_golden.json", import.meta.url));
const golden = {
  source: "frontend/src/utils/landmarkSmoothing.js smoothLandmarks (pre-refactor)",
  alpha: GOLDEN_ALPHA,
  seed: DEFAULT_SEED,
  points: POINT_COUNT,
  frames: FRAME_COUNT,
  stepMs: FRAME_STEP_MS,
  output: runOriginalEma(GOLDEN_ALPHA),
};
writeFileSync(out, JSON.stringify(golden));
console.log(`wrote ${out}`);
