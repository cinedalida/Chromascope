import { create } from "zustand";

export const useUserStore = create((set) => ({
  user: null,
  // "loading" until Firebase reports the sign-in state once, then "signedIn" or "signedOut" (used by RequireAuth).
  authStatus: "loading",

  updateProfile: (profile) =>
    set((state) => ({ user: state.user ? { ...state.user, ...profile } : null })),

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
  setAuthStatus: (authStatus) => set({ authStatus }),
}));
