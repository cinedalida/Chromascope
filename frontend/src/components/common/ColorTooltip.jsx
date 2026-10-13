import { getColorName } from "../../utils/colorNames";

const VARIANTS = {
  dark: { box: "bg-[#111827]", name: "text-white", hex: "text-gray-300", arrow: "border-t-[#111827]" },
  light: { box: "bg-white", name: "text-[#111827]", hex: "text-gray-500", arrow: "border-t-white" },
};

/**
 * ColorTooltip — wraps any element and shows the color's friendly name
 * and hex code above it on hover or keyboard focus.
 * Use variant="light" on dark backgrounds. Pass `name` to override the default color word.
 */
export function ColorTooltip({ hex, name, variant = "dark", children, className = "" }) {
  const label = name ?? getColorName(hex);
  const styles = VARIANTS[variant] ?? VARIANTS.dark;

  return (
    <div
      tabIndex={0}
      aria-label={`${label} ${hex}`}
      className={`group/tip relative inline-flex outline-none ${className}`}
    >
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center opacity-0 shadow-lg transition-all duration-200 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-visible/tip:translate-y-0 group-focus-visible/tip:opacity-100 ${styles.box}`}
      >
        <p className={`text-xs font-bold ${styles.name}`}>{label}</p>
        <p className={`font-mono text-[10px] uppercase ${styles.hex}`}>{hex}</p>
        <span className={`absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent ${styles.arrow}`} />
      </div>
    </div>
  );
}
