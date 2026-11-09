import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppliedProductsPanel } from "../components/ar-tryon/AppliedProductsPanel.jsx";
import { CameraFeed } from "../components/ar-tryon/CameraFeed.jsx";
import { AROverlayCanvas } from "../components/ar-tryon/AROverlayCanvas.jsx";
import { ARControlBar } from "../components/ar-tryon/ARControlBar.jsx";
import { useARCamera } from "../hooks/useARCamera.jsx";
import { PerfStatsBadge } from "../components/ar-tryon/PerfStatsBadge.jsx";
import { usePerfStats } from "../hooks/usePerfStats.js";
import { useSettingsStore } from "../store/settingsStore.js";
import { productToTryOn } from "../services/arRecommendedService.js";
import { renderFinishFromText } from "../utils/arProductMap.js";
import { ALL_REGIONS, AR_GROUPS, REGION_LABEL, groupOfRegion } from "../utils/arGroups.js";
import { OfflineNote } from "../components/common/OfflineBanner.jsx";
import { Activity, Check, Maximize2, Minimize2, Smile } from "lucide-react";

const NO_SHADES = Object.fromEntries(ALL_REGIONS.map((region) => [region, null]));

// DEV tuning panel options (Phase 4b). Kept for future tuning; shown only in dev when
// Profile, App Settings, "AR blend tuning (dev)" is on.
const BLEND_MODES = ["color", "multiply", "soft-light", "overlay", "hard-light", "screen", "source-over"];
const TUNING_REGIONS = ALL_REGIONS.map((key) => ({ key, label: REGION_LABEL[key] }));

// Browser full screen where supported. iPhone Safari has no element full screen (the
// method is missing), so the CSS expanded view is used alone there.
function enterBrowserFullscreen(el) {
  el?.requestFullscreen?.()?.catch?.(() => {});
}
function exitBrowserFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
}

// Shades panel width limits (px, desktop). The max keeps the camera card from getting squeezed.
const PANEL_WIDTH_KEY = "chromascope.tryon.panelWidth";
const PANEL_MIN = 340;
const PANEL_DEFAULT = 460;
const maxPanelWidth = () => Math.max(PANEL_MIN, Math.min(720, Math.round(window.innerWidth * 0.5)));
const clampPanelWidth = (w) => Math.min(maxPanelWidth(), Math.max(PANEL_MIN, Math.round(w)));

