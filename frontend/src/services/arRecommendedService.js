import { auth } from "../firebase";
import { runFilter } from "./productService";

// Recommended shades: products returned by the safety filter and matching engine.

// Firestore sub_category values that are color products for each AR region.
// Taken from the Phase 2 catalog check. Matched after trimming and lowercasing.
export const SUB_CATEGORY_ALLOWLIST = {
  lips: [
    "Lipstick",
    "Lipstick (Matte)",
    "Lipstick - balm",
    "Lip Tint",
    "Lip Tint (Velvet)",
    "Lip (Liquid Matte)",
    "Lip Gloss",
    "Lip Oil",
  ],
  cheeks: [
    "Blush",
    "Powder Blush",
    "Liquid Blush",
    "Liquid Blush (Multi-use)",
    "Cream Blush Stick",
    "Cream Cheek Tint",
    "Lip and Cheek tint",
  ],
  eyeshadow: [
    "Eyeshadow",
    "Eyeshadow Stick",
  ],
};

// Category keys accepted by /api/run-filter.
const API_CATEGORY = { lips: "lips", cheeks: "cheeks", eyeshadow: "eyes" };

// The AR page clears this on mount. The expiry is only a backstop.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // "<uid>:<region>" -> { expires, request }

const normalize = (value) => String(value ?? "").trim().toLowerCase();

const ALLOWED = Object.fromEntries(
  Object.entries(SUB_CATEGORY_ALLOWLIST).map(([region, values]) => [region, new Set(values.map(normalize))]),
);

function emptyResult(status) {
  return { status, items: [], seasonFilter: null, dropped: null };
}

// Blank or malformed hex, or the #FFFFFF + Lab 0 placeholder written by labcolormigration.py.
function hasPlaceholderColor(product) {
  const hex = String(product.hex_color ?? "").trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) return true;
  const labIsZero = [product.lab_L, product.lab_a, product.lab_b].every((v) => !Number(v));
  return hex === "#FFFFFF" && labIsZero;
}

function toLab(product) {
  const lab = [product.lab_L, product.lab_a, product.lab_b].map(Number);
  if (lab.some(Number.isNaN) || lab.every((v) => v === 0)) return null;
  return lab;
}

// Firestore prices are text such as "≈ ₱799", or blank.
function parsePrice(price) {
  const num = parseFloat(String(price ?? "").replace(/[^\d.]/g, ""));
  return Number.isNaN(num) ? null : num;
}

function toShadeItem(product) {
  const verdict = normalize(product.verdict);
  const price = parsePrice(product.price);
  return {
    id: product.product_id,
    source: "recommended",
    brand: product.brand ?? "",
    product: product.product_name ?? "",
    shade: null,
    hex: String(product.hex_color).trim().toUpperCase(),
    lab: toLab(product),
    price,
    currency: price !== null && String(product.price).includes("₱") ? "Peso" : null,
    finish: null,
    url: null,
    verdict: verdict === "safe" || verdict === "caution" ? verdict : null,
    seasonMatch: Boolean(product.is_season_match),
  };
}

async function loadRecommended(region) {
  const response = await runFilter({ category: API_CATEGORY[region] });

  // runFilter returns empty lists on any failure; a real response always has active_profile.
  if (!response?.active_profile) return emptyResult("error");

  const dropped = { subCategory: { total: 0, byValue: {} }, placeholder: 0, excluded: 0 };
  const kept = [];

  for (const product of response.color_matched ?? []) {
    if (!ALLOWED[region].has(normalize(product.sub_category))) {
      const value = product.sub_category || "(blank)";
      dropped.subCategory.total += 1;
      dropped.subCategory.byValue[value] = (dropped.subCategory.byValue[value] ?? 0) + 1;
      continue;
    }
    if (hasPlaceholderColor(product)) {
      dropped.placeholder += 1;
      continue;
    }
    if (normalize(product.verdict) === "excluded") {
      dropped.excluded += 1;
      continue;
    }
    kept.push(toShadeItem(product));
  }

  // Season rule: matches only when any exist, otherwise everything that passed.
  let items = kept;
  let seasonFilter = "no_season";
  if (response.active_profile.seasonal_label) {
    const matches = kept.filter((item) => item.seasonMatch);
    seasonFilter = matches.length > 0 ? "matched" : "fallback";
    if (matches.length > 0) items = matches;
  }

  return { status: items.length > 0 ? "ok" : "empty", items, seasonFilter, dropped };
}

export async function getRecommended(region) {
  if (!(region in API_CATEGORY)) throw new Error(`Unknown AR region: ${region}`);

  // currentUser is null until Firebase restores the saved session.
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return emptyResult("signed_out");

  const key = `${user.uid}:${region}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.request;

  const request = loadRecommended(region)
    .catch((error) => {
      console.error(`Error loading recommended ${region}:`, error);
      return emptyResult("error");
    })
    .then((result) => {
      if (result.status === "error" && cache.get(key)?.request === request) cache.delete(key);
      return result;
    });
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, request });
  return request;
}

export function clearRecommendedCache() {
  cache.clear();
}
