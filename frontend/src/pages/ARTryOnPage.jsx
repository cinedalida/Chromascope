import { useRef, useState } from "react";
import { AppliedProductsPanel } from "../components/ar-tryon/AppliedProductsPanel.jsx";
import { CameraFeed } from "../components/ar-tryon/CameraFeed.jsx";
import { AROverlayCanvas } from "../components/ar-tryon/AROverlayCanvas.jsx";
import { ARControlBar } from "../components/ar-tryon/ARControlBar.jsx";
import { useARCamera } from "../hooks/useARCamera.jsx";
import { Check, Smile } from "lucide-react";

//TODO: region toggles (lips/cheeks/full face) are wired via ARControlBar + real state below.
// Product colors are still the placeholder DEFAULT_COLORS inside AROverlayCanvas — Task 7 replaces
// those with real hex_color values from /api/run-filter via AppliedProductsPanel.

export function ARTryOnPage() {
  // Camera access (and its permission prompt) is gated behind the "Start
  // Try-On Now" screen below — useARCamera only requests the stream once
  // `started` is true, so the page doesn't ambush the user with a camera
  // prompt the instant it loads.
  const [started, setStarted] = useState(false);
  const { cameraRef, isReady, error, isMock, enableMockCamera } = useARCamera(started);
  const overlayRef = useRef(null);
  const [toggles, setToggles] = useState({
    lips: true,
    cheeks: true,
    eyeshadow: true,
  });

  // Shutter-flash + "Saved" toast shown briefly after a successful capture.
  // Split into "mounted" (in the DOM) vs. the transition-triggering class so
  // each can fade in then out via CSS transitions before unmounting.
  const [flashMounted, setFlashMounted] = useState(false);
  const [flashOut, setFlashOut] = useState(false);
  const [toastMounted, setToastMounted] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const handleCapture = () => {
    const dataUrl = overlayRef.current?.capture();
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `chromascope-tryon-${Date.now()}.png`;
    link.click();

    setFlashMounted(true);
    setFlashOut(false);
    requestAnimationFrame(() => setFlashOut(true));
    setTimeout(() => setFlashMounted(false), 350);

    setToastMounted(true);
    setToastVisible(false);
    requestAnimationFrame(() => setToastVisible(true));
    setTimeout(() => setToastVisible(false), 1100);
    setTimeout(() => setToastMounted(false), 1450);
  };

  // "Full Face" isn't its own render region (see AROverlayCanvas) — it's a
  // shortcut that switches lips + cheeks + eyeshadow on/off together. If
  // they're all already on, pressing it turns all three off; otherwise it
  // turns all three on, regardless of their individual current states.
  const handleToggleRegion = (key) => {
    if (key === "fullFace") {
      setToggles((prev) => {
        const allOn = prev.lips && prev.cheeks && prev.eyeshadow;
        return { ...prev, lips: !allOn, cheeks: !allOn, eyeshadow: !allOn };
      });
      return;
    }
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <main className="min-h-screen bg-surface/50 font-body">
      {/* Layout */}
      <div className="mx-auto grid min-h-[calc(100vh-64px)] grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* CENTER */}
        <section className="relative flex items-center justify-center bg-[#FDF8FF] p-6 min-h-120 lg:h-auto lg:min-h-0">
          <div className="relative aspect-[4/5] w-full max-w-[540px] overflow-hidden rounded-[40px] bg-slate-900 shadow-xl ring-1 ring-black/5">
            {/* AR FEED */}
            <CameraFeed 
              cameraRef={cameraRef} 
              isReady={isReady} 
              error={error} 
              isMock={isMock} 
              onEnableMock={enableMockCamera} 
            />

            {/* AR OVERLAY — live landmark tracking + region rendering. `toggles` here is
                real state now, driven by ARControlBar below, not AROverlayCanvas's internal default. */}
            <AROverlayCanvas ref={overlayRef} videoRef={cameraRef} isReady={isReady} isMock={isMock} toggles={toggles} />

            {/* AR SCAN RETICLE */}
            {isReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center mix-blend-overlay opacity-50 transition-opacity duration-1000 delay-500">
                <div className="relative h-[55%] w-[65%]">
                  <div className="absolute left-0 top-0 h-10 w-10 border-l-[3px] border-t-[3px] border-white rounded-tl-xl" />
                  <div className="absolute right-0 top-0 h-10 w-10 border-r-[3px] border-t-[3px] border-white rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 h-10 w-10 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 h-10 w-10 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />
                  
                  {/* Scanning Line */}
                  <div className="absolute left-0 right-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[#00E676] to-transparent opacity-60 shadow-[0_0_8px_#00E676] animate-[scan_3s_ease-in-out_infinite]" />
                </div>
              </div>
            )}

            {/* CONTROLS — region toggles flank the capture button */}
            <div className="absolute bottom-6 sm:bottom-8 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center justify-center gap-2 sm:gap-4">
              <ARControlBar regionKeys={["lips", "cheeks"]} toggles={toggles} onToggle={handleToggleRegion} />
              <CaptureButton onClick={handleCapture} disabled={!isReady || isMock} />
              <ARControlBar regionKeys={["eyeshadow", "fullFace"]} toggles={toggles} onToggle={handleToggleRegion} />
            </div>

            {/* SAVE FEEDBACK — brief shutter flash + "Saved" toast after a capture */}
            {flashMounted && (
              <div
                className={`pointer-events-none absolute inset-0 z-20 bg-white transition-opacity duration-300 ease-out ${
                  flashOut ? "opacity-0" : "opacity-90"
                }`}
              />
            )}
            {toastMounted && (
              <div
                className={`pointer-events-none absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-5 py-2.5 text-white shadow-lg backdrop-blur-md transition-all duration-300 ${
                  toastVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                <Check size={16} strokeWidth={3} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Saved</span>
              </div>
            )}

            {/* START GATE — camera stays off until the user opts in here */}
            {!started && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-slate-900 p-8 text-center font-body">
                <div className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[90px]" />

                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20">
                  <Smile size={26} strokeWidth={1.5} />
                </div>

                <div className="relative z-10 max-w-[280px]">
                  <h2 className="mb-2 font-heading text-2xl font-bold text-white tracking-tight">
                    Try On Your Look
                  </h2>
                  <p className="text-[13px] leading-relaxed text-white/60">
                    See how these shades look on you in real time. We'll ask for camera access when you're ready.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStarted(true)}
                  className="group relative z-10 overflow-hidden rounded-full bg-gradient-to-br from-primary to-[#5500A0] px-8 py-4 text-[11px] font-bold tracking-[0.2em] uppercase text-white shadow-[0_8px_32px_rgba(119,0,207,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start Try-On Now
                </button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="border-t lg:border-t-0 lg:border-l border-gray-lighter/60 bg-white shadow-[-4px_0px_20px_rgba(0,0,0,0.02)]">
          <AppliedProductsPanel />
        </aside>
      </div>
    </main>
  );
}

/* Controls */
function CaptureButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Save photo"
      title="Save photo"
      className={`group relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_8px_32px_rgba(119,0,207,0.25)] ring-4 ring-white/60 transition-all duration-300 focus:outline-none ${
        disabled ? "cursor-not-allowed opacity-40" : "hover:scale-105 active:scale-95"
      }`}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-[#5500A0]" />
      <div className="relative h-14 w-14 rounded-full border-[3px] border-white/40 transition-all duration-300 group-hover:border-white group-hover:scale-95 group-active:scale-90" />
      <div className="absolute inset-0 rounded-full ring-4 ring-primary blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-40" />
    </button>
  );
}
