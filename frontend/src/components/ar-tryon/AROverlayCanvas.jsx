import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getFaceLandmarker } from "../../services/faceLandmarkerService";
import { smoothLandmarks } from "../../utils/landmarkSmoothing.js";
import { REGION_RENDER, drawLooks, sampleSkin, toCanvasSpace } from "../../utils/arRenderer.js";

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

// Split compare: a vertical divider with a small round handle, drawn on the canvas so a saved photo shows it too.
// The makeup is drawn only to the left of it (see the render loop); the right side is the bare camera frame.
function drawSplitDivider(ctx, x, canvasW, canvasH) {
  const line = Math.max(2, canvasW / 300);
  const r = Math.max(12, canvasW * 0.035);
  // Handle sits low (over the shoulders) so it doesn't cover the face; the thin line is all that crosses it.
  const cy = canvasH * 0.88;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = line * 3;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - line / 2, 0, line, canvasH);
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#6B4FC8"; // the app's primary purple
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const a = r * 0.42; // arrow size: one pointing each way
  ctx.beginPath();
  ctx.moveTo(x - a * 0.35, cy - a);
  ctx.lineTo(x - a * 1.35, cy);
  ctx.lineTo(x - a * 0.35, cy + a);
  ctx.moveTo(x + a * 0.35, cy - a);
  ctx.lineTo(x + a * 1.35, cy);
  ctx.lineTo(x + a * 0.35, cy + a);
  ctx.stroke();
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
const NO_FACE_RESET_FRAMES = 20; // about 0.7 s of video

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
  splitRef,
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
  // Skin color ({ L, a, b } in CIELAB) for skin-adaptive makeup; re-measured every few frames and smoothed so it never flickers.
  const skinRef = useRef(null);
  const skinFramesRef = useRef(0);
  const noFaceFramesRef = useRef(0);
  const hasFrameRef = useRef(false);
  const [status, setStatus] = useState("loading"); // loading | ready | tracking | error

  useImperativeHandle(ref, () => ({
    capture() {
      const canvas = canvasRef.current;
      if (isMock || !canvas || !hasFrameRef.current) return null;
      return canvas.toDataURL("image/png");
    },
    // Forget the measured skin color so the next frame measures it afresh (a new photo in the DEV lab).
    resetSkin() {
      skinRef.current = null;
      skinFramesRef.current = 0;
    },
  }), [isMock]);

  // Get the FaceLandmarker on mount. It is shared across visits (faceLandmarkerService.js), so it is not closed here.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const landmarker = await getFaceLandmarker();
        if (cancelled) return;
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
      landmarkerRef.current = null;
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

        // Read each frame from a ref, so moving the divider never restarts this loop or re-renders the page.
        const split = typeof splitRef?.current === "number" ? splitRef.current : null;
        const hasFace = result.faceLandmarks?.length > 0;
        // The skin estimate is smoothed over time, so after the face has been gone for a while (another person may
        // appear) it is thrown away and measured again instead of slowly drifting from the old face's color.
        noFaceFramesRef.current = hasFace ? 0 : noFaceFramesRef.current + 1;
        if (noFaceFramesRef.current === NO_FACE_RESET_FRAMES) skinRef.current = null;
        if (hasFace) {
          if (status !== "tracking") setStatus("tracking");

          const rawPoints = result.faceLandmarks[0];

          // EMA smoothing (Eq. D.1) before anything gets rendered from it.
          const smoothed = smoothLandmarks(rawPoints, smoothedLandmarksRef.current, alpha);
          smoothedLandmarksRef.current = smoothed;
          // DEV lab only: lets test scripts read where the face is, in video-normalised coordinates.
          if (landmarksRef) landmarksRef.current = { points: smoothed, videoW: video.videoWidth, videoH: video.videoHeight, canvasW: canvas.width, canvasH: canvas.height, skinL: skinRef.current?.L ?? null, skin: skinRef.current };

          const videoW = video.videoWidth;
          const videoH = video.videoHeight;
          if (skinRef.current === null || skinFramesRef.current++ % 10 === 0) {
            const m = sampleSkin(video, smoothed);
            const k = skinRef.current;
            skinRef.current = k === null ? m : { L: k.L * 0.8 + m.L * 0.2, a: k.a * 0.8 + m.a * 0.2, b: k.b * 0.8 + m.b * 0.2 };
          }
          // Split compare: makeup only to the left of the divider (a fraction of the width; null = no split).
          if (split !== null) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, canvas.width * split, canvas.height);
            ctx.clip();
          }
          drawLooks(ctx, smoothed, videoW, videoH, canvas.width, canvas.height, { colors, toggles, finishes, render, skin: skinRef.current, video });
          if (debugLandmarks) drawLandmarkNumbers(ctx, smoothed, videoW, videoH, canvas.width, canvas.height, Array.isArray(debugLandmarks) ? debugLandmarks : null);
          if (split !== null) ctx.restore();
        }
        if (split !== null) drawSplitDivider(ctx, canvas.width * split, canvas.width, canvas.height);

        onFrameRef.current?.(performance.now() - frameStart, hasFace);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, isMock, isReady, videoRef, alpha, toggles, colors, finishes, render, debugLandmarks, landmarksRef, splitRef]);

  return (
    <canvas
      ref={canvasRef}
      data-ar-status={status}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
});

// Seed values for the DEV tuning panel in ARTryOnPage.
AROverlayCanvas.defaultRender = REGION_RENDER;
