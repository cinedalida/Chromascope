import { SearchInput } from "../common/SearchInput.jsx";

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

// Price ranges in pesos. `value` is what the URL holds (?price=1000-2000,over-2000); the page maps it to its bounds.
const PRICE_OPTIONS = [
  { value: "under-1000", label: "Under ₱1,000" },
  { value: "1000-2000", label: "₱1,000 to ₱2,000" },
  { value: "over-2000", label: "Over ₱2,000" },
];

/* One boxed group of checkboxes with a small uppercase heading. More than one option can be checked. */
function FilterGroup({ id, title, options, selected, onToggle, children }) {
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
      {children}
    </div>
  );
}

/* Min and max price the user types in. Digits only; either can be left empty. */
function PriceAmount({ id, amount, invalid, onChange }) {
  const field = (key, label) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray">
      {label}
      <span className="flex items-center rounded-lg border border-primary-lighter bg-white px-2 focus-within:border-primary">
        <span aria-hidden="true" className="text-sm text-gray-light">
          ₱
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={amount[key]}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={key === "pmin" ? "0" : "Any"}
          aria-describedby={invalid ? `${id}-hint` : undefined}
          aria-invalid={invalid || undefined}
          className="w-full min-w-0 bg-transparent px-1 py-1.5 text-sm text-black placeholder:text-gray-light focus:outline-none"
        />
      </span>
    </label>
  );
  return (
    <div className="mt-3 border-t border-primary-lighter pt-3">
      <p className="mb-2 text-xs font-semibold text-black">Or enter an amount</p>
      <div className="flex items-end gap-2">
        {field("pmin", "Min")}
        <span aria-hidden="true" className="pb-2 text-gray-light">
          -
        </span>
        {field("pmax", "Max")}
      </div>
      {invalid && (
        <p id={`${id}-hint`} className="mt-2 text-xs text-danger">
          Min is higher than max.
        </p>
      )}
    </div>
  );
}

/* A vertical list of one-choice rows. `count` is optional. Pressing the active row again clears it. */
function PillGroup({ id, title, options, selected, onSelect, allLabel }) {
  const pill = (isActive) =>
    `flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      isActive ? "bg-primary-lighter font-semibold text-primary-dark" : "text-black hover:bg-primary-lightest"
    }`;
  return (
    <div role="group" aria-labelledby={id} className="rounded-2xl bg-white p-3 ring-1 ring-primary-lighter">
      <h3 id={id} className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-gray">
        {title}
      </h3>
      <div className="flex flex-col gap-0.5">
        <button type="button" aria-pressed={!selected} onClick={() => onSelect("")} className={pill(!selected)}>
          {allLabel}
        </button>
        {options.map((option) => {
          const isActive = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(isActive ? "" : option.value)}
              className={pill(isActive)}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.count !== undefined && <span className="shrink-0 text-xs text-gray-light">{option.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Search on product name and brand (no ingredient search: plan decision 4). */
export function CatalogSearch({ value, onChange }) {
  return (
    <SearchInput value={value} onChange={onChange} placeholder="Search name or brand" ariaLabel="Search by product name or brand" />
  );
}

/**
 * CatalogFilters: the filter panel (a sidebar on desktop, a sheet on phones). Owns no state: the page keeps every
 * filter in the URL next to the view, and filters the data it already loaded.
 */
export function CatalogFilters({
  idPrefix,
  view,
  categories,
  subOptions,
  sub,
  verdicts,
  prices,
  amount,
  amountInvalid,
  onSelectCategory,
  onSelectSub,
  onToggle,
  onAmount,
  onClear,
  active,
}) {
  const verdictOptions = VERDICT_OPTIONS.filter((option) => option.value !== "excluded"); // Excluded products are never listed
  // idPrefix keeps the heading ids unique: the sidebar stays in the page while the phone sheet is open.
  return (
    <div className="space-y-4">
      {/* One category at a time, then its sub-categories (Lip: Lipstick, Lip liner ...). A shared link with several
          categories still filters by all of them; the first press here replaces them with one. */}
      <PillGroup
        id={`${idPrefix}-category`}
        title="Category"
        allLabel="All"
        options={CATEGORY_OPTIONS}
        selected={categories.length === 1 ? categories[0] : categories.length > 1 ? "multiple" : ""}
        onSelect={onSelectCategory}
      />
      {subOptions.length > 1 && (
        <PillGroup
          id={`${idPrefix}-sub`}
          title="Type"
          allLabel="All"
          options={subOptions}
          selected={sub}
          onSelect={onSelectSub}
        />
      )}
      {/* The Full catalog is not checked against the profile, so it has no safety filter. */}
      {view !== "all" && (
        <FilterGroup
          id={`${idPrefix}-verdict`}
          title="Safety verdict"
          options={verdictOptions}
          selected={verdicts}
          onToggle={(value) => onToggle("verdict", value)}
        />
      )}
      <FilterGroup
        id={`${idPrefix}-price`}
        title="Price"
        options={PRICE_OPTIONS}
        selected={prices}
        onToggle={(value) => onToggle("price", value)}
      >
        <PriceAmount id={`${idPrefix}-amount`} amount={amount} invalid={amountInvalid} onChange={onAmount} />
      </FilterGroup>
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
