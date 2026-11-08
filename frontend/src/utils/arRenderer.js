import {
  LIPS_OUTER,
  LIPS_INNER,
  FACE_OVAL,
  CHEEK_LEFT,
  CHEEK_RIGHT,
  EYE_LEFT,
  EYE_RIGHT,
  EYEBROW_LEFT_A,
  EYEBROW_LEFT_B,
  EYEBROW_RIGHT_A,
  EYEBROW_RIGHT_B,
  EYE_LEFT_UPPER,
  EYE_RIGHT_UPPER,
  EYE_LEFT_LOWER,
  EYE_RIGHT_LOWER,
  NOSE_BRIDGE,
  CONTOUR_LEFT,
  CONTOUR_RIGHT,
  CHEEKBONE_LEFT,
  CHEEKBONE_RIGHT,
  orderRingByAngle,
  upperArc,
  pickCloserRing,
} from "./meshRegions.js";

/**
 * AR makeup renderer: draws every look onto the canvas that already holds the mirrored camera frame.
 *
 * Each look is a function (ctx, frame, color, settings) that paints with canvas blend modes against the skin
 * pixels underneath. REGION_RENDER holds the settings per region; a finish ("gloss", "sheer", ...) overrides
 * parts of them (see FINISH_OVERRIDES). Blend modes: "multiply" adds pigment depth, "color" keeps the skin's own
 * brightness (creases and highlights stay visible), "soft-light" is a sheer tint, "screen" lightens (highlighter).
 * `feather` is the edge blur as a fraction of canvas width. Values are tuned by eye on a live face.
 */

// Back to front: base products first, details on top.
export const DRAW_ORDER = [
  "foundation",
  "concealer",
  "powder",
  "bronzer",
  "contour",
  "cheeks",
  "highlighter",
  "eyeshadow",
  "brows",
  "eyeliner",
  "mascara",
  "lips",
  "lipLiner",
];

export const REGION_RENDER = {
  // Lipstick needs real pigment: "color" alone keeps the lip's own brightness, so a dark shade could not darken a
  // paler lip (it came out lilac). "source-over" moves the lip towards the shade, "multiply" adds depth, "color" sets hue.
  lips: {
    feather: 0.016,
    radial: false,
    layers: [
      { blend: "source-over", opacity: 0.22 },
      { blend: "multiply", opacity: 0.3 },
      { blend: "color", opacity: 0.2 },
    ],
  },
  lipLiner: {
    feather: 0.0045, // soft edge so the liner melts into the lipstick instead of showing a hard line
    width: 0.0026,
    inset: 0.045, // fraction pulled toward the lip centre, keeps the liner inside the lip edge
    layers: [
      { blend: "multiply", opacity: 0.5 },
      { blend: "color", opacity: 0.3 },
    ],
  },
  // Blush, highlighter and eyeshadow are soft blooms (an ellipse fitted to the landmarks, fading to nothing at its
  // edge), not a polygon filled with a gradient: a polygon leaves visible straight edges.
  cheeks: {
    feather: 0.012,
    bloom: 1.35, // ellipse size relative to the landmark spread
    // "color" gives the blush its saturation, and on deep skin that reads far stronger than on light skin.
    skinScale: [{ blend: "color", deep: 0.4, light: 1 }],
    layers: [
      { blend: "soft-light", opacity: 0.35 },
      { blend: "color", opacity: 0.4 },
    ],
  },
  // Warmth at the temples and down the sides of the jaw (the "3" shape), not a band around the whole face. "soft-light"
  // and "color" leave a white or grey background alone, which "multiply" would tint.
  bronzer: {
    feather: 0.03,
    width: 0.075,
    inset: 0.1,
    skinScale: [{ blend: "*", deep: 1, light: 1.15 }],
    layers: [
      { blend: "soft-light", opacity: 0.4 },
      { blend: "color", opacity: 0.22 },
    ],
  },
  contour: {
    feather: 0.016,
    width: 0.028,
    extend: 0.6, // lengthen the line past its last landmark, as a fraction of its length
    skinScale: [{ blend: "*", deep: 1.6, light: 1 }],
    layers: [{ blend: "soft-light", opacity: 0.66 }],
  },
  highlighter: {
    feather: 0.016,
    width: 0.013,
    bloom: 1.7, // cheekbone patch size relative to its landmark spread
    skinScale: [{ blend: "*", deep: 1, light: 0.8 }],
    layers: [
      { blend: "screen", opacity: 0.48 },
      { blend: "soft-light", opacity: 0.4 },
    ],
  },
  eyeshadow: {
    feather: 0.015,
    bloom: 1.45,
    profile: [[0, 0.95], [0.6, 0.8], [1, 0]], // stays strong across the lid, fades only at the edge
    skinScale: [{ blend: "color", deep: 0.65, light: 1 }],
    layers: [
      { blend: "multiply", opacity: 0.6 },
      { blend: "color", opacity: 0.45 },
    ],
  },
  brows: {
    feather: 0.003,
    slim: 0.7, // fraction of the landmark brow thickness that is coloured
    layers: [
      { blend: "multiply", opacity: 0.25 },
      { blend: "color", opacity: 0.3 },
    ],
  },
  eyeliner: {
    feather: 0.0016,
    width: 0.042, // fraction of eye width
    wing: 0.18, // flick length, fraction of eye width
    layers: [{ blend: "source-over", opacity: 0.62 }],
  },
  mascara: {
    feather: 0.0012,
    width: 0.0011, // each lash, fraction of canvas width
    length: 0.15, // fraction of eye width
    density: 3, // lashes per gap between lid landmarks
    layers: [{ blend: "source-over", opacity: 0.6 }],
  },
  // Base products are drawn as a correction of the user's own skin (see baseCorrection): the shade is compared with the skin
  // sampled from the camera and the face is moved `coverage` of the way there, keeping texture and shadows. A shade that
  // matches the skin therefore changes almost nothing, a lighter / darker / warmer one visibly moves it. `tint` adds a
  // little opaque pigment (evens redness and blemishes). `layers` is the fallback until the skin has been measured; its
  // clip in REGION_GUARD keeps the tint off the wall or hair just outside the face.
  foundation: {
    feather: 0.03,
    reach: 1.03, // face outline grown by this factor (more at the top), so the tint blends into the hairline
    reachTop: 0.06,
    coverage: 0.62,
    maxShift: 14, // largest colour change (CIELAB dE) a mismatched shade may cause: visibly off, but never a mask
    tint: [{ blend: "source-over", opacity: 0.05 }],
    layers: [
      { blend: "color", opacity: 0.32 },
      { blend: "source-over", opacity: 0.08 },
      { blend: "soft-light", opacity: 0.1 },
    ],
  },
  concealer: {
    feather: 0.014,
    coverage: 0.6,
    maxShift: 14,
    tint: [{ blend: "source-over", opacity: 0.2 }], // actual cover: dark circles are darker than the cheek the shade matches
    layers: [
      { blend: "color", opacity: 0.4 },
      { blend: "source-over", opacity: 0.4 },
    ],
  },
  powder: {
    feather: 0.022,
    coverage: 0.3,
    maxShift: 8,
    tint: [{ blend: "source-over", opacity: 0.03 }],
    layers: [
      { blend: "soft-light", opacity: 0.16 },
      { blend: "color", opacity: 0.1 },
      { blend: "source-over", opacity: 0.04 },
    ],
  },
};

