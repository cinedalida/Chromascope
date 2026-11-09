/** Shimmering stand-ins shown while data loads, shaped like what will replace them. */

export function ProductCardSkeleton() {
  return (
    <li aria-hidden="true" className="flex h-full flex-col overflow-hidden rounded-2xl border border-primary-lighter bg-white shadow-sm">
      <span className="skeleton block aspect-[16/10] w-full min-[360px]:aspect-[4/3]" />
      <span className="flex flex-col gap-2 p-3 sm:p-4">
        <span className="skeleton h-4 w-16 rounded-full" />
        <span className="skeleton h-4 w-11/12 rounded" />
        <span className="skeleton h-3 w-1/3 rounded" />
        <span className="skeleton mt-1 h-4 w-1/4 rounded" />
      </span>
    </li>
  );
}

export function ProductGridSkeleton({ count = 8, label = "Loading..." }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: count }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

export function ShadeListSkeleton({ rows = 5 }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3 py-4">
      <span className="sr-only">Loading shades</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-3">
          <span className="skeleton h-12 w-12 shrink-0 rounded-xl" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skeleton h-3.5 w-3/4 rounded" />
            <span className="skeleton h-3 w-1/3 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Stand-in for one favorite product card whose product is still being looked up. */
export function FavoriteCardSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex h-full flex-col overflow-hidden rounded-2xl border border-primary-lighter bg-white shadow-sm">
      <span className="sr-only">Loading</span>
      <span aria-hidden="true" className="skeleton block h-28 w-full sm:h-32" />
      <span aria-hidden="true" className="flex flex-col gap-2 p-3 sm:p-3.5">
        <span className="skeleton h-4 w-16 rounded-full" />
        <span className="skeleton h-4 w-5/6 rounded" />
        <span className="skeleton h-3 w-1/3 rounded" />
        <span className="skeleton mt-2 h-8 w-full rounded-full" />
      </span>
    </div>
  );
}

/** A bar standing in for a line of text that is still loading. */
export function TextSkeleton({ className = "h-4 w-32" }) {
  return <span aria-hidden="true" className={`skeleton inline-block rounded ${className}`} />;
}
