import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// The face model is expensive to set up (WASM runtime, model file, GPU), so it is created once per page load and
// kept: leaving Try-On and coming back reuses it instead of starting over. Only one canvas uses it at a time, and
// detection timestamps (performance.now) keep increasing across visits, as VIDEO mode requires.

let shared = null;

/** The shared FaceLandmarker (a Promise). Never close() it; a failed setup is forgotten so the next call retries. */
export function getFaceLandmarker() {
  shared ??= createFaceLandmarker().catch((error) => {
    shared = null;
    throw error;
  });
  return shared;
}

async function createFaceLandmarker() {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });
}