// Finish-specific changes merged over a region's settings. `specular` adds a soft shine highlight (lips). `layers`
// replaces the region's blend layers; `addLayers` keeps them and adds more (a sheen on top), so a product with no finish
// (or "matte") renders exactly as the region's default. Which finish a product gets: arProductMap.renderFinishFromText.
export const FINISH_OVERRIDES = {
  cheeks: {
    radiant: { addLayers: [{ blend: "screen", opacity: 0.08 }] },
    shimmer: { addLayers: [{ blend: "screen", opacity: 0.18 }] },
  },
  eyeshadow: {
    satin: { addLayers: [{ blend: "screen", opacity: 0.1 }] },
    shimmer: { addLayers: [{ blend: "screen", opacity: 0.24 }] },
  },
  highlighter: {
    shimmer: { addLayers: [{ blend: "screen", opacity: 0.2 }] },
  },
  lips: {
    sheer: {
      layers: [
        { blend: "source-over", opacity: 0.12 },
        { blend: "multiply", opacity: 0.2 },
        { blend: "color", opacity: 0.2 },
      ],
    },
    gloss: {
      layers: [
        { blend: "source-over", opacity: 0.2 },
        { blend: "multiply", opacity: 0.26 },
        { blend: "color", opacity: 0.22 },
      ],
      specular: 0.34,
    },
  },
};

export function settingsFor(region, finish, render = REGION_RENDER, skinL) {
  const base = render[region];
  const override = FINISH_OVERRIDES[region]?.[finish];
  const merged = override
    ? { ...base, ...override, layers: override.layers ?? [...base.layers, ...(override.addLayers ?? [])] }
    : base;
  if (skinL == null || !merged.skinScale) return merged;
  return { ...merged, layers: adaptLayers(merged.layers, merged.skinScale, skinTone(skinL)) };
}

// 0 for very deep skin (L* 25 and below) up to 1 for light skin (L* 70 and above).
export const skinTone = (L) => Math.min(1, Math.max(0, (L - 25) / 45));

// Scales layer opacities by a rule per blend ("*" = every layer): `deep` on the deepest skin, `light` on the lightest.
function adaptLayers(layers, rules, t) {
  return layers.map((layer) => {
    let m = 1;
    for (const r of rules) if (r.blend === "*" || r.blend === layer.blend) m *= r.deep + (r.light - r.deep) * t;
    return m === 1 ? layer : { ...layer, opacity: Math.min(1, layer.opacity * m) };
  });
}

// Skin color of the face in the camera frame, as CIELAB { L, a, b } (D65, the scale the backend and `user_lab` use): a few
// cheek pixels of a tiny copy of the frame, averaged in linear light, so the main canvas is never read back. Call every
// few frames and smooth the result. L* is the lightness; a* and b* give the undertone (red/green, yellow/blue).
const sampler = { canvas: null, ctx: null };
const CHEEK_SAMPLES = [205, 425, 50, 280];
export function sampleSkin(video, landmarks) {
  const W = 96;
  const H = 120;
  if (!sampler.ctx) {
    sampler.canvas = document.createElement("canvas");
    sampler.canvas.width = W;
    sampler.canvas.height = H;
    sampler.ctx = sampler.canvas.getContext("2d", { willReadFrequently: true });
  }
  sampler.ctx.drawImage(video, 0, 0, W, H);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const i of CHEEK_SAMPLES) {
    const x = Math.min(W - 3, Math.max(0, Math.round(landmarks[i].x * (W - 1)) - 1));
    const y = Math.min(H - 3, Math.max(0, Math.round(landmarks[i].y * (H - 1)) - 1));
    const d = sampler.ctx.getImageData(x, y, 3, 3).data;
    for (let k = 0; k < d.length; k += 4) {
      r += lin(d[k]);
      g += lin(d[k + 1]);
      b += lin(d[k + 2]);
      n += 1;
    }
  }
  return linearRgbToLab(r / n, g / n, b / n);
}

