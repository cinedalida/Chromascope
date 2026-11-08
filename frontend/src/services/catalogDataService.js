import { auth } from "../firebase";
import { createRecommendedCache, profileSignature } from "../utils/arRecommendedCache";
import { getProductCatalog, runFilter } from "./productService";

// What the Catalog page loads, kept for the session so coming back to the page does not refetch. Memory only: the
// product list is large, so it is not worth risking the localStorage quota.

export const FILTER_CATEGORIES = ["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"];

// The backend caches its product list for 10 minutes, so there is nothing newer to fetch sooner than that.
const CATALOG_TTL_MS = 10 * 60 * 1000;
const catalogCache = createRecommendedCache({ ttlMs: CATALOG_TTL_MS });
const safetyCache = createRecommendedCache(); // keyed by profile, see below

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

/**
 * Safety and match results for every category: { results, complete }. Cached per user and per profile, so editing the
 * profile (skin type, concerns, avoided ingredients, season, skin color) asks the server again and nothing else does.
 * A result with a failed category is returned but not kept, so the next visit (or Retry) tries again.
 */
export function getSafetyResults(user) {
  const payload = filterInputs(user);
  const signature = profileSignature({ ...payload, concerns: user.concerns });
  const load = async () => {
    const responses = await Promise.all(FILTER_CATEGORIES.map((category) => runFilter({ ...payload, category })));
    return { results: responses.flatMap((response) => response.color_matched || []), complete: isComplete(responses) };
  };
  return safetyCache.get(user.uid, "safety", signature, load, (value) => !value.complete);
}

// Sign-out: the next person on this device starts clean.
export function clearCatalogCache() {
  catalogCache.clear();
  safetyCache.clear();
}
