import { API_BASE_URL } from "../config";
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
