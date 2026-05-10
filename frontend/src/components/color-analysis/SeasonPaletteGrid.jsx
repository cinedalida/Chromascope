/**
 * SeasonPaletteGrid — FUTURE USE (ColorAnalysisPage / ColorAnalysisSubtypePage)
 *
 * Displays a grid of color swatches for the identified seasonal palette.
 * Receives a `palette` array of hex color strings from the color analysis result.
 * Also used in the "Related Palettes" section of ColorAnalysisPage.
 */
export function SeasonPaletteGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="h-24 rounded-3xl bg-purple-500" />
      <div className="h-24 rounded-3xl bg-fuchsia-500" />
      <div className="h-24 rounded-3xl bg-slate-500" />
    </div>
  );
}
