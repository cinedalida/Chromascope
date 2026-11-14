import { ArrowUpDown } from "lucide-react";
import { SORT_OPTIONS } from "../../utils/catalogSort.js";

/**
 * CatalogSort: how the products are ordered. Owns no state: the page keeps the choice in the URL (?sort=price-asc or
 * ?sort=price-desc), so reloads, the back button and shared links work. Sorting is not a filter, so it is not counted
 * with the filters.
 *
 * Phones: a round 44px icon button like the Filters one next to it. The native select sits on top of it, invisible,
 * so a tap opens the phone's own option list and screen readers still read the chosen order. A dot shows when a price
 * sort is on. From sm: a pill showing the chosen order.
 */
export function CatalogSort({ value, onChange }) {
  return (
    <label className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-lighter bg-white shadow-sm focus-within:ring-2 focus-within:ring-primary sm:h-auto sm:w-auto sm:border-0 sm:bg-transparent sm:shadow-none sm:focus-within:ring-0">
      <span className="sr-only">Sort products</span>
      <ArrowUpDown aria-hidden="true" className="pointer-events-none absolute h-4 w-4 text-gray sm:left-4" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full text-base opacity-0 focus:outline-none sm:static sm:h-auto sm:w-auto sm:border sm:border-primary-lighter sm:bg-white sm:py-2.5 sm:pr-8 sm:pl-10 sm:text-sm sm:font-semibold sm:text-black sm:opacity-100 sm:shadow-sm sm:focus-visible:ring-2 sm:focus-visible:ring-primary"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {value && (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white sm:hidden" />
      )}
    </label>
  );
}
