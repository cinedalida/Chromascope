/**
 * landmarkSmoothing — EMA-Smoothed Mesh Registration Algorithm, Step 2 (Eq. D.1)
 *
 * Exponential moving average over MediaPipe's per-frame landmark output.
 * Reduces frame-to-frame jitter from raw predictions without introducing
 * perceptible lag, per the manuscript (Sec. 3.3-D, Eq. D.1):
 *
 *   L̂_l(t) = α · L_l(t) + (1 − α) · L̂_l(t − 1)
 *
 * where L_l(t) is the raw predicted position of landmark l at frame t, and
 * L̂_l(t − 1) is the smoothed position from the previous frame.
 *
 * α (alpha) trades responsiveness against stability: higher = snappier but
 * more jittery, lower = smoother but laggier. Manuscript's recommended
 * starting range is 0.4–0.6; tune empirically once real rendering (Step 4)
 * makes jitter visible instead of just numeric in the console.
 */
export function smoothLandmarks(rawLandmarks, prevSmoothed, alpha = 0.5) {
  return rawLandmarks.map((point, i) => {
    const prev = prevSmoothed?.[i];

    // First frame (or a landmark index that didn't exist previously) has no
    // history to blend against yet, so pass the raw value through unchanged.
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