// Linear sRGB (0..1) to CIELAB, D65.
export function linearRgbToLab(r, g, b) {
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const fy = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const fz = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry

function coverTransform(videoW, videoH, canvasW, canvasH) {
  const videoAspect = videoW / videoH;
  const canvasAspect = canvasW / canvasH;
  if (videoAspect > canvasAspect) {
    const scale = canvasH / videoH;
    return { scale, offsetX: (videoW * scale - canvasW) / 2, offsetY: 0 };
  }
  const scale = canvasW / videoW;
  return { scale, offsetX: 0, offsetY: (videoH * scale - canvasH) / 2 };
}

/**
 * Maps a point in the video's pixel space onto the canvas, replicating CSS object-cover cropping and the
 * horizontal mirror the camera view has (MediaPipe runs on the raw, unmirrored frame).
 */
export function toCanvasSpace(px, py, videoW, videoH, canvasW, canvasH) {
  const { scale, offsetX, offsetY } = coverTransform(videoW, videoH, canvasW, canvasH);
  return [canvasW - (px * scale - offsetX), py * scale - offsetY];
}

function makeFrame(landmarks, videoW, videoH, canvasW, canvasH) {
  const px = (i) => toCanvasSpace(landmarks[i].x * videoW, landmarks[i].y * videoH, videoW, videoH, canvasW, canvasH);
  return {
    cw: canvasW,
    ch: canvasH,
    landmarks,
    px,
    pts: (ids) => ids.map(px),
    // Landmark set with no official order: sorted into a clean loop around its live centroid.
    ring: (ids) => orderRingByAngle(ids, landmarks).map(px),
  };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const centroid = (points) => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
];
// Lengthens an open line past its last point by `fraction` of its total length, in the direction of its last segment.
function extendLine(points, fraction) {
  if (!fraction || points.length < 2) return points;
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const segment = dist(a, b) || 1;
  const total = points.slice(1).reduce((sum, p, i) => sum + dist(points[i], p), 0);
  const k = (total * fraction) / segment;
  return [...points, [b[0] + (b[0] - a[0]) * k, b[1] + (b[1] - a[1]) * k]];
}
const shrink = (points, c, amount) => points.map(([x, y]) => [x + (c[0] - x) * amount, y + (c[1] - y) * amount]);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------------------------------------------------------
// Base products as a correction of the skin

// Per-channel gain that turns the skin color into the shade color (both as sRGB 0..1, so it is exact at the skin color and
// a close approximation around it). Canvas can apply a gain g with two blends: "multiply" by min(1, g) darkens, and
// "color-dodge" by 1 - 1/g lightens (it computes backdrop / (1 - source)). Both leave texture and shadows in place.
//
// How far the face moves is `coverage`, capped so the change never exceeds `maxShift` (CIELAB dE): a shade far from the
// user's skin still looks wrong, but does not turn the face into a mask. Returns the layers and the skin color the face
// has afterwards, so the next base product corrects from that instead of stacking on top of the original skin.
export function baseCorrection(skin, shadeHex, { coverage, maxShift = Infinity, tint = [] }) {
  const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const toSrgb = ({ L, a, b }) => {
    const fy = (L + 16) / 116;
    const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
    const X = 0.95047 * inv(fy + a / 500);
    const Y = inv(fy);
    const Z = 1.08883 * inv(fy - b / 200);
    return [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z].map((c) => encode(Math.min(1, Math.max(0, c))));
  };
  const decode = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  const shade = linearRgbToLab(...hexToRgb(shadeHex).map(decode));
  const gap = Math.hypot(shade.L - skin.L, shade.a - skin.a, shade.b - skin.b);
  const eff = gap > 0 ? Math.min(coverage, maxShift / gap) : coverage;
  const from = toSrgb(skin);
  const to = toSrgb(shade);
  const gain = to.map((t, i) => Math.min(2, Math.max(0.5, t / Math.max(from[i], 0.02))));
  const css = (values) => `rgb(${values.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(",")})`;
  const tinted = tint.reduce((left, layer) => left * (1 - layer.opacity), 1 - eff); // share of the old skin that is left
  const k = 1 - tinted;
  return {
    layers: [
      { blend: "multiply", opacity: eff, fill: css(gain.map((g) => Math.min(1, g))) },
      { blend: "color-dodge", opacity: eff, fill: css(gain.map((g) => Math.max(0, 1 - 1 / g))) },
      ...tint,
    ],
    skinAfter: { L: skin.L + (shade.L - skin.L) * k, a: skin.a + (shade.a - skin.a) * k, b: skin.b + (shade.b - skin.b) * k },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Path helpers

// Smooth closed loop: a quadratic curve through each edge midpoint rounds the corners of sparse landmark rings.
function tracePath(path, points) {
  if (points.length < 3) {
    points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
    return;
  }
  const start = mid(points[points.length - 1], points[0]);
  path.moveTo(start[0], start[1]);
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const m = mid(curr, points[(i + 1) % points.length]);
    path.quadraticCurveTo(curr[0], curr[1], m[0], m[1]);
  }
  path.closePath();
}

// Smooth open line through the points.
function traceLine(path, points) {
  path.moveTo(points[0][0], points[0][1]);
  if (points.length === 2) {
    path.lineTo(points[1][0], points[1][1]);
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1]);
    path.quadraticCurveTo(points[i][0], points[i][1], m[0], m[1]);
  }
  const last = points[points.length - 1];
  path.lineTo(last[0], last[1]);
}

