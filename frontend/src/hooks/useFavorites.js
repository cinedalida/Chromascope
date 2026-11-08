import { useEffect } from "react";
import { create } from "zustand";
import { useUserStore } from "../store/userStore";
import * as favoritesService from "../services/favoritesService";
import { regionForProduct } from "../utils/arProductMap";
import { getCatalog, getSafetyCategory } from "../services/catalogDataService";
import { getShades } from "../services/arShadeService";
import { productToTryOn } from "../services/arRecommendedService";
import { REGION_LABEL, groupOfRegion } from "../utils/arGroups";

// One shared list for the whole app (catalog cards, the detail view and the AR panel all read it), loaded once per
// signed-in user. Taps update the list at once; if the save fails, the change is rolled back and a short message
// is kept in `error` for the page to show.

const sameRef = (a, b) => (a ?? null) === (b ?? null);
// The service's own messages are written for users; anything else (a Firebase error) gets the short fallback.
const messageOf = (error, fallback) => (error instanceof favoritesService.FavoritesError ? error.message : fallback);
let tempId = 0;

export const favoritesStore = create((set, get) => ({
  uid: null,
  status: "idle", // idle | loading | ready | error
  favorites: [],
  error: null,

  load: async (uid) => {
    set({ uid, status: "loading", favorites: [], error: null });
    try {
      const favorites = await favoritesService.listFavorites();
      if (get().uid === uid) set({ status: "ready", favorites });
    } catch (error) {
      if (get().uid === uid) set({ status: "error", error: messageOf(error, "Couldn't load your favorites.") });
    }
  },

  reset: () => set({ uid: null, status: "idle", favorites: [], error: null }),
  clearError: () => set({ error: null }),

  findProduct: (productId, shadeId) =>
    get().favorites.find(
      (f) => f.type === "product" && sameRef(f.items?.[0]?.product_id, productId) && sameRef(f.items?.[0]?.shade_id, shadeId),
    ),

  // A catalog product counts as a favorite whatever shade was stored with it (its best shade can change later).
  findByProductId: (productId) =>
    productId ? get().favorites.find((f) => f.type === "product" && f.items?.[0]?.product_id === productId) : undefined,

  removeExisting: async (existing) => {
    set({ favorites: get().favorites.filter((f) => f.id !== existing.id), error: null });
    try {
      await favoritesService.removeFavorite(existing.id);
      return { ok: true };
    } catch (error) {
      const message = messageOf(error, "Couldn't remove the favorite. Try again.");
      set({ favorites: [existing, ...get().favorites], error: message });
      return { ok: false, error: message };
    }
  },

  // Adds the product (and shade) to favorites, or removes it if it is already there. Resolves with { ok, error }.
  toggleProduct: async (input) => {
    let item;
    try {
      item = favoritesService.toFavoriteItem(input);
    } catch (error) {
      const message = messageOf(error, "Couldn't save this favorite.");
      set({ error: message });
      return { ok: false, error: message };
    }
    const existing = get().findProduct(item.product_id, item.shade_id);
    if (existing) return get().removeExisting(existing);
    const before = get().favorites;
    const temp = { id: `pending-${++tempId}`, type: "product", name: null, items: [item], pending: true };
    set({ favorites: [temp, ...before], error: null });
    try {
      const saved = await favoritesService.addProductFavorite(item, before);
      set({ favorites: get().favorites.map((f) => (f.id === temp.id ? saved : f)) });
      return { ok: true };
    } catch (error) {
      const message = messageOf(error, "Couldn't save the favorite. Try again.");
      set({ favorites: get().favorites.filter((f) => f.id !== temp.id), error: message });
      return { ok: false, error: message };
    }
  },

  // The heart on a catalog card or the detail view: the product with its best shade for this user, if known.
  toggleCatalogProduct: async (product) => {
    const existing = get().findByProductId(product?.product_id);
    if (existing) return get().removeExisting(existing);
    return get().toggleProduct({
      region: regionForProduct(product),
      source: "catalog",
      product_id: product?.product_id,
      shade_id: product?.best_shade?.shade_id ?? null,
    });
  },

  // Looks are saved from a dialog that waits for the result, so this resolves with the saved look or throws.
  saveLook: async (name, items) => {
    const look = await favoritesService.saveLook(name, items, get().favorites);
    set({ favorites: [look, ...get().favorites] });
    return look;
  },

  // Replaces a saved look's shades (AR "Update this look"). Resolves with the patch or throws, like saveLook.
  updateLook: async (id, items) => {
    const patch = await favoritesService.updateLookItems(id, items);
    set({ favorites: get().favorites.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
    return patch;
  },

  renameLook: async (id, name) => {
    const before = get().favorites;
    const cleaned = favoritesService.cleanLookName(name);
    set({ favorites: before.map((f) => (f.id === id ? { ...f, name: cleaned } : f)), error: null });
    try {
      await favoritesService.renameLook(id, cleaned);
    } catch (error) {
      set({ favorites: before, error: messageOf(error, "Couldn't rename the look. Try again.") });
    }
  },

  removeFavorite: async (id) => {
    const before = get().favorites;
    set({ favorites: before.filter((f) => f.id !== id), error: null });
    try {
      await favoritesService.removeFavorite(id);
    } catch (error) {
      set({ favorites: before, error: messageOf(error, "Couldn't remove the favorite. Try again.") });
    }
  },
}));

/**
 * useFavorites: the signed-in user's favorites and the actions on them. Loads once per user; signed out, the list is
 * empty and `signedIn` is false (the page then hides the heart or asks to sign in, decision B1).
 */
export function useFavorites() {
  const uid = useUserStore((state) => state.user?.uid ?? null);
  const store = favoritesStore();

  useEffect(() => {
    const { uid: loadedFor, load, reset } = favoritesStore.getState();
    if (!uid) {
      if (loadedFor) reset();
    } else if (loadedFor !== uid) {
      load(uid);
    }
  }, [uid]);

  return {
    signedIn: Boolean(uid),
    status: uid ? store.status : "signed_out",
    favorites: uid ? store.favorites : [],
    error: store.error,
    isFavorite: (productId, shadeId) => Boolean(uid && store.findProduct(productId, shadeId)),
    isProductFavorite: (productId) => Boolean(uid && store.findByProductId(productId)),
    toggleProduct: store.toggleProduct,
    toggleCatalogProduct: store.toggleCatalogProduct,
    saveLook: store.saveLook,
    updateLook: store.updateLook,
    renameLook: store.renameLook,
    removeFavorite: store.removeFavorite,
    clearError: store.clearError,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Favorite -> AR try-on (Phase F4). Shared by the Favorites page ("Try on") and the AR panel's Favorites tab.

// F-R5 as written in the plan: only lip, cheek and eye products open in AR.
export const TRY_ON_GROUPS = ["lips", "cheeks", "eyes"];
// Product category (data) -> safety filter category (api.py category_map).
const FILTER_CATEGORY = { Lip: "Lips", Cheek: "Cheeks", Eye: "Eyes", Face: "Face", Concealer: "Concealer", "Multi-Use": "Multiuse" };

// The product as the safety filter sees it now (current verdict, best shade), else the plain catalog entry. Both reads
// go through catalogDataService, so they are shared with the pages and refreshed when the profile changes.
async function currentProduct(productId, user, context) {
  const fromContext = context?.byId?.get(productId);
  if (fromContext) return fromContext;
  const raw = (await getCatalog()).find((p) => p.product_id === productId);
  if (!raw) return null;
  const category = FILTER_CATEGORY[raw.category];
  if (!user || !(user.profile_completed || user.skin_type) || !category) return raw;
  const result = ((await getSafetyCategory(user, category)).color_matched || []).find((p) => p.product_id === productId);
  return result ?? raw;
}

/**
 * Turns a favorite (product or look) into AR shades: { shades: { region: shadeItem }, missing, notAvailable, excluded }
 * (lists of names). Missing = no longer in the catalog (F-R6); notAvailable = cannot be tried on (F-R5); excluded =
 * currently Excluded for this user (the page shows the F-R4 notice first). `context.byId` / `context.browse` let a
 * page that already loaded the data skip the requests.
 */
export async function favoriteToTryOn(favorite, user, context = {}) {
  const out = { shades: {}, missing: [], notAvailable: [], excluded: [] };
  for (const item of favorite.items || []) {
    if (item.source === "browse") {
      const list = context.browse?.[item.region] ?? (await getShades(item.region).catch(() => []));
      const shade = list.find((s) => s.id === item.shade_id);
      if (!shade) out.missing.push(REGION_LABEL[item.region] ?? item.region);
      else if (!TRY_ON_GROUPS.includes(groupOfRegion(shade.region))) out.notAvailable.push(shade.product);
      else out.shades[shade.region] = shade;
      continue;
    }
    const product = await currentProduct(item.product_id, user, context);
    if (!product) {
      out.missing.push(REGION_LABEL[item.region] ?? "A product");
      continue;
    }
    const name = product.product_name || "This product";
    const tryOn = productToTryOn(product);
    if (!tryOn || !TRY_ON_GROUPS.includes(groupOfRegion(tryOn.region))) {
      out.notAvailable.push(name);
      continue;
    }
    let shade = tryOn.shade;
    const saved = item.shade_id ? (product.shades || []).find((s) => s.shade_id === item.shade_id) : null;
    if (saved?.hex) {
      shade = { ...shade, shade: saved.name ?? shade.shade, hex: String(saved.hex).trim().toUpperCase(), lab: saved.lab ?? shade.lab, shadeId: saved.shade_id };
    }
    if (String(product.verdict ?? "").toLowerCase() === "excluded") out.excluded.push(name);
    out.shades[tryOn.region] = shade;
  }
  return out;
}

/** Whether a product (catalog shape) can be tried on, per F-R5. */
export function canTryOn(product) {
  const tryOn = product ? productToTryOn(product) : null;
  return Boolean(tryOn && TRY_ON_GROUPS.includes(groupOfRegion(tryOn.region)));
}

/**
 * One AR shade (from Recommended, Browse or a catalog Try on) as a favorite item: references only (F-R1).
 * Browse shades are identified by their shade id; product shades by product id plus the best shade id, if known.
 */
export function shadeToFavoriteItem(region, shade) {
  const browse = shade?.source === "browse";
  return {
    region,
    source: shade?.source === "recommended" || browse ? shade.source : "catalog",
    product_id: browse ? null : shade?.id ?? null,
    shade_id: browse ? shade?.id ?? null : shade?.shadeId ?? null,
  };
}

/** The items of the shades currently on the face, one per region, in a stable order. */
export function selectedShadesToItems(selectedShades) {
  return Object.entries(selectedShades || {})
    .filter(([, shade]) => shade)
    .map(([region, shade]) => shadeToFavoriteItem(region, shade))
    .sort((a, b) => a.region.localeCompare(b.region));
}
