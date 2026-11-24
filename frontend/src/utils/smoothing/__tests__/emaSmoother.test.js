// TC-U1 (part 2): the refactored EmaSmoother must reproduce the old smoother's golden output.
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { EmaSmoother } from "../EmaSmoother.js";
import { makeLandmarkStream } from "./fixtures.js";

const golden = JSON.parse(readFileSync(new URL("./ema_alpha0.5_golden.json", import.meta.url), "utf8"));

test("TC-U1: EmaSmoother (alpha 0.5) matches the golden output exactly", () => {
  const smoother = new EmaSmoother({ alpha: golden.alpha });
  const output = makeLandmarkStream().map(({ t, points }) => ({
    t,
    points: smoother.smooth(points, t).map((p) => [p.x, p.y, p.z]),
  }));
  expect(output).toStrictEqual(golden.output);
});
