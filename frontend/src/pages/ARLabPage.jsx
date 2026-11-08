import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CameraFeed } from "../components/ar-tryon/CameraFeed.jsx";
import { AROverlayCanvas } from "../components/ar-tryon/AROverlayCanvas.jsx";
import { useARCamera } from "../hooks/useARCamera.jsx";
import { toCanvasSpace } from "../utils/arRenderer.js";

/**
 * DEV only (route /dev/ar-lab, not registered in production builds): renders chosen looks with no login, for tuning,
 * screenshots and automated QA.
 *   ?looks=lips:%23b03060:gloss,cheeks:%23e07a8a   region:hex[:finish], comma separated (live camera mode)
 *   &debug=1 or &debug=116,117                     draw landmark index numbers (all, or only the listed)
 *   ?still=1                                       no camera: a face image is fed through the same pipeline
 *
 * Still mode is driven from a script through window.__arLab:
 *   await __arLab.setImage(url)                    load a face image (a blob/data URL, so the canvas stays untainted)
 *   await __arLab.render({ colors, finishes, render })   draw looks; resolves once the result has settled
 *   __arLab.capture()                              PNG data URL of the canvas (camera frame + makeup)
 *   __arLab.landmarks()                            { w, h, skinL, skin: {L,a,b}, points: [[x, y]...] } in canvas pixels
 */
const STILL_W = 720;
const STILL_H = 900;
const SETTLE_FRAMES = 14; // landmark smoothing is an EMA, so identical frames converge within a few frames

export function ARLabPage() {
  const [params] = useSearchParams();
  const still = params.get("still") === "1";
  const camera = useARCamera(!still);
  const overlayRef = useRef(null);

  // "1" numbers every landmark; a comma list (e.g. 116,117) numbers only those.
  const debugParam = params.get("debug") ?? "";
  const debug = debugParam === "1" ? true : debugParam.includes(",") ? debugParam.split(",").map(Number) : false;

  const urlLooks = useMemo(() => {
    const colors = {};
    const finishes = {};
    for (const entry of (params.get("looks") ?? "").split(",").filter(Boolean)) {
      const [region, hex, finish] = entry.split(":");
      colors[region] = hex;
      if (finish) finishes[region] = finish;
    }
    return { colors, finishes, render: undefined };
  }, [params]);
  const [scripted, setScripted] = useState(null);
  const looks = scripted ?? urlLooks;

  // Still-image mode: image -> canvas -> captureStream -> <video>, the element the pipeline already reads.
  const stillVideoRef = useRef(null);
  const [stillReady, setStillReady] = useState(false);
  const landmarksRef = useRef(null);
  const framesRef = useRef(0);
  const stillRef = useRef({ canvas: null, timer: null });

  useEffect(() => {
    if (!still) return undefined;
    const waitFrames = (n) =>
      new Promise((resolve) => {
        const target = framesRef.current + n;
        const check = () => (framesRef.current >= target ? resolve() : setTimeout(check, 20));
        check();
      });

    window.__arLab = {
      async setImage(url) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("image failed to load"));
          img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = STILL_W;
        canvas.height = STILL_H;
        const draw = () => canvas.getContext("2d").drawImage(img, 0, 0, STILL_W, STILL_H);
        draw();
        clearInterval(stillRef.current.timer);
        // Redrawing keeps the capture stream producing frames, so the pipeline keeps processing the same picture.
        stillRef.current = { canvas, timer: setInterval(draw, 33) };
        const video = stillVideoRef.current;
        video.srcObject = canvas.captureStream(30);
        await video.play();
        landmarksRef.current = null;
        setStillReady(true);
        await waitFrames(SETTLE_FRAMES);
        if (!landmarksRef.current) throw new Error("no face found in the image");
        // The skin color is smoothed over time and would still hold the previous image's: measure it again.
        overlayRef.current?.resetSkin();
        await waitFrames(2);
      },
      async render(next) {
        setScripted({ colors: next.colors ?? {}, finishes: next.finishes ?? {}, render: next.render });
        await waitFrames(SETTLE_FRAMES);
      },
      capture: () => overlayRef.current?.capture() ?? null,
      landmarks() {
        const l = landmarksRef.current;
        if (!l) return null;
        return {
          w: l.canvasW,
          h: l.canvasH,
          skinL: l.skinL,
          skin: l.skin, // { L, a, b } CIELAB of the sampled cheek skin
          points: l.points.map((p) => toCanvasSpace(p.x * l.videoW, p.y * l.videoH, l.videoW, l.videoH, l.canvasW, l.canvasH)),
        };
      },
    };
    return () => {
      clearInterval(stillRef.current.timer);
      delete window.__arLab;
    };
  }, [still]);

  const frameClass = still
    ? "relative overflow-hidden bg-slate-900"
    : "relative aspect-[4/5] h-[92dvh] overflow-hidden bg-slate-900";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-900 p-4">
      <div id="ar-lab-frame" className={frameClass} style={still ? { width: STILL_W, height: STILL_H } : undefined}>
        {still ? (
          <video ref={stillVideoRef} playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
        ) : (
          <CameraFeed
            cameraRef={camera.cameraRef}
            isReady={camera.isReady}
            error={camera.error}
            isMock={camera.isMock}
            onEnableMock={camera.enableMockCamera}
          />
        )}
        <AROverlayCanvas
          ref={overlayRef}
          videoRef={still ? stillVideoRef : camera.cameraRef}
          isReady={still ? stillReady : camera.isReady}
          isMock={still ? false : camera.isMock}
          colors={looks.colors}
          finishes={looks.finishes}
          render={looks.render}
          debugLandmarks={debug}
          landmarksRef={landmarksRef}
          onFrame={(ms) => {
            framesRef.current += 1;
            window.__latencyMs = (window.__latencyMs ?? ms) * 0.9 + ms * 0.1; // smoothed, read by test scripts
          }}
        />
      </div>
    </div>
  );
}
