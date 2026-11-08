// Look definitions for the AR QA matrix: one representative shade per makeup region, then stacks.
// Shape matches window.__arLab.render({ colors, finishes }). Hex values are typical store shades.
export const LOOKS = {
  lips: "#b03060",
  lipLiner: "#8a2a40",
  cheeks: "#e07a8a",
  bronzer: "#b07a55",
  contour: "#8a6a5a",
  highlighter: "#f3d9b8",
  eyeshadow: "#8a5a7a",
  brows: "#4a3426",
  eyeliner: "#1a1a1a",
  mascara: "#111111",
  foundation: "#d9b08c",
  concealer: "#e0b894",
  powder: "#e8cdb0",
};

const pick = (...regions) => ({ colors: Object.fromEntries(regions.map((r) => [r, LOOKS[r]])), finishes: {} });

export const SOLO = Object.fromEntries(Object.keys(LOOKS).map((r) => [r, pick(r)]));
// Lips in the other finishes the renderer knows about.
SOLO.lips_gloss = { colors: { lips: LOOKS.lips }, finishes: { lips: "gloss" } };
SOLO.lips_sheer = { colors: { lips: LOOKS.lips }, finishes: { lips: "sheer" } };
// Shade extremes for lips: a nude, a deep berry and a bright red.
SOLO.lips_nude = { colors: { lips: "#c99a8b" }, finishes: {} };
SOLO.lips_berry = { colors: { lips: "#5a1030" }, finishes: {} };
SOLO.lips_red = { colors: { lips: "#d0101e" }, finishes: {} };

// Finishes outside the lips: shimmer must read brighter than matte, and a product with no finish renders as the default.
for (const region of ["cheeks", "eyeshadow", "highlighter"]) {
  SOLO[`fin_${region}_matte`] = { colors: { [region]: LOOKS[region] }, finishes: { [region]: "matte" } };
  SOLO[`fin_${region}_shimmer`] = { colors: { [region]: LOOKS[region] }, finishes: { [region]: "shimmer" } };
}
SOLO.fin_cheeks_radiant = { colors: { cheeks: LOOKS.cheeks }, finishes: { cheeks: "radiant" } };
SOLO.fin_eyeshadow_satin = { colors: { eyeshadow: LOOKS.eyeshadow }, finishes: { eyeshadow: "satin" } };

export const STACKS = {
  // Overlap-prone pairs and groups.
  face_contour_blush: pick("cheeks", "bronzer", "contour"),
  face_sculpt: pick("cheeks", "bronzer", "contour", "highlighter"),
  base_plus_sculpt: pick("foundation", "concealer", "powder", "cheeks", "bronzer", "contour", "highlighter"),
  eyes_all: pick("eyeshadow", "eyeliner", "mascara", "brows"),
  lips_all: pick("lips", "lipLiner"),
  // Everything at once.
  full_face: pick(...Object.keys(LOOKS)),
};

// CIELAB (D65) to #RRGGBB, for building shades relative to a photo's measured skin color.
export function labToHex({ L, a, b }) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = 0.95047 * inv(fx);
  const Y = inv(fy);
  const Z = 1.08883 * inv(fz);
  const lin = [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z];
  const enc = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
  return "#" + lin.map((c) => enc(c).toString(16).padStart(2, "0")).join("");
}

// Base-product experiments built from the photo's own skin: a matching shade must barely change the face, a lighter or
// darker one must move it the right way. `skin` is { L, a, b }.
export function baseSets(skin) {
  const shade = (dL = 0, da = 0, db = 0) => labToHex({ L: skin.L + dL, a: skin.a + da, b: skin.b + db });
  const one = (region, hex) => ({ colors: { [region]: hex }, finishes: {} });
  return {
    fnd_matched: one("foundation", shade()),
    fnd_light: one("foundation", shade(12)),
    fnd_dark: one("foundation", shade(-12)),
    fnd_warm: one("foundation", shade(0, 2, 9)),
    fnd_cool: one("foundation", shade(0, 5, -8)),
    pwd_matched: one("powder", shade()),
    cnc_matched: one("concealer", shade(3)),
  };
}

// Stacks a user who picked well would build: every skin product in a shade chosen for THIS skin (the same targets the
// recommender uses: bronzer ~10 L* deeper, contour ~14 deeper, highlighter ~10 lighter, concealer ~3 lighter), plus the
// usual eye and lip products. Everything should read as makeup on the user, never as a mask.
export function matchedStacks(skin) {
  const shade = (dL = 0, da = 0, db = 0) => labToHex({ L: skin.L + dL, a: skin.a + da, b: skin.b + db });
  const base = { foundation: shade(), concealer: shade(3), powder: shade() };
  const sculpt = { cheeks: LOOKS.cheeks, bronzer: shade(-10, 2, 4), contour: shade(-14, 0, 2), highlighter: shade(10, 1, 6) };
  const eyes = { eyeshadow: LOOKS.eyeshadow, brows: LOOKS.brows, eyeliner: LOOKS.eyeliner, mascara: LOOKS.mascara };
  const lips = { lips: LOOKS.lips, lipLiner: LOOKS.lipLiner };
  const set = (...parts) => ({ colors: Object.assign({}, ...parts), finishes: {} });
  return {
    stackm_base: set(base),
    stackm_sculpt: set(sculpt),
    stackm_base_sculpt: set(base, sculpt),
    stackm_full: set(base, sculpt, eyes, lips),
  };
}
