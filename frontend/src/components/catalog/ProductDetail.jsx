import { useEffect, useRef, useState } from "react";
import { FadeImage } from "../common/FadeImage.jsx";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { assetUrl } from "../../config";
import placeholderImg from "../../assets/images/placeholder.svg";
import { SafetyBadge } from "./SafetyBadge.jsx";
import { FavoriteButton } from "./ProductCard.jsx";
import { SeasonTags } from "../common/SeasonTags.jsx";
import { ShadeSwatches } from "./ShadeSwatches.jsx";
import { catalogShades } from "../../utils/catalogShades";
import { canTryOn } from "../../hooks/useFavorites";

// Same rules as ProductCard (a component file cannot share plain helpers under the fast-refresh lint rule).
function imageSrc(url) {
  if (!url) return null;
  return url.startsWith("/public/") ? url.replace("/public/", "/") : assetUrl(url);
}

function formatPrice(price) {
  if (price === null || price === undefined || price === "") return null;
  if (typeof price !== "number") return String(price);
  return `₱${price.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`; // all prices are in pesos
}

// The store page from the catalog data (`where_to_buy`). Only a plain http(s) link is offered; anything else is ignored.
function buyLink(product) {
  const raw = String(product.where_to_buy ?? "").trim();
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

// Category names as the manuscript writes them (C5); the data stores "Multi-Use".
const CATEGORY_LABEL = { "Multi-Use": "Multiuse" };

/**
 * ProductDetail: the safety details of one product without leaving the catalog. A bottom sheet on phones and a
 * centered dialog from tablet width up (32rem: max-w-xl is 1280px here, variables.css redefines --container-xl). Closes with the close button, the Escape key, a tap on the backdrop, or the back button
 * (the page keeps the open product in the URL). Focus moves into the panel on open and stays inside while it is
 * open; the page returns it to the card on close. Only fields the data has are shown (C4).
 */
export function ProductDetail({ product, onClose, plain = false }) {
  const navigate = useNavigate();
  const buyHref = buyLink(product);
  const store = String(product.store ?? "").trim();
  const tryOnAllowed = canTryOn(product); // same rule as Favorites: an AR region with a real color
  const excluded = !plain && String(product.verdict ?? "").toLowerCase() === "excluded";
  const [confirmTryOn, setConfirmTryOn] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const name = product.product_name || product.name || "";
  const src = imageSrc(product.image_url);
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;
  const flagged = plain ? [] : (product.flagged_ingredients || []).filter(Boolean);
  const price = formatPrice(product.price, product.price_currency);
  const category = product.category ? (CATEGORY_LABEL[product.category] ?? product.category) : null;
  const ingredients = String(product.full_inci_list ?? "").trim();
  const details = [
    category && { label: "Category", value: category },
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
    <div className="fixed inset-0 z-500 flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[85dvh] sm:max-w-128 sm:rounded-3xl"
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
          {/* Fixed height so the image never outgrows the panel. */}
          <div className="h-48 w-full shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 sm:h-56">
            {showImage ? (
              <FadeImage src={src} alt={name} onError={() => setFailedSrc(src)} className="h-full w-full object-contain p-4" />
            ) : (
              <img src={placeholderImg} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-60" />
            )}
          </div>

          <div className="space-y-2">
            {!plain && <SafetyBadge verdict={product.verdict} size="lg" />}
            {/* A guide, never a guarantee (C7). Only with a verdict: "Not checked" is not based on the profile. */}
            {!plain && product.verdict && (
              <p className="text-xs leading-snug text-gray">
                Based on your skin profile. This is a guide, not a medical diagnosis.
              </p>
            )}
            {product.brand && <p className="text-sm uppercase tracking-wide text-gray">{product.brand}</p>}
            <SeasonTags tags={product.season_tags} basis={product.match_basis} />
          </div>

          {/* Every color of the product; the ones that fit the user are ringed. */}
          {catalogShades(product).length > 0 && (
            <section aria-labelledby="shades-heading">
              <h3 id="shades-heading" className="mb-2 text-sm font-semibold text-black">
                Shades
              </h3>
              <ShadeSwatches product={product} markFits={!plain} size={22} className="gap-1.5" />
              {!plain && catalogShades(product).some((shade) => shade.matches) && (
                <p className="mt-2 text-xs text-gray">Ringed shades fit you.</p>
              )}
            </section>
          )}

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

        {/* Outside the scrolling part so they are always in reach. The AR page applies the product's best shade. */}
        <div className="flex flex-col gap-2 border-t border-gray-lightest px-5 py-3">
          {tryOnAllowed && confirmTryOn && (
            <p role="alert" className="text-center text-xs text-gray">
              This product is Excluded for your profile. Try it on anyway?
            </p>
          )}
          {tryOnAllowed ? (
            <button
              type="button"
              onClick={() => (excluded && !confirmTryOn ? setConfirmTryOn(true) : navigate("/ar-tryon", { state: { product } }))}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
              {confirmTryOn ? "Try on anyway" : "Try on"}
            </button>
          ) : (
            <p className="text-center text-xs text-gray">Not available in try-on</p>
          )}
          {buyHref && (
            <a
              href={buyHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                tryOnAllowed ? "border border-primary-lighter bg-white text-primary-dark hover:bg-primary-lightest" : "bg-primary text-white hover:bg-primary-dark"
              }`}
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
              {store ? `Buy at ${store}` : "Buy this product"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
