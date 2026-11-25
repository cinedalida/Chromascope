#!/usr/bin/env node
/**
 * One Euro tuning on R1 clips ONLY (report Sec. 11, tuning and test split).
 *
 *   node tools/replay/tune.mjs --clips data/recordings [--grid-out results/tuning_grid.csv] [--tuned-out tools/replay/tuned.json]
 *
 * Grid (log scale): minCutoff in Hz; beta in normalized units per second. The smoother runs on
 * normalized coordinates (0..1 of the frame), as in the app, so the plan's pixel-unit beta grid
 * {0, 0.0001 ... 0.1} is multiplied by 1000 (a typical frame width) (decision 1a). dCutoff is fixed at 1.
 *
 * Selection rule (pre-registered): among settings whose median lag on R1 movement clips is not higher
 * than EMA alpha 0.5's, pick the lowest mean jitter on R1 still clips (ties: earlier in grid order).
 * If none qualify, report it and pick the lowest median lag (ties: lower jitter).
 *
 * Grid widening (pre-registered): if the chosen minCutoff is the smallest or largest tried, or the chosen
 * beta is the largest tried, add one step in that direction (minCutoff x0.5 or x2, beta x3) and evaluate
 * again, at most MAX_WIDENINGS times. Every widening is recorded in tuned.json.
 */
import { pathToFileURL } from "node:url";
import { MOVEMENT_SCENARIOS, clipMetrics, loadClips, parseArgs, toCsv, writeText } from "./replayCore.js";
import { mean, median } from "./metrics.js";

export const MIN_CUTOFFS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4];
export const BETAS = [0, 0.1, 0.3, 1, 3, 10, 30, 100];
export const D_CUTOFF = 1.0;
export const MAX_WIDENINGS = 3;
export const BASELINE = { name: "ema0.5", type: "ema", params: { alpha: 0.5 } };

/** Throws if any clip that is not R1 would be used for tuning. */
export function assertTuningClips(clips) {
  const other = clips.filter((c) => c.researcher !== "R1");
  if (other.length) {
    throw new Error(`Tuning must use R1 clips only; refusing: ${other.map((c) => c.clipId).join(", ")}`);
  }
}

/** Mean jitter on still clips and median lag on movement clips for one condition. */
function score(stillClips, moveClips, condition) {
  const jit = stillClips.map((c) => clipMetrics(c, condition).jitter).filter((v) => v !== null);
  const lags = moveClips.map((c) => clipMetrics(c, condition).lagMs).filter((v) => v !== null);
  return { meanJitterStill: mean(jit), medianLagMove: median(lags), nStill: jit.length, nMove: lags.length };
}

const key = (m, b) => `${m}|${b}`;

