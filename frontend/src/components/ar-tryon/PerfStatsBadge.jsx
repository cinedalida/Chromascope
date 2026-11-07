import { Activity } from "lucide-react";

const fmt = (v, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? "–" : v.toFixed(digits));

/**
 * Small FPS / latency readout shown over the AR feed when the
 * "Show performance stats" setting is on. Participants read the 30-second
 * average from here for survey items TR1–TR3. The average starts at the
 * first tracked face and stays fixed once the 30 s are up.
 */
export function PerfStatsBadge({ stats }) {
  return (
    <div
      data-testid="perf-stats"
      className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl bg-black/65 px-2.5 py-1.5 font-mono text-[10px] leading-snug text-white shadow-lg backdrop-blur-md sm:left-4 sm:top-4"
    >
      <div className="flex items-center gap-1.5">
        <Activity size={11} strokeWidth={2.5} className="shrink-0 text-white/70" aria-hidden="true" />
        {!stats ? (
          <span data-testid="perf-waiting">Waiting for camera…</span>
        ) : (
          <span data-testid="perf-live">
            Live: {fmt(stats.liveFps)} FPS · {fmt(stats.liveLatencyMs)} ms
          </span>
        )}
      </div>
      {stats && (
        !stats.started ? (
          <div data-testid="perf-waiting-face" className="text-[9px] text-white/70">
            Waiting for a face…
          </div>
        ) : stats.windowFull ? (
          <>
            <div data-testid="perf-avg" className="font-bold text-[#00E676]">
              {stats.windowSec} s avg: {fmt(stats.avgFps, 1)} FPS · {fmt(stats.avgLatencyMs)} ms
            </div>
            <div data-testid="perf-face-share" className="text-[9px] text-white/70">
              Face in {fmt(stats.faceShare * 100)}% of frames
            </div>
          </>
        ) : (
          <div data-testid="perf-measuring" className="text-[9px] text-white/70">
            Measuring {stats.windowSec} s avg… {Math.floor(stats.elapsedSec)} / {stats.windowSec} s
          </div>
        )
      )}
    </div>
  );
}
