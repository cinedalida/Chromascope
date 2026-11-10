import { Search } from "lucide-react";

/** A rounded search bar with a magnifier icon on the left. The icon is decorative; `ariaLabel` names the field. */
export function SearchInput({ value, onChange, placeholder, ariaLabel }) {
  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-light sm:left-4"
        strokeWidth={2}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-full border border-primary-lighter bg-white py-2.5 pr-4 pl-10 text-sm text-black shadow-sm placeholder:text-gray-light focus:border-primary focus:outline-none sm:pr-5 sm:pl-11"
      />
    </div>
  );
}
