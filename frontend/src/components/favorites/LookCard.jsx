import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { assetUrl } from "../../config";
import { REGION_LABEL } from "../../utils/arGroups";

const MAX_NAME = 40;

/**
 * LookCard: one saved look (Part B, Phase F3). The look name is the title (plain text, never HTML); each shade shows
 * its swatch, region and product, with small product images where the catalog has them. No face photo is ever
 * shown or stored (F-R2). Rename in place (trimmed, 1 to 40 characters; blank keeps the old name) and delete with a
 * confirm step. `resolve(item)` returns { status: "ok" | "missing" | "loading", product }.
 */
export function LookCard({ look, resolve, onRename, onDelete, children }) {
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

  const hexOf = ({ status, product }) => (status === "ok" && product.hex_color ? product.hex_color : null);
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

      <ul className="space-y-2" aria-label="Shades in this look">
        {items.map((entry) => (
          <li key={`${entry.item.region}-${entry.item.product_id}-${entry.item.shade_id}`} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-full bg-gray-lightest ring-1 ring-black/10"
              style={hexOf(entry) ? { backgroundColor: hexOf(entry) } : undefined}
            />
            <span className="w-20 shrink-0 text-xs font-semibold text-gray">{REGION_LABEL[entry.item.region] ?? entry.item.region}</span>
            <span className="min-w-0 truncate text-black">{nameOf(entry)}</span>
          </li>
        ))}
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
