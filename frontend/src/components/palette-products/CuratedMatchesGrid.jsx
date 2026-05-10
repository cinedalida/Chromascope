/**
 * CuratedMatchesGrid — FUTURE USE (PaletteGuideProductPage)
 *
 * Grid of curated product match cards sorted by ΔE color distance score.
 * Receives a `matches` array from PaletteGuideProductPage / useProductRecommendations.
 * Replaces the inline product grid in PaletteGuideProductPage.
 */
export function CuratedMatchesGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-3xl bg-slate-900 p-4">Match 1</div>
      <div className="rounded-3xl bg-slate-900 p-4">Match 2</div>
    </div>
  );
}
