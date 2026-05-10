/**
 * SkinTypeSelector — FUTURE USE (OnboardingPage / ProfilePage)
 *
 * Button grid for selecting the primary skin type (Oily, Dry, Normal, Combo, Sensitive).
 * Will replace the inline skin type pill buttons currently in ProfilePage.
 * Emits a `skinType` string to the parent form state.
 */
export function SkinTypeSelector() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button className="rounded-3xl bg-slate-800 p-4 text-left text-slate-200">Dry</button>
      <button className="rounded-3xl bg-slate-800 p-4 text-left text-slate-200">Oily</button>
    </div>
  );
}
