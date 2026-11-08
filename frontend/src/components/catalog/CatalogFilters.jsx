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

/* One boxed group of checkboxes with a small uppercase heading. More than one option can be checked. */
function FilterGroup({ id, title, options, selected, onToggle }) {
  return (
    <div role="group" aria-labelledby={id} className="rounded-2xl bg-white p-4 ring-1 ring-primary-lighter">
      <h3 id={id} className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray">
        {title}
      </h3>
      <ul className="space-y-2.5">
        {options.map((option) => (
          <li key={option.value}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-black">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
                className="h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Search on product name and brand (no ingredient search: plan decision 4). */
export function CatalogSearch({ value, onChange }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search name or brand"
      aria-label="Search by product name or brand"
      className="w-full rounded-full border border-primary-lighter bg-white px-4 py-2.5 text-sm sm:px-5 text-black shadow-sm placeholder:text-gray-light focus:border-primary focus:outline-none"
    />
  );
}

/**
 * CatalogFilters: the filter panel (a sidebar on desktop, a sheet on phones). Owns no state: the page keeps every
 * filter in the URL next to the view, and filters the data it already loaded.
 */
export function CatalogFilters({ idPrefix, view, categories, verdicts, onToggle, onClear, active }) {
  const verdictOptions = view === "all" ? VERDICT_OPTIONS : VERDICT_OPTIONS.filter((option) => option.value !== "excluded");
  // idPrefix keeps the heading ids unique: the sidebar stays in the page while the phone sheet is open.
  return (
    <div className="space-y-4">
      <FilterGroup
        id={`${idPrefix}-category`}
        title="Category"
        options={CATEGORY_OPTIONS}
        selected={categories}
        onToggle={(value) => onToggle("category", value)}
      />
      <FilterGroup
        id={`${idPrefix}-verdict`}
        title="Safety verdict"
        options={verdictOptions}
        selected={verdicts}
        onToggle={(value) => onToggle("verdict", value)}
      />
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="w-full rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
