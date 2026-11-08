const OPTIONS = [
  { value: "safe", label: "Safe for me" },
  { value: "all", label: "Full catalog" },
];

/**
 * CatalogViewToggle: two-option segmented control for the catalog views. Owns no state: the page keeps the choice
 * in the URL (?view=safe or ?view=all), so the back button and shared links work.
 */
export function CatalogViewToggle({ value, onChange }) {
  return (
    <div role="group" aria-label="Catalog view" className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-primary-lighter">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => !active && onChange(option.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 ${
              active ? "bg-primary text-white shadow-sm" : "text-gray hover:text-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
