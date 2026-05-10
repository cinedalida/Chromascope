/**
 * AdminRoute — FUTURE USE (AppRouter)
 *
 * Route guard that restricts the /admin route to users with role === "admin".
 * Non-admin users are redirected to /home.
 * Currently commented out in AppRouter — uncomment the AdminRoute wrapper on the /admin route
 * once user roles are assigned via the backend auth system.
 * Depends on: useUserProfile hook → userStore (user.role field).
 */
import { Navigate } from "react-router-dom";
import { useUserProfile } from "../hooks/useUserProfile.jsx";

export function AdminRoute({ children }) {
  const { user } = useUserProfile();
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }
  return children;
}
