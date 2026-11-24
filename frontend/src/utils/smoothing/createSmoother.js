import { EmaSmoother } from "./EmaSmoother.js";

/**
 * Factory for landmark smoothers (see LandmarkSmoother.js).
 *
 *   createSmoother()                          -> EmaSmoother, alpha 0.5
 *   createSmoother({ type: "ema", alpha })    -> EmaSmoother
 *
 * An unknown type falls back to the EMA with a console warning, so a bad setting
 * never leaves the try-on without smoothing.
 *
 * @returns {import("./LandmarkSmoother.js").LandmarkSmoother}
 */
export function createSmoother({ type = "ema", ...params } = {}) {
  switch (type) {
    case "ema":
      return new EmaSmoother(params);
    default:
      console.warn(`[AR] Unknown smoother type "${type}", using EMA.`);
      return new EmaSmoother(params);
  }
}
