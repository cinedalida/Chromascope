import { useCallback, useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

// Registers the service worker once per page (StrictMode runs effects twice in dev, where
// registerSW is a no-op anyway) and reports when a new app version is waiting.
const listeners = new Set();
let updateServiceWorker = null;
let newVersionInControl = false;

function notify(event) {
  listeners.forEach((listener) => listener(event));
}

function startRegistration() {
  if (updateServiceWorker) return;
  updateServiceWorker = registerSW({
    immediate: true,
    // A new version is installed and waiting.
    onNeedRefresh: () => notify("need-refresh"),
    // The new version took control, because this tab or another one asked it to. Without this
    // callback the plugin reloads every open tab, even one in the middle of a camera session (rule P3).
    onNeedReload: () => {
      newVersionInControl = true;
      notify("need-reload");
    },
  });
}

/**
 * The update prompt state. A waiting version never loads until the user taps Reload.
 *  - needRefresh: a new version is ready.
 *  - updateNow(): the user tapped Reload.
 *  - dismiss(): the user tapped Later; the prompt comes back on the next page load.
 */
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    const listener = (event) => {
      if (event === "need-reload" && requestedRef.current) {
        window.location.reload();
        return;
      }
      setNeedRefresh(true);
    };
    listeners.add(listener);
    startRegistration();
    return () => listeners.delete(listener);
  }, []);

  const updateNow = useCallback(() => {
    requestedRef.current = true;
    // Another tab already activated the new version, so only this page is left to reload.
    if (newVersionInControl) {
      window.location.reload();
      return;
    }
    updateServiceWorker?.();
  }, []);

  const dismiss = useCallback(() => setNeedRefresh(false), []);

  return { needRefresh, updateNow, dismiss };
}
