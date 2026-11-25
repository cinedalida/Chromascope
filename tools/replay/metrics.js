/**
 * Metrics for the AR smoothing experiment. Pre-registered in docs/AR_SMOOTHING_REFACTOR_PLAN.md
 * (Phase 7) and report Sec. 11; do not change them after seeing results.
 *
 * Every function takes one replayed clip in PIXELS:
 *   { t: number[], raw: (Point[] | null)[], smoothed: (Point[] | null)[] }
 * where Point is [x, y] (z is not used), t is milliseconds from the clip start, and a null frame
 * had no face. raw[i] and smoothed[i] are null on the same frames.
 *
 * Shared rules:
 *  - The first WARMUP_MS of every clip are skipped, for every condition.
 *  - A faceless frame breaks the signal: nothing is paired, averaged or interpolated across it.
 *  - Scale (IOD) is the raw pixel distance between landmarks 33 and 263 (outer eye corners).
 */
export const WARMUP_MS = 500;
export const IOD_LANDMARKS = [33, 263];
export const LAG_LANDMARKS = [1, 13, 14, 61, 291]; // nose tip and lips
export const MAX_LAG_MS = 300;
export const TRACK_HALF_WINDOW = 2; // centered moving average of 5 raw frames

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Inter-ocular distance of one raw frame, in pixels. */
export function iod(rawFrame) {
  return dist(rawFrame[IOD_LANDMARKS[0]], rawFrame[IOD_LANDMARKS[1]]);
}

/** Unbroken runs of face frames, as [start, end] index pairs (inclusive). */
export function runsOf(frames) {
  const runs = [];
  let start = -1;
  for (let i = 0; i <= frames.length; i++) {
    const has = i < frames.length && frames[i] !== null;
    if (has && start < 0) start = i;
    if (!has && start >= 0) {
      runs.push([start, i - 1]);
      start = -1;
    }
  }
  return runs;
}

/** Face frames that count: after the warm-up. */
export function countFrames({ t, raw }) {
  let n = 0;
  for (let i = 0; i < t.length; i++) if (raw[i] && t[i] >= WARMUP_MS) n++;
  return n;
}

/**
 * Jitter (still clips): for each pair of consecutive face frames after the warm-up, the mean over all
 * landmarks of the smoothed pixel movement from frame i-1 to i, divided by frame i's raw IOD.
 * Returns the mean over pairs (unitless), or null if there is no pair.
 */
export function jitter({ t, raw, smoothed }) {
  const values = [];
  for (let i = 1; i < t.length; i++) {
    if (t[i - 1] < WARMUP_MS) continue;
    const a = smoothed[i - 1];
    const b = smoothed[i];
    if (!a || !b) continue;
    const scale = iod(raw[i]);
    if (!(scale > 0)) continue;
    let sum = 0;
    for (let l = 0; l < b.length; l++) sum += dist(a[l], b[l]);
    values.push(sum / b.length / scale);
  }
  return mean(values);
}

/**
 * Lag (movement clips): for each of landmarks 1, 13, 14, 61, 291, the shift s in 0..300 ms (1 ms steps)
 * that minimizes the mean squared 2D distance (x and y together) between raw(t_i) and smoothed(t_i + s),
 * the smoothed signal shifted back in time. smoothed(t_i + s) is linearly interpolated on the real
 * timestamps, only inside the same run of face frames. Ties go to the smaller shift. Returns the median
 * best shift over the 5 landmarks, in ms, or null if none could be measured.
 *
 * Measured in 2D per landmark (decision "lag a", before any data): with x and y as separate series, an
 * axis that barely moves (y in a head turn, x while talking) carries only noise, scores 0 ms and pulls
 * the median toward 0. In 2D the moving axis dominates the error, with no threshold to choose.
 */
export function lagMs({ t, raw, smoothed }, { landmarks = LAG_LANDMARKS, maxShiftMs = MAX_LAG_MS } = {}) {
  const runs = runsOf(raw);
  const best = [];
  for (const l of landmarks) {
    let bestShift = null;
    let bestMse = Infinity;
    for (let s = 0; s <= maxShiftMs; s++) {
      let sse = 0;
      let n = 0;
      for (const [a, b] of runs) {
        let j = a;
        for (let i = a; i <= b; i++) {
          if (t[i] < WARMUP_MS) continue;
          const target = t[i] + s;
          if (target > t[b]) break;
          while (j < b && t[j + 1] <= target) j++;
          let vx;
          let vy;
          if (j === b) {
            vx = smoothed[b][l][0];
            vy = smoothed[b][l][1];
          } else {
            const f = (target - t[j]) / (t[j + 1] - t[j]);
            vx = smoothed[j][l][0] + f * (smoothed[j + 1][l][0] - smoothed[j][l][0]);
            vy = smoothed[j][l][1] + f * (smoothed[j + 1][l][1] - smoothed[j][l][1]);
          }
          const dx = raw[i][l][0] - vx;
          const dy = raw[i][l][1] - vy;
          sse += dx * dx + dy * dy;
          n++;
        }
      }
      if (n > 0) {
        const mse = sse / n;
        if (mse < bestMse) {
          bestMse = mse;
          bestShift = s;
        }
      }
    }
    if (bestShift !== null) best.push(bestShift);
  }
  return median(best);
}

/**
 * Tracking error (movement clips): reference = centered moving average of 5 raw frames (zero delay),
 * only where all 5 frames are in the same run of face frames. Mean pixel distance between smoothed and
 * reference over all landmarks, divided by the raw IOD; mean over frames after the warm-up.
 */
export function trackingError({ t, raw, smoothed }) {
  const h = TRACK_HALF_WINDOW;
  const w = 2 * h + 1;
  const values = [];
  for (const [a, b] of runsOf(raw)) {
    for (let i = a + h; i <= b - h; i++) {
      if (t[i] < WARMUP_MS) continue;
      const scale = iod(raw[i]);
      if (!(scale > 0)) continue;
      const n = raw[i].length;
      let sum = 0;
      for (let l = 0; l < n; l++) {
        let rx = 0;
        let ry = 0;
        for (let k = i - h; k <= i + h; k++) {
          rx += raw[k][l][0];
          ry += raw[k][l][1];
        }
        sum += Math.hypot(smoothed[i][l][0] - rx / w, smoothed[i][l][1] - ry / w);
      }
      values.push(sum / n / scale);
    }
  }
  return mean(values);
}
