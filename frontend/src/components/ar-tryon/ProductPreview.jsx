import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import placeholderImg from "../../assets/images/placeholder.svg";
import { SafetyBadge } from "../catalog/SafetyBadge.jsx";
import { SeasonTags } from "../common/SeasonTags.jsx";
import { pesoPrice, productImageSrc } from "../../utils/productDisplay";
import { seasonsForUser } from "../../utils/arFit";
import { shortShadeName } from "../../utils/shadeGroups";

/**
 * ProductPreview: what product a Try-On card is, without leaving the Try-On. The same dialog from a Recommended card and a
 * Browse card (the product name opens it on both): brand, name, price, safety, and the shades, each named and tappable (it
 * applies that shade, the same as the card's swatches). Recommended: the large photo, only the shades that fit you, and
 * "Open in catalog". Browse: no photo in the data, every shade, and "View at store". Both links open in a NEW tab, so the
 * camera and the shades already on the face stay as they are. Closes with the close button, Escape or a tap on the backdrop.
 */
export function ProductPreview({ group, selectedShades, userSeason, isShadeSelected, onSelect, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const src = productImageSrc(group.imageUrl);
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;
  const price = pesoPrice(group.price);
  const isBrowse = group.source === "browse";
  const productId = group.shades[0]?.id;
  // Recommended products open in the catalog; Browse ones have no catalog page, only the store's.
  const linkHref = isBrowse ? group.url : `${import.meta.env.BASE_URL}catalog?view=all&product=${encodeURIComponent(productId ?? "")}`;
  const linkLabel = isBrowse ? "View at store" : "Open in catalog";

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Keep Tab and Shift+Tab inside the dialog.
    const focusable = panelRef.current.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-500 flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-preview-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[85dvh] sm:max-w-sm sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-lightest px-5 py-4">
          <div className="min-w-0">
            {group.brand && <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-gray-light">{group.brand}</p>}
            <h2 id="product-preview-title" className="font-heading text-base font-semibold leading-snug text-black">
              {group.product}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close product preview"
            className="shrink-0 rounded-full p-2 text-gray transition hover:bg-gray-lightest hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Browse has no photo in its data, so no empty box there. */}
          {!isBrowse && (
            <div className="h-44 w-full shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
              {showImage ? (
                <img src={src} alt={group.product} onError={() => setFailedSrc(src)} className="h-full w-full object-contain p-3" />
              ) : (
                <img src={placeholderImg} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-60" />
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {isBrowse ? (
              <span className="text-xs text-gray">From Browse, not safety-checked</span>
            ) : (
              group.verdict && <SafetyBadge verdict={group.verdict} />
            )}
            {price && <span className="text-sm font-semibold text-black">{price}</span>}
          </div>

          <section aria-labelledby="preview-shades-heading">
            <h3 id="preview-shades-heading" className="mb-2 text-sm font-semibold text-black">
              {group.shades.length} shade{group.shades.length === 1 ? "" : "s"}
              {isBrowse ? "" : " that fit you"}
            </h3>
            <ul className="space-y-1">
              {group.shades.map((shade) => {
                const active = isShadeSelected(group, shade, selectedShades);
                const percent = group.matchBasis === "skin" && Number.isFinite(shade.fit) ? Math.round(shade.fit * 100) : null;
                return (
                  <li key={shade.shadeId ?? shade.hex}>
                    <button
                      type="button"
                      onClick={() => onSelect(group.region, active ? null : shade)}
                      aria-pressed={active}
                      className={`flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active ? "bg-primary-lightest" : "hover:bg-gray-lightest/70"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 h-6 w-6 shrink-0 rounded-full ring-offset-1 ${active ? "ring-2 ring-primary" : "ring-1 ring-black/10"}`}
                        style={{ backgroundColor: shade.hex }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-snug text-black">
                          {shortShadeName(shade.shade || shade.product)}
                        </span>
                        {percent !== null && <span className="block text-[11px] text-gray">{percent}% match</span>}
                        <SeasonTags codes={seasonsForUser(shade.shadeSeasons ?? null, shade.fit, userSeason)} className="mt-1" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {linkHref && (
          <div className="border-t border-gray-lightest px-5 py-3">
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {linkLabel}
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
