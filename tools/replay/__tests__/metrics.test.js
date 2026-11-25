// TC-M1: the pre-registered metrics give the right answer on signals whose answer is known.
import { describe, expect, test } from "vitest";
import { jitter, lagMs, runsOf, trackingError, LAG_LANDMARKS } from "../metrics.js";
import { wilcoxon } from "../summarize.mjs";

// A 478-point pixel frame shifted by (fx, fy); eye corners 33 and 263 are 200 px apart.
const frame = (fx, fy) => Array.from({ length: 478 }, (_, l) => [fx + (l === 263 ? 200 : 0) + l * 0.01, fy + l * 0.02]);
const sig = (s) => 300 + 80 * Math.sin((2 * Math.PI * s) / 1700) + 30 * Math.sin((2 * Math.PI * s) / 610);
// Uneven timestamps around 30 fps.
const times = (n) => {
  const t = [];
  let tt = 0;
  for (let i = 0; i < n; i++) {
    t.push(tt);
    tt += 33.3 + (((i * 7919) % 11) - 5) * 0.6;
  }
  return t;
};

describe("TC-M1", () => {
  test("a perfectly still clip has jitter 0", () => {
    const t = times(300);
    const raw = t.map(() => frame(100, 100));
    expect(jitter({ t, raw, smoothed: raw })).toBe(0);
  });

  test.each([0, 50, 137])("a signal delayed by exactly %i ms gives that lag (+/- 1 ms)", (delay) => {
    const t = times(300);
    const raw = t.map((s) => frame(sig(s), sig(s + 400)));
    const smoothed = t.map((s) => frame(sig(s - delay), sig(s + 400 - delay)));
    expect(Math.abs(lagMs({ t, raw, smoothed }) - delay)).toBeLessThanOrEqual(1);
  });

  test("lag is measured in 2D: movement on one axis only still gives the full delay", () => {
    const t = times(300);
    const raw = t.map((s) => frame(sig(s), 200));
    const smoothed = t.map((s) => frame(sig(s - 50), 200));
    expect(LAG_LANDMARKS).toHaveLength(5);
    expect(Math.abs(lagMs({ t, raw, smoothed }) - 50)).toBeLessThanOrEqual(1);
  });

  test("a faceless frame splits the signal into runs", () => {
    expect(runsOf([1, 1, null, 1, null, null, 1, 1, 1])).toStrictEqual([[0, 1], [3, 3], [6, 8]]);
  });

  test("tracking error is 0 when the smoothed signal equals the centered average (linear motion)", () => {
    // Even frame spacing: the reference is a 5-FRAME average, so the motion must be linear per frame.
    const t = Array.from({ length: 100 }, (_, i) => i * 33.3);
    const raw = t.map((s) => frame(s * 0.1, 50));
    expect(trackingError({ t, raw, smoothed: raw })).toBeLessThan(1e-12);
  });
});

describe("Wilcoxon signed-rank (checked against scipy.stats.wilcoxon)", () => {
  test("exact test, no ties", () => {
    expect(wilcoxon([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).p).toBe(0.001953125);
    expect(wilcoxon([-1.5, 2.1, -0.3, -4.2, -2.2, 0.9, -3.1, -0.7, -1.9, 0.4]).p).toBe(0.16015625);
  });
  test("normal approximation with ties", () => {
    const r = wilcoxon([-1, -1, -2, 2, -3, -3, -3, 1, -4, -5]);
    expect(r.method).toMatch(/normal approximation/);
    expect(r.p).toBeCloseTo(0.0355643790581936, 6);
  });
  test("fewer than 8 non-zero pairs gives no p-value", () => {
    expect(wilcoxon([1, -2, 3, 0, 0, 0, 0, 0]).p).toBeNull();
  });
});
