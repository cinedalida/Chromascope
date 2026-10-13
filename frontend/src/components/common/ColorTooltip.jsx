import { useRef, useState } from "react";
import { getColorName } from "../../utils/colorNames";

const VARIANTS = {
  dark: { box: "bg-[#111827]", name: "text-white", hex: "text-gray-300", arrow: "border-t-[#111827]" },
  light: { box: "bg-white", name: "text-[#111827]", hex: "text-gray-500", arrow: "border-t-white" },
};

const EDGE_GAP = 4;

// Nearest ancestor that clips its children (e.g. a card with overflow-hidden).
function getClipBounds(el) {
  let left = 0;
  let right = window.innerWidth;
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowX } = getComputedStyle(node);
    if (overflowX !== "visible") {
      const rect = node.getBoundingClientRect();
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
      break;
    }
  }
  return { left: left + EDGE_GAP, right: right - EDGE_GAP };
}

/**
 * ColorTooltip — wraps any element and shows the color's friendly name
 * and hex code above it on hover, tap, or keyboard focus.
 * Use variant="light" on dark backgrounds. Pass `name` to override the default color word.
 */
export function ColorTooltip({ hex, name, variant = "dark", children, className = "" }) {
  const label = name ?? getColorName(hex);
  const styles = VARIANTS[variant] ?? VARIANTS.dark;
  const tipRef = useRef(null);
  const [offset, setOffset] = useState(0);

  // Nudge the tooltip sideways so it never gets cut off by its card or the screen edge.
  const keepInBounds = () => {
    const tip = tipRef.current;
    if (!tip) return;
    const rect = tip.getBoundingClientRect();
    const naturalLeft = rect.left - offset;
    const naturalRight = rect.right - offset;
    const bounds = getClipBounds(tip);
    let shift = 0;
    if (naturalLeft < bounds.left) shift = bounds.left - naturalLeft;
    else if (naturalRight > bounds.right) shift = bounds.right - naturalRight;
    setOffset(shift);
  };

  return (
    <div
      tabIndex={0}
      aria-label={`${label} ${hex}`}
      onMouseEnter={keepInBounds}
      onFocus={keepInBounds}
      className={`group/tip relative inline-flex outline-none ${className}`}
    >
      {children}
      <div
        ref={tipRef}
        role="tooltip"
        style={{ marginLeft: offset }}
        className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center opacity-0 shadow-lg transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus/tip:translate-y-0 group-focus/tip:opacity-100 ${styles.box}`}
      >
        <p className={`text-xs font-bold ${styles.name}`}>{label}</p>
        <p className={`font-mono text-[10px] uppercase ${styles.hex}`}>{hex}</p>
        <span
          style={{ marginLeft: -offset }}
          className={`absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent ${styles.arrow}`}
        />
      </div>
    </div>
  );
}
