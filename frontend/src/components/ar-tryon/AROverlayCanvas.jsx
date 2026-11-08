import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { smoothLandmarks } from "../../utils/landmarkSmoothing.js";
import { REGION_RENDER, drawLooks, sampleSkinL, toCanvasSpace } from "../../utils/arRenderer.js";

/**
 * Drawing lives in utils/arRenderer.js (REGION_RENDER holds the blend settings per region). This component
 * owns the camera frame, face tracking and smoothing. Nothing has a default color: a region is drawn only
 * when ARTryOnPage passes a selected shade for it.
 *
 * Eyeliner was tried once (stroke along the upper lash line with a wing flick) and removed because it read as
 * too faint. It is back as a thick opaque stroke scaled to the eye width; see REGION_RENDER.eyeliner.
 */
const NO_COLORS = {};
const NO_FINISHES = {};
const NO_TOGGLES = {};

// Canvas resolution cap. Above 2x the extra pixels cost frame time with no visible gain.
const MAX_PIXEL_RATIO = 2;

/**
 * The object-cover draw rect for the video inside a canvas of the given size,
 * as [x, y, width, height]. Matches toCanvasSpace() below.
 */
function coverRect(videoW, videoH, canvasW, canvasH) {
  if (videoW / videoH > canvasW / canvasH) {
    const h = canvasH;
    const w = videoW * (h / videoH);
    return [(canvasW - w) / 2, 0, w, h];
  }
  const w = canvasW;
  const h = videoH * (w / videoW);
  return [0, (canvasH - h) / 2, w, h];
}

/**
 * Draws the current video frame mirrored and object-cover cropped, so the
 * canvas shows the same picture as CameraFeed and the makeup layers can blend
 * with real skin pixels. Without this the canvas is transparent and every
 * blend mode falls back to a flat color laid on top of the face.
 */
function drawMirroredFrame(ctx, video, canvasW, canvasH) {
  const [x, y, w, h] = coverRect(video.videoWidth, video.videoHeight, canvasW, canvasH);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -(x + w), y, w, h);
  ctx.restore();
}

// DEV aid for tuning landmark sets: the index number next to every landmark.
function drawLandmarkNumbers(ctx, landmarks, videoW, videoH, canvasW, canvasH, only) {
  ctx.font = only ? "bold 15px sans-serif" : "9px sans-serif";
  ctx.fillStyle = "#00ff88";
  landmarks.forEach((lm, i) => {
    if (only && !only.includes(i)) return;
    const [x, y] = toCanvasSpace(lm.x * videoW, lm.y * videoH, videoW, videoH, canvasW, canvasH);
    ctx.fillText(String(i), x, y);
  });
}

/**
 * AROverlayCanvas — live face landmark tracking, EMA smoothing, and
 * region-fill rendering (EMA-Smoothed Mesh Registration Algorithm,
 * manuscript Sec. 3.3-D).
 *
 * Props:
 *  - videoRef: ref to the <video> element rendered by CameraFeed.
 *  - isReady: true once the camera stream is actually playing.
 *  - isMock: true when CameraFeed shows the static mock background instead
 *    of a real stream — there's no <video> to track, so detection/render
 *    is skipped.
 *  - alpha: EMA smoothing factor (manuscript recommends 0.4-0.6).
 *  - toggles: { region: boolean }. A region is hidden only when its toggle is false.
 *  - colors: { lips, cheeks, eyeshadow } hex strings, the selected shades. May be
 *    partial; a region with no color is not drawn.
 *  - render: per-region blend layers, opacity and feather. Defaults to
 *    REGION_RENDER; the DEV tuning panel passes its own values here.
 *  - landmarksRef: optional ref the DEV lab page passes to read the smoothed landmarks.
 *  - onFrame: optional callback(latencyMs, hasFace) called once per processed
 *    frame with the time spent on detection + smoothing + drawing and whether
 *    a face was found (usePerfStats).
 *
 * Exposes via ref: capture() returns the canvas (camera frame plus makeup,
 * exactly what is on screen) as a PNG data URL for ARTryOnPage's save button.
 * Returns null when no live frame has been drawn yet (mock mode, or before
 * the camera is ready).
 */
