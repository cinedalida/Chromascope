import { Droplet, Eye, ScanFace } from "lucide-react";
import { AR_GROUPS } from "../../utils/arGroups.js";
import lipsIcon from "../../assets/icons/lips.png";
import cheeksIcon from "../../assets/icons/blush.png";

/**
 * ARControlBar: region toggle row (PRD Task 6)
 *
 * One evenly spaced row of labeled icons: Lips, Cheeks, Eyes, Face, plus Full Face.
 * Each tap turns that makeup group on or off; a dot under the label marks the groups
 * that are on. Owns no state itself: `toggles` and `onToggle` are lifted up to
 * ARTryOnPage, which also feeds `toggles` into AROverlayCanvas, so a tap here
 * directly changes what renders on the live camera feed.
 *
 * `light`: white icons and labels for use over the camera feed (full screen view).
 */
const REGIONS = [
  { key: "lips", label: "Lips", iconSrc: lipsIcon },
  { key: "cheeks", label: "Cheeks", iconSrc: cheeksIcon },
  { key: "eyes", label: "Eyes", Icon: Eye },
  { key: "face", label: "Face", Icon: Droplet },
  { key: "fullFace", label: "Full Face", Icon: ScanFace },
];

export function ARControlBar({ toggles, onToggle, regionKeys, light = false }) {
  const regions = regionKeys ? REGIONS.filter((r) => regionKeys.includes(r.key)) : REGIONS;
  return (
    <div className="flex w-full items-start justify-between">
      {regions.map(({ key, label, Icon, iconSrc }) => {
        // "Full Face" has no state of its own (see ARTryOnPage's handleToggleRegion): it reads as active only
        // when every group is already on, since it's a shortcut for that combined state.
        const active = key === "fullFace" ? AR_GROUPS.every((group) => toggles[group.key]) : toggles[key];
        const tone = light
          ? `drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${active ? "text-white" : "text-white/55 hover:text-white/80"}`
          : active
            ? "text-black"
            : "text-gray-light hover:text-gray";
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={active}
            title={active ? `Hide ${label}` : `Show ${label}`}
            className={`group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${tone}`}
          >
            {Icon ? (
              <Icon strokeWidth={1.5} className="h-6 w-6 sm:h-7 sm:w-7" />
            ) : (
              // PNG icons (lips/blush) recolored via mask so they pick up currentColor like the lucide icons.
              <span
                aria-hidden="true"
                className="h-6 w-6 bg-current sm:h-7 sm:w-7"
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
            <span className="truncate text-[11px] font-medium sm:text-xs">{label}</span>
            <span
              aria-hidden="true"
              className={`h-1 w-1 rounded-full transition-opacity duration-200 ${active ? `${light ? "bg-white" : "bg-primary-light"} opacity-100` : "opacity-0"}`}
            />
          </button>
        );
      })}
    </div>
  );
}