// Shade color at full strength in the middle of a ring, fading to transparent at its edge.
function radialStyle(ctx, points, [r, g, b]) {
  const [cx, cy] = centroid(points);
  const radius = Math.max(1, ...points.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.7)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  return gradient;
}

// Whether this browser applies `ctx.filter` (Safari may not). Where it does not, `ctx.filter` is missing or ignored and
// the makeup would get hard edges, so the shadow fallback below is used instead. Checked once, on a separate canvas.
let canvasFilterSupport;
function supportsCanvasFilter() {
  if (canvasFilterSupport === undefined) {
    try {
      const probe = document.createElement("canvas").getContext("2d");
      if (!probe || typeof probe.filter !== "string") canvasFilterSupport = false;
      else {
        probe.filter = "blur(1px)";
        canvasFilterSupport = probe.filter === "blur(1px)";
      }
    } catch {
      canvasFilterSupport = false;
    }
  }
  return canvasFilterSupport;
}

// Draws `draw()` blurred by `radius` px. With ctx.filter: a blur filter. Without (Safari): the shape is drawn two canvas
// widths to the left, off screen, and only its blurred shadow lands in place. A shadow offset ignores the transform,
// and shadowBlur 2r matches blur(r). Blend mode, alpha and gradient fades apply to the shadow too.
function withFeather(ctx, radius, color, draw) {
  if (!(radius > 0)) {
    draw();
    return;
  }
  if (supportsCanvasFilter()) {
    ctx.filter = `blur(${radius}px)`;
    draw();
    ctx.filter = "none";
    return;
  }
  const offset = ctx.canvas.width * 2;
  ctx.save();
  ctx.translate(-offset, 0);
  ctx.shadowOffsetX = offset;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = radius * 2;
  ctx.shadowColor = color;
  draw();
  ctx.restore();
}

// Runs `draw` once per blend layer of the settings, with the feather blur applied. `color` is the shade being drawn
// (a layer's own `fill` wins); the Safari fallback needs it for the shadow.
function paintLayers(ctx, frame, settings, draw, color) {
  const feather = frame.cw * (settings.feather ?? 0);
  ctx.filter = "none";
  for (const layer of settings.layers) {
    if (!(layer.opacity > 0)) continue;
    ctx.globalCompositeOperation = layer.blend;
    ctx.globalAlpha = layer.opacity;
    withFeather(ctx, feather, layer.fill ?? color ?? "#000", () => draw(layer));
  }
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// Fills point sets. With `radial` each set fades out from its middle; otherwise all sets are one path (so
// "evenodd" can cut holes, e.g. the open mouth).
function fillShapes(ctx, frame, pointSets, color, settings, rule = "nonzero") {
  const rgb = hexToRgb(color);
  const makePath = (sets) => {
    const path = new Path2D();
    sets.forEach((points) => tracePath(path, points));
    return path;
  };
  const shapes = settings.radial
    ? pointSets.map((points) => ({ path: makePath([points]), style: radialStyle(ctx, points, rgb) }))
    : [{ path: makePath(pointSets), style: color }];
  paintLayers(ctx, frame, settings, (layer) => {
    for (const { path, style } of shapes) {
      ctx.fillStyle = layer.fill ?? style; // a layer can carry its own color (see baseCorrection)
      ctx.fill(path, rule);
    }
  }, color);
}

function strokeLines(ctx, frame, lines, color, settings, lineWidth) {
  const path = new Path2D();
  lines.forEach((points) => traceLine(path, points));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  paintLayers(ctx, frame, settings, () => ctx.stroke(path), color);
}

// Ellipse fitted to a set of points (principal axes of their spread), `k` times the spread.
function ellipseOf(points, k) {
  const [cx, cy] = centroid(points);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of points) {
    sxx += (x - cx) ** 2;
    sxy += (x - cx) * (y - cy);
    syy += (y - cy) ** 2;
  }
  const n = points.length;
  sxx /= n;
  sxy /= n;
  syy /= n;
  const half = (sxx + syy) / 2;
  const disc = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy ** 2));
  return { cx, cy, rx: k * Math.sqrt(half + disc), ry: k * Math.sqrt(Math.max(half - disc, 1e-6)), angle: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
}

