// Run with: node --test src/utils/
import test from "node:test";
import assert from "node:assert/strict";
import { parseSort, sortByPrice } from "./catalogSort.js";

const item = (id, price, extra = {}) => ({ product_id: id, price, ...extra });
const ids = (list) => list.map((p) => p.product_id);

test("parseSort keeps the two known values and turns anything else into Recommended", () => {
  assert.equal(parseSort("price-asc"), "price-asc");
  assert.equal(parseSort("price-desc"), "price-desc");
  assert.equal(parseSort(""), "");
  assert.equal(parseSort("name"), "");
  assert.equal(parseSort(null), "");
});

test("ascending and descending order by price", () => {
  const list = [item("a", 500), item("b", 120), item("c", 900)];
  assert.deepEqual(ids(sortByPrice(list, "price-asc")), ["b", "a", "c"]);
  assert.deepEqual(ids(sortByPrice(list, "price-desc")), ["c", "a", "b"]);
});

test("products without a numeric price go last in both directions", () => {
  const list = [item("none", null), item("a", 500), item("text", "Contact us"), item("b", 120), item("nan", NaN)];
  assert.deepEqual(ids(sortByPrice(list, "price-asc")), ["b", "a", "none", "text", "nan"]);
  assert.deepEqual(ids(sortByPrice(list, "price-desc")), ["a", "b", "none", "text", "nan"]);
});

test("equal prices keep their given order", () => {
  const list = [item("x", 300), item("y", 300), item("z", 100), item("w", 300)];
  assert.deepEqual(ids(sortByPrice(list, "price-asc")), ["z", "x", "y", "w"]);
  assert.deepEqual(ids(sortByPrice(list, "price-desc")), ["x", "y", "w", "z"]);
});

test("Recommended (or an unknown value) keeps the given order, and the input is never changed", () => {
  const list = [item("a", 500), item("b", 120)];
  const copy = [...list];
  const sorted = sortByPrice(list, "");
  assert.deepEqual(ids(sorted), ["a", "b"]);
  assert.notEqual(sorted, list);
  sortByPrice(list, "price-asc");
  assert.deepEqual(list, copy);
  assert.deepEqual(ids(sortByPrice(list, "nonsense")), ["a", "b"]);
});

test("a group rank keeps groups together and sorts by price only inside each group", () => {
  const rank = (p) => (p.verdict === "safe" ? 0 : 1);
  const list = [
    item("c1", 100, { verdict: "caution" }),
    item("s1", 900, { verdict: "safe" }),
    item("s2", 200, { verdict: "safe" }),
    item("c2", 50, { verdict: "caution" }),
  ];
  assert.deepEqual(ids(sortByPrice(list, "price-asc", rank)), ["s2", "s1", "c2", "c1"]);
  assert.deepEqual(ids(sortByPrice(list, "price-desc", rank)), ["s1", "s2", "c1", "c2"]);
});
