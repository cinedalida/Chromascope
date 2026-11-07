import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppliedProductsPanel } from "../components/ar-tryon/AppliedProductsPanel.jsx";
import { CameraFeed } from "../components/ar-tryon/CameraFeed.jsx";
import { AROverlayCanvas } from "../components/ar-tryon/AROverlayCanvas.jsx";
import { ARControlBar } from "../components/ar-tryon/ARControlBar.jsx";
import { useARCamera } from "../hooks/useARCamera.jsx";
import { PerfStatsBadge } from "../components/ar-tryon/PerfStatsBadge.jsx";
import { usePerfStats } from "../hooks/usePerfStats.js";
import { useSettingsStore } from "../store/settingsStore.js";
import { clearRecommendedCache } from "../services/arRecommendedService.js";
import { OfflineNote } from "../components/common/OfflineBanner.jsx";
import { Activity, Check, Maximize2, Minimize2, Smile } from "lucide-react";

const NO_SHADES = { lips: null, cheeks: null, eyeshadow: null };

// DEV tuning panel options (Phase 4b). Kept for future tuning; shown only in dev when
// Profile, App Settings, "AR blend tuning (dev)" is on.
const BLEND_MODES = ["color", "multiply", "soft-light", "overlay", "hard-light"];
const TUNING_REGIONS = [
  { key: "lips", label: "Lips" },
  { key: "cheeks", label: "Cheeks" },
  { key: "eyeshadow", label: "Eyeshadow" },
];

// Browser full screen where supported. iPhone Safari has no element full screen (the
// method is missing), so the CSS expanded view is used alone there.
function enterBrowserFullscreen(el) {
  el?.requestFullscreen?.()?.catch?.(() => {});
}
function exitBrowserFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
}

