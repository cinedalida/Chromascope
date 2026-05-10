/**
 * Badge — FUTURE USE (app-wide)
 *
 * Generic status/tag badge for use across multiple pages.
 * Will replace ad-hoc inline <span> badge patterns in HomePage, IngredientFilterPage, etc.
 * Accepts `text`, `variant` ("primary" | "danger" | "warning" | "success"), and optional `size` props.
 */
export function Badge({ text = "Badge" }) {
  return <span className="inline-flex rounded-full bg-purple-600 px-3 py-1 text-xs uppercase tracking-wide text-white">{text}</span>;
}
