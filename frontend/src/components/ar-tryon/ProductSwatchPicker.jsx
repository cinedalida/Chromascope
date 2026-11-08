import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { shadeToFavoriteItem, useFavorites } from "../../hooks/useFavorites.js";
import { shortShadeName } from "../../utils/shadeGroups.js";

// Shades shown at a time; the arrows page through the rest.
const PAGE_SIZE = 5;

/**
 * ProductSwatchPicker: up to five round shade swatches, and arrows to page through the rest. Hovering or focusing a
 * swatch enlarges it and shows the full shade name. One tap applies a shade; tapping
 * the selected swatch again passes null, which removes it. The selected shade's name and its heart show underneath.
 */
export function ProductSwatchPicker({ shades, selectedId, onSelect }) {
  const selectedIndex = shades.findIndex((shade) => shade.id === selectedId);
  const pageCount = Math.max(1, Math.ceil(shades.length / PAGE_SIZE));
  // Opens on the page that holds the selected shade.
  const [page, setPage] = useState(() => (selectedIndex > 0 ? Math.floor(selectedIndex / PAGE_SIZE) : 0));
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const visible = shades.slice(start, start + PAGE_SIZE);
  const paged = pageCount > 1;
  const selectedShade = selectedIndex >= 0 ? shades[selectedIndex] : null;

  return (
    <div className="pt-2">
      <div className="flex items-center gap-1">
        {/* Without arrows, same-size spacers keep every product's swatches in the same five columns. */}
        {paged ? (
          <PageArrow direction="previous" disabled={current === 0} onClick={() => setPage(current - 1)} />
        ) : (
          <ArrowSpacer />
        )}
        <ul className="grid min-w-0 flex-1 grid-cols-5 gap-1">
          {visible.map((shade, i) => {
            const full = shade.shade || shade.product;
            const isSelected = shade.id === selectedId;
            // Keep the tooltip inside the panel: edge columns align it to their outer side.
            const tipPosition = i === 0 ? "left-0" : i === PAGE_SIZE - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <li key={shade.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? null : shade)}
                  aria-label={full}
                  aria-pressed={isSelected}
                  className="group relative flex w-full items-center justify-center rounded-xl py-1 focus:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-48 rounded-md bg-black/85 px-2 py-1 text-left text-[11px] leading-snug font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${tipPosition}`}
                  >
                    {full}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-8 w-8 shrink-0 rounded-full ring-offset-2 transition-transform duration-150 group-hover:scale-115 group-focus-visible:scale-115 group-focus-visible:ring-2 group-focus-visible:ring-primary-light ${
                      isSelected ? "ring-2 ring-primary" : "ring-1 ring-black/5"
                    }`}
                    style={{ backgroundColor: shade.hex }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        {paged ? (
          <PageArrow direction="next" disabled={current === pageCount - 1} onClick={() => setPage(current + 1)} />
        ) : (
          <ArrowSpacer />
        )}
      </div>
      {selectedShade && (
        <div className="mt-1.5 flex items-center gap-1.5 px-1">
          <p className="min-w-0 truncate text-[11px] text-gray-light">
            Selected: <span className="font-semibold text-black">{shortShadeName(selectedShade.shade || selectedShade.product)}</span>
          </p>
          <ShadeFavoriteButton shade={selectedShade} />
        </div>
      )}
    </div>
  );
}

// Same width as a PageArrow, so rows with and without arrows line up.
function ArrowSpacer() {
  return <span aria-hidden="true" className="h-8 w-6 shrink-0" />;
}

function PageArrow({ direction, disabled, onClick }) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "previous" ? "Previous shades" : "Next shades"}
      className="flex h-8 w-6 shrink-0 items-center justify-center rounded-full text-gray transition hover:bg-gray-lightest hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-25"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2.25} />
    </button>
  );
}

// Heart for the selected shade (Part B, Phase F4): saves that one shade as a product favorite. Signed in only (B1).
export function ShadeFavoriteButton({ shade }) {
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
