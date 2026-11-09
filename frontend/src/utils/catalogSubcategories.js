// Sub-categories for the Catalog page (Lipstick, Lip liner, Blush ...), read from each product's raw sub_category.
//
// products_v2 sub_category values are scraper strings ("Eye shadow", "Lip stain & tint"), and about 20% are composites
// joined with ";" ("Blush;Highlighter & illuminator"). Each token gets a clean label; variants of one thing share a
// label. Tokens not listed here are shown title-cased as they are, so nothing is lost.

const LABEL_BY_TOKEN = {
  "lipstick": "Lipstick",
  "lip color": "Lipstick",
  "lip stain & tint": "Lip stain & tint",
  "lip gloss": "Lip gloss",
  "lip balm": "Lip balm",
  "lip plumper": "Lip plumper",
  "lip liner": "Lip liner",
  "blush": "Blush",
  "bronzer": "Bronzer",
  "contour": "Contour",
  "highlighter": "Highlighter",
  "highlighter & illuminator": "Highlighter",
  "eyeshadow": "Eyeshadow",
  "eye shadow": "Eyeshadow",
  "eyeshadow palette": "Eyeshadow",
  "eyeliner": "Eyeliner",
  "eyebrows": "Brows",
  "brow": "Brows",
  "mascara": "Mascara",
  "foundation": "Foundation",
  "liquid foundation": "Foundation",
  "powder foundation": "Foundation",
  "bb & cc cream": "Foundation",
  "tinted moisturiser": "Tinted moisturiser",
  "concealer": "Concealer",
  "under eye concealer": "Concealer",
  "corrector": "Corrector",
  "powder": "Powder",
  "face primer": "Primer",
  "primer": "Primer",
};

// A product's sub_category can list tags from other categories ("Concealer;Lip gloss" on a concealer, "Blush;Lip balm"
// on a blush), which would put it under the wrong heading. Under a category only that category's own types count.
const TYPES_BY_CATEGORY = {
  Lip: ["Lipstick", "Lip gloss", "Lip balm", "Lip stain & tint", "Lip plumper", "Lip liner"],
  Cheek: ["Blush", "Bronzer", "Contour", "Highlighter"],
  Eye: ["Eyeshadow", "Eyeliner", "Brows", "Mascara"],
  Face: ["Foundation", "Tinted moisturiser", "Powder", "Primer"],
  Concealer: ["Concealer", "Corrector"],
};

const titleCase = (text) => text.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * The clean sub-category labels of a product, in the order its sub_category lists them (no duplicates), limited to the
 * types of the product's own category. Categories not listed above (Multiuse) keep every tag.
 */
export function subcategoryLabels(product) {
  const allowed = TYPES_BY_CATEGORY[product?.category];
  const labels = [];
  for (const raw of String(product?.sub_category ?? "").split(";")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    const label = LABEL_BY_TOKEN[token] ?? titleCase(token);
    if (allowed && !allowed.includes(label)) continue;
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

/** Sub-category labels of the given products with how many products carry each, most products first. */
export function subcategoryCounts(products) {
  const counts = new Map();
  for (const product of products) {
    for (const label of subcategoryLabels(product)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
