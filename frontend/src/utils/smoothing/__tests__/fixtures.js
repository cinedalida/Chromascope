/**
 * Deterministic synthetic landmark stream for smoother tests.
 *
 * 478 points (MediaPipe Face Landmarker: 468 mesh + 10 iris), normalized x, y, z,
 * 120 frames at a fixed 33 ms step. Each frame is a fixed base face moved by a slow
 * sinusoidal head movement plus seeded per-point jitter. No Math.random(): the same
 * seed always gives the same stream, so golden outputs stay valid.
 */
export const POINT_COUNT = 478;
export const FRAME_COUNT = 120;
export const FRAME_STEP_MS = 33;
export const DEFAULT_SEED = 20261124;

// Head movement and jitter sizes, in normalized units.
const SWAY_X = 0.02; // horizontal sway amplitude
const SWAY_Y = 0.01; // vertical sway amplitude
const SWAY_Z = 0.005; // depth sway amplitude
const PERIOD_X_MS = 4000;
const PERIOD_Y_MS = 3000;
const JITTER = 0.002; // per-coordinate jitter, uniform in [-JITTER, JITTER]

/** mulberry32: small seeded PRNG returning floats in [0, 1). */
export function createPrng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the stream as [{ t, points: [{ x, y, z }, ...] }, ...], with t in milliseconds.
 * Fresh objects every call, so a test may not change another test's input.
 */
export function makeLandmarkStream({
  seed = DEFAULT_SEED,
  points = POINT_COUNT,
  frames = FRAME_COUNT,
  stepMs = FRAME_STEP_MS,
} = {}) {
  const rand = createPrng(seed);
  const jitter = () => (rand() * 2 - 1) * JITTER;

  const base = [];
  for (let i = 0; i < points; i++) {
    base.push({ x: 0.3 + rand() * 0.4, y: 0.3 + rand() * 0.4, z: (rand() * 2 - 1) * 0.05 });
  }

  const stream = [];
  for (let f = 0; f < frames; f++) {
    const t = f * stepMs;
    const dx = SWAY_X * Math.sin((2 * Math.PI * t) / PERIOD_X_MS);
    const dy = SWAY_Y * Math.sin((2 * Math.PI * t) / PERIOD_Y_MS);
    const dz = SWAY_Z * Math.sin((2 * Math.PI * t) / PERIOD_X_MS);
    const framePoints = base.map((p) => ({
      x: p.x + dx + jitter(),
      y: p.y + dy + jitter(),
      z: p.z + dz + jitter(),
    }));
    stream.push({ t, points: framePoints });
  }
  return stream;
}
