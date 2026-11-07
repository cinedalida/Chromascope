import { useCallback, useSyncExternalStore } from "react";

// Install state for the "Install app" button (docs/PWA_PLAN.md, Phase 5).
// The listeners are added when this module loads, because Chromium fires beforeinstallprompt
// once, early, often before the Profile or User manual page is opened.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's own mini bar from showing; the app offers the button instead.
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribe(onChange) {
  listeners.add(onChange);
  const media = window.matchMedia(STANDALONE_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
  };
}

// Installed and opened from the home screen: Chromium uses the display mode, iOS Safari navigator.standalone.
const getStandalone = () => window.matchMedia(STANDALONE_QUERY).matches || navigator.standalone === true;
const getPrompt = () => deferredPrompt;

// iPhone, iPod, and iPad (iPadOS reports itself as a Mac with a touch screen). iOS has no install prompt.
function detectIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 *  - isStandalone: running as the installed app.
 *  - canPrompt: Chromium offered an install prompt that the app can show.
 *  - isIos: show the "Share, then Add to Home Screen" steps instead.
 *  - promptInstall(): shows the browser's install dialog; resolves to "accepted", "dismissed", or null.
 */
export function useInstallPrompt() {
  const isStandalone = useSyncExternalStore(subscribe, getStandalone, () => false);
  const prompt = useSyncExternalStore(subscribe, getPrompt, () => null);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return null;
    // A saved prompt can be shown only once.
    deferredPrompt = null;
    notify();
    await event.prompt();
    const choice = await event.userChoice;
    return choice?.outcome ?? null;
  }, []);

  return { isStandalone, canPrompt: Boolean(prompt), isIos: detectIos(), promptInstall };
}
