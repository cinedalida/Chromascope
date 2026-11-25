// TC-U8: the factory picks the right strategy and falls back to the EMA with a warning.
import { afterEach, expect, test, vi } from "vitest";
import { createSmoother } from "../createSmoother.js";
import { EmaSmoother } from "../EmaSmoother.js";
import { OneEuroSmoother } from "../OneEuroSmoother.js";

afterEach(() => vi.restoreAllMocks());

test("TC-U8: no type gives the EMA with alpha 0.5, and no warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const s = createSmoother();
  expect(s).toBeInstanceOf(EmaSmoother);
  expect(s.alpha).toBe(0.5);
  expect(warn).not.toHaveBeenCalled();
});

test("TC-U8: 'oneeuro' gives the One Euro smoother with the given params", () => {
  const s = createSmoother({ type: "oneeuro", minCutoff: 0.5, beta: 3, dCutoff: 1 });
  expect(s).toBeInstanceOf(OneEuroSmoother);
  expect([s.minCutoff, s.beta, s.dCutoff]).toStrictEqual([0.5, 3, 1]);
});

test("TC-U8: an unknown type gives the EMA plus one console warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const s = createSmoother({ type: "kalman", alpha: 0.7 });
  expect(s).toBeInstanceOf(EmaSmoother);
  expect(s.alpha).toBe(0.7);
  expect(warn).toHaveBeenCalledTimes(1);
});