export function ARTryOnPage() {
  // Camera access (and its permission prompt) is gated behind the "Start
  // Try-On Now" screen below — useARCamera only requests the stream once
  // `started` is true, so the page doesn't ambush the user with a camera
  // prompt the instant it loads.
  const [started, setStarted] = useState(false);
  const { cameraRef, isReady, error, isMock, enableMockCamera } = useARCamera(started);
  const overlayRef = useRef(null);

  // Full-screen view: the camera frame covers the whole window (above the navbar), plus the
  // browser's own full screen where available. Esc, the button, or leaving browser full
  // screen (e.g. Android back) all exit.
  const frameRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpanded = () => {
    if (isExpanded) {
      setIsExpanded(false);
      exitBrowserFullscreen();
    } else {
      setIsExpanded(true);
      enterBrowserFullscreen(frameRef.current);
    }
  };
  useEffect(() => {
    if (!isExpanded) return;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsExpanded(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isExpanded]);
  // Leaving the page while expanded also leaves browser full screen.
  useEffect(() => exitBrowserFullscreen, []);

  // Fresh Recommended results on every visit, so changed allergens or a new season show at once.
  // A layout effect runs before the panel's data effects; a plain effect would run after them.
  useLayoutEffect(() => {
    clearRecommendedCache();
  }, []);

  // FPS / latency badge, on by default. Toggled from the AR screen or Profile → App settings.
  // Measures only a live camera feed.
  const showPerfStats = useSettingsStore((s) => s.showPerfStats);
  const setShowPerfStats = useSettingsStore((s) => s.setShowPerfStats);
  const perfEnabled = showPerfStats && started && isReady && !isMock;
  const { stats: perfStats, recordFrame } = usePerfStats({ enabled: perfEnabled });

  const [toggles, setToggles] = useState({
    lips: true,
    cheeks: true,
    eyeshadow: true,
  });

  // Selected shade item per region (unified shape from arShadeService / arRecommendedService).
  const [selectedShades, setSelectedShades] = useState(NO_SHADES);
  const selectShade = (region, shade) => setSelectedShades((prev) => ({ ...prev, [region]: shade }));
  const clearShades = () => setSelectedShades(NO_SHADES);

  // DEV only: live blend and opacity values from the tuning panel. With the panel off
  // (and always in production) the overlay uses its hardcoded REGION_RENDER values.
  const showBlendTuner = useSettingsStore((s) => s.showBlendTuner);
  const tunerEnabled = import.meta.env.DEV && showBlendTuner;
  const [tuning, setTuning] = useState(() => structuredClone(AROverlayCanvas.defaultRender));

  // Only regions with a selected shade; AROverlayCanvas draws nothing for the rest.
  // Memoized so the render loop restarts only when a shade actually changes.
  const colors = useMemo(() => {
    const next = {};
    for (const [region, shade] of Object.entries(selectedShades)) {
      if (shade?.hex) next[region] = shade.hex;
    }
    return next;
  }, [selectedShades]);

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
    <main className="min-h-[calc(100dvh-64px)] bg-primary-lightest font-body lg:h-[calc(100dvh-64px)] lg:overflow-hidden">
      {/* Layout */}
      {/* Desktop: locked to the viewport so the panel scrolls inside itself and the camera stays in view. */}
      <div className="mx-auto grid grid-cols-1 lg:h-[calc(100dvh-64px)] lg:grid-cols-[1fr_400px] lg:overflow-hidden">
        {/* CENTER */}
        <section className="relative flex items-center justify-center bg-primary-lightest p-4 sm:p-6 lg:h-full lg:min-h-0">
          {/* Mobile: width-driven, capped by screen height. Desktop: height-driven, so it always fits.
              Expanded: fills the whole window above the navbar and sidebar (both z-50). */}
          <div
            ref={frameRef}
            className={
              isExpanded
                ? "fixed inset-0 z-60 overflow-hidden bg-slate-900"
                : "relative aspect-[4/5] w-full max-w-[min(540px,48dvh)] overflow-hidden rounded-[32px] bg-slate-900 shadow-xl ring-1 ring-black/5 sm:rounded-[40px] lg:h-full lg:max-h-195 lg:w-auto lg:max-w-full"
            }
          >
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
            <AROverlayCanvas
              ref={overlayRef}
              videoRef={cameraRef}
              isReady={isReady}
              isMock={isMock}
              toggles={toggles}
              colors={colors}
              render={tunerEnabled ? tuning : undefined}
              onFrame={perfEnabled ? recordFrame : undefined}
            />

            {/* PERFORMANCE STATS — FPS + latency, live and 30 s average (survey TR1–TR3) */}
            {perfEnabled && <PerfStatsBadge stats={perfStats} />}
            {/* Top-right: full screen, then performance stats */}
            {started && (
              <div className="absolute right-3 top-3 z-10 flex gap-2 sm:right-4 sm:top-4">
                <FrameIconButton
                  label={isExpanded ? "Exit full screen" : "Full screen"}
                  pressed={isExpanded}
                  onClick={toggleExpanded}
                >
                  {isExpanded ? <Minimize2 size={16} strokeWidth={2.25} /> : <Maximize2 size={16} strokeWidth={2.25} />}
                </FrameIconButton>
                <FrameIconButton
                  label="Performance stats"
                  pressed={showPerfStats}
                  active={showPerfStats}
                  onClick={() => setShowPerfStats(!showPerfStats)}
                >
                  <Activity size={16} strokeWidth={2.25} />
                </FrameIconButton>
              </div>
            )}

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
            <div className="absolute bottom-3 sm:bottom-8 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center justify-center gap-1.5 sm:gap-4">
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
                className={`pointer-events-none absolute bottom-20 sm:bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-5 py-2.5 text-white shadow-lg backdrop-blur-md transition-all duration-300 ${
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
                  <h2 className="mb-2 font-heading text-2xl font-semibold text-white tracking-tight">
                    Try On Your Look
                  </h2>
                  <p className="text-[13px] leading-relaxed text-white/60">
                    See how these shades look on you in real time. We'll ask for camera access when you're ready.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStarted(true)}
                  className="group relative z-10 overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-dark px-8 py-4 text-[11px] font-bold tracking-[0.2em] uppercase text-white shadow-[0_8px_32px_color-mix(in_srgb,var(--color-primary)_35%,transparent)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start Try-On Now
                </button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="flex h-[55dvh] min-h-0 flex-col overflow-hidden border-t border-gray-lighter/60 bg-white shadow-[-4px_0px_20px_rgba(0,0,0,0.02)] lg:h-full lg:border-t-0 lg:border-l">
          {/* Offline: Recommended calls the backend and fails, Browse is served from the device cache. */}
          <OfflineNote className="mx-4 mt-3 shrink-0 rounded-xl px-3 py-2 text-xs">
            Offline: Recommended needs internet. Browse works if you used it online before.
          </OfflineNote>
          <div className="min-h-0 flex-1">
            <AppliedProductsPanel selectedShades={selectedShades} onSelectShade={selectShade} onClear={clearShades} />
          </div>
        </aside>
      </div>

      {tunerEnabled && (
        <BlendTuner
          value={tuning}
          onChange={setTuning}
          onReset={() => setTuning(structuredClone(AROverlayCanvas.defaultRender))}
        />
      )}
    </main>
  );
}

/* DEV only (Phase 4b): live per-region blend, opacity and feather controls. */
function BlendTuner({ value, onChange, onReset }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const setRegion = (region, patch) => onChange({ ...value, [region]: { ...value[region], ...patch } });
  const setLayer = (region, index, patch) =>
    setRegion(region, {
      layers: value[region].layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer)),
    });
  const copyValues = () => {
    navigator.clipboard
      ?.writeText(JSON.stringify(value, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-70 rounded-full bg-black/80 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg"
      >
        Blend tuning (dev)
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-70 max-h-[80dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl bg-black/85 p-3 font-mono text-[10px] text-white shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold uppercase tracking-wider">Blend tuning (dev)</span>
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-white/60 hover:text-white">
          Close
        </button>
      </div>

      {TUNING_REGIONS.map(({ key, label }) => {
        const region = value[key];
        return (
          <fieldset key={key} className="mb-2 min-w-0 rounded-xl border border-white/15 p-2">
            <legend className="px-1 font-bold">{label}</legend>
            {region.layers.map((layer, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-1.5">
                <span className="w-3 shrink-0 text-white/50">{i + 1}</span>
                <select
                  value={layer.blend}
                  onChange={(e) => setLayer(key, i, { blend: e.target.value })}
                  className="w-22 shrink-0 rounded bg-white/10 px-1 py-0.5"
                >
                  {BLEND_MODES.map((mode) => (
                    <option key={mode} value={mode} className="text-black">
                      {mode}
                    </option>
                  ))}
                </select>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={layer.opacity}
                  onChange={(e) => setLayer(key, i, { opacity: Number(e.target.value) })}
                  className="w-0 min-w-0 flex-1"
                  aria-label={`${label} layer ${i + 1} opacity`}
                />
                <span className="w-8 shrink-0 text-right">{layer.opacity.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 text-white/50">feather</span>
              <input
                type="range"
                min="0"
                max="0.04"
                step="0.002"
                value={region.feather}
                onChange={(e) => setRegion(key, { feather: Number(e.target.value) })}
                className="w-0 min-w-0 flex-1"
                aria-label={`${label} feather`}
              />
              <span className="w-10 shrink-0 text-right">{region.feather.toFixed(3)}</span>
            </div>
            <label className="mt-1 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={region.radial}
                onChange={(e) => setRegion(key, { radial: e.target.checked })}
              />
              <span className="text-white/70">radial fade</span>
            </label>
          </fieldset>
        );
      })}

      <div className="flex gap-2">
        <button type="button" onClick={copyValues} className="flex-1 rounded-lg bg-white/15 py-1.5 font-bold hover:bg-white/25">
          {copied ? "Copied" : "Copy values"}
        </button>
        <button type="button" onClick={onReset} className="flex-1 rounded-lg bg-white/15 py-1.5 font-bold hover:bg-white/25">
          Reset
        </button>
      </div>
    </div>
  );
}

/* Controls */
// Round button in the camera frame's top-right row; same look as the region toggles.
// 36 px on phones (matches the region buttons), 40 px on tablets, 32 px on desktop.
function FrameIconButton({ label, pressed, active = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-lg ring-1 ring-white/40 backdrop-blur-xl transition-all duration-200 sm:h-10 sm:w-10 lg:h-8 lg:w-8 ${
        active ? "bg-primary text-white" : "bg-white/50 text-black/70 hover:bg-white/70"
      }`}
    >
      {children}
    </button>
  );
}

function CaptureButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Save photo"
      title="Save photo"
      className={`group relative flex h-14 w-14 shrink-0 items-center sm:h-18 sm:w-18 justify-center rounded-full bg-white shadow-[0_8px_32px_color-mix(in_srgb,var(--color-primary)_25%,transparent)] ring-4 ring-white/60 transition-all duration-300 focus:outline-none ${
        disabled ? "cursor-not-allowed opacity-40" : "hover:scale-105 active:scale-95"
      }`}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-primary-dark" />
      <div className="relative h-11 w-11 rounded-full border-[3px] sm:h-14 sm:w-14 border-white/40 transition-all duration-300 group-hover:border-white group-hover:scale-95 group-active:scale-90" />
      <div className="absolute inset-0 rounded-full ring-4 ring-primary blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-40" />
    </button>
  );
}
