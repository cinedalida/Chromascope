/**
 * ProductCard — FUTURE USE (PaletteGuideProductPage / ProductCatalogPage)
 *
 * Reusable card showing a single cosmetic product: name, brand, swatch, ΔE score, and badges.
 * Will replace the inline product card JSX in PaletteGuideProductPage.
 * Receives a `product` object with { name, brand, deltaE, matchType, badges, verified } props.
 */
export function ProductCard() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <h4 className="font-semibold">Product name</h4>
    </div>
  );
}
