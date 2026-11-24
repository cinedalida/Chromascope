/**
 * DEV only: raw landmark recorder for the AR smoothing experiment.
 *
 * Records the RAW MediaPipe landmarks (before any smoothing) for a fixed time after a
 * countdown, as coordinates only. It never captures images or video. The clip is saved
 * as a JSON download; raw clips belong in data/recordings/, which git ignores
 * (face geometry is biometric data under the Data Privacy Act of 2012).
 *
 * Clip format:
 *   { clipId, researcher, scenario, lighting, device, videoWidth, videoHeight, recordedAt,
 *     frames: [ { t, points: [[x, y, z], ...] }, { t, points: null }, ... ] }
 * t is milliseconds from the first recorded frame, on the same clock the smoother gets
 * (performance.now() at detection). points: null marks a frame with no face.
 */
export const COUNTDOWN_MS = 3000;
export const RECORD_MS = 10000;

export const RESEARCHERS = ["R1", "R2", "R3"];
export const SCENARIOS = ["still", "slowTurn", "fastTurn", "talking"];
export const LIGHTING = ["bright", "dim"];

/** Suggested clip id, e.g. "R2-still-bright-iphone13". */
export function suggestClipId({ researcher, scenario, lighting, device }) {
  const dev = String(device ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return [researcher, scenario, lighting, dev].filter(Boolean).join("-");
}

/** Safe file name for a clip id (letters, digits, dot, dash, underscore). */
export function clipFileName(clipId) {
  const safe = String(clipId).trim().replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${safe || "clip"}.json`;
}

/**
 * State machine: idle -> countdown -> recording -> done (or back to idle on cancel).
 * pushFrame() is fed every processed camera frame; the countdown and the recording
 * length are measured on those frame timestamps.
 */
export function createLandmarkRecorder({ countdownMs = COUNTDOWN_MS, durationMs = RECORD_MS } = {}) {
  let state = "idle";
  let meta = null;
  let countdownEnd = 0;
  let recordStart = 0;
  let frames = [];

  return {
    get state() {
      return state;
    },
    get frameCount() {
      return frames.length;
    },

    /** Starts the countdown. meta: { clipId, researcher, scenario, lighting, device, videoWidth, videoHeight }. */
    start(clipMeta, nowMs) {
      meta = { ...clipMeta, recordedAt: new Date().toISOString() };
      frames = [];
      countdownEnd = nowMs + countdownMs;
      state = "countdown";
    },

    /** Milliseconds left in the current countdown or recording, for the UI. */
    remainingMs(nowMs) {
      if (state === "countdown") return Math.max(0, countdownEnd - nowMs);
      if (state === "recording") return Math.max(0, recordStart + durationMs - nowMs);
      return 0;
    },

    /** One processed frame: raw points ([{ x, y, z }]) or null when no face was found. */
    pushFrame(timestampMs, points) {
      if (state === "countdown") {
        if (timestampMs < countdownEnd) return;
        state = "recording";
        recordStart = timestampMs;
      }
      if (state !== "recording") return;
      const t = timestampMs - recordStart;
      if (t >= durationMs) {
        state = "done";
        return;
      }
      frames.push({ t, points: points ? points.map((p) => [p.x, p.y, p.z]) : null });
    },

    cancel() {
      state = "idle";
      frames = [];
      meta = null;
    },

    /** The finished clip in the format above; null unless recording is done. */
    buildClip() {
      if (state !== "done" || meta === null) return null;
      const { clipId, researcher, scenario, lighting, device, videoWidth, videoHeight, recordedAt } = meta;
      return { clipId, researcher, scenario, lighting, device, videoWidth, videoHeight, recordedAt, frames };
    },
  };
}

/** Saves a clip as a JSON download in the browser (no network). */
export function downloadClip(clip) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(clip)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = clipFileName(clip.clipId);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
