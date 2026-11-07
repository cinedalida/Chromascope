import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";

/**
 * Small pill shown only while the device is offline. It never blocks clicks, and App.jsx stacks it
 * above the update prompt at the bottom of the screen.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="flex items-center gap-2 rounded-full bg-black/85 px-4 py-2 font-body text-xs font-medium text-white shadow-lg backdrop-blur"
    >
      <WifiOff size={14} className="shrink-0" aria-hidden="true" />
      You are offline. Some features need internet.
    </div>
  );
}

/**
 * In-page note for a feature that needs the backend, shown only while offline.
 * Pages render it where the user would otherwise start the feature or see an empty result.
 */
export function OfflineNote({ children, className = "" }) {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <p
      role="status"
      data-testid="offline-feature-note"
      className={`flex items-center gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning ${className}`}
    >
      <WifiOff size={16} className="shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
