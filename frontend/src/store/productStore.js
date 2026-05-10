/**
 * productStore — FUTURE USE (ProductCatalogPage / PaletteGuideProductPage)
 *
 * Zustand store for the fetched product catalog list.
 * `products` is populated by productService.getProductCatalog() on page load.
 * Shared between ProductCatalogPage and PaletteGuideProductPage to avoid redundant fetches.
 */
import { create } from "zustand";

export const useProductStore = create((set) => ({
  products: [],
  setProducts(products) {
    set({ products });
  },
}));
