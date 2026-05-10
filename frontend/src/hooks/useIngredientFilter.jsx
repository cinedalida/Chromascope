/**
 * useIngredientFilter — FUTURE USE (IngredientFilterPage)
 *
 * Custom hook for managing active ingredient safety filters.
 * `filters` is an array of active filter criteria (allergens, skin type, etc.).
 * On filter change, call ingredientService.filterIngredients(filters) to refresh the product list.
 */
import { useState } from "react";

export function useIngredientFilter() {
  const [filters, setFilters] = useState([]);

  return { filters, setFilters };
}
