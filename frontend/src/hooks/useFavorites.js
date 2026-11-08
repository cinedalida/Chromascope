import { useEffect } from "react";
import { create } from "zustand";
import { useUserStore } from "../store/userStore";
import * as favoritesService from "../services/favoritesService";

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

  // Adds the product (and shade) to favorites, or removes it if it is already there.
  toggleProduct: async (input) => {
    let item;
    try {
      item = favoritesService.toFavoriteItem(input);
    } catch (error) {
      set({ error: messageOf(error, "Couldn't save this favorite.") });
      return;
    }
    const existing = get().findProduct(item.product_id, item.shade_id);
    if (existing) {
      set({ favorites: get().favorites.filter((f) => f.id !== existing.id), error: null });
      try {
        await favoritesService.removeFavorite(existing.id);
      } catch (error) {
        set({ favorites: [existing, ...get().favorites], error: messageOf(error, "Couldn't remove the favorite. Try again.") });
      }
      return;
    }
    const before = get().favorites;
    const temp = { id: `pending-${++tempId}`, type: "product", name: null, items: [item], pending: true };
    set({ favorites: [temp, ...before], error: null });
    try {
      const saved = await favoritesService.addProductFavorite(item, before);
      set({ favorites: get().favorites.map((f) => (f.id === temp.id ? saved : f)) });
    } catch (error) {
      set({ favorites: get().favorites.filter((f) => f.id !== temp.id), error: messageOf(error, "Couldn't save the favorite. Try again.") });
    }
  },

  // Looks are saved from a dialog that waits for the result, so this resolves with the saved look or throws.
  saveLook: async (name, items) => {
    const look = await favoritesService.saveLook(name, items, get().favorites);
    set({ favorites: [look, ...get().favorites] });
    return look;
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
    toggleProduct: store.toggleProduct,
    saveLook: store.saveLook,
    renameLook: store.renameLook,
    removeFavorite: store.removeFavorite,
    clearError: store.clearError,
  };
}
