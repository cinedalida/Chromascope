import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useUserStore } from "../store/userStore";

/**
 * Route guard: app pages require a signed-in user (PLAN_OPTIMIZATION.md, Phase A8).
 * Logged-out visitors go to the login page; the page they asked for is kept in `state.from`.
 * Data is protected by the Firestore rules and the backend either way; this keeps the UI from
 * showing empty or "Loading…" screens to someone who is not signed in.
 */
export function RequireAuth({ children }) {
  const authStatus = useUserStore((state) => state.authStatus);
  const location = useLocation();

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-primary-lightest" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }
  if (authStatus === "signedOut") {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
}
