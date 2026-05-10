/**
 * useUserProfile — FUTURE USE (ProtectedRoute / AdminRoute / ProfilePage / Navbar)
 *
 * Derived hook exposing the current user and authentication status from userStore.
 * `isAuthenticated` gates access in ProtectedRoute and AdminRoute.
 * Used in Navbar to show the logged-in user's name/avatar (future).
 */
import { useMemo } from "react";
import { useUserStore } from "../store/userStore.js";

export function useUserProfile() {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useMemo(() => Boolean(user?.id), [user]);

  return { user, isAuthenticated };
}
