// Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { createServerWake, isAwakeBody, loadAfterWake } from "./serverWake.js";

// A fake clock: sleeping advances it instantly, so a 3-minute limit takes no real time.
function fakeTime() {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
}

test("only a JSON reply with a status counts as awake (not the HTML starting page)", () => {
  assert.equal(isAwakeBody({ status: "Chromascope Safety API is running" }), true);
  for (const body of [null, undefined, {}, { status: "" }, { status: 200 }, "<html>Starting</html>", []]) {
    assert.equal(isAwakeBody(body), false, JSON.stringify(body));
  }
});

test("keeps pinging until the server answers, then stops", async () => {
  const clock = fakeTime();
  let pings = 0;
  const wake = createServerWake({ ...clock, ping: async () => ++pings >= 4 });
  assert.equal(await wake.whenAwake(60000), true);
  assert.equal(pings, 4);
  assert.equal(wake.state(), "awake");
  await wake.whenAwake(60000);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(pings, 4, "no more pings once awake");
});

test("a ping that throws is just 'not yet'", async () => {
  const clock = fakeTime();
  let n = 0;
  const wake = createServerWake({ ...clock, ping: async () => { if (++n < 3) throw new TypeError("Failed to fetch"); return true; } });
  assert.equal(await wake.whenAwake(60000), true);
  assert.equal(n, 3);
});

test("whenAwake gives up after its own timeout and never rejects", async () => {
  const wake = createServerWake({ ping: async () => { throw new Error("down"); }, intervalMs: 5, maxMs: 150, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
  const started = Date.now();
  assert.equal(await wake.whenAwake(30), false);
  assert.ok(Date.now() - started < 500);
});

test("pinging gives up after maxMs, and later waits return false at once", async () => {
  const clock = fakeTime();
  let pings = 0;
  const wake = createServerWake({ ...clock, ping: async () => { pings += 1; return false; }, intervalMs: 4000, maxMs: 180000 });
  assert.equal(await wake.whenAwake(10 * 60 * 1000), false);
  assert.equal(wake.state(), "gaveUp");
  assert.ok(pings >= 40 && pings <= 46, `${pings} pings in 3 minutes at 4 s`);
  const before = pings;
  assert.equal(await wake.whenAwake(60000), false);
  assert.equal(pings, before);
});

test("start is idempotent: two starts run one loop", async () => {
  const clock = fakeTime();
  let pings = 0;
  const wake = createServerWake({ ...clock, ping: async () => ++pings >= 3 });
  wake.start();
  wake.start();
  await wake.whenAwake(60000);
  assert.equal(pings, 3);
});

test("already awake: answers true without another ping", async () => {
  const clock = fakeTime();
  let pings = 0;
  const wake = createServerWake({ ...clock, ping: async () => { pings += 1; return true; } });
  await wake.whenAwake(1000);
  assert.equal(await wake.whenAwake(1), true);
  assert.equal(pings, 1);
});

test("offline: nothing is sent, and pinging resumes when the device is back", async () => {
  const clock = fakeTime();
  let online = false;
  let pings = 0;
  let cameBack;
  const backOnline = new Promise((r) => { cameBack = r; });
  const wake = createServerWake({
    ...clock,
    isOnline: () => online,
    whenOnline: () => backOnline,
    ping: async () => { pings += 1; return true; },
    sleep: async (ms) => { clock.sleep(ms); if (!online) { online = true; cameBack(); } },
  });
  assert.equal(await wake.whenAwake(60000), true);
  assert.equal(pings, 1, "the one ping happened after the device came back");
});

test("loadAfterWake: loads after waiting, and retries once after a failure when the server is up", async () => {
  const clock = fakeTime();
  const wake = createServerWake({ ...clock, ping: async () => true });
  let loads = 0;
  const result = await loadAfterWake(wake, async () => ++loads, (r) => r === 1, { firstWaitMs: 1000, retryWaitMs: 1000 });
  assert.equal(loads, 2);
  assert.equal(result, 2);
});

test("loadAfterWake: no retry when the first load works, none when the server never wakes", async () => {
  const clock = fakeTime();
  const up = createServerWake({ ...clock, ping: async () => true });
  let loads = 0;
  await loadAfterWake(up, async () => ++loads, () => false);
  assert.equal(loads, 1);

  const down = createServerWake({ ping: async () => false, intervalMs: 2, maxMs: 60, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
  loads = 0;
  const r = await loadAfterWake(down, async () => ++loads, () => true, { firstWaitMs: 10, retryWaitMs: 10 });
  assert.equal(loads, 1, "a down server is tried once, not twice");
  assert.equal(r, 1);
});
