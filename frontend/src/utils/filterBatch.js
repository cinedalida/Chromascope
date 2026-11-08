// Several /run-filter categories in one request, with a fallback to one request each. Pure (no Firebase, no network of
// its own), so it runs under `npm run test:unit`.
//
// The batch endpoint exists only on a backend that has been redeployed. An older one answers 404/405: the runner then
// asks per category, as before, and remembers (for this page load) not to try the batch again.

const emptyResponse = () => ({ safety_results: [], color_matched: [] }); // what runFilter returns when a call fails

/**
 * @param fetchBatch  (categories, context) => Promise<{ status, body }>; may reject (network error, timeout)
 * @param runSingle   (category, context) => Promise<response> ({ color_matched, active_profile, ... }; never rejects)
 * @returns run(categories, context) => Promise<{ [category]: response }>. `context` (the request's profile fields) is
 *          passed through to both callbacks, so one runner can serve every profile and remember the backend's support. A response without `active_profile` is a failure,
 *          the same convention as a failed single call.
 */
export function createBatchRunner({ fetchBatch, runSingle }) {
  let unsupported = false;

  const fromSingles = async (categories, context) => {
    const responses = await Promise.all(categories.map((category) => runSingle(category, context)));
    return Object.fromEntries(categories.map((category, i) => [category, responses[i] ?? emptyResponse()]));
  };

  return async function run(categories, context) {
    if (!unsupported) {
      const result = await fetchBatch(categories, context).catch(() => null);
      const ok = result && result.status >= 200 && result.status < 300 && result.body?.categories;
      if (ok) {
        const profile = result.body.active_profile;
        return Object.fromEntries(
          categories.map((category) => {
            const part = result.body.categories[category];
            return [category, part && profile ? { ...part, active_profile: profile } : emptyResponse()];
          }),
        );
      }
      if (result && (result.status === 404 || result.status === 405)) unsupported = true;
    }
    // Old backend, or the batch failed (timeout, 5xx, network): the single calls still work.
    return fromSingles(categories, context);
  };
}
