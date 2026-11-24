/**
 * landmarkSmoothing: kept for compatibility. The EMA (Eq. D.1) now lives in
 * utils/smoothing/EmaSmoother.js behind the LandmarkSmoother strategy interface.
 *
 * smoothLandmarks(rawLandmarks, prevSmoothed, alpha = 0.5) is the same one-step
 * function as before; new code should use createSmoother() from utils/smoothing.
 */
export { emaStep as smoothLandmarks, EmaSmoother } from "./smoothing/EmaSmoother.js";
