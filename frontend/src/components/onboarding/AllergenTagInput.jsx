/**
 * AllergenTagInput — FUTURE USE (OnboardingPage / ProfilePage)
 *
 * Tag-input field for adding custom allergens/ingredients to avoid.
 * Will replace the inline allergen search input in ProfilePage.
 * Emits an `onChange` array of allergen strings to parent state.
 */
export function AllergenTagInput() {
  return (
    <div className="space-y-3">
      <input className="w-full rounded-2xl bg-slate-900 p-3 text-white" placeholder="Enter allergen tag" />
      <div className="flex flex-wrap gap-2"><span className="rounded-full bg-purple-600 px-3 py-1 text-xs text-white">Fragrance</span></div>
    </div>
  );
}
