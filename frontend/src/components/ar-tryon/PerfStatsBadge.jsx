import { Activity } from "lucide-react";

const fmt = (v, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? "–" : v.toFixed(digits));

/**
 * Small FPS / latency readout shown over the AR feed when the
 * "Show performance stats" setting is on. Participants read the 30-second
 * average from here for survey items TR1–TR3.
 */
export function PerfStatsBadge({ stats }) {
  return (
    <div
      data-testid="perf-stats"
      className="pointer-events-none absolute left-3 top-3 z-10 rounded-2xl bg-black/65 px-3 py-2 font-mono text-[11px] leading-tight text-white shadow-lg backdrop-blur-md sm:left-4 sm:top-4 sm:text-xs"
    >
      <div className="mb-1 flex items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-wider text-white/70">
        <Activity size={12} strokeWidth={2.5} />
        Performance
      </div>
      {!stats ? (
        <div data-testid="perf-waiting">Waiting for camera…</div>
      ) : (
        <>
          <div data-testid="perf-live">
            Live: {fmt(stats.liveFps)} FPS · {fmt(stats.liveLatencyMs)} ms
          </div>
          {stats.windowFull ? (
            <div data-testid="perf-avg" className="mt-0.5 font-bold text-[#00E676]">
              {stats.windowSec} s avg: {fmt(stats.avgFps, 1)} FPS · {fmt(stats.avgLatencyMs)} ms
            </div>
          ) : (
            <div data-testid="perf-measuring" className="mt-0.5 text-white/70">
              Measuring {stats.windowSec} s avg… {Math.floor(stats.elapsedSec)} / {stats.windowSec} s
            </div>
          )}
        </>
      )}
    </div>
  );
}
