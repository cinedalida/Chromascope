import { useState } from "react";
import { AppliedProductsPanel } from "../components/ar-tryon/AppliedProductsPanel.jsx";
import { CameraFeed } from "../components/ar-tryon/CameraFeed.jsx";
import { AROverlayCanvas } from "../components/ar-tryon/AROverlayCanvas.jsx";
import { ARControlBar } from "../components/ar-tryon/ARControlBar.jsx";
import { useARCamera } from "../hooks/useARCamera.jsx";
import { Share2, Copy } from "lucide-react";

//TODO: region toggles (lips/cheeks/full face) are wired via ARControlBar + real state below.
// Product colors are still the placeholder DEFAULT_COLORS inside AROverlayCanvas — Task 7 replaces
// those with real hex_color values from /api/run-filter via AppliedProductsPanel.
//TODO: fix the Capture/Compare/Share button toggles (separate from AR region toggles above)

/* Design tokens */
const controlGlass = "backdrop-blur-xl border border-white/30 bg-white/30";

export function ARTryOnPage() {
  const { cameraRef, isReady, error, isMock, enableMockCamera } = useARCamera();
  const [toggles, setToggles] = useState({
    lips: true,
    cheeks: true,
    eyeshadow: true,
  });

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
        <section className="relative flex items-center justify-center bg-[#FDF8FF] p-6 lg:h-auto h-[600px]">
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
            <AROverlayCanvas videoRef={cameraRef} isReady={isReady} isMock={isMock} toggles={toggles} />

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

            {/* REGION TOGGLES — lips / cheeks / full face */}
            <div className="absolute left-6 right-6 top-6 flex justify-center overflow-x-auto">
              <ARControlBar toggles={toggles} onToggle={handleToggleRegion} />
            </div>

            {/* CONTROLS */}
            <div
              className={`absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-7 rounded-full px-8 py-4 shadow-2xl ring-1 ring-white/40 ${controlGlass}`}
            >
              <ControlButton icon={<Copy size={18} strokeWidth={2.5} />} label="Compare" />

              <CaptureButton />

              <ControlButton icon={<Share2 size={18} strokeWidth={2.5} />} label="Share" />
            </div>
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
function ControlButton({ icon, label }) {
  return (
    <button className="group flex w-16 flex-col items-center justify-center gap-2 bg-transparent transition-all duration-300 focus:outline-none active:scale-95">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/50 text-black/70 shadow-sm ring-1 ring-white/60 backdrop-blur-md transition-all duration-300 group-hover:bg-white group-hover:text-primary group-hover:shadow-md group-hover:ring-primary/20">
        {icon}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/70 transition-colors group-hover:text-primary">
        {label}
      </span>
    </button>
  );
}

function CaptureButton() {
  return (
    <button className="group relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_8px_32px_rgba(119,0,207,0.25)] ring-4 ring-white/60 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-[#5500A0]" />
      <div className="relative h-14 w-14 rounded-full border-[3px] border-white/40 transition-all duration-300 group-hover:border-white group-hover:scale-95 group-active:scale-90" />
      <div className="absolute inset-0 rounded-full ring-4 ring-primary blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-40" />
    </button>
  );
}
