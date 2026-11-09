// Run with: node --test src/utils/
import test from "node:test";
import assert from "node:assert/strict";
import { seasonChips, seasonChipsForCodes } from "./seasonLabels.js";

test("seasonChipsForCodes names every season (never '+N') and skips unknown codes", () => {
  assert.deepEqual(seasonChipsForCodes(["au-soft", "au-true"]), ["Soft Autumn", "Warm Autumn"]);
  assert.deepEqual(seasonChipsForCodes(["au-soft", "au-true", "au-deep", "wi-deep", "su-soft"]), [
    "Soft Autumn", "Warm Autumn", "Deep Autumn", "Deep Winter", "Soft Summer",
  ]);
  assert.deepEqual(seasonChipsForCodes(["SP-TRUE"]), ["Warm Spring"]);
  assert.deepEqual(seasonChipsForCodes(["nope"]), []);
  assert.deepEqual(seasonChipsForCodes(null), []);
});

test("seasonChips (whole product) reads stored tags, all of them", () => {
  assert.deepEqual(seasonChips({ season_tags: "AU-SOFT, SP-LIGHT" }), ["Soft Autumn", "Light Spring"]);
  assert.equal(seasonChips({ season_tags: "WI-DEEP, SU-LIGHT, AU-SOFT, SP-LIGHT" }).length, 4);
  assert.deepEqual(seasonChips({ season_tags: "ALL", match_basis: "skin" }), []);
  assert.deepEqual(seasonChips({ season_tags: "ALL", match_basis: "harmony" }), ["All seasons"]);
});
