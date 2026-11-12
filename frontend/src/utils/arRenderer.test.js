// Run with: node --test src/utils/
import test from "node:test";
import assert from "node:assert/strict";
import { baseCorrection, linearRgbToLab } from "./arRenderer.js";

const decode = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const labOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return linearRgbToLab(...[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(decode));
};
const channels = (css) => css.match(/\d+/g).map(Number);
const deltaE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

const SETTINGS = { coverage: 0.35, maxShift: 6, tint: [{ blend: "source-over", opacity: 0.02 }] };
// Largest per-channel gain a base product may apply. Beyond this the face stops looking like skin (a flat mask).
const GAIN_CAP = 1.3;
const maxDodge = Math.round((1 - 1 / GAIN_CAP) * 255) + 1; // color-dodge fill brightens by 1 / (1 - fill)
const minMultiply = Math.floor(255 / GAIN_CAP) - 1; // multiply fill is 1 / gain when darkening

test("a shade that matches the skin changes almost nothing", () => {
  const skin = labOf("#C8A98E");
  const { layers, skinAfter } = baseCorrection(skin, "#C8A98E", SETTINGS);
  const multiply = layers.find((l) => l.blend === "multiply");
  const dodge = layers.find((l) => l.blend === "color-dodge");
  for (const c of channels(multiply.fill)) assert.ok(c >= 254, `multiply fill ${c}`);
  for (const c of channels(dodge.fill)) assert.ok(c <= 1, `color-dodge fill ${c}`);
  assert.ok(deltaE(skin, skinAfter) < 1);
});

test("a much lighter shade on dim skin never brightens more than the gain cap (no flat mask)", () => {
  const skin = labOf("#6B4E3D"); // the camera sees the face dark in dim light
  const { layers } = baseCorrection(skin, "#F2D8C2", SETTINGS); // a light foundation shade
  const dodge = layers.find((l) => l.blend === "color-dodge");
  for (const c of channels(dodge.fill)) assert.ok(c <= maxDodge, `color-dodge fill ${c} would brighten more than the cap`);
});

test("a much darker shade never darkens more than the gain cap", () => {
  const skin = labOf("#F2D8C2");
  const { layers } = baseCorrection(skin, "#6B4E3D", SETTINGS);
  const multiply = layers.find((l) => l.blend === "multiply");
  for (const c of channels(multiply.fill)) assert.ok(c >= minMultiply, `multiply fill ${c} would darken more than the cap`);
});

test("the face moves by at most maxShift (plus the small tint), however far the shade is", () => {
  const skin = labOf("#6B4E3D");
  const gap = deltaE(skin, labOf("#F8E8DC"));
  const { skinAfter } = baseCorrection(skin, "#F8E8DC", SETTINGS);
  const tintShare = gap * SETTINGS.tint[0].opacity; // the opaque tint is on top of the capped correction
  const moved = deltaE(skin, skinAfter);
  assert.ok(moved <= SETTINGS.maxShift + tintShare + 0.01, `moved ${moved.toFixed(2)} dE`);
});
