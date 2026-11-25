// TC-U2 to TC-U7: behavior both smoothers must share, plus the One Euro low-pass check.
import { describe, expect, test } from "vitest";
import { EmaSmoother } from "../EmaSmoother.js";
import { OneEuroSmoother } from "../OneEuroSmoother.js";
import { smoothingAlpha } from "../LowPassFilter.js";
import { makeLandmarkStream, POINT_COUNT } from "./fixtures.js";

const SMOOTHERS = {
  "EMA (alpha 0.5)": () => new EmaSmoother({ alpha: 0.5 }),
  "One Euro (1, 0.01, 1)": () => new OneEuroSmoother({ minCutoff: 1, beta: 0.01, dCutoff: 1 }),
};
const TOL = 1e-12;
const stream = makeLandmarkStream();
const coords = (p) => [p.x, p.y, p.z];
const allFinite = (frame) => frame.every((p) => coords(p).every(Number.isFinite));

describe.each(Object.entries(SMOOTHERS))("%s", (_, make) => {
  test("TC-U2: constant input gives a constant output", () => {
    const s = make();
    const frame = stream[0].points;
    for (let f = 0; f < 30; f++) {
      const out = s.smooth(frame, f * 33);
      out.forEach((p, i) => {
        expect(Math.abs(p.x - frame[i].x)).toBeLessThan(TOL);
        expect(Math.abs(p.y - frame[i].y)).toBeLessThan(TOL);
        expect(Math.abs(p.z - frame[i].z)).toBeLessThan(TOL);
      });
    }
  });

  test("TC-U3: the first frame passes through unchanged", () => {
    const out = make().smooth(stream[0].points, 0);
    expect(out.map(coords)).toStrictEqual(stream[0].points.map(coords));
  });

  test("TC-U4: after reset(), the next output equals the new raw frame", () => {
    const s = make();
    for (let f = 0; f < 10; f++) s.smooth(stream[f].points, stream[f].t);
    s.reset();
    const out = s.smooth(stream[50].points, stream[50].t);
    expect(out.map(coords)).toStrictEqual(stream[50].points.map(coords));
  });

  test("TC-U5: 478 x 3 in gives 478 x 3 out, no NaN, a new array every frame", () => {
    const s = make();
    let previous = null;
    for (const { t, points } of stream) {
      const out = s.smooth(points, t);
      expect(out).toHaveLength(POINT_COUNT);
      expect(out.every((p) => Object.keys(p).sort().join() === "x,y,z")).toBe(true);
      expect(allFinite(out)).toBe(true);
      expect(out).not.toBe(previous);
      previous = out;
    }
  });

  test("TC-U7: uneven, repeated, negative and NaN timestamps give no NaN, Infinity or jumps", () => {
    const s = make();
    const times = [0, 0, 0, 5, 200, 201, 201, NaN, 300, -10, 400, 1400, 1401];
    const lo = stream[0].points.map(() => [Infinity, Infinity, Infinity]);
    const hi = stream[0].points.map(() => [-Infinity, -Infinity, -Infinity]);
    times.forEach((t, f) => {
      const raw = stream[f].points;
      raw.forEach((p, i) => coords(p).forEach((v, k) => {
        lo[i][k] = Math.min(lo[i][k], v);
        hi[i][k] = Math.max(hi[i][k], v);
      }));
      const out = s.smooth(raw, t);
      expect(allFinite(out)).toBe(true);
      // "No jumps": every output stays inside the range of the raw values seen so far.
      out.forEach((p, i) => coords(p).forEach((v, k) => {
        expect(v).toBeGreaterThanOrEqual(lo[i][k] - TOL);
        expect(v).toBeLessThanOrEqual(hi[i][k] + TOL);
      }));
    });
  });
});

test("TC-U6: One Euro with beta = 0 equals a fixed low-pass filter at minCutoff", () => {
  const minCutoff = 2;
  const s = new OneEuroSmoother({ minCutoff, beta: 0, dCutoff: 1 });
  let ref = null;
  let tPrev = null;
  for (const { t, points } of stream) {
    const out = s.smooth(points, t);
    if (ref === null) {
      ref = points.map(coords);
    } else {
      const a = smoothingAlpha(minCutoff, (t - tPrev) / 1000);
      ref = ref.map((r, i) => coords(points[i]).map((v, k) => a * v + (1 - a) * r[k]));
    }
    tPrev = t;
    out.forEach((p, i) => coords(p).forEach((v, k) => expect(Math.abs(v - ref[i][k])).toBeLessThan(TOL)));
  }
});
