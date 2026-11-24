import { useEffect, useRef, useState } from "react";
import {
  COUNTDOWN_MS,
  LIGHTING,
  RECORD_MS,
  RESEARCHERS,
  SCENARIOS,
  createLandmarkRecorder,
  downloadClip,
  suggestClipId,
} from "./landmarkRecorder.js";

/**
 * DEV only: form + Record button for the raw landmark recorder (landmarkRecorder.js).
 * ARTryOnPage loads it lazily behind import.meta.env.DEV, so production builds do not
 * include it. Frames arrive through rawFrameRef, which AROverlayCanvas calls once per
 * processed frame with the raw landmarks, before smoothing.
 */
export default function LandmarkRecorderPanel({ rawFrameRef, videoRef }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clipId: "", researcher: "R1", scenario: "still", lighting: "bright", device: "" });
  const [status, setStatus] = useState({ state: "idle", remainingMs: 0, frames: 0 });
  const [lastSaved, setLastSaved] = useState(null);
  const recorderRef = useRef(null);

  // Feed raw frames into the recorder while this panel is mounted.
  useEffect(() => {
    const recorder = createLandmarkRecorder();
    recorderRef.current = recorder;
    rawFrameRef.current = (timestampMs, points) => recorder.pushFrame(timestampMs, points);
    return () => {
      rawFrameRef.current = null;
      recorder.cancel();
    };
  }, [rawFrameRef]);

  // Refresh the countdown / progress, and save the clip once the recording is done.
  const active = status.state === "countdown" || status.state === "recording";
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const recorder = recorderRef.current;
      if (recorder.state === "done") {
        const clip = recorder.buildClip();
        downloadClip(clip);
        setLastSaved({ clipId: clip.clipId, frames: clip.frames.length, noFace: clip.frames.filter((f) => f.points === null).length });
        recorder.cancel();
        setStatus({ state: "idle", remainingMs: 0, frames: 0 });
        return;
      }
      setStatus({ state: recorder.state, remainingMs: recorder.remainingMs(performance.now()), frames: recorder.frameCount });
    }, 100);
    return () => clearInterval(id);
  }, [active]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const clipId = form.clipId.trim() || suggestClipId(form);

  const start = () => {
    const video = videoRef.current;
    recorderRef.current.start(
      {
        clipId,
        researcher: form.researcher,
        scenario: form.scenario,
        lighting: form.lighting,
        device: form.device.trim(),
        videoWidth: video?.videoWidth ?? null,
        videoHeight: video?.videoHeight ?? null,
      },
      performance.now()
    );
    setLastSaved(null);
    setStatus({ state: "countdown", remainingMs: COUNTDOWN_MS, frames: 0 });
  };
  const cancel = () => {
    recorderRef.current.cancel();
    setStatus({ state: "idle", remainingMs: 0, frames: 0 });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-70 rounded-full bg-black/80 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg"
      >
        Record landmarks (dev)
      </button>
    );
  }

  const field = "w-full rounded bg-white/10 px-2 py-1 text-white";
  return (
    <div className="fixed bottom-4 right-4 z-70 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-black/85 p-3 font-mono text-[10px] text-white shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold uppercase tracking-wider">Record landmarks (dev)</span>
        <button type="button" onClick={() => setOpen(false)} disabled={active} className="text-white/70 disabled:opacity-40">
          Close
        </button>
      </div>
      <p className="mb-2 text-white/60">
        Raw coordinates only, no images. {COUNTDOWN_MS / 1000} s countdown, then {RECORD_MS / 1000} s. Move the file to data/recordings/.
      </p>
      <fieldset disabled={active} className="grid gap-1.5">
        <label className="grid gap-0.5">
          Clip ID
          <input className={field} value={form.clipId} placeholder={suggestClipId(form)} onChange={set("clipId")} />
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="grid gap-0.5">
            Researcher
            <select className={field} value={form.researcher} onChange={set("researcher")}>
              {RESEARCHERS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="grid gap-0.5">
            Scenario
            <select className={field} value={form.scenario} onChange={set("scenario")}>
              {SCENARIOS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="grid gap-0.5">
            Lighting
            <select className={field} value={form.lighting} onChange={set("lighting")}>
              {LIGHTING.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-0.5">
          Device
          <input className={field} value={form.device} placeholder="e.g. iPhone 13" onChange={set("device")} />
        </label>
      </fieldset>
      <div className="mt-2 flex items-center gap-2">
        {active ? (
          <>
            <span data-testid="recorder-status" className="flex-1">
              {status.state === "countdown"
                ? `Starting in ${Math.ceil(status.remainingMs / 1000)}…`
                : `Recording ${Math.ceil(status.remainingMs / 1000)} s · ${status.frames} frames`}
            </span>
            <button type="button" onClick={cancel} className="rounded-full bg-white/15 px-3 py-1 font-bold">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={start} className="flex-1 rounded-full bg-red-600 px-3 py-1.5 font-bold uppercase tracking-wider">
            Record
          </button>
        )}
      </div>
      {lastSaved && (
        <p data-testid="recorder-saved" className="mt-2 text-[#00E676]">
          Saved {lastSaved.clipId}: {lastSaved.frames} frames ({lastSaved.noFace} without a face)
        </p>
      )}
    </div>
  );
}
