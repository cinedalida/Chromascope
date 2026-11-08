// How well a shade suits the signed-in user, for ranking the AR Browse list (Recommended is ranked by the backend).
//
// This mirrors backend/app/core/color_matching.py so both tabs agree on what "a good match" is:
//  - harmony regions (lips, lip liner, blush, eyeshadow): the season classifier's score for the user's season. The
//    scores are precomputed per shade by backend/scripts/add_shade_season_scores.py and stored as `ss`.
//  - skin regions (foundation, concealer, powder, bronzer, contour, highlighter): CIEDE2000 distance from the shade to the
//    user's skin tone, shifted deeper or lighter where the product should be (a bronzer sits darker than the skin).
//  - brows, eyeliner, mascara: no color target, so no fit.

// Order of `ss`: must match SEASON_ORDER in add_shade_season_scores.py.
export const SEASON_ORDER = [
  "sp-light", "sp-true", "sp-bright", "su-light", "su-true", "su-soft",
  "au-soft", "au-true", "au-deep", "wi-deep", "wi-true", "wi-bright",
];

// Labels the season model outputs (and older ones for the "true" seasons) -> code.
const SEASON_CODE_BY_LABEL = {
  "light spring": "sp-light", "warm spring": "sp-true", "true spring": "sp-true", "bright spring": "sp-bright",
  "light summer": "su-light", "cool summer": "su-true", "true summer": "su-true", "soft summer": "su-soft",
  "soft autumn": "au-soft", "warm autumn": "au-true", "true autumn": "au-true", "deep autumn": "au-deep",
  "deep winter": "wi-deep", "cool winter": "wi-true", "true winter": "wi-true", "bright winter": "wi-bright",
};

export const REGION_BASIS = {
  lips: "harmony", lipLiner: "harmony", cheeks: "harmony", eyeshadow: "harmony",
  foundation: "skin", concealer: "skin", powder: "skin", bronzer: "skin", contour: "skin", highlighter: "skin",
  brows: "neutral", eyeliner: "neutral", mascara: "neutral",
};

// How much lighter (+) or deeper (-) than the user's skin the shade should be, in L*.
export const SKIN_TARGET_L_SHIFT = { foundation: 0, powder: 0, concealer: 3, bronzer: -10, contour: -14, highlighter: 10 };

const SKIN_SIGMA = 5;
// fit >= 0.75 "great", >= 0.55 "good" (shown to the user); >= 0.35 fair, otherwise low (not shown).
const FIT_TIERS = [[0.75, "great"], [0.55, "good"], [0.35, "fair"]];
const SHOWN_TIERS = new Set(["great", "good"]);

export function seasonCodeFor(label) {
  return SEASON_CODE_BY_LABEL[String(label ?? "").trim().toLowerCase()] ?? null;
}

export function tierFor(fit) {
  for (const [minimum, name] of FIT_TIERS) if (fit >= minimum) return name;
  return "low";
}

/** CIEDE2000 colour difference between two [L, a, b] colors, rounded to 2 decimals like the backend. */
export function deltaE2000(lab1, lab2) {
  if (!lab1 || !lab2) return 999;
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cavg = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cavg ** 7 / (Cavg ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const mod360 = (x) => ((x % 360) + 360) % 360;
  const h1p = mod360(deg(Math.atan2(b1, a1p)));
  const h2p = mod360(deg(Math.atan2(b2, a2p)));
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lpavg = (L1 + L2) / 2;
  const Cpavg = (C1p + C2p) / 2;
  let hpavg;
  if (C1p * C2p === 0) hpavg = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hpavg = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hpavg = (h1p + h2p + 360) / 2;
  else hpavg = (h1p + h2p - 360) / 2;
  const T =
    1 - 0.17 * Math.cos(rad(hpavg - 30)) + 0.24 * Math.cos(rad(2 * hpavg)) +
    0.32 * Math.cos(rad(3 * hpavg + 6)) - 0.2 * Math.cos(rad(4 * hpavg - 63));
  const SL = 1 + (0.015 * (Lpavg - 50) ** 2) / Math.sqrt(20 + (Lpavg - 50) ** 2);
  const SC = 1 + 0.045 * Cpavg;
  const SH = 1 + 0.015 * Cpavg * T;
  // Rotation term for the blue region (hue ~275 degrees); without it this is not CIEDE2000.
  const dTheta = 30 * Math.exp(-(((hpavg - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cpavg ** 7 / (Cpavg ** 7 + 25 ** 7));
  const RT = -Math.sin(rad(2 * dTheta)) * RC;
  const d = Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
  return Math.round(d * 100) / 100;
}

/** The user's colors from their profile: { seasonCode, skinLab }, either may be null. */
export function userColors(profile) {
  const lab = Array.isArray(profile?.user_lab) ? profile.user_lab.map(Number) : null;
  return {
    seasonCode: seasonCodeFor(profile?.seasonal_label),
    skinLab: lab && lab.length === 3 && lab.every(Number.isFinite) ? lab : null,
  };
}

/** Fit 0..1 of one Browse shade item for this user, or null when it cannot be scored. */
export function fitForShade(item, colors) {
  const basis = REGION_BASIS[item.region];
  if (basis === "harmony") {
    const index = colors.seasonCode ? SEASON_ORDER.indexOf(colors.seasonCode) : -1;
    const score = Array.isArray(item.ss) ? item.ss[index] : undefined;
    return index >= 0 && Number.isFinite(score) ? score / 100 : null;
  }
  if (basis === "skin") {
    const lab = Array.isArray(item.lab) && item.lab.length === 3 && item.lab.every(Number.isFinite) ? item.lab : null;
    if (!colors.skinLab || !lab) return null;
    const target = [colors.skinLab[0] + SKIN_TARGET_L_SHIFT[item.region], colors.skinLab[1], colors.skinLab[2]];
    const d = deltaE2000(target, lab);
    return Math.exp(-(d ** 2) / (2 * SKIN_SIGMA ** 2));
  }
  return null;
}

const byFitDesc = (a, b) => (a === null) - (b === null) || (a !== null ? b - a : 0);

/**
 * Orders Browse shades best fit first for this user. Shades are ordered within each product, then products by their
 * best shade (so a product's first shade is the one to try). Shades without a fit keep their order, after the scored ones.
 * Returns { items, ranked }; `ranked` is false (and the list untouched) when the user has no season / skin tone yet.
 */
export function rankBrowseItems(items, profile) {
  const colors = userColors(profile);
  const scored = items.map((item) => {
    const fit = fitForShade(item, colors);
    const tier = fit === null ? null : tierFor(fit);
    return { ...item, fit, fitTier: SHOWN_TIERS.has(tier) ? tier : null };
  });
  if (!scored.some((item) => item.fit !== null)) return { items, ranked: false };

  const products = new Map(); // product url -> shades, in first-seen order
  for (const item of scored) {
    const key = `browse:${item.url}`;
    if (!products.has(key)) products.set(key, []);
    products.get(key).push(item);
  }
  const ordered = [...products.values()].map((shades) => shades.sort((a, b) => byFitDesc(a.fit, b.fit)));
  ordered.sort((a, b) => byFitDesc(a[0].fit, b[0].fit));
  return { items: ordered.flat(), ranked: true };
}
