// Cache for Recommended AR results. Pure (no Firebase, no network) so it runs under `npm run test:unit`.
//
// Recommendations only change when one of the profile fields the server reads changes. The key therefore holds a
// signature of those fields, and a changed profile misses the cache by itself, with nothing to clear by hand.

// Backstop only: lets products added to the catalog show up eventually. The signature does the real invalidation.
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const round = (n) => Math.round(Number(n) * 100) / 100;
const cleanList = (list) =>
  Array.isArray(list) ? [...new Set(list.map((v) => String(v).trim().toLowerCase()).filter(Boolean))].sort() : [];

/**
 * The profile fields /run-filter reads from users/{uid}: season, skin color, skin type, concerns, avoided ingredients.
 * Stable under array order and case. Different profiles give different strings.
 */
export function profileSignature(profile) {
  const lab = Array.isArray(profile?.user_lab) && profile.user_lab.length === 3 ? profile.user_lab.map(round) : null;
  return JSON.stringify([
    String(profile?.seasonal_label ?? "").trim().toLowerCase(),
    lab && lab.every(Number.isFinite) ? lab : null,
    String(profile?.skin_type ?? "").trim().toLowerCase(),
    cleanList(profile?.concerns),
    cleanList(profile?.avoid_ingredients),
  ]);
}

/**
 * Promise cache keyed by user, group and profile signature. Concurrent callers share one request.
 * `load` returns the result. A result for which `isFailure(result)` is true is not kept, so the next call retries.
 */
export function createRecommendedCache({ ttlMs = CACHE_TTL_MS, now = Date.now } = {}) {
  const entries = new Map(); // "<uid>:<group>:<signature>" -> { expires, request }

  function get(uid, group, signature, load, isFailure = () => false) {
    const key = `${uid}:${group}:${signature}`;
    const hit = entries.get(key);
    if (hit && hit.expires > now()) return hit.request;

    // One live entry per user and group: a new signature replaces the older ones.
    const prefix = `${uid}:${group}:`;
    for (const k of entries.keys()) if (k.startsWith(prefix)) entries.delete(k);

    const request = Promise.resolve()
      .then(load)
      .then((result) => {
        if (isFailure(result) && entries.get(key)?.request === request) entries.delete(key);
        return result;
      })
      .catch((error) => {
        if (entries.get(key)?.request === request) entries.delete(key);
        throw error;
      });
    entries.set(key, { expires: now() + ttlMs, request });
    return request;
  }

  return { get, clear: () => entries.clear(), size: () => entries.size };
}
