import { smoothLandmarks } from "../../landmarkSmoothing.js";
import { makeLandmarkStream } from "./fixtures.js";

export const GOLDEN_ALPHA = 0.5;

/**
 * Runs the original smoothLandmarks over the fixture stream exactly the way
 * AROverlayCanvas does (previous smoothed frame fed back in, null on the first
 * frame) and returns the output as plain [x, y, z] arrays per frame.
 */
export function runOriginalEma(alpha = GOLDEN_ALPHA) {
  const stream = makeLandmarkStream();
  let prev = null;
  return stream.map(({ t, points }) => {
    prev = smoothLandmarks(points, prev, alpha);
    return { t, points: prev.map((p) => [p.x, p.y, p.z]) };
  });
}
