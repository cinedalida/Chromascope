// Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { importWithReload, isChunkLoadError } from "./lazyWithRetry.js";

const memoryStorage = () => {
  const data = new Map();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
};
const chunkError = () => new TypeError("Failed to fetch dynamically imported module: https://x/assets/FavoritesPage-abc.js");
const pending = (promise) => Promise.race([promise.then(() => "settled", () => "settled"), new Promise((r) => setTimeout(() => r("pending"), 30))]);

test("recognises the download errors of the common browsers and bundlers", () => {
  for (const message of [
    "Failed to fetch dynamically imported module: https://x/a.js",
    "error loading dynamically imported module",
    "Importing a module script failed.",
    "Loading chunk 12 failed.",
    "ChunkLoadError: Loading CSS chunk 3 failed",
  ]) assert.equal(isChunkLoadError(new Error(message)), true, message);
  for (const message of ["x is not a function", "Cannot read properties of undefined", "boom"]) assert.equal(isChunkLoadError(new Error(message)), false, message);
});

test("a page that loads is returned as it is", async () => {
  const module = { Page: 1 };
  assert.equal(await importWithReload(async () => module, { getStorage: memoryStorage, reload: () => assert.fail("no reload") }), module);
});

test("the first download failure reloads the page once and never settles meanwhile", async () => {
  const storage = memoryStorage();
  let reloads = 0;
  const result = importWithReload(async () => { throw chunkError(); }, { getStorage: () => storage, reload: () => { reloads += 1; } });
  assert.equal(await pending(result), "pending");
  assert.equal(reloads, 1);
});

test("a second failure (after that reload) is thrown, not reloaded again", async () => {
  const storage = memoryStorage();
  let reloads = 0;
  const opts = { getStorage: () => storage, reload: () => { reloads += 1; } };
  await pending(importWithReload(async () => { throw chunkError(); }, opts)); // first: reloads
  await assert.rejects(importWithReload(async () => { throw chunkError(); }, opts), /dynamically imported/);
  assert.equal(reloads, 1);
});

test("after a successful load the next failure may reload again", async () => {
  const storage = memoryStorage();
  let reloads = 0;
  const opts = { getStorage: () => storage, reload: () => { reloads += 1; } };
  await pending(importWithReload(async () => { throw chunkError(); }, opts));
  await importWithReload(async () => ({}), opts); // the reloaded page loads fine and clears the mark
  await pending(importWithReload(async () => { throw chunkError(); }, opts));
  assert.equal(reloads, 2);
});

test("an error that is not a download failure is thrown without reloading", async () => {
  let reloads = 0;
  await assert.rejects(importWithReload(async () => { throw new Error("x is not a function"); }, { getStorage: memoryStorage, reload: () => { reloads += 1; } }), /not a function/);
  assert.equal(reloads, 0);
});

test("without usable storage there is no reload (so no reload loop), the error is thrown", async () => {
  let reloads = 0;
  const reload = () => { reloads += 1; };
  await assert.rejects(importWithReload(async () => { throw chunkError(); }, { getStorage: () => { throw new Error("SecurityError"); }, reload }), /dynamically imported/);
  await assert.rejects(importWithReload(async () => { throw chunkError(); }, { getStorage: () => null, reload }), /dynamically imported/);
  const broken = { getItem: () => { throw new Error("x"); }, setItem: () => {}, removeItem: () => {} };
  await assert.rejects(importWithReload(async () => { throw chunkError(); }, { getStorage: () => broken, reload }), /dynamically imported/);
  assert.equal(reloads, 0);
});
