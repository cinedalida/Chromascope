import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { smoothLandmarks } from "../../utils/landmarkSmoothing.js";
import {
  LIPS_OUTER,
  LIPS_INNER,
  CHEEK_LEFT,
  CHEEK_RIGHT,
  orderRingByAngle,
  EYE_LEFT,
  EYE_RIGHT,
  EYEBROW_LEFT_A,
  EYEBROW_LEFT_B,
  EYEBROW_RIGHT_A,
  EYEBROW_RIGHT_B,
  upperArc,
  pickCloserRing,
} from "../../utils/meshRegions.js";

/**
 * Placeholder toggle/color state. Task 6 replaced DEFAULT_TOGGLES with
 * real state from ARControlBar; Task 7 replaces DEFAULT_COLORS with real
 * product hex_color values from AppliedProductsPanel / the /api/run-filter
 * response. Full face defaults off since it visually covers lips/cheeks
 * underneath it.
 *
 * Eyeliner was tried (stroke-based, along the upper lash line with a
 * wing-tip flick) and removed after visual testing, it read as too faint/
 * indistinct against real lashes even after widening the stroke, boosting
 * opacity, and adding the wing. Eyeshadow (fill-based, same technique as
 * lips/cheeks) worked well and stayed. See
 * claude/AR_Implementation_Paper_Updates.md in the project for the full
 * before/after decision.
 */
const DEFAULT_TOGGLES = {
  lips: true,
  cheeks: true,
  eyeshadow: true,
};
const DEFAULT_COLORS = {
  lips: "#B5432A",
  cheeks: "#E8A2A2",
  eyeshadow: "#8B6F5C",
};

/**
 * Maps a point in the video's own pixel space onto the canvas, replicating
 * two things that both have to line up for the overlay to sit on the face
 * correctly:
 *  1. CSS `object-cover` scaling/cropping — CameraFeed's <video> fills its
 *     container with object-cover, which scales and crops the video rather
 *     than stretching it. MediaPipe's normalized (0-1) landmark output is
 *     relative to the video's native resolution, not the displayed box, so
 *     without this the overlay would drift whenever the video's aspect
 *     ratio doesn't match the container's.
 *  2. The horizontal mirror CameraFeed applies to the video for a normal
 *     selfie view (style={{ transform: "scaleX(-1)" }}). MediaPipe runs
 *     detection on the raw, unmirrored frame, so the overlay has to be
 *     flipped to match what's actually on screen.
 */
function toCanvasSpace(px, py, videoWidth, videoHeight, canvasWidth, canvasHeight) {
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let scale;
  let offsetX = 0;
  let offsetY = 0;
  if (videoAspect > canvasAspect) {
    scale = canvasHeight / videoHeight;
    offsetX = (videoWidth * scale - canvasWidth) / 2;
  } else {
    scale = canvasWidth / videoWidth;
    offsetY = (videoHeight * scale - canvasHeight) / 2;
  }

  const x = px * scale - offsetX;
  const y = py * scale - offsetY;
  return [canvasWidth - x, y]; // mirrored to match CameraFeed's scaleX(-1)
}

/**
 * Traces a SMOOTH closed loop through a set of points, using a quadratic
 * curve through each edge's midpoint rather than straight lines to each
 * vertex. Straight lines between sparse landmark points (especially the
 * cheek approximation, which isn't an official ordered MediaPipe ring)
 * produce a jagged, star-shaped outline; this rounds every corner into a
 * soft, organic blob instead.
 */
