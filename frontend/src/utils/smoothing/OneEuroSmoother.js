import { lowpass, smoothingAlpha } from "./LowPassFilter.js";

const DIMS = 3; // x, y, z: the same coordinates the EMA smooths
const FALLBACK_DT = 1 / 60; // seconds, used when a time step is zero, negative or not finite

/**
 * One Euro filter (Casiez, Roussel, & Vogel, 2012) applied to every coordinate of every
 * landmark. Per coordinate, on a sample x at time t (seconds):
 *
 *   first sample:  xHat = x, dxHat = 0, return x
 *   dt     = t - tPrev            (1/60 if dt <= 0 or not finite)
 *   dx     = (x - xHatPrev) / dt
 *   dxHat  = lowpass(dx, alpha(dCutoff, dt), dxHatPrev)
 *   cutoff = minCutoff + beta * |dxHat|
 *   xHat   = lowpass(x, alpha(cutoff, dt), xHatPrev)
 *
 * dx uses the previous FILTERED value (xHatPrev), as in the CHI 2012 paper. Some public
 * implementations use the previous raw value instead.
 *
 * Coordinates are normalized (0..1 of the video size), so beta and the derivative are
 * in normalized units per second. The defaults are placeholders until tuning (Phase 7).
 *
 * State lives in Float64Arrays (478 landmarks x 3 = 1,434 filters), so the per-frame
 * loop allocates nothing except the returned points. The output array is new every
 * frame because the renderer and landmarksRef keep references to it.
 *
 * @implements {import("./LandmarkSmoother.js").LandmarkSmoother}
 */
export class OneEuroSmoother {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.type = "oneeuro";
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xHat = null; // filtered values, [x0, y0, z0, x1, y1, z1, ...]
    this.dxHat = null; // filtered derivatives, same layout
    this.count = 0; // landmarks in the stored state
    this.tPrev = 0; // seconds
    this.initialized = false;
  }

  smooth(points, timestampMs) {
    const n = points.length;
    if (this.initialized && n !== this.count) {
      console.warn(`[AR] Landmark count changed from ${this.count} to ${n}; resetting the One Euro smoother.`);
      this.reset();
    }
    if (this.xHat === null || this.xHat.length !== n * DIMS) {
      this.xHat = new Float64Array(n * DIMS);
      this.dxHat = new Float64Array(n * DIMS);
    }

    const t = timestampMs / 1000;
    const out = new Array(n);

    if (!this.initialized) {
      for (let i = 0; i < n; i++) {
        const p = points[i];
        const k = i * DIMS;
        this.xHat[k] = p.x;
        this.xHat[k + 1] = p.y;
        this.xHat[k + 2] = p.z;
        this.dxHat[k] = 0;
        this.dxHat[k + 1] = 0;
        this.dxHat[k + 2] = 0;
        out[i] = { x: p.x, y: p.y, z: p.z };
      }
      this.count = n;
      this.tPrev = t;
      this.initialized = true;
      return out;
    }

    let dt = t - this.tPrev;
    if (!(dt > 0) || !Number.isFinite(dt)) dt = FALLBACK_DT;
    if (Number.isFinite(t)) this.tPrev = t;
    const aD = smoothingAlpha(this.dCutoff, dt);

    for (let i = 0; i < n; i++) {
      const p = points[i];
      const k = i * DIMS;
      out[i] = {
        x: this.#step(k, p.x, dt, aD),
        y: this.#step(k + 1, p.y, dt, aD),
        z: this.#step(k + 2, p.z, dt, aD),
      };
    }
    return out;
  }

  /** Filters one coordinate (state index k) and stores the new state. */
  #step(k, x, dt, aD) {
    const xHatPrev = this.xHat[k];
    const dx = (x - xHatPrev) / dt;
    const dxHat = lowpass(dx, aD, this.dxHat[k]);
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = lowpass(x, smoothingAlpha(cutoff, dt), xHatPrev);
    this.dxHat[k] = dxHat;
    this.xHat[k] = xHat;
    return xHat;
  }

  /** Clears all state, so the next frame passes through unchanged. */
  reset() {
    this.initialized = false;
    this.count = 0;
  }
}
