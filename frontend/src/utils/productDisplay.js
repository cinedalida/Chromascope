// Small display helpers for a product shown outside the catalog card (e.g. inside a saved look).
import { assetUrl } from "../config";

/** The product image URL the way the catalog card resolves it, or null when there is none. */
export function productImageSrc(url) {
  if (!url) return null;
  return url.startsWith("/public/") ? url.replace("/public/", "/") : assetUrl(url);
}

/** A price in pesos ("₱799"); text prices are shown as stored; a missing price gives null. */
export function pesoPrice(price) {
  if (price === null || price === undefined || price === "") return null;
  if (typeof price !== "number") return String(price);
  return `₱${price.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}
