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
 * Default toggles, used only when no `toggles` prop is passed (ARTryOnPage
 * always passes real state from ARControlBar). There are no default colors:
 * a region is drawn only when ARTryOnPage passes a selected shade for it.
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
const NO_COLORS = {};

/**
 * How each region is drawn over the camera frame. Each layer is one fill with
 * a canvas blend mode against the skin pixels underneath:
 *  - "multiply" adds pigment depth, so a dark shade reads darker than a light one.
 *  - "color" adds the shade's hue and saturation but keeps the skin's own
 *    brightness, so creases, shadows and highlights stay visible.
 *  - "soft-light" is a sheer tint, closer to blush or a gloss.
 * `feather` is the edge blur as a fraction of canvas width. `radial` fades the
 * fill from the middle of each ring out to transparent (blush placement).
 * Values chosen by eye against the darkest and lightest shades of each
 * region, 2026-11-07. Lips stay non-radial so "evenodd" keeps the mouth clear.
 */
const REGION_RENDER = {
  lips: {
    feather: 0.012,
    radial: false,
    layers: [
      { blend: "multiply", opacity: 0.6 },
      { blend: "color", opacity: 0.35 },
    ],
  },
  cheeks: {
    feather: 0.012,
    radial: true,
    layers: [
      { blend: "soft-light", opacity: 0.35 },
      { blend: "color", opacity: 0.4 },
    ],
  },
  eyeshadow: {
    feather: 0.015,
    radial: true,
    layers: [
      { blend: "multiply", opacity: 0.6 },
      { blend: "color", opacity: 0.45 },
    ],
  },
};

// Canvas resolution cap. Above 2x the extra pixels cost frame time with no visible gain.
const MAX_PIXEL_RATIO = 2;

// Whether this browser applies `ctx.filter` (Safari may not). Where it does not, setting
// it does nothing and every region gets a hard edge, so fillRegion feathers with a
// canvas shadow instead.
function supportsCanvasFilter() {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx || typeof ctx.filter !== "string") return false;
  ctx.filter = "blur(1px)";
  return ctx.filter === "blur(1px)";
}
const CANVAS_FILTER = typeof document !== "undefined" && supportsCanvasFilter();

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

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Shade color at full strength in the middle of the ring, fading to transparent at its edge.
function radialFill(ctx, points, [r, g, b]) {
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const radius = Math.max(1, ...points.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.7)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  return gradient;
}

/**
 * Fills one or more rings of landmark indices as smooth paths, one fill per
 * layer of `settings` (see REGION_RENDER). Each layer blends the shade with the
 * skin pixels already on the canvas at the layer's opacity, which is the
 * C(τ) = β·C_shade + (1-β)·C_skin(τ) mix of Eq. D.2 done per blend mode.
 * Without `radial`, all rings form one path so "evenodd" can cut out the inner lips.
 */
function fillRegion(ctx, rings, landmarks, videoW, videoH, canvasW, canvasH, color, settings, fillRule = "nonzero", forceShadowBlur = false) {
  const pointSets = rings.map((ring) =>
    ring.map((idx) => {
      const lm = landmarks[idx];
      return toCanvasSpace(lm.x * videoW, lm.y * videoH, videoW, videoH, canvasW, canvasH);
    }),
  );
  const pathOf = (sets) => {
    const path = new Path2D();
    sets.forEach((points) => tracePath(path, points));
    return path;
  };
  const rgb = hexToRgb(color);
  const shapes = settings.radial
    ? pointSets.map((points) => ({ path: pathOf([points]), style: radialFill(ctx, points, rgb) }))
    : [{ path: pathOf(pointSets), style: color }];

  const feather = canvasW * settings.feather;
  const shadowFeather = feather > 0 && (forceShadowBlur || !CANVAS_FILTER);
  if (!shadowFeather) ctx.filter = feather > 0 ? `blur(${feather}px)` : "none";
  // Shadow fallback: the shape is drawn two canvas widths to the left, off screen, and
  // only its blurred shadow lands on the face. Shadow offsets ignore the transform, and a
  // shadowBlur of 2x matches a blur() of 1x. Blend mode and the radial fade's alpha apply
  // to the shadow too.
  const offset = canvasW * 2;
  for (const layer of settings.layers) {
    if (!(layer.opacity > 0)) continue;
    ctx.globalCompositeOperation = layer.blend;
    ctx.globalAlpha = layer.opacity;
    for (const { path, style } of shapes) {
      ctx.fillStyle = style;
      if (shadowFeather) {
        ctx.save();
        ctx.translate(-offset, 0);
        ctx.shadowOffsetX = offset;
        ctx.shadowBlur = feather * 2;
        ctx.shadowColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fill(path, fillRule);
        ctx.restore();
      } else {
        ctx.fill(path, fillRule);
      }
    }
  }
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
 *  - colors: { lips, cheeks, eyeshadow } hex strings, the selected shades. May be
 *    partial; a region with no color is not drawn.
 *  - render: per-region blend layers, opacity and feather. Defaults to
 *    REGION_RENDER; the DEV tuning panel passes its own values here.
 *  - forceShadowBlur: DEV only, uses the shadow feather fallback even where
 *    `ctx.filter` works, to compare the two on desktop.
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
  toggles = DEFAULT_TOGGLES,
  colors = NO_COLORS,
  render = REGION_RENDER,
  forceShadowBlur = false,
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

          const videoW = video.videoWidth;
          const videoH = video.videoHeight;
          const args = [smoothed, videoW, videoH, canvas.width, canvas.height];

          if (toggles.lips && colors.lips) {
            fillRegion(ctx, [LIPS_OUTER, LIPS_INNER], ...args, colors.lips, render.lips, "evenodd", forceShadowBlur);
          }
          if (toggles.cheeks && colors.cheeks) {
            const leftRing = orderRingByAngle(CHEEK_LEFT, smoothed);
            const rightRing = orderRingByAngle(CHEEK_RIGHT, smoothed);
            fillRegion(ctx, [leftRing, rightRing], ...args, colors.cheeks, render.cheeks, "nonzero", forceShadowBlur);
          }
          if (toggles.eyeshadow && colors.eyeshadow) {
            // Region = upper lash line arc + the eyebrow ring that sits closer to the
            // eye, angle-sorted into a closed blob (same technique as cheeks).
            const browLeftLower = pickCloserRing(EYEBROW_LEFT_A, EYEBROW_LEFT_B, smoothed);
            const browRightLower = pickCloserRing(EYEBROW_RIGHT_A, EYEBROW_RIGHT_B, smoothed);
            const lidLeft = upperArc(EYE_LEFT, smoothed);
            const lidRight = upperArc(EYE_RIGHT, smoothed);
            const shadowLeft = orderRingByAngle([...lidLeft, ...browLeftLower], smoothed);
            const shadowRight = orderRingByAngle([...lidRight, ...browRightLower], smoothed);
            fillRegion(ctx, [shadowLeft, shadowRight], ...args, colors.eyeshadow, render.eyeshadow, "nonzero", forceShadowBlur);
          }
        }

        onFrameRef.current?.(performance.now() - frameStart, hasFace);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, isMock, isReady, videoRef, alpha, toggles, colors, render, forceShadowBlur]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
});

// Seed values for the DEV tuning panel in ARTryOnPage.
AROverlayCanvas.defaultRender = REGION_RENDER;
