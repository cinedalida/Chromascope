/**
 * PaletteGuideCard — FUTURE USE (PaletteGuideProductPage / ColorAnalysisPage)
 *
 * Card showcasing a single palette entry: swatch, season name, and description.
 * Receives `name`, `description`, and `colors` (hex[]) props.
 * Used in the "Related Palettes" section of ColorAnalysisPage and PaletteGuideProductPage sidebar.
 */
export function PaletteGuideCard() {
  return (
    <article className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <h3 className="font-semibold text-purple-100">Palette guide</h3>
    </article>
  );
}
