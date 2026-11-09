// Single source of truth for "which AR region can this product be tried on in".
//
// products_v2 sub_category values are raw scraper strings ("Eye shadow", "Lip stain & tint") and about 20% are
// composites joined with ";" ("Blush;Highlighter & illuminator"). Each token is looked up in TOKEN_REGION; for a
// composite, the first token that maps to an ENABLED region wins.

// Regions the AR renderer can draw right now. Each rendering stage adds its regions here.
export const ENABLED_REGIONS = new Set([
  "lips",
  "lipLiner",
  "cheeks",
  "bronzer",
  "contour",
  "highlighter",
  "eyeshadow",
  "brows",
  "eyeliner",
  "mascara",
  "foundation",
  "concealer",
  "powder",
]);

// Normalized sub_category token -> region. Tokens that map to a region not (yet) in ENABLED_REGIONS are ignored.
const TOKEN_REGION = {
  // lips
  "lipstick": "lips",
  "lip color": "lips",
  "lip stain & tint": "lips",
  "lip gloss": "lips",
  "lip balm": "lips",
  "lip plumper": "lips",
  "lip liner": "lipLiner",
  // cheeks
  "blush": "cheeks",
  "bronzer": "bronzer",
  "contour": "contour",
  "highlighter": "highlighter",
  "highlighter & illuminator": "highlighter",
  // eyes
  "eyeshadow": "eyeshadow",
  "eye shadow": "eyeshadow",
  "eyeshadow palette": "eyeshadow",
  "eyeliner": "eyeliner",
  "eyebrows": "brows",
  "brow": "brows",
  "mascara": "mascara",
  // base
  "foundation": "foundation",
  "liquid foundation": "foundation",
  "powder foundation": "foundation",
  "tinted moisturiser": "foundation",
  "bb & cc cream": "foundation",
  "concealer": "concealer",
  "under eye concealer": "concealer",
  "powder": "powder",
  // "face primer" is deliberately absent: it has no visible color to show.
};

const normalize = (value) => String(value ?? "").trim().toLowerCase();

// { region, token } for a sub_category string (possibly a ";" composite), or null when it can't be tried on.
function resolveSubCategory(subCategory) {
  for (const raw of String(subCategory ?? "").split(";")) {
    const token = normalize(raw);
    const region = TOKEN_REGION[token];
    if (region && ENABLED_REGIONS.has(region)) return { region, token };
  }
  return null;
}

export function regionForSubCategory(subCategory) {
  return resolveSubCategory(subCategory)?.region ?? null;
}

// Region for a whole product. The scraper files some bronzers under "Powder" (e.g. "Smooth Blur Bronzer" exists as both
// Bronzer and Face > Powder). A powder-category product whose name says bronzer is a bronzer, not a face-wide powder.
export function regionForProduct(product) {
  const region = regionForSubCategory(product?.sub_category);
  if (region === "powder" && /bronz/i.test(product?.product_name ?? "") && ENABLED_REGIONS.has("bronzer")) return "bronzer";
  return region;
}

// How a region's makeup is drawn ("gloss", "sheer", ...; see FINISH_OVERRIDES in arRenderer.js), from the free-text
// finish of a Browse shade ("Matte, Satin, Natural"). Undefined means the region's default look.
export function renderFinishFromText(region, finishText) {
  const text = normalize(finishText);
  if (!text) return undefined;
  if (region === "lips") {
    if (/gloss|shiny|wet|high.?shine|plump/.test(text)) return "gloss";
    if (/sheer|balm|tint|stain|dewy/.test(text)) return "sheer";
  }
  // Blush, eyeshadow and highlighter: sparkle beats glow beats the plain (matte) look. A palette lists several finishes;
  // the most visible one wins.
  if (region === "cheeks" || region === "eyeshadow" || region === "highlighter") {
    if (/shimmer|glitter|metallic|pearl|foil|sparkl/.test(text)) return "shimmer";
    if (region === "highlighter") return undefined;
    if (/satin|radiant|luminous|glow|high.?shine/.test(text)) return region === "cheeks" ? "radiant" : "satin";
  }
  return undefined;
}

// Same, from the product's sub_category. Used for Recommended / Catalog products, which have no finish text.
export function renderFinishForSubCategory(subCategory) {
  const hit = resolveSubCategory(subCategory);
  if (hit?.region !== "lips") return undefined;
  if (hit.token === "lip gloss" || hit.token === "lip plumper") return "gloss";
  if (hit.token === "lip balm" || hit.token === "lip stain & tint") return "sheer";
  return undefined;
}

// Tooltip for a disabled "Try on" button, saying why the product can't be tried on.
export function tryOnUnavailableTooltip(product) {
  const tokens = String(product?.sub_category ?? "").split(";").map(normalize);
  if (tokens.includes("face primer")) return "Primer has no visible color, so there is nothing to show in AR";
  return "This product type isn't available in AR try-on yet";
}