// Soft blooms: each ellipse fades from the shade at its middle to transparent at its edge (settings.profile).
function fillBlooms(ctx, frame, ellipses, color, settings) {
  const [r, g, b] = hexToRgb(color);
  const profile = settings.profile ?? [[0, 1], [0.5, 0.7], [1, 0]];
  paintLayers(ctx, frame, settings, () => {
    for (const e of ellipses) {
      ctx.save();
      ctx.translate(e.cx, e.cy);
      ctx.rotate(e.angle);
      ctx.scale(e.rx, e.ry);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [offset, alpha] of profile) gradient.addColorStop(offset, `rgba(${r},${g},${b},${alpha})`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, color);
}

// ---------------------------------------------------------------------------------------------------------------
// Looks. Each takes (ctx, frame, color, settings).

// The four closed rings that must stay bare in base makeup: both eyes, both brows, the mouth.
function holesForBase(frame) {
  const browLeft = frame.ring([...EYEBROW_LEFT_A, ...EYEBROW_LEFT_B]);
  const browRight = frame.ring([...EYEBROW_RIGHT_A, ...EYEBROW_RIGHT_B]);
  return [frame.pts(EYE_LEFT), frame.pts(EYE_RIGHT), browLeft, browRight, frame.pts(LIPS_OUTER)];
}

// Face outline for base makeup, grown slightly (more on the forehead) so its edge sits in the hairline, not on the skin.
function faceOutline(frame, s) {
  const oval = frame.pts(FACE_OVAL);
  const [cx, cy] = centroid(oval);
  const reach = s.reach ?? 1;
  const reachTop = s.reachTop ?? 0;
  return oval.map(([x, y]) => {
    const k = reach + (y < cy ? reachTop : 0);
    return [cx + (x - cx) * k, cy + (y - cy) * k];
  });
}

// Positions in FACE_OVAL of the two bronzer arcs: from each temple down the side of the face to the jaw angle.
const BRONZER_ARCS = [[5, 6, 7, 8, 9, 10, 11], [31, 30, 29, 28, 27, 26, 25]];

// A base product's layers: the skin correction once the skin has been measured, else the plain tint. Products that tint
// the whole face (`global`: foundation, powder) leave frame.baseSkin as the face now looks, so the next base product
// only adds what is still missing; a local one (concealer) does not change it.
function baseSettings(s, color, frame, global) {
  if (!frame.baseSkin || !s.coverage) return s;
  const { layers, skinAfter } = baseCorrection(frame.baseSkin, color, s);
  if (global) frame.baseSkin = skinAfter;
  return { ...s, layers };
}

const LOOKS = {
  lips(ctx, frame, color, s) {
    const sets = [frame.pts(LIPS_OUTER), frame.pts(LIPS_INNER)];
    fillShapes(ctx, frame, sets, color, s, "evenodd");
    if (s.specular) drawLipShine(ctx, frame, s.specular);
  },

  lipLiner(ctx, frame, color, s) {
    // Pull the line slightly inside the lip edge so it never spills onto the skin and makes the lips look bigger.
    const outer = frame.pts(LIPS_OUTER);
    const line = shrink(outer, centroid(outer), s.inset ?? 0);
    strokeLines(ctx, frame, [[...line, line[0]]], color, s, frame.cw * s.width);
  },

  cheeks(ctx, frame, color, s) {
    fillBlooms(ctx, frame, [CHEEK_LEFT, CHEEK_RIGHT].map((ids) => ellipseOf(frame.pts(ids), s.bloom)), color, s);
  },

  // Warmth around the edge of the face (temples, jaw) plus the hollow under the cheekbone.
  bronzer(ctx, frame, color, s) {
    const oval = frame.pts(FACE_OVAL);
    const c = centroid(oval);
    const arcs = BRONZER_ARCS.map((positions) => shrink(positions.map((i) => oval[i]), c, s.inset));
    strokeLines(ctx, frame, arcs, color, s, frame.cw * s.width);
  },

  // Shadow in the hollow under each cheekbone, slanting from the ear towards the mouth corner.
  contour(ctx, frame, color, s) {
    const lines = [CONTOUR_LEFT, CONTOUR_RIGHT].map((ids) => extendLine(frame.pts(ids), s.extend ?? 0));
    strokeLines(ctx, frame, lines, color, s, frame.cw * s.width);
  },

  // Light on the top of each cheekbone and down the bridge of the nose.
  highlighter(ctx, frame, color, s) {
    fillBlooms(ctx, frame, [CHEEKBONE_LEFT, CHEEKBONE_RIGHT].map((ids) => ellipseOf(frame.pts(ids), s.bloom)), color, s);
    strokeLines(ctx, frame, [frame.pts(NOSE_BRIDGE)], color, { ...s, layers: s.layers.map((l) => ({ ...l, opacity: l.opacity * 0.8 })) }, frame.cw * s.width);
  },

  eyeshadow(ctx, frame, color, s) {
    // Upper lash line arc plus the eyebrow ring that sits closer to the eye, sorted into a closed blob.
    const lm = frame.landmarks;
    const browLeft = pickCloserRing(EYEBROW_LEFT_A, EYEBROW_LEFT_B, lm);
    const browRight = pickCloserRing(EYEBROW_RIGHT_A, EYEBROW_RIGHT_B, lm);
    const left = frame.pts([...upperArc(EYE_LEFT, lm), ...browLeft]);
    const right = frame.pts([...upperArc(EYE_RIGHT, lm), ...browRight]);
    fillBlooms(ctx, frame, [ellipseOf(left, s.bloom), ellipseOf(right, s.bloom)], color, s);
  },

  // Each brow is two 5-point edges whose points pair up by index (outer to inner). Walking one edge and back along the
  // other gives an ordered outline; slimming it towards the centre line keeps the colour on the hair itself.
  brows(ctx, frame, color, s) {
    const outline = (a, b) => {
      const edgeA = frame.pts(a);
      const edgeB = frame.pts(b);
      const slim = (p, q) => [(p[0] + q[0]) / 2 + ((p[0] - q[0]) / 2) * s.slim, (p[1] + q[1]) / 2 + ((p[1] - q[1]) / 2) * s.slim];
      return [...edgeA.map((p, i) => slim(p, edgeB[i])), ...edgeB.map((p, i) => slim(p, edgeA[i])).reverse()];
    };
    fillShapes(ctx, frame, [outline(EYEBROW_LEFT_A, EYEBROW_LEFT_B), outline(EYEBROW_RIGHT_A, EYEBROW_RIGHT_B)], color, s);
  },

  // Line along the upper lashes, with a small flick past the outer corner.
  eyeliner(ctx, frame, color, s) {
    for (const ids of [EYE_LEFT_UPPER, EYE_RIGHT_UPPER]) {
      const lid = frame.pts(ids);
      const outer = lid[0];
      const inner = lid[lid.length - 1];
      const eyeW = dist(outer, inner);
      strokeLines(ctx, frame, [lid], color, s, eyeW * s.width);
      if (s.wing > 0) {
        // Flick direction: away from the inner corner, tilted up.
        const dx = (outer[0] - inner[0]) / eyeW;
        const dy = (outer[1] - inner[1]) / eyeW;
        // Tilted upwards on both eyes (the camera view is mirrored, so the outer corner is on either side).
        const tip = [outer[0] + dx * eyeW * s.wing, outer[1] + (dy - Math.abs(dx) * 0.35) * eyeW * s.wing];
        const base = lid[1];
        const wing = new Path2D();
        wing.moveTo(outer[0], outer[1]);
        wing.lineTo(tip[0], tip[1]);
        wing.lineTo(base[0], base[1] - eyeW * s.width * 0.4);
        wing.closePath();
        paintLayers(ctx, frame, s, () => {
          ctx.fillStyle = color;
          ctx.fill(wing);
        }, color);
      }
    }
  },

  // A darker lash line plus short curled strokes fanning out of it. Length varies from lash to lash.
  mascara(ctx, frame, color, s) {
    for (const ids of [EYE_LEFT_UPPER, EYE_RIGHT_UPPER]) {
      const lid = frame.pts(ids);
      const outerCorner = lid[0];
      const eyeW = dist(outerCorner, lid[lid.length - 1]);
      const center = centroid(lid);
      const roots = [];
      for (let i = 0; i < lid.length - 1; i++) {
        for (let k = 0; k < s.density; k++) {
          const t = k / s.density;
          roots.push([lid[i][0] + (lid[i + 1][0] - lid[i][0]) * t, lid[i][1] + (lid[i + 1][1] - lid[i][1]) * t]);
        }
      }
      const path = new Path2D();
      roots.forEach((p, i) => {
        const along = i / (roots.length - 1); // 0 outer corner .. 1 inner corner
        if (along < 0.04 || along > 0.96) return; // no lashes right in the corners
        let vx = p[0] - center[0];
        let vy = p[1] - center[1] - eyeW * 0.4; // fan upwards
        const norm = Math.hypot(vx, vy) || 1;
        vx /= norm;
        vy /= norm;
        const profile = 0.55 + 0.45 * Math.sin(along * Math.PI); // longest in the middle
        const jitter = 0.8 + 0.2 * Math.sin(i * 2.7);
        const length = eyeW * s.length * profile * jitter;
        // Curl: the lash bends towards the outer corner as it rises.
        const toOuter = [outerCorner[0] - center[0], outerCorner[1] - center[1]];
        const toOuterNorm = Math.hypot(toOuter[0], toOuter[1]) || 1;
        const tip = [p[0] + vx * length + (toOuter[0] / toOuterNorm) * length * 0.25, p[1] + vy * length + (toOuter[1] / toOuterNorm) * length * 0.1];
        const control = [p[0] + vx * length * 0.55, p[1] + vy * length * 0.55];
        path.moveTo(p[0], p[1]);
        path.quadraticCurveTo(control[0], control[1], tip[0], tip[1]);
      });
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, frame.cw * s.width);
      ctx.strokeStyle = color;
      paintLayers(ctx, frame, s, () => ctx.stroke(path), color);
      strokeLines(ctx, frame, [lid], color, s, eyeW * 0.045);
    }
  },

  // Skin tone over the whole face, leaving eyes, brows and mouth bare.
  foundation(ctx, frame, color, s) {
    fillShapes(ctx, frame, [faceOutline(frame, s), ...holesForBase(frame)], color, baseSettings(s, color, frame, true), "evenodd");
  },

  // Patches under the eyes (and beside the nose) to cover shadows.
  concealer(ctx, frame, color, s) {
    const patches = [];
    for (const ids of [EYE_LEFT_LOWER, EYE_RIGHT_LOWER]) {
      const lid = frame.pts(ids);
      const eyeW = dist(lid[0], lid[lid.length - 1]);
      const drop = eyeW * 0.5;
      const lower = lid.slice(1, -1);
      patches.push([...lower, ...lower.map(([x, y]) => [x, y + drop]).reverse()]);
    }
    fillShapes(ctx, frame, patches, color, baseSettings(s, color, frame, false));
  },

  // Translucent finishing layer over the face: evens tone, no visible color.
  powder(ctx, frame, color, s) {
    fillShapes(ctx, frame, [faceOutline(frame, s), ...holesForBase(frame)], color, baseSettings(s, color, frame, true), "evenodd");
  },
};

// Soft white shine on the middle of each lip: a radial gradient that fades to nothing (no edge), clipped to the lips by
// the region guard.
function drawLipShine(ctx, frame, strength) {
  const lm = frame.px;
  const left = lm(61);
  const right = lm(291);
  const mouthW = dist(left, right);
  const spots = [
    { c: mid(lm(17), lm(14)), w: mouthW * 0.26, h: mouthW * 0.07, a: 1 }, // lower lip
    { c: mid(lm(0), lm(13)), w: mouthW * 0.18, h: mouthW * 0.045, a: 0.55 }, // upper lip
  ];
  ctx.globalCompositeOperation = "source-over";
  for (const { c, w, h, a } of spots) {
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(w, h);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = strength * a;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Where each region may paint, so makeup never tints what it should not: the eyeballs, the inside of the mouth, the
// hair and the background. `face` clips to the face outline grown by that factor (base layers fade out at their own
// soft edge, so they get a looser clip); `eyes` and `mouth` cut holes ("all" = the lips as well, for skin products).
const SKIN_GUARD = { face: 1.0, eyes: 1.06, mouth: "all" };
const BASE_GUARD = { face: 1.07, faceTop: 0.06, eyes: 1.06, mouth: "all" };
const REGION_GUARD = {
  foundation: BASE_GUARD,
  powder: BASE_GUARD,
  concealer: { ...BASE_GUARD, face: 1.04 },
  bronzer: SKIN_GUARD,
  contour: SKIN_GUARD,
  cheeks: SKIN_GUARD,
  highlighter: SKIN_GUARD,
  eyeshadow: { eyes: 1.0 },
  lips: { mouth: "inner", lipEdge: 0.012 },
  lipLiner: { mouth: "inner", lipEdge: 0.012 },
};

// Moves every point of an outline away from its centre by about `d` pixels (x and y scaled separately, so a wide, flat
// shape such as the lips grows by the same amount on all sides).
function growByDistance(points, d) {
  const [cx, cy] = centroid(points);
  const halfW = Math.max(1, (Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]))) / 2);
  const halfH = Math.max(1, (Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]))) / 2);
  return points.map(([x, y]) => [cx + (x - cx) * (1 + d / halfW), cy + (y - cy) * (1 + d / halfH)]);
}

