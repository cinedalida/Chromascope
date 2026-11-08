// Turns a product's stored season tags into text people can read.
//
// The classifier (backend/scripts/classify_products_season.py) stores season_tags as codes: "SP-LIGHT, AU-SOFT", or
// "ALL" for products that suit any season or that are matched to skin tone instead. Older catalog entries hold prose
// such as "Warm shades: SP/AU. Cool shades: SU/WI"; that is shown as it is.

const SEASON_BY_CODE = {
  "sp-light": "Light Spring",
  "sp-true": "Warm Spring",
  "sp-bright": "Bright Spring",
  "su-light": "Light Summer",
  "su-true": "Cool Summer",
  "su-soft": "Soft Summer",
  "au-soft": "Soft Autumn",
  "au-true": "Warm Autumn",
  "au-deep": "Deep Autumn",
  "wi-deep": "Deep Winter",
  "wi-true": "Cool Winter",
  "wi-bright": "Bright Winter",
};

export const SEASON_COUNT = Object.keys(SEASON_BY_CODE).length;

const MAX_CHIPS = 3;

function splitTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  return String(tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Season codes (lowercase) named by a product's tags; empty for "ALL", blank and prose.
export function seasonCodes(product) {
  return splitTags(product?.season_tags)
    .map((t) => t.toLowerCase())
    .filter((t) => t in SEASON_BY_CODE);
}

/**
 * Chips for a product's seasons: at most 3 season names plus "+N", always at least one entry.
 * "ALL" or no tag reads "All seasons", except for skin-matched and neutral products, which have no season (empty list).
 */
export function seasonChips(product, limit = MAX_CHIPS) {
  const tags = splitTags(product?.season_tags);
  const codes = seasonCodes(product);
  if (codes.length > 0) {
    const names = codes.map((code) => SEASON_BY_CODE[code]);
    const shown = names.slice(0, limit);
    return names.length > limit ? [...shown, `+${names.length - limit}`] : shown;
  }
  const isProse = tags.length > 0 && !tags.some((t) => /^all\b/i.test(t));
  if (isProse) return [tags.join(", ")];
  // Base products (skin) and brows/liner/mascara (neutral) have no season, so there is nothing true to say.
  if (product?.match_basis === "skin" || product?.match_basis === "neutral") return [];
  return ["All seasons"];
}
