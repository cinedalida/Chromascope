import { useCallback, useEffect, useRef, useState } from "react";

/**
 * usePerfStats: frame-rate and latency meter for the AR try-on loop.
 *
 * Definitions (reported in the paper for survey items TR1–TR3):
 *  - FPS: AR frames processed per second, i.e. frames in which face detection
 *    ran. Frames with no face still count, so a lost face does not lower FPS.
 *  - Latency: time to process one frame (MediaPipe detection + landmark
 *    smoothing + canvas drawing), in milliseconds. Averaged over frames with a
 *    face only, since frames without one skip drawing and would look faster.
 *
 * The AR loop calls `recordFrame(latencyMs, hasFace)` once per processed frame.
 * Samples live in refs (no re-render per frame); the displayed values refresh
 * every `refreshMs`. "Live" = the last 1 s. The `windowSec` average (30 s, the
 * window participants read in the survey) starts at the first frame with a
 * face and, once complete, stays fixed until the meter is turned off or the
 * page is left.
 */
export function usePerfStats({ enabled = true, windowSec = 30, refreshMs = 500 } = {}) {
  const liveRef = useRef([]); // [{ t: ms timestamp, ms: latency, face }], last 1 s
  const samplesRef = useRef([]); // same shape, inside the averaging window
  const startRef = useRef(null); // time of the first frame with a face
  const resultRef = useRef(null); // fixed result once the window is complete
  const [stats, setStats] = useState(null);

  const clearSamples = () => {
    liveRef.current = [];
    samplesRef.current = [];
    startRef.current = null;
    resultRef.current = null;
  };

  const recordFrame = useCallback(
    (latencyMs, hasFace = true) => {
      if (!enabled) return;
      const sample = { t: performance.now(), ms: latencyMs, face: hasFace };
      liveRef.current.push(sample);
      if (startRef.current === null) {
        if (!hasFace) return;
        startRef.current = sample.t;
      }
      if (resultRef.current === null && sample.t - startRef.current <= windowSec * 1000) {
        samplesRef.current.push(sample);
      }
    },
    [enabled, windowSec]
  );

  const reset = useCallback(() => {
    clearSamples();
    setStats(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const mean = (arr) => arr.reduce((sum, s) => sum + s.ms, 0) / arr.length;

    const id = setInterval(() => {
      const now = performance.now();
      const live = liveRef.current;
      while (live.length && live[0].t < now - 1000) live.shift();
      if (live.length === 0 && startRef.current === null) {
        setStats(null);
        return;
      }

      const liveFaces = live.filter((s) => s.face);
      const liveStats = {
        liveFps: live.length,
        liveLatencyMs: liveFaces.length ? mean(liveFaces) : null,
        windowSec,
      };
      if (startRef.current === null) {
        setStats({ ...liveStats, started: false });
        return;
      }

      if (resultRef.current === null && now - startRef.current >= windowSec * 1000) {
        const samples = samplesRef.current;
        const faces = samples.filter((s) => s.face);
        resultRef.current = {
          avgFps: samples.length / windowSec,
          avgLatencyMs: faces.length ? mean(faces) : null,
          faceShare: samples.length ? faces.length / samples.length : 0,
        };
        samplesRef.current = [];
      }

      setStats({
        ...liveStats,
        started: true,
        elapsedSec: Math.min((now - startRef.current) / 1000, windowSec),
        windowFull: resultRef.current !== null,
        ...resultRef.current,
      });
    }, refreshMs);
    return () => {
      // Turning the meter off (or leaving the page) starts the next session from zero.
      clearInterval(id);
      clearSamples();
      setStats(null);
    };
  }, [enabled, windowSec, refreshMs]);

  return { stats: enabled ? stats : null, recordFrame, reset };
}
