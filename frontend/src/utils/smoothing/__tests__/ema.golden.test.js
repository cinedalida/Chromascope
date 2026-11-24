// TC-U1 (part 1): locks in the current EMA smoother's output before the refactor.
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { makeLandmarkStream, createPrng, POINT_COUNT, FRAME_COUNT } from "./fixtures.js";
import { GOLDEN_ALPHA, runOriginalEma } from "./emaGolden.js";

const golden = JSON.parse(readFileSync(new URL("./ema_alpha0.5_golden.json", import.meta.url), "utf8"));

describe("fixture stream", () => {
  test("is deterministic and has the expected shape", () => {
    const a = makeLandmarkStream();
    const b = makeLandmarkStream();
    expect(a).toHaveLength(FRAME_COUNT);
    expect(a[0].points).toHaveLength(POINT_COUNT);
    expect(a).toStrictEqual(b);
    expect(a[1].t - a[0].t).toBe(33);
  });

  test("seeded PRNG gives the same sequence for the same seed", () => {
    const r1 = createPrng(1);
    const r2 = createPrng(1);
    for (let i = 0; i < 5; i++) expect(r1()).toBe(r2());
  });
});

describe("EMA golden output", () => {
  test("golden file matches its recorded settings", () => {
    expect(golden.alpha).toBe(GOLDEN_ALPHA);
    expect(golden.output).toHaveLength(FRAME_COUNT);
    expect(golden.output[0].points).toHaveLength(POINT_COUNT);
  });

  test("TC-U1: smoothLandmarks (alpha 0.5) matches the golden output exactly", () => {
    expect(runOriginalEma(GOLDEN_ALPHA)).toStrictEqual(golden.output);
  });

  test("first golden frame equals the raw first frame", () => {
    const first = makeLandmarkStream()[0].points.map((p) => [p.x, p.y, p.z]);
    expect(golden.output[0].points).toStrictEqual(first);
  });
});
