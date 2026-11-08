import { RefreshCw } from "lucide-react";
import { usePwaUpdate } from "../../hooks/usePwaUpdate.js";

/**
 * "A new version is ready." card. Shown only when an updated service worker is waiting.
 * Nothing reloads until the user taps Reload (rule P3); Later hides it until the next page load.
 * App.jsx places it in the bottom notice stack, above the AR full-screen view (z-60) and the dev
 * tuning panel (z-70).
 */
export function PwaUpdatePrompt() {
  const { needRefresh, updateNow, dismiss } = usePwaUpdate();
  if (!needRefresh) return null;

  return (
    <div
      role="status"
      data-testid="pwa-update-prompt"
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white p-3 pl-4 font-body shadow-xl ring-1 ring-black/10"
    >
      <RefreshCw size={18} className="shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium text-black">A new version is ready.</p>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-light transition hover:text-black"
      >
        Later
      </button>
      <button
        type="button"
        onClick={updateNow}
        className="rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-primary-dark"
      >
        Reload
      </button>
    </div>
  );
}
