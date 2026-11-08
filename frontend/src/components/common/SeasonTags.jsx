import { seasonChips } from "../../utils/seasonLabels";

/**
 * SeasonTags: the seasons a makeup product is tagged for ("Soft Autumn", ...). Takes the backend's season_tags /
 * match_basis. Renders nothing for products with no season: skincare, and base products, brows, liner and mascara
 * (their fit is shown as a percentage instead).
 * `limit` caps the season names shown, the rest collapse into "+N" (tight cards use 2).
 */
export function SeasonTags({ tags, basis, limit, className = "" }) {
  const hasTags = Array.isArray(tags) ? tags.length > 0 : Boolean(String(tags ?? "").trim());
  if (!hasTags && !basis) return null;
  const chips = seasonChips({ season_tags: tags, match_basis: basis }, limit);
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
