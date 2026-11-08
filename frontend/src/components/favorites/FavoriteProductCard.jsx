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
      <span className="flex flex-1 flex-col gap-1.5 px-3 pt-3 pb-2">
        <span className="flex items-center gap-1.5" title={isBrowse ? "Not checked by the safety filter" : undefined}>
          <SafetyBadge verdict={product.verdict} />
        </span>
        <span className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-black">{name}</span>
        {meta.length > 0 && (
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-gray">
            {product.brand && <span className="truncate uppercase tracking-wide">{product.brand}</span>}
            {product.brand && price && <span aria-hidden="true">·</span>}
            {price && <span className="shrink-0">{price}</span>}
          </span>
        )}
        {product.hex_color && (
          <span aria-hidden="true" className="block h-4 w-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: product.hex_color }} />
        )}
        {isBrowse && <span className="text-[11px] leading-snug text-gray-light">From Browse, not safety-checked.</span>}
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

      {children && <div className="border-t border-gray-lightest px-3 py-2.5">{children}</div>}

      {isBrowse ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove from favorites"
          title="Remove from favorites"
          className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Heart aria-hidden="true" strokeWidth={2} className="h-4.5 w-4.5 fill-current text-danger" />
        </button>
      ) : (
        <FavoriteButton product={product} className="absolute top-2 right-2" />
      )}
    </div>
  );
}
