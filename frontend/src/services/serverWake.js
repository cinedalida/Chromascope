import { API_BASE_URL, apiUrl } from "../config";
import { createServerWake, isAwakeBody, loadAfterWake } from "../utils/serverWake";

// The free-hosted backend sleeps when nobody visits and takes a minute or more to start. Pinging it the moment the app
// opens means that start-up overlaps with sign-in, instead of starting only when the first data request is sent.
// See utils/serverWake.js for the rules (what counts as awake, when pinging stops).

const ROOT = API_BASE_URL ? `${API_BASE_URL.replace(/\/api$/, "")}/` : null;
const PING_TIMEOUT_MS = 8000;

async function ping() {
  const response = await fetch(ROOT, { cache: "no-store", signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
  return response.ok && isAwakeBody(await response.json().catch(() => null));
}

// Without an API address nothing can be woken (the config already logs that); loads then proceed at once.
const wake = ROOT
  ? createServerWake({
      ping,
      isOnline: () => navigator.onLine !== false,
      whenOnline: () => new Promise((resolve) => window.addEventListener("online", resolve, { once: true })),
    })
  : null;

/** Starts waking the backend (safe to call more than once). */
export function startServerWake() {
  wake?.start();
}

/** Resolves true when the backend answers, false after `timeoutMs`. Never rejects. */
export function whenServerAwake(timeoutMs) {
  return wake ? wake.whenAwake(timeoutMs) : Promise.resolve(true);
}

/** Runs a data load after the backend is up; one retry after a failure (see loadAfterWake). */
export function loadWhenServerAwake(load, isFailure, options) {
  return wake ? loadAfterWake(wake, load, isFailure, options) : load();
}

// The color-analysis models take a minute or two to load on a freshly started server. Asking for /warm holds a request
// open while they load (the server only gets CPU during a request), so by the time the person reaches the photo step
// they are usually ready. A failure is ignored (analysis loads them anyway).
//
// Cloud Run stops an instance that has had no requests for a while, which would make the next photo wait for the
// models again. So the app keeps asking while someone is using it: once when it opens (signed in or not), then every
// KEEP_WARM_INTERVAL_MS while the tab is visible and the device is online. Once the models are loaded /warm answers
// at once, so these requests cost almost nothing. When the tab is hidden or closed the requests stop, and the server
// is left to go idle by itself.
const WARM_TIMEOUT_MS = 180000;
const KEEP_WARM_INTERVAL_MS = 4 * 60 * 1000; // well under Cloud Run's idle shutdown (about 15 minutes)

/** Starts keeping the color-analysis models warm. Returns a function that stops it. Safe to call before sign-in. */
export function keepAnalyzerWarm() {
  if (!API_BASE_URL) return () => {};

  let inFlight = false;
  let lastAt = 0;

  const warmNow = () => {
    if (inFlight || navigator.onLine === false) return;
    inFlight = true;
    lastAt = Date.now();
    fetch(apiUrl("/warm"), { cache: "no-store", signal: AbortSignal.timeout(WARM_TIMEOUT_MS) })
      .catch(() => {})
      .finally(() => {
        inFlight = false;
      });
  };

  const tick = () => {
    if (document.visibilityState === "visible") warmNow();
  };

  // Coming back to the tab after a while: the server may have gone idle meanwhile, so start loading right away.
  const onVisible = () => {
    if (document.visibilityState === "visible" && Date.now() - lastAt >= KEEP_WARM_INTERVAL_MS) warmNow();
  };

  warmNow();
  const timer = setInterval(tick, KEEP_WARM_INTERVAL_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", warmNow);

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", warmNow);
  };
}
