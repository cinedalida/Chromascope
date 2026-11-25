/**
 * Shared replay code: load clips, run one condition over a clip exactly as the app does, compute the
 * clip's metrics, and write CSV. Uses the app's own smoother classes, so the replay and the try-on run
 * the same code (report Sec. 8, "Why a factory").
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createSmoother } from "../../frontend/src/utils/smoothing/createSmoother.js";
import { countFrames, jitter, lagMs, trackingError } from "./metrics.js";

export const POINT_COUNT = 478;
export const SCENARIOS = ["still", "slowTurn", "fastTurn", "talking"];
export const MOVEMENT_SCENARIOS = ["slowTurn", "fastTurn", "talking"];
export const CSV_COLUMNS = ["clipId", "researcher", "scenario", "lighting", "device", "condition", "params", "nFrames", "jitter", "lagMs", "trackErr", "msPerFrame"];

/** Reads every *.json clip in dir, sorted by file name so runs are deterministic. */
export function loadClips(dir) {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json")).sort();
  return files.map((file) => {
    const clip = JSON.parse(readFileSync(join(dir, file), "utf8"));
    validateClip(clip, file);
    return clip;
  });
}

export function validateClip(clip, file = clip?.clipId) {
  const fail = (why) => {
    throw new Error(`Clip ${file}: ${why}`);
  };
  if (!clip || typeof clip !== "object") fail("not a JSON object");
  for (const key of ["clipId", "researcher", "scenario", "lighting", "device"]) {
    if (typeof clip[key] !== "string") fail(`missing ${key}`);
  }
  if (!SCENARIOS.includes(clip.scenario)) fail(`unknown scenario "${clip.scenario}"`);
  if (!(clip.videoWidth > 0) || !(clip.videoHeight > 0)) fail("missing videoWidth / videoHeight");
  if (!Array.isArray(clip.frames) || clip.frames.length === 0) fail("no frames");
  for (const [i, f] of clip.frames.entries()) {
    if (typeof f.t !== "number" || !Number.isFinite(f.t)) fail(`frame ${i} has no numeric t`);
    if (f.points !== null && (!Array.isArray(f.points) || f.points.length !== POINT_COUNT)) {
      fail(`frame ${i} does not have ${POINT_COUNT} points`);
    }
    if (i > 0 && f.t < clip.frames[i - 1].t) fail(`frame ${i} goes back in time`);
  }
}

/**
 * Reads the condition list. "params": "tuned" is replaced by tools/replay/tuned.json (next to the
 * conditions file); if that file does not exist yet, the condition is skipped with a warning.
 */
export function loadConditions(path) {
  const { conditions } = JSON.parse(readFileSync(path, "utf8"));
  const tunedPath = join(dirname(resolve(path)), "tuned.json");
  const out = [];
  for (const c of conditions) {
    if (c.params === "tuned") {
      if (!existsSync(tunedPath)) {
        console.warn(`Skipping condition "${c.name}": ${tunedPath} does not exist yet (run tune.mjs first).`);
        continue;
      }
      const tuned = JSON.parse(readFileSync(tunedPath, "utf8"));
      out.push({ ...c, params: { minCutoff: tuned.minCutoff, beta: tuned.beta, dCutoff: tuned.dCutoff } });
    } else {
      out.push({ ...c, params: c.params ?? {} });
    }
  }
  return out;
}

const toPixels = (points, w, h) => points.map((p) => [p[0] * w, p[1] * h]);

/**
 * Runs one condition over one clip the way AROverlayCanvas does: smooth each face frame with its
 * timestamp, reset() on a faceless frame. Returns the pixel signals for the metrics plus the time spent
 * in smooth() alone.
 *   condition: { name, type: "raw" | "ema" | "oneeuro", params }
 */
export function replayClip(clip, condition) {
  const w = clip.videoWidth;
  const h = clip.videoHeight;
  const smoother = condition.type === "raw" ? null : createSmoother({ type: condition.type, ...condition.params });
  const t = [];
  const raw = [];
  const smoothed = [];
  let smoothMs = 0;
  let smoothCalls = 0;
  for (const frame of clip.frames) {
    t.push(frame.t);
    if (frame.points === null) {
      smoother?.reset();
      raw.push(null);
      smoothed.push(null);
      continue;
    }
    const rawPx = toPixels(frame.points, w, h);
    raw.push(rawPx);
    if (!smoother) {
      smoothed.push(rawPx);
      continue;
    }
    const pts = frame.points.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    const start = performance.now();
    const out = smoother.smooth(pts, frame.t);
    smoothMs += performance.now() - start;
    smoothCalls++;
    smoothed.push(out.map((p) => [p.x * w, p.y * h]));
  }
  return { t, raw, smoothed, smoothMs, smoothCalls };
}

/** Metrics for one clip under one condition: jitter on still clips, lag and tracking error on the rest. */
export function clipMetrics(clip, condition, { timing = false } = {}) {
  const run = replayClip(clip, condition);
  const still = clip.scenario === "still";
  return {
    nFrames: countFrames(run),
    jitter: still ? jitter(run) : null,
    lagMs: still ? null : lagMs(run),
    trackErr: still ? null : trackingError(run),
    msPerFrame: timing && run.smoothCalls > 0 ? run.smoothMs / run.smoothCalls : null,
  };
}

function csvField(value) {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns, rows) {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => csvField(r[c])).join(","))].join("\n") + "\n";
}

/** Minimal CSV parser for the files these scripts write (quoted fields, "" escapes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1 || r[0] !== "").map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function writeText(path, text) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, text);
}

/** Tiny --flag value parser. */
export function parseArgs(argv, defaults) {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}
