#!/usr/bin/env node
/**
 * Replay harness (FR7): runs every condition over every recorded clip and writes one CSV row per
 * clip x condition.
 *
 *   node tools/replay/replay.mjs --clips data/recordings --conditions tools/replay/conditions.json --out results/results.csv [--timing]
 *
 * Deterministic (NFR4, TC-I1): the same clips give a byte-identical CSV. msPerFrame ("Node replay
 * time") is a time measurement and changes between runs, so it is written only with --timing; the
 * in-app smoothing time (FR8) is the number used for NFR1.
 */
import { pathToFileURL } from "node:url";
import { CSV_COLUMNS, clipMetrics, loadClips, loadConditions, parseArgs, toCsv, writeText } from "./replayCore.js";

export function replayRows(clips, conditions, { timing = false } = {}) {
  const rows = [];
  for (const clip of clips) {
    for (const condition of conditions) {
      const m = clipMetrics(clip, condition, { timing });
      rows.push({
        clipId: clip.clipId,
        researcher: clip.researcher,
        scenario: clip.scenario,
        lighting: clip.lighting,
        device: clip.device,
        condition: condition.name,
        params: JSON.stringify(condition.params),
        ...m,
      });
    }
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    clips: "data/recordings",
    conditions: "tools/replay/conditions.json",
    out: "results/results.csv",
    timing: false,
  });
  const clips = loadClips(args.clips);
  if (clips.length === 0) throw new Error(`No clips found in ${args.clips}`);
  const conditions = loadConditions(args.conditions);
  const rows = replayRows(clips, conditions, { timing: args.timing === true });
  writeText(args.out, toCsv(CSV_COLUMNS, rows));
  console.log(`Wrote ${rows.length} rows (${clips.length} clips x ${conditions.length} conditions) to ${args.out}${args.timing === true ? " with timing" : ""}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
