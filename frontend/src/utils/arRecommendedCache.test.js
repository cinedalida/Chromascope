// Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { createRecommendedCache, profileSignature, CACHE_TTL_MS } from "./arRecommendedCache.js";

const base = {
  seasonal_label: "Soft Autumn",
  user_lab: [60, 10, 12],
  skin_type: "Oily",
  concerns: ["Acne", "Redness"],
  avoid_ingredients: ["Parabens", "Fragrance"],
};

test("signature ignores array order, case and unrelated fields", () => {
  const same = {
    ...base,
    concerns: ["redness", "ACNE"],
    avoid_ingredients: ["fragrance", "parabens", "Parabens"],
    display_name: "x",
    updated_at: 1,
  };
  assert.equal(profileSignature(same), profileSignature(base));
});

test("signature changes when any one input changes", () => {
  const sig = profileSignature(base);
  const changed = [
    { seasonal_label: "Deep Winter" },
    { user_lab: [60, 10, 13] },
    { skin_type: "Dry" },
    { concerns: ["Acne"] },
    { avoid_ingredients: ["Parabens"] },
  ];
  for (const patch of changed) assert.notEqual(profileSignature({ ...base, ...patch }), sig, JSON.stringify(patch));
});

test("signature copes with null and missing fields", () => {
  for (const p of [null, undefined, {}, { user_lab: null }, { user_lab: [1, 2] }, { concerns: "acne" }, { user_lab: ["a", 1, 2] }]) {
    assert.equal(typeof profileSignature(p), "string");
  }
  assert.equal(profileSignature(null), profileSignature({}));
  assert.notEqual(profileSignature({}), profileSignature(base));
});

test("second call with the same key does not load again", async () => {
  const cache = createRecommendedCache();
  let loads = 0;
  const load = async () => ++loads;
  const sig = profileSignature(base);
  assert.equal(await cache.get("u1", "lips", sig, load), 1);
  assert.equal(await cache.get("u1", "lips", sig, load), 1);
  assert.equal(loads, 1);
});

test("concurrent callers share one request", async () => {
  const cache = createRecommendedCache();
  let loads = 0;
  const load = async () => ++loads;
  const [a, b] = await Promise.all([cache.get("u1", "lips", "s", load), cache.get("u1", "lips", "s", load)]);
  assert.equal(a, b);
  assert.equal(loads, 1);
});

test("a changed signature, group or user loads again", async () => {
  const cache = createRecommendedCache();
  let loads = 0;
  const load = async () => ++loads;
  await cache.get("u1", "lips", "s1", load);
  await cache.get("u1", "lips", "s2", load);
  await cache.get("u1", "face", "s2", load);
  await cache.get("u2", "lips", "s2", load);
  assert.equal(loads, 4);
});

test("a new signature drops the older entry for the same user and group", async () => {
  const cache = createRecommendedCache();
  await cache.get("u1", "lips", "s1", async () => 1);
  await cache.get("u1", "lips", "s2", async () => 2);
  await cache.get("u1", "face", "s2", async () => 3);
  assert.equal(cache.size(), 2);
  // Going back to the old profile loads again rather than serving a stale entry.
  let loads = 0;
  await cache.get("u1", "lips", "s1", async () => ++loads);
  assert.equal(loads, 1);
});

test("a failed result is not cached", async () => {
  const cache = createRecommendedCache();
  let loads = 0;
  const load = async () => ({ status: ++loads === 1 ? "error" : "ok" });
  const isFailure = (r) => r.status === "error";
  assert.equal((await cache.get("u1", "lips", "s", load, isFailure)).status, "error");
  assert.equal((await cache.get("u1", "lips", "s", load, isFailure)).status, "ok");
  assert.equal((await cache.get("u1", "lips", "s", load, isFailure)).status, "ok");
  assert.equal(loads, 2);
});

test("a rejected load is not cached", async () => {
  const cache = createRecommendedCache();
  let loads = 0;
  const load = async () => {
    if (++loads === 1) throw new Error("boom");
    return "ok";
  };
  await assert.rejects(cache.get("u1", "lips", "s", load), /boom/);
  assert.equal(await cache.get("u1", "lips", "s", load), "ok");
  assert.equal(cache.size(), 1);
});

test("entries expire after the TTL", async () => {
  let t = 1000;
  const cache = createRecommendedCache({ now: () => t });
  let loads = 0;
  const load = async () => ++loads;
  await cache.get("u1", "lips", "s", load);
  t += CACHE_TTL_MS - 1;
  await cache.get("u1", "lips", "s", load);
  assert.equal(loads, 1);
  t += 2;
  await cache.get("u1", "lips", "s", load);
  assert.equal(loads, 2);
});

test("clear empties the cache", async () => {
  const cache = createRecommendedCache();
  await cache.get("u1", "lips", "s", async () => 1);
  cache.clear();
  assert.equal(cache.size(), 0);
});
