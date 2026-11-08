// Favorites (catalog plan Part B, decision B2 = Option 1): stored in Firestore at users/{uid}/favorites/{id}, written
// with the client SDK like the user profile. Every read and write goes through this file, so the storage can be
// swapped without touching the pages.
//
// A favorite holds references only (plan rule F-R1): type, name (looks), items [{ region, source, product_id,
// shade_id }], created_at, updated_at. Never a safety verdict (worked out again on every view), never an image or
// camera data (F-R2).

import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ALL_REGIONS } from "../utils/arGroups";

export const MAX_FAVORITES = 50; // F-R7 (security rules cannot count documents, so the cap lives here)
export const MAX_LOOK_NAME = 40;
export const MAX_LOOK_ITEMS = 3; // B4 default; firestore.rules allows the same (change both together)
const SOURCES = ["recommended", "browse", "catalog"];

export class FavoritesError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function favoritesRef() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new FavoritesError("signed_out", "Sign in to save favorites.");
  return collection(db, "users", uid, "favorites");
}

// Exactly the four reference fields; anything else on the input is dropped. Browse shades have no product_id.
// Exported so the useFavorites hook shows the same item instantly before the save finishes.
export function toFavoriteItem(input) {
  // A catalog product that AR cannot try on has no region; it can still be a product favorite (not part of a look).
  const region = input?.region ? String(input.region) : null;
  const source = String(input?.source ?? "");
  if (region !== null && !ALL_REGIONS.includes(region)) throw new FavoritesError("invalid", `Unknown region: ${region}`);
  if (!SOURCES.includes(source)) throw new FavoritesError("invalid", `Unknown source: ${source}`);
  const item = {
    region,
    source,
    product_id: input.product_id ? String(input.product_id) : null,
    shade_id: input.shade_id ? String(input.shade_id) : null,
  };
  if (!item.product_id && !item.shade_id) throw new FavoritesError("invalid", "A favorite needs a product or a shade.");
  return item;
}

// Trimmed, 1 to 40 characters. Plain text: it is only ever rendered as text, never as HTML.
export function cleanLookName(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new FavoritesError("invalid_name", "Give the look a name.");
  return trimmed.slice(0, MAX_LOOK_NAME);
}

const sameItem = (a, b) =>
  a.region === b.region && a.source === b.source && a.product_id === b.product_id && a.shade_id === b.shade_id;

/** All of the signed-in user's favorites, newest first: [{ id, type, name, items, created_at, updated_at }]. */
export async function listFavorites() {
  const snapshot = await getDocs(favoritesRef());
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

async function ensureRoom(existing) {
  const list = existing ?? (await listFavorites());
  if (list.length >= MAX_FAVORITES) {
    throw new FavoritesError("limit", `You can save up to ${MAX_FAVORITES} favorites. Remove one to add another.`);
  }
  return list;
}

/** Saves one product (and shade). Returns the existing favorite instead of a duplicate. */
export async function addProductFavorite(input, existing) {
  const item = toFavoriteItem(input);
  const list = existing ?? (await listFavorites());
  const duplicate = list.find((f) => f.type === "product" && f.items?.length === 1 && sameItem(f.items[0], item));
  if (duplicate) return duplicate;
  await ensureRoom(list);
  const now = new Date().toISOString();
  const data = { type: "product", name: null, items: [item], created_at: now, updated_at: now };
  const ref = await addDoc(favoritesRef(), data);
  return { id: ref.id, ...data };
}

/** Saves a look: at most one shade per region (B4). */
export async function saveLook(name, inputs, existing) {
  const items = (inputs || []).map(toFavoriteItem);
  if (items.length === 0) throw new FavoritesError("invalid", "Add at least one shade to save a look.");
  if (items.some((item) => !item.region)) throw new FavoritesError("invalid", "Every shade in a look needs a region.");
  const regions = items.map((i) => i.region);
  if (new Set(regions).size !== regions.length) {
    throw new FavoritesError("invalid", "A look can have only one shade per region.");
  }
  if (items.length > MAX_LOOK_ITEMS) {
    throw new FavoritesError("invalid", `A look can have up to ${MAX_LOOK_ITEMS} shades.`);
  }
  await ensureRoom(existing);
  const now = new Date().toISOString();
  const data = { type: "look", name: cleanLookName(name), items, created_at: now, updated_at: now };
  const ref = await addDoc(favoritesRef(), data);
  return { id: ref.id, ...data };
}

/** Renames a look. */
export async function renameLook(id, name) {
  const patch = { name: cleanLookName(name), updated_at: new Date().toISOString() };
  await updateDoc(doc(favoritesRef(), id), patch);
  return patch;
}

/** Removes one favorite (product or look). */
export async function removeFavorite(id) {
  await deleteDoc(doc(favoritesRef(), id));
}
