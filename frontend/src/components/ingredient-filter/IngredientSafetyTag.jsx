/**
 * IngredientSafetyTag — FUTURE USE (IngredientFilterPage / ProductCatalogPage)
 *
 * Small pill badge indicating ingredient safety status (Safe / Flagged / Unknown).
 * Accepts a `status` prop ("safe" | "flagged" | "unknown") and renders a color-coded pill.
 * Used inline in INCIMatchTable rows and product catalog rows.
 */
export function IngredientSafetyTag() {
  return <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs text-slate-950">Safe</span>;
}
