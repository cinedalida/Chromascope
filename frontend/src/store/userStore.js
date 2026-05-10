/**
 * userStore — FUTURE USE (AuthPage / ProfilePage / ProtectedRoute / AdminRoute)
 *
 * Zustand store for authenticated user session state.
 * login() is called by authService after successful authentication.
 * logout() clears session; used in Navbar profile dropdown (future).
 * updateProfile() syncs profile changes from ProfilePage back to global state.
 * Used by useUserProfile hook, which gates access via ProtectedRoute and AdminRoute.
 */
import { create } from "zustand";

export const useUserStore = create((set) => ({
  user: null,
  login(user) {
    set({ user });
  },
  logout() {
    set({ user: null });
  },
  updateProfile(profile) {
    set((state) => ({ user: { ...state.user, ...profile } }));
  },
}));