export const AROverlayCanvas = forwardRef(function AROverlayCanvas({
  videoRef,
  isReady,
  isMock,
  alpha = 0.5,
  toggles = NO_TOGGLES,
  colors = NO_COLORS,
  finishes = NO_FINISHES,
  render = REGION_RENDER,
  debugLandmarks = false,
  landmarksRef,
  onFrame,
}, ref) {
  const canvasRef = useRef(null);
  // Changing a shade restarts the render loop below; smoothing state lives in
  // refs, so the restart costs at most one frame and no tracking jump.
  // Kept in a ref so a new callback never restarts the render loop.
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const smoothedLandmarksRef = useRef(null);
  // Skin lightness for skin-adaptive makeup strength; re-measured every few frames and smoothed so it never flickers.
  const skinLRef = useRef(null);
  const skinFramesRef = useRef(0);
  const hasFrameRef = useRef(false);
  const [status, setStatus] = useState("loading"); // loading | ready | tracking | error

  useImperativeHandle(ref, () => ({
    capture() {
      const canvas = canvasRef.current;
      if (isMock || !canvas || !hasFrameRef.current) return null;
      return canvas.toDataURL("image/png");
    },
  }), [isMock]);

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

  // Detect → smooth → render, once the model is ready and a real video feed is playing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (isMock && canvas && hasFrameRef.current) {
      // A last camera frame must not stay on top of the mock background.
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      hasFrameRef.current = false;
    }
    if (status !== "ready" && status !== "tracking") return;
    if (isMock || !isReady) return;

    const video = videoRef?.current;
    if (!video || !canvas) return;

    function tick() {
      const landmarker = landmarkerRef.current;

      if (
        landmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime;
        const frameStart = performance.now();
        const result = landmarker.detectForVideo(video, frameStart);

        // Keep the canvas's pixel buffer matched to its displayed size times the
        // device pixel ratio, so the camera frame drawn into it stays sharp on
        // phones. Cheap to check every frame; only resizes when the box changed.
        const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const displayW = Math.round(canvas.clientWidth * pixelRatio);
        const displayH = Math.round(canvas.clientHeight * pixelRatio);
        if (canvas.width !== displayW || canvas.height !== displayH) {
          canvas.width = displayW;
          canvas.height = displayH;
        }

        // The frame covers the whole canvas, so it also replaces the previous frame's makeup.
        const ctx = canvas.getContext("2d");
        drawMirroredFrame(ctx, video, canvas.width, canvas.height);
        hasFrameRef.current = true;

        const hasFace = result.faceLandmarks?.length > 0;
        if (hasFace) {
          if (status !== "tracking") setStatus("tracking");

          const rawPoints = result.faceLandmarks[0];

          // EMA smoothing (Eq. D.1) before anything gets rendered from it.
          const smoothed = smoothLandmarks(rawPoints, smoothedLandmarksRef.current, alpha);
          smoothedLandmarksRef.current = smoothed;
          // DEV lab only: lets test scripts read where the face is, in video-normalised coordinates.
          if (landmarksRef) landmarksRef.current = { points: smoothed, videoW: video.videoWidth, videoH: video.videoHeight, canvasW: canvas.width, canvasH: canvas.height, skinL: skinLRef.current };

          const videoW = video.videoWidth;
          const videoH = video.videoHeight;
          if (skinLRef.current === null || skinFramesRef.current++ % 10 === 0) {
            const measured = sampleSkinL(video, smoothed);
            skinLRef.current = skinLRef.current === null ? measured : skinLRef.current * 0.8 + measured * 0.2;
          }
          drawLooks(ctx, smoothed, videoW, videoH, canvas.width, canvas.height, { colors, toggles, finishes, render, skinL: skinLRef.current, video });
          if (debugLandmarks) drawLandmarkNumbers(ctx, smoothed, videoW, videoH, canvas.width, canvas.height, Array.isArray(debugLandmarks) ? debugLandmarks : null);
        }

        onFrameRef.current?.(performance.now() - frameStart, hasFace);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, isMock, isReady, videoRef, alpha, toggles, colors, finishes, render, debugLandmarks, landmarksRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
});

// Seed values for the DEV tuning panel in ARTryOnPage.
AROverlayCanvas.defaultRender = REGION_RENDER;