function tracePath(ctx, points) {
  if (points.length < 3) {
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    return;
  }
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = midpoint(points[points.length - 1], points[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const mid = midpoint(curr, next);
    ctx.quadraticCurveTo(curr[0], curr[1], mid[0], mid[1]);
  }
  ctx.closePath();
}

/**
 * Fills one or more rings of landmark indices as a single smooth path, per
 * Eq. D.2 (Region Triangle Fill): C(τ) = β·C_shade + (1-β)·C_skin(τ).
 * `feather` (px) softens the fill's edge with a canvas blur so it blends
 * into skin instead of cutting off sharply.
 */
function fillRegion(ctx, rings, landmarks, videoW, videoH, canvasW, canvasH, color, opacity, fillRule = "nonzero", feather = 0, blendMode = "color") {
  ctx.beginPath();
  rings.forEach((ring) => {
    const points = ring.map((idx) => {
      const lm = landmarks[idx];
      return toCanvasSpace(lm.x * videoW, lm.y * videoH, videoW, videoH, canvasW, canvasH);
    });
    tracePath(ctx, points);
  });
  // Blend mode options (CSS Compositing spec, all supported by Canvas 2D):
  //  - "color": keeps the base layer's own luminosity (skin shading,
  //    texture, highlights) and only applies the fill's hue/saturation.
  //    Tints instead of flattening what's underneath — the default now.
  //  - "multiply": darkens based on the base pixel; at higher opacity it
  //    can wash out fine texture, which is what this replaced.
  //  - "soft-light" / "overlay": more subtle tint, closer to a sheer/gloss
  //    product than a pigmented one, worth trying once real product data
  //    (Task 7) distinguishes matte vs. sheer finishes.
  ctx.globalCompositeOperation = blendMode;
  ctx.filter = feather > 0 ? `blur(${feather}px)` : "none";
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.fill(fillRule);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
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
 *  - toggles: { lips, cheeks, eyeshadow } booleans — which regions render. There
 *    is no separate "fullFace" toggle here — ARControlBar's Full Face pill is a
 *    shortcut that flips these three together, not its own render region.
 *  - colors: { lips, cheeks, eyeshadow } hex strings — the shade to apply.
 *  - opacity: blend opacity constant β from Eq. D.2 (manuscript recommends 0.7-0.8).
 *
 * Exposes via ref: capture() — composites the mirrored video frame plus the
 * current makeup overlay into one PNG data URL for ARTryOnPage's save
 * button. Returns null when there's no live video to capture from (mock
 * mode, or before the camera is ready).
 */
export const AROverlayCanvas = forwardRef(function AROverlayCanvas({
  videoRef,
  isReady,
  isMock,
  alpha = 0.5,
  toggles = DEFAULT_TOGGLES,
  colors = DEFAULT_COLORS,
  opacity = 0.75,
  blendMode = "color",
}, ref) {
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const smoothedLandmarksRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | tracking | error

  useImperativeHandle(ref, () => ({
    capture() {
      const video = videoRef?.current;
      const overlay = canvasRef.current;
      if (isMock || !video || !overlay || !video.videoWidth) return null;

      const out = document.createElement("canvas");
      out.width = overlay.width;
      out.height = overlay.height;
      const ctx = out.getContext("2d");

      // Same object-cover mapping as toCanvasSpace() above, but for an image
      // draw rect instead of a point, so the captured frame lines up with
      // what's actually on screen (including CameraFeed's scaleX(-1) mirror).
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      const videoAspect = videoW / videoH;
      const canvasAspect = out.width / out.height;
      let drawW, drawH, drawX, drawY;
      if (videoAspect > canvasAspect) {
        drawH = out.height;
        drawW = videoW * (drawH / videoH);
        drawX = (out.width - drawW) / 2;
        drawY = 0;
      } else {
        drawW = out.width;
        drawH = videoH * (drawW / videoW);
        drawX = 0;
        drawY = (out.height - drawH) / 2;
      }

      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -(drawX + drawW), drawY, drawW, drawH);
      ctx.restore();

      // Makeup fills, already rendered in mirrored canvas space.
      ctx.drawImage(overlay, 0, 0, out.width, out.height);

      return out.toDataURL("image/png");
    },
  }), [videoRef, isMock]);

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
    if (status !== "ready" && status !== "tracking") return;
    if (isMock || !isReady) return;

    const video = videoRef?.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    function tick() {
      const landmarker = landmarkerRef.current;

      if (
        landmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime;
        const result = landmarker.detectForVideo(video, performance.now());

        // Keep the canvas's pixel buffer matched to its displayed CSS size
        // so drawing coordinates line up. Cheap to check every frame; only
        // actually resizes (and clears) when the box size changed.
        const displayW = canvas.clientWidth;
        const displayH = canvas.clientHeight;
        if (canvas.width !== displayW || canvas.height !== displayH) {
          canvas.width = displayW;
          canvas.height = displayH;
        }

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result.faceLandmarks?.length > 0) {
          if (status !== "tracking") setStatus("tracking");

          const rawPoints = result.faceLandmarks[0];

          // EMA smoothing (Eq. D.1) before anything gets rendered from it.
          const smoothed = smoothLandmarks(rawPoints, smoothedLandmarksRef.current, alpha);
          smoothedLandmarksRef.current = smoothed;

          const videoW = video.videoWidth;
          const videoH = video.videoHeight;
          const args = [smoothed, videoW, videoH, canvas.width, canvas.height];

          const lipFeather = canvas.width * 0.006;
          const cheekFeather = canvas.width * 0.02;
          const eyeshadowFeather = canvas.width * 0.015;

          if (toggles.lips) {
            fillRegion(ctx, [LIPS_OUTER, LIPS_INNER], ...args, colors.lips, opacity, "evenodd", lipFeather, blendMode);
          }
          if (toggles.cheeks) {
            const leftRing = orderRingByAngle(CHEEK_LEFT, smoothed);
            const rightRing = orderRingByAngle(CHEEK_RIGHT, smoothed);
            fillRegion(ctx, [leftRing, rightRing], ...args, colors.cheeks, opacity, "nonzero", cheekFeather, blendMode);
          }
          if (toggles.eyeshadow) {
            // Region = upper lash line arc + the eyebrow ring that sits closer to the
            // eye, angle-sorted into a closed blob (same technique as cheeks).
            const browLeftLower = pickCloserRing(EYEBROW_LEFT_A, EYEBROW_LEFT_B, smoothed);
            const browRightLower = pickCloserRing(EYEBROW_RIGHT_A, EYEBROW_RIGHT_B, smoothed);
            const lidLeft = upperArc(EYE_LEFT, smoothed);
            const lidRight = upperArc(EYE_RIGHT, smoothed);
            const shadowLeft = orderRingByAngle([...lidLeft, ...browLeftLower], smoothed);
            const shadowRight = orderRingByAngle([...lidRight, ...browRightLower], smoothed);
            fillRegion(ctx, [shadowLeft, shadowRight], ...args, colors.eyeshadow, opacity, "nonzero", eyeshadowFeather, blendMode);
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, isMock, isReady, videoRef, alpha, toggles, colors, opacity, blendMode]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
});
