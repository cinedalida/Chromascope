/**
 * ScientificFilterPanel — FUTURE USE (IngredientFilterPage)
 *
 * Left-sidebar panel for constructing ingredient safety filters (allergen toggles, skin type).
 * Replaces the inline "Active Filters" and "Skin Profile Insight" cards in IngredientFilterPage.
 * Emits `onFilterChange` callbacks to update the INCIMatchTable results.
 */
export function ScientificFilterPanel() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <p>Build your safety filter and allergen profile.</p>
    </div>
  );
}
