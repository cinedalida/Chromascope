import { useState } from "react";
import { Heart } from "lucide-react";
import { assetUrl } from "../../config";
import placeholderImg from "../../assets/images/placeholder.svg";
import { FavoriteButton } from "../catalog/ProductCard.jsx";
import { SafetyBadge } from "../catalog/SafetyBadge.jsx";

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

/**
 * FavoriteProductCard: one saved product on the Favorites page. Shorter than the catalog card, with its actions
 * inside: the heart in the image corner removes it, and `children` (Try on, or "Not available in try-on") sits in
 * the footer. Catalog favorites open their details on tap (onSelect) and use the catalog heart. Browse favorites
 * (no product id, no safety check) get a matching heart that calls onRemove, and a short "not checked" line.
 */
export function FavoriteProductCard({ product, isBrowse = false, onSelect, onRemove, children }) {
  const name = product.product_name || product.name || "";
  const src = imageSrc(product.image_url);
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;
  const price = formatPrice(product.price, product.price_currency);
  const meta = [product.brand, price].filter(Boolean);

  const body = (
    <>
      <span className="block h-28 w-full overflow-hidden bg-linear-to-br from-primary-lightest via-white to-primary-lighter/40 sm:h-32">
        {showImage ? (
          <img src={src} alt={name} loading="lazy" onError={() => setFailedSrc(src)} className="h-full w-full object-contain p-3" />
        ) : (
          <img src={placeholderImg} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-50" />
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 px-2.5 pt-2.5 pb-2 sm:px-3 sm:pt-3">
        {/* nowrap: the badge text stays on one line in narrow cards */}
        <span className="flex items-center gap-1.5 whitespace-nowrap" title={isBrowse ? "Not checked by the safety filter" : undefined}>
          <SafetyBadge verdict={product.verdict} />
        </span>
        <span className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-black">{name}</span>
        {meta.length > 0 && (
          // Phones: brand and price on their own lines. From sm: one line with a separator.
          <span className="flex min-w-0 flex-col text-[11px] text-gray sm:flex-row sm:items-center sm:gap-1">
            {product.brand && <span className="truncate uppercase tracking-wide">{product.brand}</span>}
            {product.brand && price && <span aria-hidden="true" className="hidden sm:inline">·</span>}
            {price && <span className="shrink-0">{price}</span>}
          </span>
        )}
        {product.hex_color && (
          <span aria-hidden="true" className="block h-4 w-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: product.hex_color }} />
        )}
        {isBrowse && <span className="text-[10px] leading-snug text-gray-light sm:text-[11px]">From Browse, not safety-checked.</span>}
      </span>
    </>
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-primary-lighter bg-white shadow-sm transition hover:shadow-md">
      {onSelect ? (
        <button type="button" onClick={onSelect} className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
          {body}
        </button>
      ) : (
        <div className="flex flex-1 flex-col">{body}</div>
      )}

      {children && <div className="border-t border-gray-lightest px-2.5 py-2 sm:px-3 sm:py-2.5">{children}</div>}

      {isBrowse ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove from favorites"
          title="Remove from favorites"
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-9 sm:w-9"
        >
          <Heart aria-hidden="true" strokeWidth={2} className="h-4 w-4 fill-current text-danger sm:h-4.5 sm:w-4.5" />
        </button>
      ) : (
        // Shrinks the catalog heart's 36px button to 32px on phones without changing the catalog card.
        <FavoriteButton product={product} className="absolute top-2 right-2 max-sm:[&>button]:h-8 max-sm:[&>button]:w-8" />
      )}
    </div>
  );
}
