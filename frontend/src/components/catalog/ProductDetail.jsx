import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { assetUrl } from "../../config";
import placeholderImg from "../../assets/images/placeholder.svg";
import { SafetyBadge } from "./SafetyBadge.jsx";
import { FavoriteButton } from "./ProductCard.jsx";

// Same rules as ProductCard (a component file cannot share plain helpers under the fast-refresh lint rule).
function imageSrc(url) {
  if (!url) return null;
  return url.startsWith("/public/") ? url.replace("/public/", "/") : assetUrl(url);
}

function formatPrice(price, currency) {
  if (price === null || price === undefined || price === "") return null;
  if (typeof price !== "number") return String(price);
  const amount = price.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  if (currency === "Peso") return `₱${amount}`;
  if (currency === "Dollar") return `$${amount}`;
  return amount;
}

// Category names as the manuscript writes them (C5); the data stores "Multi-Use".
const CATEGORY_LABEL = { "Multi-Use": "Multiuse" };

/**
 * ProductDetail: the safety details of one product without leaving the catalog. A bottom sheet on phones and a
 * centered dialog on desktop. Closes with the close button, the Escape key, a tap on the backdrop, or the back button
 * (the page keeps the open product in the URL). Focus moves into the panel on open and stays inside while it is
 * open; the page returns it to the card on close. Only fields the data has are shown (C4).
 */
export function ProductDetail({ product, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const name = product.product_name || product.name || "";
  const src = imageSrc(product.image_url);
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;
  const flagged = (product.flagged_ingredients || []).filter(Boolean);
  const price = formatPrice(product.price, product.price_currency);
  const category = product.category ? (CATEGORY_LABEL[product.category] ?? product.category) : null;
  const ingredients = String(product.full_inci_list ?? "").trim();
  const details = [
    category && { label: "Category", value: category },
    product.hex_color && {
      label: "Shade",
      value: (
        <span
          role="img"
          aria-label="Shade color"
          className="inline-block h-5 w-5 rounded-full align-middle ring-1 ring-black/10"
          style={{ backgroundColor: product.hex_color }}
        />
      ),
    },
    price && { label: "Price", value: price },
  ].filter(Boolean);

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
    // Keep Tab and Shift+Tab inside the panel.
    const focusable = panelRef.current.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
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
    <div className="fixed inset-0 z-500 flex items-end bg-black/40 lg:items-center lg:justify-center lg:p-6" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl lg:max-h-[85dvh] lg:w-full lg:max-w-xl lg:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-lightest px-5 py-4">
          <h2 id="product-detail-title" className="font-heading text-lg font-semibold leading-snug text-black">
            {name}
          </h2>
          <div className="flex shrink-0 items-start gap-1">
            <FavoriteButton product={product} />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close product details"
              className="shrink-0 rounded-full p-2 text-gray transition hover:bg-gray-lightest hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
            {showImage ? (
              <img src={src} alt={name} onError={() => setFailedSrc(src)} className="h-full w-full object-contain p-4" />
            ) : (
              <img src={placeholderImg} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-60" />
            )}
          </div>

          <div className="space-y-2">
            <SafetyBadge verdict={product.verdict} size="lg" />
            {/* A guide, never a guarantee (C7). Only with a verdict: "Not checked" is not based on the profile. */}
            {product.verdict && (
              <p className="text-xs leading-snug text-gray">
                Based on your skin profile. This is a guide, not a medical diagnosis.
              </p>
            )}
            {product.brand && <p className="text-sm uppercase tracking-wide text-gray">{product.brand}</p>}
          </div>

          {flagged.length > 0 && (
            <section aria-labelledby="flagged-heading">
              <h3 id="flagged-heading" className="mb-2 text-sm font-semibold text-black">
                Flagged ingredients
              </h3>
              <ul className="space-y-1.5">
                {flagged.map((reason) => (
                  <li key={reason} className="rounded-xl bg-gray-lightest px-3 py-2 text-sm text-black">
                    {reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {details.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {details.map(({ label, value }) => (
                <div key={label} className="contents">
                  <dt className="text-gray">{label}</dt>
                  <dd className="text-black">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {ingredients && (
            <section aria-labelledby="ingredients-heading">
              <h3 id="ingredients-heading" className="mb-2 text-sm font-semibold text-black">
                Full ingredient list
              </h3>
              <p className="text-sm leading-relaxed text-gray">{ingredients}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
