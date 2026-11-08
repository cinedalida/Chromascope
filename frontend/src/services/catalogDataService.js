import { auth } from "../firebase";
import { API_BASE_URL } from "../config";
import { createRecommendedCache, profileSignature } from "../utils/arRecommendedCache";
import { createBatchRunner } from "../utils/filterBatch";
import { getProductCatalog, runFilter } from "./productService";

// What the Catalog page loads, kept for the session so coming back to the page does not refetch. Memory only: the
// product list is large, so it is not worth risking the localStorage quota.

export const FILTER_CATEGORIES = ["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"];

// The backend caches its product list for 10 minutes, so there is nothing newer to fetch sooner than that.
const CATALOG_TTL_MS = 10 * 60 * 1000;
const catalogCache = createRecommendedCache({ ttlMs: CATALOG_TTL_MS });
const safetyCache = createRecommendedCache(); // keyed by profile, see below

// A slow or just-woken backend can take a while; give up on the batch after this and ask per category instead.
const BATCH_TIMEOUT_MS = 60000;

/** Every product, for the signed-in user (or signed-out). An empty list means the request failed and is not kept. */
export function getCatalog() {
  const uid = auth.currentUser?.uid ?? "anonymous";
  return catalogCache.get(uid, "catalog", "all", getProductCatalog, (items) => !items?.length);
}

// The profile fields the safety filter reads. The same fallbacks as the request payload below.
function filterInputs(user) {
  return {
    skin_type: user.skin_type || user.skin_profile?.base_type || "Normal",
    avoid_ingredients: user.avoid_ingredients || user.skin_profile?.blacklisted_ingredients || [],
    user_lab: user.user_lab,
    seasonal_label: user.seasonal_label,
  };
}

// A real /run-filter response always has active_profile; the service returns empty lists on any failure.
const isComplete = (responses) => responses.every((response) => response?.active_profile);

// One request for all categories (POST /run-filter-batch), or one per category on a backend that does not have it yet.
async function fetchBatch(categories, payload) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`${API_BASE_URL}/run-filter-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...payload, categories }),
    signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
  });
  return { status: response.status, body: response.ok ? await response.json() : null };
}

// One runner for the page load: it remembers when the backend has no batch endpoint (not redeployed yet), so that is
// found out once, whatever the profile.
const runBatch = createBatchRunner({
  fetchBatch,
  runSingle: (category, payload) => runFilter({ ...payload, category }),
});

/**
 * Every category's /run-filter response, as { Face: {...}, Concealer: {...}, ... }. One request, cached per user and
 * profile, so editing the profile (skin type, concerns, avoided ingredients, season, skin color) asks the server again
 * and nothing else does. The catalog page, the Favorites page and a favorite's "Try on" all read through here, so
 * they share it. A result with a failed category is returned but not kept, so the next call (or Retry) tries again.
 */
function getSafetyBatch(user) {
  const payload = filterInputs(user);
  const signature = profileSignature({ ...payload, concerns: user.concerns });
  return safetyCache.get(
    user.uid,
    "safety",
    signature,
    () => runBatch(FILTER_CATEGORIES, payload),
    (responses) => !isComplete(FILTER_CATEGORIES.map((category) => responses[category])),
  );
}

/** One category's /run-filter response (shares the one batch request with every other category). */
export async function getSafetyCategory(user, category) {
  return (await getSafetyBatch(user))[category];
}

/** Every category's results together: { results, complete }. */
export async function getSafetyResults(user) {
  const responses = await getSafetyBatch(user);
  const list = FILTER_CATEGORIES.map((category) => responses[category]);
  return { results: list.flatMap((response) => response?.color_matched || []), complete: isComplete(list) };
}

// Sign-out: the next person on this device starts clean.
export function clearCatalogCache() {
  catalogCache.clear();
  safetyCache.clear();
}
