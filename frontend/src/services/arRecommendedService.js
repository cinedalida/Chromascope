import { auth } from "../firebase";
import { runFilter } from "./productService";
import { regionForProduct, renderFinishForSubCategory } from "../utils/arProductMap";
import { groupByKey } from "../utils/arGroups";

// Recommended shades: products returned by the safety filter and matching engine.

// The AR page clears this on mount. The expiry is only a backstop.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // "<uid>:<region>" -> { expires, request }

const normalize = (value) => String(value ?? "").trim().toLowerCase();

function emptyResult(status) {
  return { status, items: [], seasonFilter: null, ranked: false, dropped: null };
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

// The backend scores every product for this user (see color_matching.py): `best_shade` is the shade that suits them
// most, `fit_score` (0..1) how well, `fit_tier` best | good | fair | low. When present, that shade is what the try-on
// applies instead of the product's first shade. Products the backend cannot score (brows, mascara, liner) have neither.
const TIER_LABEL = { best: "great", good: "good" }; // only these two are shown to the user, as "Great match" / "Good match"

function toShadeItem(product) {
  const verdict = normalize(product.verdict);
  const price = parsePrice(product.price);
  const best = product.best_shade;
  const fit = Number(product.fit_score);
  return {
    id: product.product_id,
    source: "recommended",
    region: regionForProduct(product),
    brand: product.brand ?? "",
    product: product.product_name ?? "",
    shade: best?.name ?? null,
    shadeId: best?.shade_id ?? null, // kept so a saved favorite or look remembers the exact shade (plan Part B, F-R1)
    hex: String(best?.hex ?? product.hex_color).trim().toUpperCase(),
    lab: Array.isArray(best?.lab) ? best.lab.map(Number) : toLab(product),
    price,
    currency: price !== null && String(product.price).includes("₱") ? "Peso" : null,
    finish: null,
    renderFinish: renderFinishForSubCategory(product.sub_category),
    url: null,
    verdict: verdict === "safe" || verdict === "caution" ? verdict : null,
    seasonMatch: Boolean(product.is_season_match),
    // How well the best shade suits the user, 0..1, or null when the product has no color target.
    fit: Number.isFinite(fit) && product.fit_score !== null ? fit : null,
    fitTier: TIER_LABEL[product.fit_tier] ?? null,
  };
}

// Orders Recommended items by how well they suit the user. The backend already sends them in this order; this keeps it
// when two API categories are merged (the Face tab). One total order:
//  1. Safe products before caution ones.
//  2. Products with a fit before those without (brows, mascara, ... have no target color).
//  3. Best fit first.
//  4. Season matches before the rest, then the incoming order (Array.sort is stable).
const VERDICT_RANK = { safe: 0, caution: 1 };

export function compareCompatibility(a, b) {
  const verdict = (VERDICT_RANK[a.verdict] ?? 1) - (VERDICT_RANK[b.verdict] ?? 1);
  if (verdict !== 0) return verdict;
  const hasFit = Number(a.fit === null) - Number(b.fit === null);
  if (hasFit !== 0) return hasFit;
  if (a.fit !== null && a.fit !== b.fit) return b.fit - a.fit;
  return Number(b.seasonMatch) - Number(a.seasonMatch);
}

// Region + shade item for the AR page's "Try on" buttons, or null when the product has no supported
// region or no real color. Products without a safety verdict (Product Catalog) get source "catalog".
export function productToTryOn(product) {
  const region = regionForProduct(product);
  if (!region || hasPlaceholderColor(product)) return null;
  const shade = toShadeItem(product);
  if (!shade.verdict) shade.source = "catalog";
  return { region, shade };
}

// Recommended products for one panel group (lips, cheeks, eyes, face). A group can span several API categories.
async function loadRecommended(groupKey) {
  const group = groupByKey(groupKey);
  const responses = await Promise.all(group.api.map((category) => runFilter({ category })));

  // runFilter returns empty lists on any failure; a real response always has active_profile.
  if (responses.some((response) => !response?.active_profile)) return emptyResult("error");
  const response = { active_profile: responses[0].active_profile, color_matched: responses.flatMap((r) => r.color_matched ?? []) };

  const dropped = { subCategory: { total: 0, byValue: {} }, placeholder: 0, excluded: 0 };
  const kept = [];

  for (const product of response.color_matched) {
    const region = regionForProduct(product);
    if (!region || !group.regions.includes(region)) {
      const value = product.sub_category || "(blank)";
      dropped.subCategory.total += 1;
      dropped.subCategory.byValue[value] = (dropped.subCategory.byValue[value] ?? 0) + 1;
      continue;
    }
    // hex_color is already the best shade's color when the backend scored the product.
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

  // Everything that passed the safety check is shown, best fit first (see compareCompatibility).
  const items = kept.sort(compareCompatibility);
  // "ranked" tells the panel that the order reflects the user's colors; without a color analysis it is only safe-first.
  const ranked = items.some((item) => item.fit !== null);
  const seasonFilter = response.active_profile.seasonal_label ? "season" : "no_season";

  return { status: items.length > 0 ? "ok" : "empty", items, seasonFilter, ranked, dropped };
}

export async function getRecommended(groupKey) {
  if (!groupByKey(groupKey)) throw new Error(`Unknown AR group: ${groupKey}`);

  // currentUser is null until Firebase restores the saved session.
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return emptyResult("signed_out");

  const key = `${user.uid}:${groupKey}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.request;

  const request = loadRecommended(groupKey)
    .catch((error) => {
      console.error(`Error loading recommended ${groupKey}:`, error);
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
