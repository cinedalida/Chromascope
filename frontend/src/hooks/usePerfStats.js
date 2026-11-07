import { useCallback, useEffect, useRef, useState } from "react";

/**
 * usePerfStats: frame-rate and latency meter for the AR try-on loop.
 *
 * Definitions (reported in the paper for survey items TR1–TR3):
 *  - FPS: AR frames processed per second, i.e. frames in which face detection
 *    and overlay drawing actually ran.
 *  - Latency: time to process one such frame (MediaPipe detection + landmark
 *    smoothing + canvas drawing), in milliseconds.
 *
 * The AR loop calls `recordFrame(latencyMs)` once per processed frame. Samples
 * live in a ref (no re-render per frame); the displayed values refresh every
 * `refreshMs`. "Live" = the last 1 s; "avg" = the last `windowSec` seconds
 * (30 s by default, the window participants read in the survey).
 */
export function usePerfStats({ enabled = true, windowSec = 30, refreshMs = 500 } = {}) {
  const samplesRef = useRef([]); // [{ t: ms timestamp, ms: latency }]
  const startRef = useRef(null);
  const [stats, setStats] = useState(null);

  const recordFrame = useCallback(
    (latencyMs) => {
      if (!enabled) return;
      const t = performance.now();
      if (startRef.current === null) startRef.current = t;
      samplesRef.current.push({ t, ms: latencyMs });
    },
    [enabled]
  );

  const reset = useCallback(() => {
    samplesRef.current = [];
    startRef.current = null;
    setStats(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const now = performance.now();
      const windowMs = windowSec * 1000;
      const samples = samplesRef.current;
      // Drop samples older than the averaging window.
      while (samples.length && samples[0].t < now - windowMs) samples.shift();
      if (startRef.current === null || samples.length === 0) {
        setStats(null);
        return;
      }

      const live = samples.filter((s) => s.t >= now - 1000);
      const elapsedSec = Math.min((now - startRef.current) / 1000, windowSec);
      const mean = (arr) => arr.reduce((sum, s) => sum + s.ms, 0) / arr.length;

      setStats({
        liveFps: live.length,
        liveLatencyMs: live.length ? mean(live) : null,
        avgFps: elapsedSec > 0 ? samples.length / elapsedSec : 0,
        avgLatencyMs: mean(samples),
        elapsedSec,
        windowSec,
        windowFull: elapsedSec >= windowSec,
      });
    }, refreshMs);
    return () => {
      // Turning the meter off (or leaving the page) starts the next session from zero.
      clearInterval(id);
      samplesRef.current = [];
      startRef.current = null;
      setStats(null);
    };
  }, [enabled, windowSec, refreshMs]);

  return { stats: enabled ? stats : null, recordFrame, reset };
}
