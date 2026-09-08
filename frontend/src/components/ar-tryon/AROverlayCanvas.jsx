import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/**
 * AROverlayCanvas — Step 1: live face landmark tracking (milestone check)
 *
 * Loads MediaPipe's FaceLandmarker (VIDEO mode) once, then runs detection on
 * every animation frame against the camera feed's <video> element. For now
 * this only logs the raw landmark output so we can confirm tracking works
 * before building smoothing, region mapping, and shade rendering on top of it
 * (Steps 2-4 in the AR PRD).
 *
 * Props:
 *  - videoRef: ref to the <video> element rendered by CameraFeed (cameraRef
 *    from useARCamera). Detection reads frames directly off this element.
 *  - isReady: true once the camera stream is actually playing.
 *  - isMock: true when CameraFeed is showing the static mock background
 *    instead of a real camera stream — there's no <video> element to track
 *    in that case, so detection is skipped.
 */
export function AROverlayCanvas({ videoRef, isReady, isMock }) {
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const [status, setStatus] = useState("loading"); // loading | ready | tracking | error

  // Load the FaceLandmarker model once on mount.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setStatus("ready");
      } catch (err) {
        console.error("[AR] Failed to load FaceLandmarker:", err);
        if (!cancelled) setStatus("error");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Run the detection loop once the model is ready and a real video feed is playing.
  useEffect(() => {
    if (status !== "ready" && status !== "tracking") return;
    if (isMock || !isReady) return;

    const video = videoRef?.current;
    if (!video) return;

    function tick() {
      const landmarker = landmarkerRef.current;

      if (
        landmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime;
        const result = landmarker.detectForVideo(video, performance.now());

        if (result.faceLandmarks?.length > 0) {
          if (status !== "tracking") setStatus("tracking");

          // MILESTONE CHECK (PRD Step 1): confirm we're getting 468 points
          // with sane x/y/z values before building anything on top of this.
          // Remove this log once Step 3 (region mapping) starts consuming
          // the landmarks for real instead of just printing them.
          const points = result.faceLandmarks[0];
          console.log("[AR] landmark count:", points.length, "nose tip:", points[1]);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, isMock, isReady, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
