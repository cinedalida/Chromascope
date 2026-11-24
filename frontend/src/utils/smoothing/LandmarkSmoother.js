/**
 * LandmarkSmoother: the strategy interface every landmark smoother implements.
 *
 * AROverlayCanvas holds one smoother (made by createSmoother) and calls it once per
 * processed camera frame. Swapping the strategy changes only how landmarks are
 * smoothed; tracking, region mapping and drawing stay the same.
 *
 * Point shape: one MediaPipe Face Landmarker landmark, normalized to the video frame,
 *   { x: number, y: number, z: number }
 * x and y run 0..1 across the video width and height; z is relative depth. A frame
 * is an array of 478 points (468 mesh + 10 iris).
 *
 * @typedef {{ x: number, y: number, z: number }} LandmarkPoint
 *
 * @typedef {object} LandmarkSmoother
 * @property {(points: LandmarkPoint[], timestampMs: number) => LandmarkPoint[]} smooth
 *   Smooths one frame of raw points and returns a new array of new point objects.
 *   timestampMs is the frame time in milliseconds (performance.now() in the app).
 *   Callers may keep the returned array; a smoother never changes it afterwards.
 * @property {() => void} reset
 *   Forgets all history, so the next smooth() returns its raw input unchanged.
 *   Called when the face is lost.
 */
export {};
