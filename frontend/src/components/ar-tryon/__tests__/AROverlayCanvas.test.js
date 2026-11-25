// @vitest-environment jsdom
// TC-I2: AROverlayCanvas runs its detect -> smooth -> draw loop with each smoother on mocked landmarks.
// MediaPipe, the video, the canvas and the makeup drawing are replaced by stand-ins; the smoothers are real.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { AROverlayCanvas } from "../AROverlayCanvas.jsx";
import { getFaceLandmarker } from "../../../services/faceLandmarkerService";
import { drawLooks } from "../../../utils/arRenderer.js";
import { OneEuroSmoother } from "../../../utils/smoothing/OneEuroSmoother.js";
import { makeLandmarkStream } from "../../../utils/smoothing/__tests__/fixtures.js";

vi.mock("../../../services/faceLandmarkerService", () => ({ getFaceLandmarker: vi.fn() }));
vi.mock("../../../utils/arRenderer.js", () => ({
  REGION_RENDER: {},
  drawLooks: vi.fn(),
  sampleSkin: vi.fn(() => ({ L: 60, a: 12, b: 16 })),
  toCanvasSpace: vi.fn(() => [0, 0]),
}));

// Frames the fake detector returns in order: face, face, no face, face.
const stream = makeLandmarkStream({ frames: 4 });
const DETECTIONS = [stream[0].points, stream[1].points, null, stream[3].points];
const xyz = (p) => [p.x, p.y, p.z];

let rafQueue;
let nextRafId;
let stamps;

beforeEach(() => {
  rafQueue = new Map();
  nextRafId = 1;
  stamps = [];
  vi.stubGlobal("requestAnimationFrame", (cb) => {
    const id = nextRafId++;
    rafQueue.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id) => rafQueue.delete(id));
  const ctx = new Proxy({}, { get: (target, key) => (key in target ? target[key] : () => {}), set: (target, key, v) => ((target[key] = v), true) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
  let k = 0;
  getFaceLandmarker.mockResolvedValue({
    detectForVideo: vi.fn((video, ts) => {
      stamps.push(ts);
      const points = DETECTIONS[k++] ?? null;
      return { faceLandmarks: points ? [points] : [] };
    }),
  });
  drawLooks.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Renders the overlay, then runs one animation frame per detection; returns the smoothed frames seen. */
async function runOverlay(smoother) {
  const video = { readyState: 4, currentTime: 0, videoWidth: 640, videoHeight: 480 };
  const landmarksRef = { current: null };
  const onFrame = vi.fn();
  const errors = vi.spyOn(console, "error");
  await act(async () => {
    render(createElement(AROverlayCanvas, { videoRef: { current: video }, isReady: true, isMock: false, smoother, colors: { lips: "#b03060" }, landmarksRef, onFrame }));
  });
  const seen = [];
  for (let i = 0; i < DETECTIONS.length; i++) {
    video.currentTime += 0.033;
    const [id, cb] = rafQueue.entries().next().value;
    rafQueue.delete(id);
    landmarksRef.current = null;
    await act(async () => cb(performance.now()));
    seen.push(landmarksRef.current ? landmarksRef.current.points.map(xyz) : null);
  }
  return { seen, onFrame, errors: errors.mock.calls };
}

describe("TC-I2", () => {
  test("EMA (default): renders without errors, smooths, draws, and resets when the face is lost", async () => {
    const { seen, onFrame, errors } = await runOverlay(undefined);
    expect(errors).toStrictEqual([]);
    expect(seen[0]).toStrictEqual(DETECTIONS[0].map(xyz)); // first frame passes through
    seen[1].forEach((p, i) => p.forEach((v, c) => expect(v).toBe(0.5 * xyz(DETECTIONS[1][i])[c] + 0.5 * seen[0][i][c])));
    expect(seen[2]).toBeNull(); // no face, nothing drawn
    expect(seen[3]).toStrictEqual(DETECTIONS[3].map(xyz)); // reset: no slide-in (TC-S3 logic)
    expect(drawLooks).toHaveBeenCalledTimes(3);
    expect(onFrame).toHaveBeenCalledTimes(4);
    const calls = onFrame.mock.calls;
    expect(calls.map((c) => c[1])).toStrictEqual([true, true, false, true]);
    expect(typeof calls[0][2]).toBe("number");
    expect(calls[2][2]).toBeNull();
  });

  test("One Euro (?smoother=oneeuro): renders without errors and matches the smoother fed the same timestamps", async () => {
    const params = { minCutoff: 1, beta: 10, dCutoff: 1 };
    const { seen, errors } = await runOverlay({ type: "oneeuro", params });
    expect(errors).toStrictEqual([]);
    const ref = new OneEuroSmoother(params);
    const expected = DETECTIONS.map((points, i) => {
      if (!points) {
        ref.reset();
        return null;
      }
      return ref.smooth(points, stamps[i]).map(xyz);
    });
    expect(seen).toStrictEqual(expected);
    expect(seen[3]).toStrictEqual(DETECTIONS[3].map(xyz));
  });
});
