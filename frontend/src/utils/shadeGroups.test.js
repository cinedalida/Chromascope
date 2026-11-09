// Run with: node --test src/utils/
import test from "node:test";
import assert from "node:assert/strict";
import { cleanProductName, isEverydayProduct } from "./shadeGroups.js";

test("cleanProductName drops a trailing pack size, only that", () => {
  assert.equal(cleanProductName("Unlocked Satin Creme Lipstick • 4g"), "Unlocked Satin Creme Lipstick");
  assert.equal(cleanProductName("Triclone Skin Tech™ Foundation • 30ml"), "Triclone Skin Tech™ Foundation");
  assert.equal(cleanProductName("Rouge G - 0.5 oz"), "Rouge G");
  assert.equal(cleanProductName("Lip Color 24H"), "Lip Color 24H"); // a number that is not a size stays
  assert.equal(cleanProductName("Mini 3g Gloss Duo"), "Mini 3g Gloss Duo"); // not trailing: stays
  assert.equal(cleanProductName(null), "");
});

test("Basic Lips is lipstick only: exact types for Recommended, the name for Browse, other regions untouched", () => {
  const rec = (kinds) => ({ region: "lips", source: "recommended", kinds, product: "x" });
  assert.equal(isEverydayProduct(rec(["Lipstick"])), true);
  assert.equal(isEverydayProduct(rec(["Lip gloss", "Lipstick"])), true); // also a lipstick
  assert.equal(isEverydayProduct(rec(["Lip gloss"])), false);
  assert.equal(isEverydayProduct(rec(["Lip balm", "Lip plumper"])), false);
  assert.equal(isEverydayProduct(rec(["Lip stain & tint"])), false);
  const browse = (product) => ({ region: "lips", source: "browse", product });
  assert.equal(isEverydayProduct(browse("Rouge Pur Couture Satin Lipstick")), true);
  assert.equal(isEverydayProduct(browse("High Shine Lip Gloss Duo")), false);
  assert.equal(isEverydayProduct(browse("Tinted Lip Balm SPF 15")), false);
  assert.equal(isEverydayProduct(browse("Lip Plumping Oil")), false);
  assert.equal(isEverydayProduct({ region: "cheeks", source: "recommended", kinds: ["Blush"], product: "Gloss Blush" }), true);
  assert.equal(isEverydayProduct({ region: "foundation", source: "browse", product: "Glow Tint" }), true);
});
