/**
 * INCIMatchTable — FUTURE USE (IngredientFilterPage)
 *
 * Table view matching scanned INCI ingredient names against the user's safety profile.
 * Receives an `ingredients` array with { name, matchScore, safe } from ingredientService.
 * Replaces the inline product table currently in IngredientFilterPage.
 */
export function INCIMatchTable() {
  return (
    <div className="overflow-x-auto rounded-3xl bg-slate-900 p-4 text-slate-300">
      <table className="w-full"><tbody><tr><td>Ingredient</td><td>Match</td></tr></tbody></table>
    </div>
  );
}
