// TC-I1: the replay harness is deterministic, and tuning can never see test clips.
import { describe, expect, test } from "vitest";
import { replayRows } from "../replay.mjs";
import { CSV_COLUMNS, parseCsv, toCsv, validateClip } from "../replayCore.js";
import { assertTuningClips } from "../tune.mjs";
import { summarize } from "../summarize.mjs";
import { syntheticClip } from "./synthetic.js";

const clips = [
  syntheticClip({ researcher: "R2", scenario: "still", seed: 1 }),
  syntheticClip({ researcher: "R2", scenario: "slowTurn", seed: 2, gapAt: 40 }),
  syntheticClip({ researcher: "R3", scenario: "talking", seed: 3 }),
];
const conditions = [
  { name: "raw", type: "raw", params: {} },
  { name: "ema0.5", type: "ema", params: { alpha: 0.5 } },
  { name: "oneeuro", type: "oneeuro", params: { minCutoff: 1, beta: 10, dCutoff: 1 } },
];

describe("TC-I1", () => {
  test("replaying the same clips twice gives an identical CSV", () => {
    const a = toCsv(CSV_COLUMNS, replayRows(clips, conditions));
    const b = toCsv(CSV_COLUMNS, replayRows(clips, conditions));
    expect(a).toBe(b);
    expect(a.split("\n")[0]).toBe(CSV_COLUMNS.join(","));
    expect(a.trim().split("\n")).toHaveLength(1 + clips.length * conditions.length);
  });

  test("without --timing, msPerFrame is empty; jitter only on still clips, lag and tracking error on the rest", () => {
    const rows = parseCsv(toCsv(CSV_COLUMNS, replayRows(clips, conditions)));
    expect(rows.every((r) => r.msPerFrame === "")).toBe(true);
    for (const r of rows) {
      if (r.scenario === "still") expect([r.jitter !== "", r.lagMs, r.trackErr]).toStrictEqual([true, "", ""]);
      else expect([r.jitter, r.lagMs !== "", r.trackErr !== ""]).toStrictEqual(["", true, true]);
    }
  });

  test("the CSV round-trips through the summary step", () => {
    const rows = parseCsv(toCsv(CSV_COLUMNS, replayRows(clips, conditions)));
    const { overall, tradeoff } = summarize(rows);
    expect(overall.map((o) => o.metric)).toStrictEqual(["jitter", "lagMs", "trackErr"]);
    expect(tradeoff.map((r) => r.condition)).toStrictEqual(["raw", "ema0.5", "oneeuro"]);
  });

  test("tuning refuses any clip that is not R1", () => {
    expect(() => assertTuningClips([{ clipId: "R1-a", researcher: "R1" }])).not.toThrow();
    expect(() => assertTuningClips([{ clipId: "R1-a", researcher: "R1" }, { clipId: "R3-b", researcher: "R3" }])).toThrow(/R1 clips only.*R3-b/);
  });

  test("a malformed clip is rejected with its name", () => {
    const bad = { ...clips[0], videoWidth: undefined };
    expect(() => validateClip(bad, "bad.json")).toThrow(/bad\.json.*videoWidth/);
  });
});
