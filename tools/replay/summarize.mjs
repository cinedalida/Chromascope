#!/usr/bin/env node
/**
 * Paired comparison on the TEST clips (R2 and R3 only): One Euro minus EMA alpha 0.5, per clip.
 *
 *   node tools/replay/summarize.mjs --results results/results.csv [--summary-out results/summary.csv] [--tradeoff-out results/tradeoff.csv]
 *
 * summary.csv: one "clip" row per clip and metric (One Euro, EMA 0.5, difference), then one "overall"
 * row per metric (n, mean and median difference, clips where One Euro was better, Wilcoxon).
 * Lower is better for every metric, so a negative difference means One Euro was better.
 * Wilcoxon signed-rank (two-sided) only with 8 or more non-zero paired differences: the exact test when
 * no absolute differences are tied, else the normal approximation with tie and continuity correction.
 *
 * tradeoff.csv: one row per condition over the test clips (mean still jitter, median movement lag,
 * mean tracking error) for the jitter-vs-lag chart (Figure 2).
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { mean, median } from "./metrics.js";
import { parseArgs, parseCsv, toCsv, writeText } from "./replayCore.js";

export const TEST_RESEARCHERS = ["R2", "R3"];
export const MIN_WILCOXON_PAIRS = 8;
const METRICS = ["jitter", "lagMs", "trackErr"];
const num = (s) => (s === "" || s === undefined ? null : Number(s));

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e-7). */
function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Two-sided Wilcoxon signed-rank test on paired differences. Zeros are dropped. */
export function wilcoxon(diffs) {
  const d = diffs.filter((v) => v !== 0);
  const n = d.length;
  if (n < MIN_WILCOXON_PAIRS) return { n, p: null, method: `too few non-zero pairs (${n} < ${MIN_WILCOXON_PAIRS})` };
  const order = d.map((v, i) => ({ a: Math.abs(v), i })).sort((x, y) => x.a - y.a);
  const ranks = new Array(n);
  let ties = false;
  let tieTerm = 0;
  for (let k = 0; k < n; ) {
    let e = k;
    while (e + 1 < n && order[e + 1].a === order[k].a) e++;
    const size = e - k + 1;
    if (size > 1) {
      ties = true;
      tieTerm += size ** 3 - size;
    }
    for (let q = k; q <= e; q++) ranks[order[q].i] = (k + e) / 2 + 1;
    k = e + 1;
  }
  const wPlus = d.reduce((s, v, i) => s + (v > 0 ? ranks[i] : 0), 0);
  if (!ties) {
    const max = (n * (n + 1)) / 2;
    const counts = new Array(max + 1).fill(0);
    counts[0] = 1;
    for (let r = 1; r <= n; r++) for (let s = max; s >= r; s--) counts[s] += counts[s - r];
    const total = 2 ** n;
    let below = 0;
    for (let s = 0; s <= wPlus; s++) below += counts[s];
    let above = 0;
    for (let s = wPlus; s <= max; s++) above += counts[s];
    return { n, wPlus, p: Math.min(1, (2 * Math.min(below, above)) / total), method: "exact" };
  }
  const mu = (n * (n + 1)) / 4;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieTerm / 48);
  const z = (Math.abs(wPlus - mu) - 0.5) / sigma;
  return { n, wPlus, p: Math.min(1, 2 * (1 - normalCdf(z))), method: "normal approximation (tie + continuity corrected)" };
}

export function summarize(rows) {
  const test = rows.filter((r) => TEST_RESEARCHERS.includes(r.researcher));
  if (!test.some((r) => r.condition === "oneeuro")) throw new Error("No oneeuro rows for R2/R3 clips: run tune.mjs, then replay.mjs, first.");
  const byClip = new Map();
  for (const r of test) {
    if (!byClip.has(r.clipId)) byClip.set(r.clipId, {});
    byClip.get(r.clipId)[r.condition] = r;
  }
  const clipRows = [];
  const overall = [];
  for (const metric of METRICS) {
    const diffs = [];
    for (const [clipId, conds] of [...byClip.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const oe = num(conds.oneeuro?.[metric]);
      const ema = num(conds["ema0.5"]?.[metric]);
      if (oe === null || ema === null) continue;
      const diff = oe - ema;
      diffs.push(diff);
      clipRows.push({ level: "clip", metric, clipId, researcher: conds.oneeuro.researcher, scenario: conds.oneeuro.scenario, lighting: conds.oneeuro.lighting, device: conds.oneeuro.device, oneEuro: oe, ema05: ema, diff });
    }
    const w = wilcoxon(diffs);
    overall.push({
      level: "overall",
      metric,
      n: diffs.length,
      meanDiff: mean(diffs),
      medianDiff: median(diffs),
      nOneEuroBetter: diffs.filter((v) => v < 0).length,
      nTies: diffs.filter((v) => v === 0).length,
      wilcoxonP: w.p,
      wilcoxonMethod: diffs.length < MIN_WILCOXON_PAIRS ? `too few paired clips (${diffs.length} < ${MIN_WILCOXON_PAIRS})` : w.method,
    });
  }
  const conditions = [...new Set(test.map((r) => r.condition))];
  const tradeoff = conditions.map((condition) => {
    const rs = test.filter((r) => r.condition === condition);
    const vals = (m) => rs.map((r) => num(r[m])).filter((v) => v !== null);
    return { condition, params: rs[0].params, meanJitterStill: mean(vals("jitter")), medianLagMs: median(vals("lagMs")), meanTrackErr: mean(vals("trackErr")), nClips: new Set(rs.map((r) => r.clipId)).size };
  });
  return { clipRows, overall, tradeoff };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    results: "results/results.csv",
    "summary-out": "results/summary.csv",
    "tradeoff-out": "results/tradeoff.csv",
  });
  const { clipRows, overall, tradeoff } = summarize(parseCsv(readFileSync(args.results, "utf8")));
  const cols = ["level", "metric", "clipId", "researcher", "scenario", "lighting", "device", "oneEuro", "ema05", "diff", "n", "meanDiff", "medianDiff", "nOneEuroBetter", "nTies", "wilcoxonP", "wilcoxonMethod"];
  writeText(args["summary-out"], toCsv(cols, [...clipRows, ...overall]));
  writeText(args["tradeoff-out"], toCsv(["condition", "params", "meanJitterStill", "medianLagMs", "meanTrackErr", "nClips"], tradeoff));
  for (const o of overall) {
    console.log(`${o.metric}: n=${o.n}, mean diff ${o.meanDiff}, median diff ${o.medianDiff}, One Euro better on ${o.nOneEuroBetter}; Wilcoxon: ${o.wilcoxonP ?? "-"} (${o.wilcoxonMethod})`);
  }
  console.log(`Wrote ${args["summary-out"]} and ${args["tradeoff-out"]}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
