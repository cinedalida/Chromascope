// Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { createBatchRunner } from "./filterBatch.js";

const CATS = ["Face", "Lips", "Eyes"];
const PROFILE = { skin_type: "normal", seasonal_label: "Soft Autumn" };

// A fake server. `batch` answers the batch call; singles are counted so tests can tell which path was taken.
function setup({ batch, single } = {}) {
  const calls = { batch: 0, single: [] };
  const run = createBatchRunner({
    fetchBatch: async (categories) => {
      calls.batch += 1;
      return batch ? batch(categories) : { status: 404, body: null };
    },
    runSingle: async (category) => {
      calls.single.push(category);
      return single ? single(category) : { color_matched: [{ product_id: `${category}-1` }], active_profile: PROFILE };
    },
  });
  return { run, calls };
}
const goodBatch = (categories) => ({
  status: 200,
  body: { active_profile: PROFILE, categories: Object.fromEntries(categories.map((c) => [c, { color_matched: [{ product_id: `${c}-1` }] }])) },
});

test("a working batch answers every category with one request and the profile on each", async () => {
  const { run, calls } = setup({ batch: goodBatch });
  const out = await run(CATS);
  assert.equal(calls.batch, 1);
  assert.deepEqual(calls.single, []);
  assert.deepEqual(Object.keys(out), CATS);
  for (const c of CATS) {
    assert.deepEqual(out[c].color_matched, [{ product_id: `${c}-1` }]);
    assert.deepEqual(out[c].active_profile, PROFILE);
  }
});

test("an old backend (404) falls back to one request per category, and is not asked again", async () => {
  const { run, calls } = setup(); // batch -> 404
  const first = await run(CATS);
  assert.equal(calls.batch, 1);
  assert.deepEqual(calls.single, CATS);
  assert.deepEqual(first.Lips.color_matched, [{ product_id: "Lips-1" }]);
  await run(CATS);
  assert.equal(calls.batch, 1, "the batch is not tried again after a 404");
  assert.equal(calls.single.length, 6);
});

test("405 counts as unsupported too", async () => {
  const { run, calls } = setup({ batch: () => ({ status: 405, body: null }) });
  await run(CATS);
  await run(CATS);
  assert.equal(calls.batch, 1);
});

test("a server error or a network failure falls back for this call but the batch is tried again next time", async () => {
  let n = 0;
  const { run, calls } = setup({
    batch: (categories) => {
      n += 1;
      if (n === 1) return { status: 500, body: null };
      if (n === 2) throw new Error("timeout");
      return goodBatch(categories);
    },
  });
  await run(CATS); // 500
  await run(CATS); // network error
  assert.equal(calls.single.length, 6, "both failed calls used the single path");
  const out = await run(CATS); // works again
  assert.equal(calls.batch, 3);
  assert.equal(calls.single.length, 6);
  assert.deepEqual(out.Eyes.active_profile, PROFILE);
});

test("a category missing from the batch answer is a failure, not an invented result", async () => {
  const { run } = setup({
    batch: () => ({ status: 200, body: { active_profile: PROFILE, categories: { Face: { color_matched: [] }, Lips: { color_matched: [] } } } }),
  });
  const out = await run(CATS);
  assert.ok(out.Face.active_profile);
  assert.equal(out.Eyes.active_profile, undefined);
  assert.deepEqual(out.Eyes.color_matched, []);
});

test("an answer without a profile summary is treated as a failure for every category", async () => {
  const { run } = setup({ batch: () => ({ status: 200, body: { categories: { Face: { color_matched: [{ product_id: "x" }] } } } }) });
  const out = await run(["Face"]);
  assert.equal(out.Face.active_profile, undefined);
});

test("single calls that fail keep the failure shape, and one failure does not hide the others", async () => {
  const { run } = setup({
    single: (category) => (category === "Lips" ? { safety_results: [], color_matched: [] } : { color_matched: [{ product_id: category }], active_profile: PROFILE }),
  });
  const out = await run(CATS);
  assert.equal(out.Lips.active_profile, undefined);
  assert.ok(out.Face.active_profile && out.Eyes.active_profile);
});

test("the request context reaches both the batch and the single calls", async () => {
  const seen = [];
  const run = createBatchRunner({
    fetchBatch: async (categories, context) => {
      seen.push(["batch", context]);
      return { status: 404, body: null };
    },
    runSingle: async (category, context) => {
      seen.push([category, context]);
      return { color_matched: [], active_profile: PROFILE };
    },
  });
  await run(["Lips"], { skin_type: "oily" });
  assert.deepEqual(seen, [["batch", { skin_type: "oily" }], ["Lips", { skin_type: "oily" }]]);
});
