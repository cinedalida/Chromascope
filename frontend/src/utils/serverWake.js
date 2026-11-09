// Wakes a sleeping free-hosted backend as soon as the app opens, and lets data loads wait for it. Pure (the network call,
// the clock and the online check are injected), so it runs under `npm run test:unit`.
//
// A free Hugging Face Space goes to sleep after a while without visitors and takes a minute or more to start. While it
// starts, it answers without the CORS headers (or not at all), so a browser fetch fails: a failed ping simply means
// "not yet". Only a JSON reply that has a `status` field counts as awake (not the HTML "starting" page, even with 200).

/** Whether a parsed reply from the API root is the real server's. */
export const isAwakeBody = (body) => typeof body?.status === "string" && body.status.length > 0;

/**
 * @param ping        () => Promise<boolean>; true when the server is up. A rejection counts as false.
 * @param sleep       (ms) => Promise<void>
 * @param now         () => ms, for the give-up limit
 * @param intervalMs  time between pings
 * @param maxMs       stop pinging after this long (the server is really down, or this is a dead link)
 * @param isOnline    () => boolean. While false nothing is sent (the device is offline), and pinging resumes by itself.
 * @param whenOnline  () => Promise<void> that resolves when the device comes back online
 */
export function createServerWake({
  ping,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  intervalMs = 4000,
  maxMs = 180000,
  isOnline = () => true,
  whenOnline = () => new Promise(() => {}),
}) {
  let state = "idle"; // idle | waking | awake | gaveUp
  let finish;
  const finished = new Promise((resolve) => {
    finish = resolve;
  });

  async function loop() {
    const startedAt = now();
    while (now() - startedAt < maxMs) {
      if (!isOnline()) {
        await Promise.race([whenOnline(), sleep(intervalMs)]); // time still passes, so the limit still applies
        continue;
      }
      const ready = await Promise.resolve().then(ping).then(Boolean, () => false); // a throw or a rejection is "not yet"
      if (ready) {
        state = "awake";
        finish(true);
        return;
      }
      await sleep(intervalMs);
    }
    state = "gaveUp";
    finish(false);
  }

  /** Starts pinging (once; later calls do nothing). */
  function start() {
    if (state !== "idle") return;
    state = "waking";
    loop();
  }

  /**
   * Resolves true as soon as the server answers, or false after `timeoutMs` (or at once if pinging has given up).
   * Never rejects. Starts pinging if nobody has yet.
   */
  function whenAwake(timeoutMs) {
    if (state === "awake") return Promise.resolve(true);
    if (state === "gaveUp") return Promise.resolve(false);
    start();
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      finished.then((ok) => {
        clearTimeout(timer);
        resolve(ok);
      });
    });
  }

  return { start, whenAwake, state: () => state };
}

/**
 * Runs a data load once the server is up: waits (up to `firstWaitMs`) before the first try, and if the result is a failure
 * waits (up to `retryWaitMs`) for the server and tries once more. `wake` is the object from createServerWake.
 */
export async function loadAfterWake(wake, load, isFailure, { firstWaitMs = 45000, retryWaitMs = 30000 } = {}) {
  await wake.whenAwake(firstWaitMs);
  const result = await load();
  if (!isFailure(result) || !(await wake.whenAwake(retryWaitMs))) return result;
  return load();
}
