import { useState } from "react";
import { FadeImage } from "../common/FadeImage.jsx";
import { TextSkeleton } from "../common/Skeletons.jsx";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { assetUrl } from "../../config";
import { REGION_LABEL } from "../../utils/arGroups";
import { pesoPrice, productImageSrc } from "../../utils/productDisplay";
import { SafetyBadge } from "../catalog/SafetyBadge.jsx";

const MAX_NAME = 40;

// The shade the look actually saved. A catalog product lists all its shades, so the saved one is found by id; a Browse
// shade IS the product here. Falls back to the product's own colour and no shade name.
function savedShadeOf({ item, product }) {
  const saved = item.shade_id ? (product.shades || []).find((s) => s.shade_id === item.shade_id) : null;
  return { name: saved?.name ?? product.shade_name ?? null, hex: saved?.hex ?? product.hex_color ?? null };
}

/* What is behind one shade of a look: the product's picture, brand, name, the saved shade, price and safety, and a
   way to open the product's full details (catalog products; Browse shades have no page of their own). */
function ShadeDetails({ id, entry, onOpenProduct }) {
  const { product } = entry;
  const isBrowse = !product.product_id;
  const shade = savedShadeOf(entry);
  const src = productImageSrc(product.image_url);
  const [failedSrc, setFailedSrc] = useState(null);
  const price = pesoPrice(product.price);
  return (
    <div id={id} className="mt-1 mb-2 flex gap-3 rounded-xl bg-gray-lightest/50 p-3">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
        {src && failedSrc !== src ? (
          <FadeImage src={src} alt={product.product_name} loading="lazy" onError={() => setFailedSrc(src)} className="h-full w-full object-contain p-1" />
        ) : (
          <span aria-hidden="true" className="h-8 w-8 rounded-full ring-1 ring-black/10" style={shade.hex ? { backgroundColor: shade.hex } : undefined} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {product.brand && <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-light">{product.brand}</p>}
        <p className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-black">{product.product_name}</p>
        {shade.name && (
          <p className="flex items-center gap-1.5 text-xs text-gray">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={shade.hex ? { backgroundColor: shade.hex } : undefined} />
            <span className="min-w-0 truncate">{shade.name}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {price && <span className="text-xs font-semibold text-black">{price}</span>}
          {isBrowse ? (
            <span className="text-[11px] text-gray-light">From Browse, not safety-checked</span>
          ) : (
            <SafetyBadge verdict={product.verdict} />
          )}
        </div>
        {!isBrowse && onOpenProduct && (
          <button
            type="button"
            onClick={(e) => onOpenProduct(product, e.currentTarget)}
            className="mt-1 self-start text-[11px] font-bold uppercase tracking-[0.12em] text-primary hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View full details
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * LookCard: one saved look (Part B, Phase F3). The look name is the title (plain text, never HTML); each shade shows
 * its swatch, region and product, with small product images where the catalog has them. No face photo is ever
 * shown or stored (F-R2). Rename in place (trimmed, 1 to 40 characters; blank keeps the old name) and delete with a
 * confirm step. `resolve(item)` returns { status: "ok" | "missing" | "loading", product }.
 */
export function LookCard({ look, resolve, onRename, onDelete, onOpenProduct, children }) {
  const [openKey, setOpenKey] = useState(null); // the shade row that is open, if any
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(look.name);
  const [confirming, setConfirming] = useState(false);
  const items = look.items.map((item) => ({ item, ...resolve(item) }));
  const thumbnails = items.filter(({ status, product }) => status === "ok" && product.image_url);

  const save = (e) => {
    e.preventDefault();
    onRename(look.id, draft.trim() || look.name);
    setEditing(false);
  };

  // The saved shade's colour (the look is about the shades saved), else the product's own colour.
  const hexOf = (entry) => (entry.status === "ok" ? savedShadeOf(entry).hex || null : null);
  const nameOf = ({ status, product }) =>
    status === "ok" ? product.product_name : status === "loading" ? "Loading..." : "No longer available";

  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-primary-lighter bg-white p-4 shadow-sm">
      {/* The look's colors first: one band segment per shade, in the order saved. */}
      <div aria-hidden="true" className="flex h-14 overflow-hidden rounded-xl ring-1 ring-black/5">
        {items.map((entry) => (
          <span
            key={`band-${entry.item.region}-${entry.item.product_id}-${entry.item.shade_id}`}
            title={`${REGION_LABEL[entry.item.region] ?? entry.item.region}: ${nameOf(entry)}`}
            className="flex-1 bg-gray-lightest"
            style={hexOf(entry) ? { backgroundColor: hexOf(entry) } : undefined}
          />
        ))}
      </div>

      {editing ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_NAME))}
            maxLength={MAX_NAME}
            aria-label="Look name"
            autoFocus
            className="min-w-0 flex-1 rounded-full border border-primary-lighter px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(look.name);
              setEditing(false);
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray hover:bg-gray-lightest"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words font-heading text-base font-semibold leading-snug text-black">{look.name}</h3>
            <p className="text-[11px] text-gray">
              {items.length} shade{items.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(look.name);
                setEditing(true);
              }}
              aria-label={`Rename ${look.name}`}
              title="Rename"
              className="rounded-full p-2 text-gray hover:bg-gray-lightest hover:text-black"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${look.name}`}
              title="Delete"
              className="rounded-full p-2 text-gray hover:bg-gray-lightest hover:text-[var(--color-danger)]"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Each shade is a row; tap it to look through the product behind it (one open at a time). */}
      <ul className="space-y-1" aria-label="Shades in this look">
        {items.map((entry) => {
          const key = `${entry.item.region}-${entry.item.product_id}-${entry.item.shade_id}`;
          const open = openKey === key;
          const canOpen = entry.status === "ok";
          return (
            <li key={key} className="rounded-xl text-sm">
              <button
                type="button"
                disabled={!canOpen}
                aria-expanded={canOpen ? open : undefined}
                aria-controls={`look-${look.id}-${key}`}
                onClick={() => setOpenKey(open ? null : key)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary enabled:hover:bg-gray-lightest/70 ${
                  open ? "bg-gray-lightest/70" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 rounded-full bg-gray-lightest ring-1 ring-black/10"
                  style={hexOf(entry) ? { backgroundColor: hexOf(entry) } : undefined}
                />
                {/* Phones: the region as a small label above the product name. From sm: side by side. */}
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-light sm:w-20 sm:shrink-0 sm:text-xs sm:font-semibold sm:normal-case sm:tracking-normal sm:text-gray">
                    {REGION_LABEL[entry.item.region] ?? entry.item.region}
                  </span>
                  {entry.status === "loading" ? (
                    <TextSkeleton className="h-3.5 w-32" />
                  ) : (
                    <span className="min-w-0 truncate text-black">{nameOf(entry)}</span>
                  )}
                </span>
                {canOpen && (
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-gray-light transition-transform ${open ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              {open && canOpen && <ShadeDetails id={`look-${look.id}-${key}`} entry={entry} onOpenProduct={onOpenProduct} />}
            </li>
          );
        })}
      </ul>

      {thumbnails.length > 0 && (
        <div className="flex gap-2">
          {thumbnails.map(({ item, product }) => (
            <img
              key={`thumb-${item.region}`}
              src={assetUrl(product.image_url)}
              alt={product.product_name}
              loading="lazy"
              className="h-10 w-10 rounded-lg bg-primary-lightest object-contain p-1 ring-1 ring-black/5"
            />
          ))}
        </div>
      )}

      {children}

      {confirming && (
        <div role="alertdialog" aria-label="Delete this look?" className="mt-auto rounded-xl bg-gray-lightest p-3 text-sm">
          <p className="text-black">Delete this look? This cannot be undone.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onDelete(look.id)}
              className="rounded-full bg-[var(--color-danger)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
