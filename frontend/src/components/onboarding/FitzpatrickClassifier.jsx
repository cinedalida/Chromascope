/**
 * FitzpatrickClassifier — FUTURE USE (OnboardingPage / ProfilePage)
 *
 * Interactive selector for the Fitzpatrick skin phototype scale (Type I–VI).
 * Will replace the inline Melanin Tier <select> in ProfilePage.
 * Emits a `fitzpatrickType` value (string) used by the color analysis pipeline.
 */
export function FitzpatrickClassifier() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <p>Select the Fitzpatrick skin type that best matches your natural response to sunlight.</p>
    </div>
  );
}
