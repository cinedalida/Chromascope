import { Heart } from "lucide-react";
import { shadeToFavoriteItem, useFavorites } from "../../hooks/useFavorites.js";

// Past this many shades the strip overflows the panel, so its right edge fades to hint there's more.
const FADE_AFTER = 8;

/**
 * ProductSwatchPicker: one row of round shade swatches that scrolls sideways.
 * One tap applies a shade; tapping the selected swatch again passes null, which removes it.
 * The selected shade's name shows underneath.
 */
export function ProductSwatchPicker({ shades, selectedId, onSelect }) {
  const selectedShade = shades.find((shade) => shade.id === selectedId);
  const fade = shades.length > FADE_AFTER;
  return (
    <div className="pt-1">
      <div
        className={`flex gap-2 overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          fade ? "pr-8 [mask-image:linear-gradient(to_right,black_85%,transparent)]" : ""
        }`}
      >
        {shades.map((shade) => {
          const label = shade.shade || shade.product;
          const isSelected = shade.id === selectedId;
          return (
            <button
              key={shade.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : shade)}
              title={label}
              aria-label={label}
              aria-pressed={isSelected}
              className={`h-7 w-7 shrink-0 rounded-full ring-offset-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${
                isSelected ? "ring-2 ring-primary" : "ring-1 ring-black/5 hover:scale-110"
              }`}
              style={{ backgroundColor: shade.hex }}
            />
          );
        })}
      </div>
      {selectedShade && (
        <div className="mt-0.5 flex items-center gap-1.5 px-1">
          <p className="min-w-0 truncate text-[11px] text-gray-light">
            Selected: <span className="font-semibold text-black">{selectedShade.shade || selectedShade.product}</span>
          </p>
          <ShadeFavoriteButton shade={selectedShade} />
        </div>
      )}
    </div>
  );
}

// Heart for the selected shade (Part B, Phase F4): saves that one shade as a product favorite. Signed in only (B1).
function ShadeFavoriteButton({ shade }) {
  const { signedIn, isFavorite, toggleProduct } = useFavorites();
  if (!signedIn || !shade?.region) return null;
  const item = shadeToFavoriteItem(shade.region, shade);
  const active = isFavorite(item.product_id, item.shade_id);
  const name = shade.shade || shade.product;
  return (
    <button
      type="button"
      onClick={() => toggleProduct(item)}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className="shrink-0 rounded-full p-1 transition hover:bg-gray-lightest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Heart aria-hidden="true" strokeWidth={2} className={`h-3.5 w-3.5 ${active ? "fill-current text-danger" : "text-gray"}`} />
    </button>
  );
}
