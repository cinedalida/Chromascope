// The six manuscript categories (plan rule C5). `value` is what the URL holds; the page maps it to the data's
// category ("Multiuse" is stored as "Multi-Use").
const CATEGORY_OPTIONS = [
  { value: "cheek", label: "Cheek" },
  { value: "concealer", label: "Concealer" },
  { value: "eye", label: "Eye" },
  { value: "face", label: "Face" },
  { value: "lip", label: "Lip" },
  { value: "multiuse", label: "Multiuse" },
];

// Verdict labels exactly as the filter names them (C1). Excluded is offered only in Full catalog (C2).
const VERDICT_OPTIONS = [
  { value: "safe", label: "Safe" },
  { value: "caution", label: "Caution" },
  { value: "excluded", label: "Excluded" },
];

/* One row of single-select chips with an "All" chip first. Chips scroll sideways on narrow screens. */
function ChipGroup({ label, options, value, onChange }) {
  const chips = [{ value: "", label: "All" }, ...options];
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {chips.map((chip) => {
        const active = (value || "") === chip.value;
        return (
          <button
            key={chip.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active ? "bg-primary text-white" : "bg-white text-gray ring-1 ring-primary-lighter hover:text-primary"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * CatalogFilters: narrows the grid without leaving the page. Owns no state: the page keeps every filter in the
 * URL next to the view, and filters the data it already loaded.
 */
export function CatalogFilters({ view, category, verdict, query, onChange, onClear, active }) {
  const verdictOptions = view === "all" ? VERDICT_OPTIONS : VERDICT_OPTIONS.filter((option) => option.value !== "excluded");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search by product name or brand"
          aria-label="Search by product name or brand"
          className="w-full rounded-full border border-primary-lighter bg-white px-5 py-3 text-sm text-black shadow-sm placeholder:text-gray-light focus:border-primary focus:outline-none sm:max-w-md"
        />
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Clear filters
          </button>
        )}
      </div>
      <ChipGroup label="Category" options={CATEGORY_OPTIONS} value={category} onChange={(next) => onChange({ category: next })} />
      <ChipGroup label="Safety verdict" options={verdictOptions} value={verdict} onChange={(next) => onChange({ verdict: next })} />
    </div>
  );
}
