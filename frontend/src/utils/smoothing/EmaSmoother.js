/**
 * EMA smoother: EMA-Smoothed Mesh Registration Algorithm, Step 2 (manuscript Sec. 3.3-D, Eq. D.1)
 *
 *   L̂_l(t) = α · L_l(t) + (1 − α) · L̂_l(t − 1)
 *
 * where L_l(t) is the raw position of landmark l at frame t and L̂_l(t − 1) is its
 * smoothed position from the previous frame. Applied to x, y and z. Timestamps are
 * not used: every frame gets the same weight however far apart frames are.
 *
 * α (alpha) trades responsiveness against stability: higher = snappier but more
 * jittery, lower = smoother but laggier.
 */

/**
 * One EMA step. A landmark with no previous value (the first frame, or an index the
 * previous frame did not have) passes through unchanged.
 *
 * @param {import("./LandmarkSmoother.js").LandmarkPoint[]} rawLandmarks
 * @param {import("./LandmarkSmoother.js").LandmarkPoint[] | null | undefined} prevSmoothed
 * @param {number} alpha
 */
export function emaStep(rawLandmarks, prevSmoothed, alpha = 0.5) {
  return rawLandmarks.map((point, i) => {
    const prev = prevSmoothed?.[i];

    if (!prev) {
      return { x: point.x, y: point.y, z: point.z };
    }

    return {
      x: alpha * point.x + (1 - alpha) * prev.x,
      y: alpha * point.y + (1 - alpha) * prev.y,
      z: alpha * point.z + (1 - alpha) * prev.z,
    };
  });
}

/** @implements {import("./LandmarkSmoother.js").LandmarkSmoother} */
export class EmaSmoother {
  constructor({ alpha = 0.5 } = {}) {
    this.type = "ema";
    this.alpha = alpha;
    this.prev = null;
  }

  /** The timestamp argument of the interface is ignored by the EMA. */
  smooth(points) {
    this.prev = emaStep(points, this.prev, this.alpha);
    return this.prev;
  }

  reset() {
    this.prev = null;
  }
}
