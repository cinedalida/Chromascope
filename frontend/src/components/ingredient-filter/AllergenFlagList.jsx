/**
 * AllergenFlagList — FUTURE USE (IngredientFilterPage)
 *
 * Renders a list of allergens flagged against the user's skin profile.
 * Receives a `flaggedAllergens` string[] from ingredientService.filterIngredients().
 * Works alongside IngredientSafetyTag for per-item status display.
 */
export function AllergenFlagList() {
  return (
    <ul className="space-y-2 text-slate-300">
      <li>Fragrance</li>
      <li>Essential oils</li>
    </ul>
  );
}
