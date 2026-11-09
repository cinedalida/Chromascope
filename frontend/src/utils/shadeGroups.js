// Group shade items into product cards and search them.

// Browse: one group per product URL. Recommended: one group per product doc.
function groupKey(item) {
  return item.source === "recommended" ? `recommended:${item.id}` : `browse:${item.url}`;
}

export function groupByProduct(items) {
  const groups = new Map();
  for (const item of items) {
    const key = groupKey(item);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        source: item.source,
        region: item.region,
        brand: item.brand,
        product: item.product,
        price: item.price,
        currency: item.currency,
        finish: item.finish,
        url: item.url,
        imageUrl: item.imageUrl ?? null,
        kind: item.kind ?? null,
        kinds: item.kinds ?? null,
        verdict: item.verdict,
        seasonMatch: item.seasonMatch,
        fit: item.fit ?? null,
        seasonTags: item.seasonTags,
        matchBasis: item.matchBasis,
        fitTier: item.fitTier,
        shades: [],
      });
    }
    groups.get(key).shades.push(item);
  }
  return [...groups.values()];
}

// A trailing finish word after a dash or colon: "... - Satin", "... : Matte".
const TRAILING_FINISH =
  /\s*[-–:]\s*(satin|matte|shimmer|glitter|metallic|sheer|gloss|glossy|cream|creme|velvet|glow|frost|pearl|duochrome)\s*$/i;

/**
 * A short label for a shade, for tight spots (swatch captions, chips): drops text in brackets and a trailing finish
 * word. "519 Le Rose Essentiel (Raspberry Pink) - Satin" becomes "519 Le Rose Essentiel". The full name is still
 * used for tooltips and screen readers.
 */
export function shortShadeName(name) {
  const full = String(name ?? "").trim();
  const short = full
    .replace(/\s*\([^)]*\)/g, "")
    .replace(TRAILING_FINISH, "")
    .replace(/\s*[-–:]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return short || full;
}

export function searchProducts(groups, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return groups;
  const has = (text) => String(text ?? "").toLowerCase().includes(q);
  return groups.filter(
    (group) => has(group.brand) || has(group.product) || group.shades.some((shade) => has(shade.shade)),
  );
}

// A product name without its pack size: "Satin Creme Lipstick • 4g" -> "Satin Creme Lipstick". Only a trailing
// "• 4g" / "- 30ml" / "| 0.5 oz" style size is cut; the full name stays in the product modal.
const TRAILING_SIZE = /\s*[•·|–-]\s*\d+(?:[.,]\d+)?\s*(?:ml|g|gr|oz|fl\.?\s*oz|l|mg)\b.*$/i;
export function cleanProductName(name) {
  const full = String(name ?? "").trim();
  return full.replace(TRAILING_SIZE, "").trim() || full;
}

// Basic is the everyday makeup only: in Lips that is lipstick, not gloss, balm, stain, plumper or oil. Recommended products
// know their exact types (a composite such as "Lip gloss;Lipstick" counts as a lipstick). Browse shades have no type in the
// data, so they are told apart by the product name, which is approximate. Other regions are already one type each.
const NOT_LIPSTICK_NAME = /\b(gloss|glaze|balm|plump\w*|stain|tint(?:ed)?|oil|butter|treatment|mask)\b/i;
export function isEverydayProduct(group) {
  if (group.region !== "lips") return true;
  if (group.source === "recommended" && Array.isArray(group.kinds)) return group.kinds.includes("Lipstick");
  return !NOT_LIPSTICK_NAME.test(group.product ?? "");
}