function growAbout(points, factor, topExtra = 0) {
  const [cx, cy] = centroid(points);
  return points.map(([x, y]) => {
    const k = factor + (y < cy ? topExtra : 0);
    return [cx + (x - cx) * k, cy + (y - cy) * k];
  });
}

function applyGuard(ctx, frame, guard) {
  if (guard.face) {
    const path = new Path2D();
    tracePath(path, growAbout(frame.pts(FACE_OVAL), guard.face, guard.faceTop ?? 0));
    ctx.clip(path);
  }
  if (guard.lipEdge) {
    // Lip color stops at the lip outline (plus a small margin, as a share of the mouth width), so the feathered edge cannot
    // bleed onto the skin around the mouth.
    const outer = frame.pts(LIPS_OUTER);
    const path = new Path2D();
    tracePath(path, growByDistance(outer, guard.lipEdge * dist(frame.px(61), frame.px(291))));
    ctx.clip(path);
  }
  const holes = [];
  if (guard.eyes) for (const ids of [EYE_LEFT, EYE_RIGHT]) holes.push(growAbout(frame.pts(ids), guard.eyes));
  if (guard.mouth === "all") holes.push(growAbout(frame.pts(LIPS_OUTER), 1.04));
  if (guard.mouth === "inner") holes.push(growAbout(frame.pts(LIPS_INNER), 0.96));
  if (holes.length) {
    const path = new Path2D();
    path.rect(0, 0, frame.cw, frame.ch);
    holes.forEach((points) => tracePath(path, points));
    ctx.clip(path, "evenodd");
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Skin gate. Base makeup is clipped to the face outline, but the outline is only approximately where the skin ends: a
// white wall, a curtain, hair or a beard just inside it would be tinted too. So, in the band near the outline, every
// pixel is compared with the user's own cheek color (chroma plus brightness, at low resolution), and where it is not
// skin the original pixels are put back. The inside of the face is never gated, so shine and shadows keep their makeup.

const SKIN_GROUP = new Set(["foundation", "concealer", "powder", "bronzer", "contour", "cheeks", "highlighter"]);
const GATE_SCALE = 5; // the mask is computed at 1/5 resolution
const GATE_NEAR = 16; // colour distance below which a pixel is certainly skin
const GATE_FAR = 30; // and above which it certainly is not
const GATE_CORE = 0.82; // inside this fraction of the face outline everything counts as skin (feathered edge)
const GATE_EVERY = 2; // the mask is refreshed every 2nd frame: the background moves little between frames
const gate = { small: null, sctx: null, layer: null, lctx: null, tick: 0 };

function ensureCanvas(slot, w, h, readback) {
  if (!gate[slot] || gate[slot].width !== w || gate[slot].height !== h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    gate[slot] = canvas;
    gate[slot === "small" ? "sctx" : "lctx"] = canvas.getContext("2d", { willReadFrequently: readback });
  }
  return gate[slot === "small" ? "sctx" : "lctx"];
}

const yCbCr = (r, g, b) => [0.299 * r + 0.587 * g + 0.114 * b, 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b];

// Draws the camera frame like the main canvas does (mirrored, object-cover), at any size.
function drawCameraFrame(ctx, video, videoW, videoH, w, h) {
  const { scale, offsetX, offsetY } = coverTransform(videoW, videoH, w, h);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -(-offsetX + videoW * scale), -offsetY, videoW * scale, videoH * scale);
  ctx.restore();
}

// Alpha mask (a small canvas): 1 where the pixel counts as skin, 0 where the original pixel must be restored.
function buildSkinMask(video, landmarks, videoW, videoH, cw, ch) {
  const sw = Math.max(32, Math.round(cw / GATE_SCALE));
  const sh = Math.max(40, Math.round(ch / GATE_SCALE));
  const ctx = ensureCanvas("small", sw, sh, true);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, sw, sh);
  drawCameraFrame(ctx, video, videoW, videoH, sw, sh);
  const image = ctx.getImageData(0, 0, sw, sh);
  const data = image.data;
  const at = (i) => toCanvasSpace(landmarks[i].x * videoW, landmarks[i].y * videoH, videoW, videoH, sw, sh);

  // The user's skin colour: a few cheek pixels.
  let ref = [0, 0, 0];
  let n = 0;
  for (const i of CHEEK_SAMPLES) {
    const [cx, cy] = at(i);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = Math.min(sw - 1, Math.max(0, Math.round(cx) + dx));
        const y = Math.min(sh - 1, Math.max(0, Math.round(cy) + dy));
        const k = (y * sw + x) * 4;
        const c = yCbCr(data[k], data[k + 1], data[k + 2]);
        ref = [ref[0] + c[0], ref[1] + c[1], ref[2] + c[2]];
        n += 1;
      }
    }
  }
  ref = ref.map((v) => v / n);

  for (let k = 0; k < data.length; k += 4) {
    const [Y, Cb, Cr] = yCbCr(data[k], data[k + 1], data[k + 2]);
    const d = Math.hypot(Cb - ref[1], Cr - ref[2], 0.25 * (Y - ref[0]));
    const alpha = d <= GATE_NEAR ? 1 : d >= GATE_FAR ? 0 : 1 - (d - GATE_NEAR) / (GATE_FAR - GATE_NEAR);
    data[k] = 0;
    data[k + 1] = 0;
    data[k + 2] = 0;
    data[k + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(image, 0, 0);

  // The core of the face is always skin. Its edge is feathered, so a tint that does reach a non-skin area inside the
  // outline (a hand or curtain over the face) fades out instead of ending in a visible outline.
  const oval = FACE_OVAL.map(at);
  const core = growAbout(oval, GATE_CORE);
  const path = new Path2D();
  tracePath(path, core);
  ctx.save();
  ctx.fillStyle = "#000";
  withFeather(ctx, Math.max(1, sw * 0.035), "#000", () => ctx.fill(path));
  ctx.restore();
  return gate.small;
}

// Puts the original (non-skin) pixels back over whatever the skin group painted on them. Only the box around the face
// is processed: the rest of the canvas was never painted.
function restoreNonSkin(ctx, frame, video, mask, videoW, videoH) {
  const { cw, ch } = frame;
  const outline = growAbout(frame.pts(FACE_OVAL), 1.2, 0.05);
  const x0 = Math.max(0, Math.floor(Math.min(...outline.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...outline.map((p) => p[1]))));
  const x1 = Math.min(cw, Math.ceil(Math.max(...outline.map((p) => p[0]))));
  const y1 = Math.min(ch, Math.ceil(Math.max(...outline.map((p) => p[1]))));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw < 8 || bh < 8) return;
  const l = ensureCanvas("layer", cw, ch, false);
  l.save();
  l.beginPath();
  l.rect(x0, y0, bw, bh);
  l.clip();
  l.globalCompositeOperation = "source-over";
  l.clearRect(x0, y0, bw, bh);
  drawCameraFrame(l, video, videoW, videoH, cw, ch);
  l.globalCompositeOperation = "destination-out";
  l.filter = `blur(${cw * 0.004}px)`;
  l.drawImage(mask, 0, 0, cw, ch);
  l.filter = "none";
  l.restore();
  ctx.drawImage(gate.layer, x0, y0, bw, bh, x0, y0, bw, bh);
}

