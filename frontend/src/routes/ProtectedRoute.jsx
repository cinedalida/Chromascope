/**
 * ProtectedRoute — FUTURE USE (AppRouter)
 *
 * Route guard that redirects unauthenticated users to /auth.
 * Currently commented out in AppRouter — uncomment all ProtectedRoute wrappings
 * once authService and userStore are fully wired up.
 * Depends on: useUserProfile hook → userStore → authService.
 */
import { Navigate } from "react-router-dom";
import { useUserProfile } from "../hooks/useUserProfile.jsx";

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useUserProfile();
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}
