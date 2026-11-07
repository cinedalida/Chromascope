import { useSyncExternalStore } from "react";

// Whether the browser reports a network connection. Only a hint: it can be true on Wi-Fi with no
// internet, so a failed request should still be treated as offline where it matters.
function subscribe(onChange) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