/**
 * Draws all selected looks, in DRAW_ORDER.
 * @param colors   { region: "#hex" }, a region with no color is skipped
 * @param toggles  { region: boolean }, a region is drawn unless explicitly false
 * @param finishes { region: finishKey } optional
 */
export function drawLooks(ctx, landmarks, videoW, videoH, canvasW, canvasH, { colors, toggles, finishes, render = REGION_RENDER, skin, video }) {
  const frame = makeFrame(landmarks, videoW, videoH, canvasW, canvasH);
  frame.baseSkin = skin ?? null; // the skin as the base products have left it (see baseSettings)
  const active = DRAW_ORDER.filter((region) => colors[region] && toggles?.[region] !== false);
  // The skin gate runs once, right after the last skin-group region (eyes and lips are not gated).
  const lastSkin = video ? [...active].reverse().find((region) => SKIN_GROUP.has(region)) : null;
  let skinMask = null;
  if (lastSkin) {
    const stale = !gate.small || gate.small.width !== Math.max(32, Math.round(canvasW / GATE_SCALE));
    if (stale || gate.tick++ % GATE_EVERY === 0) buildSkinMask(video, landmarks, videoW, videoH, canvasW, canvasH);
    skinMask = gate.small;
  }
  for (const region of DRAW_ORDER) {
    const color = colors[region];
    if (!color || toggles?.[region] === false) continue;
    ctx.save();
    if (REGION_GUARD[region]) applyGuard(ctx, frame, REGION_GUARD[region]);
    LOOKS[region](ctx, frame, color, settingsFor(region, finishes?.[region], render, skin?.L));
    ctx.restore();
    if (region === lastSkin) restoreNonSkin(ctx, frame, video, skinMask, videoW, videoH);
  }
}
