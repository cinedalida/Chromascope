/**
 * LoadingSpinner — FUTURE USE (app-wide)
 *
 * Centered spinner for async loading states (API calls, image processing, etc.).
 * Use in ColorAnalysisPage, IngredientFilterPage, and any data-fetching page.
 * Accepts optional `size` ("sm" | "md" | "lg") and `label` (screen-reader text) props.
 */
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
    </div>
  );
}
