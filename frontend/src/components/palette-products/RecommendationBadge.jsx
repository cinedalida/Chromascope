/**
 * RecommendationBadge — FUTURE USE (PaletteGuideProductPage / ProductCatalogPage)
 *
 * Badge overlay for top-recommended products (e.g. "Ultra Match", "Top Pick").
 * Accepts a `label` and `variant` prop for color-coded match-type differentiation.
 * Used inside ProductCard and CuratedMatchesGrid.
 */
export function RecommendationBadge() {
  return <span className="rounded-full bg-purple-600 px-3 py-1 text-xs text-white">Top pick</span>;
}
