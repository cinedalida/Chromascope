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

// Storage that must never break the app: private windows, blocked site data and full quotas all throw.
const safely = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

// Bump when the shape of a stored result changes, so results saved by older code are ignored. (v2: items gained shadeId.)
const STORAGE_PREFIX = "chromascope:ar-rec:v2:";

/**
 * Persists results in a Storage-like object (localStorage), one slot per user and group, so a reload does not refetch.
 * Every access is wrapped: with storage unavailable it behaves as if nothing was ever saved.
 */
export function createStoragePersist(getStorage = () => globalThis.localStorage) {
  // Looked up on every call, inside the guard: merely reading `localStorage` throws when site data is blocked.
  const slot = (uid, group) => `${STORAGE_PREFIX}${uid}:${group}`;
  return {
    read(uid, group, signature) {
      const saved = safely(() => JSON.parse(getStorage().getItem(slot(uid, group)) ?? "null"));
      return saved && saved.signature === signature && Number.isFinite(saved.savedAt) && saved.result ? saved : null;
    },
    write(uid, group, signature, result, savedAt) {
      safely(() => getStorage().setItem(slot(uid, group), JSON.stringify({ signature, savedAt, result })));
    },
    clear() {
      safely(() => {
        const storage = getStorage();
        const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
        for (const key of keys) if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key);
      });
    },
  };
}

/**
 * Promise cache keyed by user, group and profile signature. Concurrent callers share one request.
 * `load` returns the result. A result for which `isFailure(result)` is true is not kept, so the next call retries.
 * `persist` (optional, see createStoragePersist) makes results survive a reload: a memory miss is looked up there first,
 * and a good result is written there. A stored result counts only for the same signature and within the TTL.
 */
export function createRecommendedCache({ ttlMs = CACHE_TTL_MS, now = Date.now, persist = null } = {}) {
  const entries = new Map(); // "<uid>:<group>:<signature>" -> { expires, request }

  function get(uid, group, signature, load, isFailure = () => false) {
    const key = `${uid}:${group}:${signature}`;
    const hit = entries.get(key);
    if (hit && hit.expires > now()) return hit.request;

    // One live entry per user and group: a new signature replaces the older ones.
    const prefix = `${uid}:${group}:`;
    for (const k of entries.keys()) if (k.startsWith(prefix)) entries.delete(k);

    const saved = persist ? safely(() => persist.read(uid, group, signature)) : null;
    if (saved && saved.savedAt + ttlMs > now()) {
      const request = Promise.resolve(saved.result);
      entries.set(key, { expires: saved.savedAt + ttlMs, request });
      return request;
    }

    const savedAt = now();
    const request = Promise.resolve()
      .then(load)
      .then((result) => {
        if (isFailure(result)) {
          if (entries.get(key)?.request === request) entries.delete(key);
        } else if (persist && entries.get(key)?.request === request) {
          safely(() => persist.write(uid, group, signature, result, savedAt));
        }
        return result;
      })
      .catch((error) => {
        if (entries.get(key)?.request === request) entries.delete(key);
        throw error;
      });
    entries.set(key, { expires: savedAt + ttlMs, request });
    return request;
  }

  return {
    get,
    clear() {
      entries.clear();
      if (persist) safely(() => persist.clear());
    },
    size: () => entries.size,
  };
}
