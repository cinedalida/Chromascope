// Sorting the catalog by price. Pure, so it runs under `npm run test:unit`.
//
// The URL holds ?sort=price-asc or ?sort=price-desc; anything else (or nothing) means "Recommended", the page's own order.

export const SORT_OPTIONS = [
  { value: "", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** A known sort value, else "" (the page's own order). */
export const parseSort = (value) => (SORT_OPTIONS.some((option) => option.value === value) ? value : "");

const isPrice = (price) => typeof price === "number" && Number.isFinite(price);

/**
 * A sorted copy of `items` (the original is never changed).
 *
 * - sort "" (or unknown): same order as given.
 * - Products without a numeric price go last in both directions.
 * - Equal prices keep their given order (stable).
 * - `groupOf(item)` is an optional rank that is compared first, so a caller can keep groups together
 *   (for example Safe before Caution) and sort by price only inside each group.
 */
export function sortByPrice(items, sort, groupOf = () => 0) {
  const direction = sort === "price-asc" ? 1 : sort === "price-desc" ? -1 : 0;
  if (!direction) return [...items];
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const groups = groupOf(a.item) - groupOf(b.item);
      if (groups) return groups;
      const aHas = isPrice(a.item.price);
      const bHas = isPrice(b.item.price);
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && a.item.price !== b.item.price) return (a.item.price - b.item.price) * direction;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
