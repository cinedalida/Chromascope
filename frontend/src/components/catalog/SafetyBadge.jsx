import { Ban, CircleDashed, ShieldCheck, TriangleAlert } from "lucide-react";

// Verdict labels are exactly Safe, Caution and Excluded (plan rule C1). A product without a verdict shows
// "Not checked" in a neutral style. Every badge has a text label and an icon, so color is never the only signal.
const VERDICTS = {
  safe: {
    label: "Safe",
    Icon: ShieldCheck,
    className: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
  caution: {
    label: "Caution",
    Icon: TriangleAlert,
    className: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  excluded: {
    label: "Excluded",
    Icon: Ban,
    className: "bg-[var(--color-danger-light)] text-[var(--color-danger)]",
  },
  none: {
    label: "Not checked",
    Icon: CircleDashed,
    className: "bg-[var(--color-gray-lightest)] text-[var(--color-gray)]",
  },
};

function verdictKey(verdict) {
  const key = String(verdict ?? "").toLowerCase();
  return key in VERDICTS && key !== "none" ? key : "none";
}

export function SafetyBadge({ verdict, size = "md" }) {
  const { label, Icon, className } = VERDICTS[verdictKey(verdict)];
  const sizing = size === "lg" ? "gap-1.5 px-3 py-1.5 text-sm" : "gap-1 px-2 py-1 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full font-bold ${sizing} ${className}`}>
      <Icon aria-hidden="true" className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2.25} />
      <span className="sr-only">Safety verdict: </span>
      {label}
    </span>
  );
}
