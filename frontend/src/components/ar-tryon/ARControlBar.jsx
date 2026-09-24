import { Eye, ScanFace } from "lucide-react";
import lipsIcon from "../../assets/icons/lips.png";
import cheeksIcon from "../../assets/icons/blush.png";

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
  { key: "lips", label: "Lips", iconSrc: lipsIcon },
  { key: "cheeks", label: "Cheeks", iconSrc: cheeksIcon },
  { key: "eyeshadow", label: "Eyeshadow", Icon: Eye },
  { key: "fullFace", label: "Full Face", Icon: ScanFace },
];

export function ARControlBar({ toggles, onToggle, regionKeys }) {
  const regions = regionKeys ? REGIONS.filter((r) => regionKeys.includes(r.key)) : REGIONS;
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/30 bg-white/30 px-2 py-2 shadow-2xl ring-1 ring-white/40 backdrop-blur-xl">
      {regions.map(({ key, label, Icon, iconSrc }) => {
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
            aria-label={label}
            title={label}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
              active
                ? "bg-primary text-white shadow-md"
                : "bg-white/50 text-black/70 hover:bg-white/70"
            }`}
          >
            {Icon ? (
              <Icon size={18} strokeWidth={2.25} />
            ) : (
              // PNG icons (lips/blush) recolored via mask so they still
              // pick up currentColor and switch white/dark with `active`,
              // matching the lucide icons above.
              <span
                aria-hidden="true"
                className="h-[18px] w-[18px] bg-current"
                style={{
                  WebkitMaskImage: `url(${iconSrc})`,
                  maskImage: `url(${iconSrc})`,
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
