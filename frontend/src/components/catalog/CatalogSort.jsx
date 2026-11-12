import { ArrowUpDown } from "lucide-react";
import { SORT_OPTIONS } from "../../utils/catalogSort.js";

/**
 * CatalogSort: how the products are ordered. Owns no state: the page keeps the choice in the URL (?sort=price-asc or
 * ?sort=price-desc), so reloads, the back button and shared links work. Sorting is not a filter, so it is not counted
 * with the filters.
 */
export function CatalogSort({ value, onChange }) {
  return (
    <label className="relative flex h-11 w-full items-center sm:inline-flex sm:h-auto sm:w-auto">
      <span className="sr-only">Sort products</span>
      <ArrowUpDown aria-hidden="true" className="pointer-events-none absolute left-4 h-4 w-4 text-gray" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-full border border-primary-lighter bg-white py-2.5 pr-8 pl-10 text-sm font-semibold text-black shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-auto sm:w-auto"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
