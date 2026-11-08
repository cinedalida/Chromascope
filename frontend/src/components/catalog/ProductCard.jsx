import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { assetUrl } from "../../config";
import placeholderImg from "../../assets/images/placeholder.svg";
import { useFavorites } from "../../hooks/useFavorites";
import { SafetyBadge } from "./SafetyBadge.jsx";

/**
 * FavoriteButton: the heart for one catalog product (Part B, Phase F2). Hidden for signed-out users (decision B1)
 * and for products without an id. A failed save is rolled back by the hook; its short message shows here briefly.
 */
export function FavoriteButton({ product, className = "" }) {
  const { signedIn, isProductFavorite, toggleCatalogProduct } = useFavorites();
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);
  if (!signedIn || !product?.product_id) return null;
  const active = isProductFavorite(product.product_id);
  const label = active ? "Remove from favorites" : "Add to favorites";
  const onClick = async (e) => {
    e.stopPropagation();
    setError(null);
    const result = await toggleCatalogProduct(product);
    if (!result.ok) setError(result.error);
  };
  return (
    <span className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Heart aria-hidden="true" strokeWidth={2} className={`h-4.5 w-4.5 ${active ? "fill-current text-danger" : "text-gray"}`} />
      </button>
      {error && (
        <span role="alert" className="max-w-44 rounded-lg bg-black/80 px-2 py-1 text-[11px] leading-snug text-white">
          {error}
        </span>
      )}
    </span>
  );
}

// Same image rule as the ingredient filter page: "/public/..." files are served from the site root, and backend
// photos ("/catalog-images/...") get the API host.
function imageSrc(url) {
  if (!url) return null;
  return url.startsWith("/public/") ? url.replace("/public/", "/") : assetUrl(url);
}

// A number gets its currency symbol; text is shown as stored; a missing price is not shown at all.
function formatPrice(price, currency) {
  if (price === null || price === undefined || price === "") return null;
  if (typeof price !== "number") return String(price);
  const amount = price.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  if (currency === "Peso") return `₱${amount}`;
  if (currency === "Dollar") return `$${amount}`;
  return amount;
}

/**
 * ProductCard: one product as a marketplace card. Order of emphasis (plan section 1): large image, safety badge,
 * name and brand, one reason line for Caution and Excluded, then the shade swatch and price on one row.
 * `verdict` defaults to the product's own verdict, so Full catalog cards can pass one looked up elsewhere.
 * The whole card is one button (onSelect). Inner parts are spans, since a button may only hold phrasing content.
 * The heart is a separate button over the image corner (a button cannot hold another), so it never opens the detail.
 */
export function ProductCard({ product, verdict = product.verdict, onSelect }) {
  const name = product.product_name || product.name || "";
  const src = imageSrc(product.image_url);
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;
  const flagged = ["caution", "excluded"].includes(String(verdict ?? "").toLowerCase());
  const reason = flagged ? product.flagged_ingredients?.[0] : null;
  const price = formatPrice(product.price, product.price_currency);

  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={onSelect}
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-primary-lighter bg-white text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {/* 16:10 in the one-column layout (under 360px) so one card does not fill the screen. */}
        <span className="block aspect-[16/10] w-full overflow-hidden min-[360px]:aspect-[4/3] bg-linear-to-br from-primary-lightest via-white to-primary-lighter/40">
          {showImage ? (
            <img
              src={src}
              alt={name}
              loading="lazy"
              onError={() => setFailedSrc(src)}
              className="h-full w-full object-contain p-3"
            />
          ) : (
            <img src={placeholderImg} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-60" />
          )}
        </span>

        <span className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
          <span className="block">
            <SafetyBadge verdict={verdict} />
          </span>
          <span className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-black">{name}</span>
          {product.brand && <span className="block truncate text-xs uppercase tracking-wide text-gray">{product.brand}</span>}
          {reason && <span className="line-clamp-2 text-xs leading-snug text-gray">{reason}</span>}
          {/* Bottom row: shade dot on the left, price on the right. */}
          {(product.hex_color || price) && (
            <span className="mt-auto flex items-center justify-between gap-2 pt-1.5">
              {product.hex_color ? (
                <span
                  aria-hidden="true"
                  className="block h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: product.hex_color }}
                />
              ) : (
                <span aria-hidden="true" />
              )}
              {price && <span className="truncate text-sm font-semibold text-black">{price}</span>}
            </span>
          )}
        </span>
      </button>
      <FavoriteButton product={product} className="absolute right-2 top-2" />
    </div>
  );
}
