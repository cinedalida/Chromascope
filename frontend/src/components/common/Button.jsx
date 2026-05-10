/**
 * Button — FUTURE USE (app-wide)
 *
 * Unified primary button component to replace scattered inline <button> elements.
 * Accepts `label`, `type`, `variant` ("primary" | "secondary" | "ghost"), `onClick`, and `disabled` props.
 * Styles should align with the design tokens in styles/variables.css (.btn classes).
 */
export function Button({ label = "Button", type = "button" }) {
  return (
    <button type={type} className="rounded-full bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:bg-purple-500">
      {label}
    </button>
  );
}
