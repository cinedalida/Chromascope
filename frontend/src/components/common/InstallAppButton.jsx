import { Download, Share } from "lucide-react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt.js";

/**
 * "Install app" for Chromium (uses the browser's saved install prompt) or the Add to Home Screen
 * steps for iPhone and iPad. Renders nothing when the app is already installed or the browser
 * offers no way to install it.
 */
export function InstallAppButton({ className = "" }) {
  const { isStandalone, canPrompt, isIos, promptInstall } = useInstallPrompt();
  if (isStandalone) return null;

  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={promptInstall}
        data-testid="install-app-button"
        className={`inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark ${className}`}
      >
        <Download size={16} aria-hidden="true" />
        Install app
      </button>
    );
  }

  if (isIos) {
    return (
      <p
        data-testid="install-ios-steps"
        className={`flex flex-wrap items-center gap-1.5 rounded-2xl bg-primary-lightest px-4 py-3 text-sm text-black ${className}`}
      >
        <span className="font-semibold">Install on iPhone:</span> tap
        <Share size={16} className="text-primary" aria-label="Share" />
        Share, then <span className="font-semibold">Add to Home Screen</span>.
      </p>
    );
  }

  return null;
}
