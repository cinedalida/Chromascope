// Warms the AR data in the background so opening the try-on does not wait for the server.
//
// One store subscription covers every case: the profile arriving after sign-in, a new color analysis and a profile edit.
// Whenever the signature of the fields the recommendations depend on changes (see arRecommendedCache.js), the four AR
// groups are fetched once, one after another, while the browser is idle. A repeat with the same signature does nothing,
// and the AR page then finds everything already cached (or already in flight, which it shares).
//
// Skipped until the profile is complete: without a color analysis the recommendations are not worth warming.
import { AR_GROUPS } from "../utils/arGroups";
import { profileSignature } from "../utils/arRecommendedCache";
import { useUserStore } from "../store/userStore";
import { getRecommended } from "./arRecommendedService";
import { getGroupShades } from "./arShadeService";
import { whenServerAwake } from "./serverWake";
import { prefetchPages, SIGNED_IN_PAGES } from "../routes/lazyPages";

const whenIdle = (task) =>
  typeof requestIdleCallback === "function" ? requestIdleCallback(task, { timeout: 3000 }) : setTimeout(task, 1500);

let pagesPrefetched = false; // the page code is fetched once per page load
let lastKey = null; // "<uid>:<signature>" last warmed
let run = 0; // a newer warm-up makes an older, still running one stop

function warm() {
  const id = ++run;
  whenIdle(async () => {
    // A sleeping free-hosted backend would fail every one of these; wait for it (up to a minute, never forever).
    await whenServerAwake(60000);
    for (const group of AR_GROUPS) {
      if (id !== run) return;
      // Never throws: both services turn failures into empty results, and a failed one is not cached, so AR retries it.
      await Promise.allSettled([getRecommended(group.key), getGroupShades(group.key)]);
    }
  });
}

function onProfile(state) {
  const profile = state.user;
  if (!profile?.uid) {
    lastKey = null; // signed out: the next sign-in warms again
    run += 1;
    return;
  }
  if (!profile.profile_completed) return;
  if (!pagesPrefetched) {
    pagesPrefetched = true;
    whenIdle(() => prefetchPages(SIGNED_IN_PAGES)); // the code for Try-On, Catalog, ...: opening them later is instant
  }
  const key = `${profile.uid}:${profileSignature(profile)}`;
  if (key === lastKey) return;
  lastKey = key;
  warm();
}

/** Starts watching the profile. Returns the function that stops it. */
export function startARPrefetch() {
  onProfile(useUserStore.getState());
  return useUserStore.subscribe(onProfile);
}
