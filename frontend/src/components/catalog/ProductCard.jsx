import { useState } from "react";
import { assetUrl } from "../../config";
import placeholderImg from "../../assets/images/placeholder.svg";
import { SafetyBadge } from "./SafetyBadge.jsx";

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
 * name and brand, shade swatch, one reason line for Caution and Excluded, then a small muted price.
 * `verdict` defaults to the product's own verdict, so Full catalog cards can pass one looked up elsewhere.
 * The whole card is one button (onSelect). Inner parts are spans, since a button may only hold phrasing content.
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
    <button
      type="button"
      onClick={onSelect}
      className="flex h-full w-full flex-col overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-black/5 transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="block aspect-square w-full overflow-hidden bg-white">
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
        {product.hex_color && (
          <span
            aria-hidden="true"
            className="block h-4 w-4 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: product.hex_color }}
          />
        )}
        {reason && <span className="line-clamp-2 text-xs leading-snug text-gray">{reason}</span>}
        {price && <span className="mt-auto block pt-1 text-[11px] font-normal text-gray-light">{price}</span>}
      </span>
    </button>
  );
}
