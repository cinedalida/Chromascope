// Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { regionForSubCategory, renderFinishFromText } from "./arProductMap.js";
import { FINISH_OVERRIDES, REGION_RENDER, settingsFor } from "./arRenderer.js";

test("lip finishes are unchanged", () => {
  assert.equal(renderFinishFromText("lips", "High Shine"), "gloss");
  assert.equal(renderFinishFromText("lips", "Sheer, Natural"), "sheer");
  assert.equal(renderFinishFromText("lips", "Matte"), undefined);
});

test("cheeks, eyeshadow and highlighter: sparkle beats glow beats plain", () => {
  assert.equal(renderFinishFromText("cheeks", "Radiant, Shimmer"), "shimmer");
  assert.equal(renderFinishFromText("cheeks", "Satin, Natural"), "radiant");
  assert.equal(renderFinishFromText("cheeks", "Matte, Natural"), undefined);
  assert.equal(renderFinishFromText("eyeshadow", "Matte, Glitter"), "shimmer");
  assert.equal(renderFinishFromText("eyeshadow", "Metallic"), "shimmer");
  assert.equal(renderFinishFromText("eyeshadow", "Satin"), "satin");
  assert.equal(renderFinishFromText("eyeshadow", "Matte"), undefined);
  assert.equal(renderFinishFromText("highlighter", "Shimmer"), "shimmer");
  assert.equal(renderFinishFromText("highlighter", "Radiant"), undefined);
  assert.equal(renderFinishFromText("foundation", "Matte, Shimmer"), undefined, "no finish looks outside these regions");
  assert.equal(renderFinishFromText("cheeks", null), undefined);
});

test("every finish the mapping can return has a renderer override, and every catalog finish text maps cleanly", () => {
  for (const region of ["cheeks", "eyeshadow", "highlighter"]) {
    const rows = JSON.parse(fs.readFileSync(new URL(`../../public/data/ar-shades-${region}.json`, import.meta.url), "utf8"));
    const seen = new Set(rows.map((r) => renderFinishFromText(region, r.finish)));
    for (const finish of seen) if (finish) assert.ok(FINISH_OVERRIDES[region]?.[finish], `${region}: no override for "${finish}"`);
  }
});

test("a finish adds layers on top of the default and never removes any; no finish is exactly the default", () => {
  for (const [region, finishes] of Object.entries(FINISH_OVERRIDES)) {
    if (region === "lips") continue;
    const base = settingsFor(region, undefined);
    assert.equal(base, REGION_RENDER[region]);
    for (const finish of Object.keys(finishes)) {
      const s = settingsFor(region, finish);
      assert.deepEqual(s.layers.slice(0, base.layers.length), base.layers);
      assert.ok(s.layers.length > base.layers.length);
    }
    assert.equal(settingsFor(region, "matte"), REGION_RENDER[region], `${region}: matte is the default look`);
  }
});

test("every face sub-category in the catalog maps to a region, except primers (no visible color)", () => {
  for (const sub of ["Foundation", "Powder foundation", "Liquid foundation", "Tinted moisturiser", "BB & CC cream", "Concealer", "Powder", "Foundation;Powder"]) {
    assert.ok(regionForSubCategory(sub), `${sub} should be tryable`);
  }
  assert.equal(regionForSubCategory("Face primer"), null);
  assert.equal(regionForSubCategory("Primer"), null);
});