export function ARTryOnPage() {
  // Camera access (and its permission prompt) is gated behind the "Start
  // Try-On Now" screen below — useARCamera only requests the stream once
  // `started` is true, so the page doesn't ambush the user with a camera
  // prompt the instant it loads.
  //
  // Exception: a "Try on" button on the Ingredient Filter or Product Catalog sends the product in
  // location.state. Then the page starts the camera right away (the browser still asks for
  // permission if it hasn't been granted yet; a refusal shows the usual camera error) and
  // pre-selects that product's shade.
  const location = useLocation();
  const navigate = useNavigate();
  const [incoming] = useState(() => (location.state?.product ? productToTryOn(location.state.product) : null));
  // A favorite opened from the Favorites page ("Try on"): its shades for every region, applied before the first frame,
  // plus the names of items that could not be applied (catalog plan Part B, Phase F4).
  const [fromFavorite] = useState(() => location.state?.favoriteTryOn ?? null);
  const [favoriteNotice, setFavoriteNotice] = useState(() => {
    const skipped = [...(fromFavorite?.missing ?? []), ...(fromFavorite?.notAvailable ?? [])];
    return skipped.length ? `Not applied: ${skipped.join(", ")} (no longer available or not available in try-on).` : null;
  });
  // The saved look the shades came from (name + items), shown in the panel with rename and "Update this look".
  const [activeLook, setActiveLook] = useState(() => fromFavorite?.look ?? null);
  const [started, setStarted] = useState(Boolean(incoming || fromFavorite));
  // Camera permission already granted: skip the "Start Try-On Now" gate. The Permissions API can't query "camera"
  // in every browser (e.g. Safari), and then the gate simply stays, as it does for first-time users.
  useEffect(() => {
    let active = true;
    navigator.permissions
      ?.query({ name: "camera" })
      .then((status) => {
        if (active && status.state === "granted") setStarted(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  // Drop the product from history state so a refresh doesn't re-apply it.
  useEffect(() => {
    if (location.state?.product || location.state?.favoriteTryOn) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);
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

  // FPS / latency badge, on by default. Toggled from the AR screen or Profile → App settings.
  // Measures only a live camera feed.
  const showPerfStats = useSettingsStore((s) => s.showPerfStats);
  const setShowPerfStats = useSettingsStore((s) => s.setShowPerfStats);
  const perfEnabled = showPerfStats && started && isReady && !isMock;
  const { stats: perfStats, recordFrame } = usePerfStats({ enabled: perfEnabled });

  // One toggle per group (lips, cheeks, eyes, face); the overlay gets it expanded to every region in the group.
  const [toggles, setToggles] = useState(() => Object.fromEntries(AR_GROUPS.map((group) => [group.key, true])));
  const regionToggles = useMemo(
    () => Object.fromEntries(ALL_REGIONS.map((region) => [region, toggles[groupOfRegion(region)]])),
    [toggles],
  );

  // Selected shade item per region (unified shape from arShadeService / arRecommendedService).
  const [selectedShades, setSelectedShades] = useState(() =>
    fromFavorite
      ? { ...NO_SHADES, ...fromFavorite.shades }
      : incoming
        ? { ...NO_SHADES, [incoming.region]: incoming.shade }
        : NO_SHADES,
  );
  const selectShade = (region, shade) => setSelectedShades((prev) => ({ ...prev, [region]: shade }));
  const clearShades = () => setSelectedShades(NO_SHADES);
  const hasShades = Object.values(selectedShades).some(Boolean);

  // Split compare is available once shades are applied on a live camera.
  const canCompare = hasShades && isReady && !isMock;

  // Split compare: a divider that follows the mouse (or a finger); makeup to its left, the bare face to its right.
  // Its position (a fraction of the width, null = off) lives in a ref the overlay reads every frame, so moving it
  // never re-renders this page.
  const splitRef = useRef(null);
  const [splitOn, setSplitOn] = useState(false);
  const splitActive = splitOn && canCompare; // also ends by itself when the shades are cleared or the camera stops
  useEffect(() => {
    splitRef.current = splitActive ? (splitRef.current ?? 0.5) : null;
  }, [splitActive]);

  // DEV only: live blend and opacity values from the tuning panel. With the panel off
  // (and always in production) the overlay uses its hardcoded REGION_RENDER values.
  const showBlendTuner = useSettingsStore((s) => s.showBlendTuner);
  const tunerEnabled = import.meta.env.DEV && showBlendTuner;
  const [tuning, setTuning] = useState(() => structuredClone(AROverlayCanvas.defaultRender));

  // Only regions with a selected shade; AROverlayCanvas draws nothing for the rest.
  // Memoized so the render loop restarts only when a shade actually changes.
  const { colors, finishes } = useMemo(() => {
    const colors = {};
    const finishes = {};
    for (const [region, shade] of Object.entries(selectedShades)) {
      if (!shade?.hex) continue;
      colors[region] = shade.hex;
      const finish = shade.renderFinish ?? renderFinishFromText(region, shade.finish);
      if (finish) finishes[region] = finish;
    }
    return { colors, finishes };
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

  // "Full Face" isn't its own render region (see AROverlayCanvas); it's a shortcut that switches every group
  // on or off together. If they're all already on, pressing it turns all off; otherwise it turns all on.
  const handleToggleRegion = (key) => {
    if (key === "fullFace") {
      setToggles((prev) => {
        const allOn = AR_GROUPS.every((group) => prev[group.key]);
        return Object.fromEntries(AR_GROUPS.map((group) => [group.key, !allOn]));
      });
      return;
    }
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Desktop only: drag the Shades panel's left edge to resize it (the stacked mobile layout has no side panel).
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
      return saved ? clampPanelWidth(saved) : PANEL_DEFAULT;
    } catch {
      return PANEL_DEFAULT;
    }
  });
  const [resizing, setResizing] = useState(false);
  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    let latest = startWidth;
    setResizing(true);
    const onMove = (ev) => {
      latest = clampPanelWidth(startWidth + (startX - ev.clientX));
      setPanelWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setResizing(false);
      try {
        localStorage.setItem(PANEL_WIDTH_KEY, String(latest));
      } catch {
        /* storage unavailable: width just isn't remembered */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  const onResizeKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = clampPanelWidth(panelWidth + (e.key === "ArrowLeft" ? 24 : -24));
    setPanelWidth(next);
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(next));
    } catch {
      /* ignore */
    }
  };
  // Keep the width valid if the window shrinks.
  useEffect(() => {
    const onResize = () => setPanelWidth((w) => clampPanelWidth(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-primary-lightest font-body lg:h-[calc(100dvh-64px)] lg:overflow-hidden">
      {/* Layout */}
      {/* Desktop: locked to the viewport so the panel scrolls inside itself and the camera stays in view. */}
      <div
        style={{ "--panel-w": `${panelWidth}px` }}
        className={`mx-auto grid grid-cols-1 lg:h-[calc(100dvh-64px)] lg:grid-cols-[1fr_var(--panel-w)] lg:overflow-hidden ${resizing ? "select-none" : ""}`}
      >
        {/* CENTER */}
        <section className="relative flex items-center justify-center bg-primary-lightest p-4 sm:p-6 lg:h-full lg:min-h-0">
          {/* Card: camera on top, white controls bar under it.
              Mobile: width-driven, capped by screen height. Desktop: height-driven, so it always fits.
              Expanded: fills the whole window above the navbar and sidebar (both z-50). */}
          <div
            ref={frameRef}
            className={
              isExpanded
                ? "fixed inset-0 z-60 overflow-hidden bg-slate-900"
                : "flex w-full max-w-[min(540px,48dvh)] flex-col overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-black/5 sm:rounded-[40px] lg:h-full lg:max-h-235 lg:w-auto lg:max-w-full"
            }
          >
          {/* CAMERA AREA: `isolate` keeps its layers (gate, flash, toast) below the controls bar. */}
          <div
            className={
              isExpanded
                ? "absolute inset-0 isolate"
                : "relative isolate aspect-[4/5] w-full shrink-0 bg-slate-900 lg:h-[calc(100%-10rem)] lg:w-auto"
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
              toggles={regionToggles}
              colors={colors}
              finishes={finishes}
              render={tunerEnabled ? tuning : undefined}
              splitRef={splitRef}
              onFrame={perfEnabled ? recordFrame : undefined}
            />

            {/* SPLIT: catches the mouse / finger over the camera and moves the divider. Below the buttons (z-10). */}
            {splitActive && <SplitLayer splitRef={splitRef} />}

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
                className={`pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-5 py-2.5 text-white shadow-lg backdrop-blur-md transition-all duration-300 ${
                  isExpanded ? "bottom-[calc(12rem+env(safe-area-inset-bottom))] sm:bottom-[calc(13.5rem+env(safe-area-inset-bottom))]" : "bottom-4 sm:bottom-6"
                } ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
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

          {/* CONTROLS: makeup toggles, then Split / capture / Reset.
              Card view: white bar under the camera. Expanded: white controls over a soft dark fade at the
              bottom of the feed, grouped in a centered column and clear of the iPhone home bar. */}
          <div
            className={
              isExpanded
                ? "pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/60 via-black/25 to-transparent px-4 pt-20 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
                : "flex shrink-0 flex-col justify-center bg-white px-3 pt-3 pb-3 sm:px-6 sm:pb-4 lg:h-40 lg:py-0"
            }
          >
            <div className={`mx-auto flex w-full flex-col gap-2 sm:gap-3 ${isExpanded ? "pointer-events-auto max-w-115" : ""}`}>
              <ARControlBar light={isExpanded} toggles={toggles} onToggle={handleToggleRegion} />
              {/* Same 5 columns as the toggle row: Split sits under Lips, capture under Eyes, Reset under Full Face. */}
              <div className="grid grid-cols-5 items-center">
                <SplitButton light={isExpanded} pressed={splitActive} disabled={!canCompare} onChange={setSplitOn} />
                <div className="col-start-3 justify-self-center">
                  <CaptureButton light={isExpanded} onClick={handleCapture} disabled={!isReady || isMock} />
                </div>
                <button
                  type="button"
                  onClick={clearShades}
                  disabled={!hasShades}
                  className={`col-start-5 justify-self-center rounded-lg px-2 py-1 text-xs font-medium sm:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed ${
                    isExpanded
                      ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] hover:text-white/80 disabled:text-white/40"
                      : "text-secondary hover:text-secondary-dark disabled:text-gray-lighter"
                  }`}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="relative flex h-[60dvh] min-h-0 sm:h-[55dvh] flex-col overflow-hidden border-t border-gray-lighter/60 bg-white shadow-[-4px_0px_20px_rgba(0,0,0,0.02)] lg:h-full lg:border-t-0 lg:border-l">
          {/* Resize handle (desktop only): drag, or focus and use the left/right arrow keys. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize shades panel"
            aria-valuemin={PANEL_MIN}
            aria-valuemax={maxPanelWidth()}
            aria-valuenow={panelWidth}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={onResizeKey}
            onDoubleClick={() => setPanelWidth(PANEL_DEFAULT)}
            className={`group absolute inset-y-0 left-0 z-20 hidden w-2 cursor-col-resize touch-none lg:block focus:outline-none ${resizing ? "bg-primary/20" : "hover:bg-primary/10 focus-visible:bg-primary/20"}`}
          >
            <span className="absolute top-1/2 left-0.5 h-10 w-1 -translate-y-1/2 rounded-full bg-gray-lighter transition-colors group-hover:bg-primary/60" />
          </div>
          {/* Offline: Recommended calls the backend and fails, Browse is served from the device cache. */}
          <OfflineNote className="mx-4 mt-3 shrink-0 rounded-xl px-3 py-2 text-xs">
            Offline: Recommended needs internet. Browse works if you used it online before.
          </OfflineNote>
          {favoriteNotice && (
            <p role="status" className="mx-4 mt-3 flex shrink-0 items-start justify-between gap-2 rounded-xl bg-primary-lightest px-3 py-2 text-xs text-primary-darker">
              {favoriteNotice}
              <button type="button" onClick={() => setFavoriteNotice(null)} aria-label="Dismiss" className="shrink-0 font-semibold">
                OK
              </button>
            </p>
          )}
          <div className="min-h-0 flex-1">
            <AppliedProductsPanel
              initialRegion={incoming?.region ?? Object.keys(fromFavorite?.shades ?? {})[0]}
              selectedShades={selectedShades}
              onSelectShade={selectShade}
              onClear={clearShades}
              activeLook={activeLook}
              onActiveLookChange={setActiveLook}
            />
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

// Outline shutter ring; the inner disc fills in on hover and press. `light`: white ring over the camera feed.
function CaptureButton({ onClick, disabled, light = false }) {
  const ring = light
    ? `border-white bg-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.3)] ${disabled ? "" : "hover:bg-white/20"}`
    : `border-primary-light bg-white/60 ${disabled ? "" : "hover:border-primary"}`;
  const disc = light
    ? "group-hover:bg-white/35 group-active:bg-white/70"
    : "group-hover:bg-primary-lighter group-active:bg-primary-light";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Save photo"
      title="Save photo"
      className={`group flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:h-16 sm:w-16 ${ring} ${
        disabled ? "cursor-not-allowed opacity-40" : "active:scale-95"
      }`}
    >
      <span className={`h-9 w-9 rounded-full transition-colors duration-200 sm:h-12 sm:w-12 ${disc}`} />
    </button>
  );
}

// Split compare: a text button styled like Reset. Toggles the divider on and off.
function SplitButton({ pressed, disabled, onChange, light = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      title="Move the divider: makeup on the left, your bare face on the right"
      onClick={() => onChange(!pressed)}
      className={`col-start-1 select-none justify-self-center rounded-lg px-2 py-1 text-xs font-medium sm:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed ${
        light
          ? `drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] disabled:text-white/40 ${pressed ? "text-primary-light" : "text-white hover:text-white/80"}`
          : `disabled:text-gray-lighter ${pressed ? "text-primary-dark" : "text-secondary hover:text-secondary-dark"}`
      }`}
    >
      Split
    </button>
  );
}

// Covers the camera while Split is on. The divider follows the mouse as it moves over the camera, and a finger while it
// drags; the arrow keys move it too. It only writes the fraction into the ref the overlay draws from.
const SPLIT_MIN = 0.02;
const SPLIT_MAX = 0.98;
function SplitLayer({ splitRef }) {
  const layerRef = useRef(null);
  const set = (fraction) => {
    const clamped = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, fraction));
    splitRef.current = clamped;
    layerRef.current?.setAttribute("aria-valuenow", String(Math.round(clamped * 100)));
  };
  const fromPointer = (e) => {
    const rect = layerRef.current.getBoundingClientRect();
    set((e.clientX - rect.left) / rect.width);
  };
  return (
    <div
      ref={layerRef}
      role="slider"
      tabIndex={0}
      aria-label="Divider: makeup on the left, bare face on the right"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={50}
      onPointerMove={fromPointer}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        fromPointer(e);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        set((splitRef.current ?? 0.5) + (e.key === "ArrowRight" ? 0.03 : -0.03));
      }}
      className="absolute inset-0 z-5 cursor-ew-resize touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    />
  );
}

