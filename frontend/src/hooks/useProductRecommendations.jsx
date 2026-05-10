/**
 * useProductRecommendations — FUTURE USE (PaletteGuideProductPage / ProductCatalogPage)
 *
 * Fetches palette-matched product recommendations on mount via productService.
 * Returns { recommendations } — an array of products sorted by ΔE match score.
 * Wire alongside productStore to cache results and avoid redundant API calls.
 */
import { useState, useEffect } from "react";
import { fetchRecommendations } from "../services/productService.js";

export function useProductRecommendations() {
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    fetchRecommendations().then(setRecommendations);
  }, []);

  return { recommendations };
}
