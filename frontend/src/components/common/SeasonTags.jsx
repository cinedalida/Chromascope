import { seasonChips, seasonChipsForCodes } from "../../utils/seasonLabels";

/**
 * SeasonTags: the seasons a makeup product or shade is tagged for ("Soft Autumn", ...). Two ways in:
 *  - `codes`: the season codes of ONE shade ("sp-true", ...). Used on the Try-On, where a card shows a single shade, so
 *    the seasons must be that shade's own and not the whole product's. Pass null when the shade has none: nothing shows.
 *  - `tags` / `basis`: the backend's product season_tags / match_basis, for a whole product (the Catalog).
 * Renders nothing for products with no season: skincare, and base products, brows, liner and mascara (their fit is
 * shown as a percentage instead). Every season is named (the chips wrap onto more lines); nothing collapses into "+N".
 */
export function SeasonTags({ tags, basis, codes, className = "" }) {
  let chips;
  if (codes !== undefined) {
    chips = seasonChipsForCodes(codes);
  } else {
    const hasTags = Array.isArray(tags) ? tags.length > 0 : Boolean(String(tags ?? "").trim());
    if (!hasTags && !basis) return null;
    chips = seasonChips({ season_tags: tags, match_basis: basis });
  }
  if (chips.length === 0) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`} aria-label={`Seasons: ${chips.join(", ")}`}>
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-md bg-gray-lightest px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-black/60"
        >
          {chip}
        </span>
      ))}
    </span>
  );
}
