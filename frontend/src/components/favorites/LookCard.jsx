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

  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-primary-lighter bg-white p-4 shadow-sm">
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
          <h3 className="min-w-0 break-words font-heading text-base font-semibold leading-snug text-black">{look.name}</h3>
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
        {items.map(({ item, status, product }) => (
          <li key={`${item.region}-${item.product_id}-${item.shade_id}`} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10"
              style={status === "ok" && product.hex_color ? { backgroundColor: product.hex_color } : undefined}
            />
            <span className="w-20 shrink-0 text-xs font-semibold text-gray">{REGION_LABEL[item.region] ?? item.region}</span>
            <span className="min-w-0 truncate text-black">
              {status === "ok" ? product.product_name : status === "loading" ? "Loading..." : "No longer available"}
            </span>
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