export function tune(allClips) {
  const r1 = allClips.filter((c) => c.researcher === "R1");
  assertTuningClips(r1);
  const still = r1.filter((c) => c.scenario === "still");
  const move = r1.filter((c) => MOVEMENT_SCENARIOS.includes(c.scenario));
  if (!still.length || !move.length) throw new Error(`Need R1 still and movement clips (found ${still.length} still, ${move.length} movement).`);

  const baseline = score(still, move, BASELINE);
  const minCutoffs = [...MIN_CUTOFFS];
  const betas = [...BETAS];
  const results = new Map();
  const widenings = [];

  const evaluateGrid = () => {
    for (const m of minCutoffs) {
      for (const b of betas) {
        if (results.has(key(m, b))) continue;
        const condition = { name: "oneeuro", type: "oneeuro", params: { minCutoff: m, beta: b, dCutoff: D_CUTOFF } };
        const s = score(still, move, condition);
        results.set(key(m, b), { minCutoff: m, beta: b, dCutoff: D_CUTOFF, ...s, qualifies: s.medianLagMove !== null && s.medianLagMove <= baseline.medianLagMove });
      }
    }
  };
  const ordered = () => minCutoffs.flatMap((m) => betas.map((b) => results.get(key(m, b))));
  const pick = () => {
    const rows = ordered();
    const qualified = rows.filter((r) => r.qualifies && r.meanJitterStill !== null);
    if (qualified.length) {
      return { best: qualified.reduce((a, r) => (r.meanJitterStill < a.meanJitterStill ? r : a)), noneQualified: false };
    }
    const measured = rows.filter((r) => r.medianLagMove !== null);
    const best = measured.reduce((a, r) => (r.medianLagMove < a.medianLagMove || (r.medianLagMove === a.medianLagMove && r.meanJitterStill < a.meanJitterStill) ? r : a));
    return { best, noneQualified: true };
  };

  evaluateGrid();
  let { best, noneQualified } = pick();
  for (let round = 0; round < MAX_WIDENINGS; round++) {
    const steps = [];
    const lo = Math.min(...minCutoffs);
    const hi = Math.max(...minCutoffs);
    const bHi = Math.max(...betas);
    if (best.minCutoff === lo) steps.push(["minCutoff", lo / 2, () => minCutoffs.unshift(lo / 2)]);
    if (best.minCutoff === hi) steps.push(["minCutoff", hi * 2, () => minCutoffs.push(hi * 2)]);
    if (best.beta === bHi && bHi > 0) steps.push(["beta", bHi * 3, () => betas.push(bHi * 3)]);
    if (!steps.length) break;
    for (const [param, value, apply] of steps) {
      apply();
      widenings.push({ round: round + 1, param, added: value });
    }
    evaluateGrid();
    ({ best, noneQualified } = pick());
  }
  const edge = [];
  if (best.minCutoff === Math.min(...minCutoffs) || best.minCutoff === Math.max(...minCutoffs)) edge.push("minCutoff");
  if (best.beta === Math.max(...betas) && best.beta > 0) edge.push("beta");

  return {
    tuned: {
      minCutoff: best.minCutoff,
      beta: best.beta,
      dCutoff: D_CUTOFF,
      units: { minCutoff: "Hz", beta: "normalized units per second (plan grid x 1000)", dCutoff: "Hz" },
      selection: noneQualified ? "no setting had median lag <= EMA 0.5; lowest median lag chosen" : "lowest mean still jitter among settings with median lag <= EMA 0.5",
      noneQualified,
      meanJitterStill: best.meanJitterStill,
      medianLagMove: best.medianLagMove,
      baselineEma05: { meanJitterStill: baseline.meanJitterStill, medianLagMove: baseline.medianLagMove },
      widenings,
      stillOnGridEdge: edge,
      gridSize: results.size,
      r1Clips: { still: still.map((c) => c.clipId), movement: move.map((c) => c.clipId) },
    },
    grid: [...results.values()].sort((a, b) => a.minCutoff - b.minCutoff || a.beta - b.beta),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    clips: "data/recordings",
    "grid-out": "results/tuning_grid.csv",
    "tuned-out": "tools/replay/tuned.json",
  });
  const { tuned, grid } = tune(loadClips(args.clips));
  writeText(args["grid-out"], toCsv(["minCutoff", "beta", "dCutoff", "meanJitterStill", "medianLagMove", "qualifies", "nStill", "nMove"], grid));
  writeText(args["tuned-out"], JSON.stringify(tuned, null, 2) + "\n");
  console.log(`Tried ${tuned.gridSize} settings on ${tuned.r1Clips.still.length} still + ${tuned.r1Clips.movement.length} movement R1 clips.`);
  console.log(`Chosen: minCutoff ${tuned.minCutoff} Hz, beta ${tuned.beta}, dCutoff ${tuned.dCutoff} (${tuned.selection}).`);
  if (tuned.widenings.length) console.log(`Grid widened: ${tuned.widenings.map((w) => `${w.param} +${w.added}`).join(", ")}.`);
  if (tuned.stillOnGridEdge.length) console.log(`Best value still on the grid edge for: ${tuned.stillOnGridEdge.join(", ")}.`);
  console.log(`Wrote ${args["tuned-out"]} and ${args["grid-out"]}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
