// Run with: node --test src/utils/
import test from "node:test";
import assert from "node:assert/strict";
import { catalogShades } from "./catalogShades.js";

const product = {
  hex_color: "#111111",
  shades: [{ shade_id: "a", hex: "#AA0000", name: "A" }, { shade_id: "b", hex: "#BB0000", name: "B" }, { shade_id: "c", hex: "#CC0000", name: "C" }],
  matching_shades: [{ shade_id: "c", hex: "#CC0000", name: "C" }, { shade_id: "a", hex: "#AA0000", name: "A" }],
};

test("full catalog: every shade, the fitting ones marked", () => {
  const list = catalogShades(product);
  assert.deepEqual(list.map((s) => s.id), ["a", "b", "c"]);
  assert.deepEqual(list.map((s) => s.matches), [true, false, true]);
});

test("Safe for me: only the fitting shades, best first", () => {
  assert.deepEqual(catalogShades(product, { onlyMatching: true }).map((s) => s.id), ["c", "a"]);
});

test("nothing to match: all shades, none marked; no shades: the single color", () => {
  const plain = { shades: product.shades };
  assert.deepEqual(catalogShades(plain, { onlyMatching: true }).map((s) => s.matches), [false, false, false]);
  assert.deepEqual(catalogShades({ hex_color: "#123456" }).map((s) => s.hex), ["#123456"]);
  assert.deepEqual(catalogShades({}), []);
});
