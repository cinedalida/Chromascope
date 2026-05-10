/**
 * Modal — FUTURE USE (app-wide)
 *
 * Backdrop + centered panel wrapper for overlays and confirmation dialogs.
 * Used as the shell for AddProductModal and any future confirmation/alert dialogs.
 * Accepts `children`, `onClose`, and optional `size` props.
 * Trap focus and close on backdrop click / Escape key when wiring up.
 */
export function Modal({ children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-950 p-6 shadow-2xl">{children}</div>
    </div>
  );
}
