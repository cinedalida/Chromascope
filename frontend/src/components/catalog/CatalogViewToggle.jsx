const OPTIONS = [
  { value: "safe", label: "Compatible with me" },
  { value: "all", label: "Full catalog" },
];

/**
 * CatalogViewToggle: two-option segmented control for the catalog views. Owns no state: the page keeps the choice
 * in the URL (?view=safe or ?view=all), so the back button and shared links work.
 */
export function CatalogViewToggle({ value, onChange }) {
  return (
    // Phones: full width with two equal halves. From sm: sized to its labels.
    <div role="group" aria-label="Catalog view" className="flex w-full rounded-full bg-white p-1 shadow-sm ring-1 ring-primary-lighter sm:inline-flex sm:w-auto">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => !active && onChange(option.value)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold sm:flex-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 ${
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
