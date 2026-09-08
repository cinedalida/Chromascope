/**
 * ARControlBar — region toggle bar (PRD Task 6)
 *
 * Lets the user turn each AR region on/off: Lips, Cheeks, Full Face.
 * Owns no state itself — `toggles` and `onToggle` are lifted up to
 * ARTryOnPage, which is also what feeds `toggles` into AROverlayCanvas, so
 * flipping a button here directly changes what actually renders on the
 * live camera feed.
 *
 * (Originally scaffolded as a Capture/Reset/Compare bar — that
 * functionality already lives inline in ARTryOnPage's own control row, so
 * this component was repurposed for the region toggles the AR pipeline
 * actually needs.)
 */
const REGIONS = [
  { key: "lips", label: "Lips" },
  { key: "cheeks", label: "Cheeks" },
  { key: "eyeshadow", label: "Eyeshadow" },
  { key: "fullFace", label: "Full Face" },
];

export function ARControlBar({ toggles, onToggle }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/30 bg-white/30 px-2 py-2 shadow-2xl ring-1 ring-white/40 backdrop-blur-xl">
      {REGIONS.map(({ key, label }) => {
        // "Full Face" has no state of its own (see ARTryOnPage's
        // handleToggleRegion) — it reads as active only when lips, cheeks,
        // AND eyeshadow are all already on, since it's a shortcut for that
        // combined state, not an independent toggle.
        const active =
          key === "fullFace"
            ? toggles.lips && toggles.cheeks && toggles.eyeshadow
            : toggles[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={active}
            className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
              active
                ? "bg-primary text-white shadow-md"
                : "bg-white/50 text-black/70 hover:bg-white/70"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
