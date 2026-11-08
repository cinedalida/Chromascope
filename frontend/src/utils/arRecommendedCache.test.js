// Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { createRecommendedCache, createStoragePersist, profileSignature, CACHE_TTL_MS } from "./arRecommendedCache.js";

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

// ---- persistence ----

// A Storage-like object backed by a Map. `fail` makes chosen operations throw, like blocked site data or a full quota.
function fakeStorage(fail = {}) {
  const data = new Map();
  return {
    data,
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem(k) { if (fail.get) throw new Error("blocked"); return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { if (fail.set) throw new Error("quota"); data.set(k, String(v)); },
    removeItem(k) { data.delete(k); },
  };
}
const ok = (n) => ({ status: "ok", items: [{ id: n }] });

test("a result saved before a reload is used after it, with no load", async () => {
  const storage = fakeStorage();
  const before = createRecommendedCache({ persist: createStoragePersist(() => storage) });
  await before.get("u1", "lips", "s", async () => ok(1));
  const afterReload = createRecommendedCache({ persist: createStoragePersist(() => storage) }); // new memory, same storage
  let loads = 0;
  const result = await afterReload.get("u1", "lips", "s", async () => { loads += 1; return ok(2); });
  assert.deepEqual(result, ok(1));
  assert.equal(loads, 0);
});

test("a stored result for another signature, group or user is not used", async () => {
  const storage = fakeStorage();
  await createRecommendedCache({ persist: createStoragePersist(() => storage) }).get("u1", "lips", "s1", async () => ok(1));
  for (const [uid, group, sig] of [["u1", "lips", "s2"], ["u1", "face", "s1"], ["u2", "lips", "s1"]]) {
    let loads = 0;
    await createRecommendedCache({ persist: createStoragePersist(() => storage) }).get(uid, group, sig, async () => { loads += 1; return ok(9); });
    assert.equal(loads, 1, `${uid} ${group} ${sig}`);
  }
});

test("a stored result expires TTL after it was saved, not after it was read", async () => {
  const storage = fakeStorage();
  let t = 1000;
  await createRecommendedCache({ now: () => t, persist: createStoragePersist(() => storage) }).get("u1", "lips", "s", async () => ok(1));
  t += CACHE_TTL_MS - 10; // a reload shortly before expiry still hits...
  let loads = 0;
  const reloaded = createRecommendedCache({ now: () => t, persist: createStoragePersist(() => storage) });
  await reloaded.get("u1", "lips", "s", async () => { loads += 1; return ok(2); });
  assert.equal(loads, 0);
  t += 20; // ...and the hydrated entry does not get a fresh full TTL
  await reloaded.get("u1", "lips", "s", async () => { loads += 1; return ok(3); });
  assert.equal(loads, 1);
  // a reload after expiry misses too
  t += CACHE_TTL_MS;
  const late = createRecommendedCache({ now: () => t, persist: createStoragePersist(() => storage) });
  await late.get("u1", "lips", "s", async () => { loads += 1; return ok(4); });
  assert.equal(loads, 2);
});

test("failed results are not written to storage", async () => {
  const storage = fakeStorage();
  const cache = createRecommendedCache({ persist: createStoragePersist(() => storage) });
  await cache.get("u1", "lips", "s", async () => ({ status: "error", items: [] }), (r) => r.status === "error");
  assert.equal(storage.data.size, 0);
  await assert.rejects(cache.get("u1", "cheeks", "s", async () => { throw new Error("x"); }));
  assert.equal(storage.data.size, 0);
});

test("empty (but successful) results are stored", async () => {
  const storage = fakeStorage();
  const cache = createRecommendedCache({ persist: createStoragePersist(() => storage) });
  await cache.get("u1", "lips", "s", async () => ({ status: "empty", items: [] }), (r) => r.status === "error");
  assert.equal(storage.data.size, 1);
});

test("storage that throws on read or write does not break the cache", async () => {
  for (const fail of [{ get: true }, { set: true }, { get: true, set: true }]) {
    const cache = createRecommendedCache({ persist: createStoragePersist(() => fakeStorage(fail)) });
    let loads = 0;
    const load = async () => { loads += 1; return ok(1); };
    assert.deepEqual(await cache.get("u1", "lips", "s", load), ok(1));
    assert.deepEqual(await cache.get("u1", "lips", "s", load), ok(1)); // still cached in memory
    assert.equal(loads, 1, JSON.stringify(fail));
  }
});

test("storage that cannot even be reached does not break the cache", async () => {
  const persist = createStoragePersist(() => { throw new Error("SecurityError"); });
  const cache = createRecommendedCache({ persist });
  assert.deepEqual(await cache.get("u1", "lips", "s", async () => ok(1)), ok(1));
  cache.clear();
});

test("corrupt stored data is ignored", async () => {
  const storage = fakeStorage();
  const persist = createStoragePersist(() => storage);
  for (const junk of ["not json", "null", "{}", '{"signature":"s"}', '{"signature":"s","savedAt":"x","result":{}}']) {
    storage.data.set("chromascope:ar-rec:v3:u1:lips", junk);
    let loads = 0;
    await createRecommendedCache({ persist }).get("u1", "lips", "s", async () => { loads += 1; return ok(1); });
    assert.equal(loads, 1, junk);
  }
});

test("clear removes this feature's stored results and nothing else", async () => {
  const storage = fakeStorage();
  storage.data.set("other-key", "keep");
  const cache = createRecommendedCache({ persist: createStoragePersist(() => storage) });
  await cache.get("u1", "lips", "s", async () => ok(1));
  await cache.get("u2", "face", "s", async () => ok(2));
  assert.equal(storage.data.size, 3);
  cache.clear();
  assert.deepEqual([...storage.data.keys()], ["other-key"]);
  assert.equal(cache.size(), 0);
});
