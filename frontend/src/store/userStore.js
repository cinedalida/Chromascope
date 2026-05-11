import { create } from "zustand";

export const useUserStore = create((set) => ({
  user: null,
  
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
  updateProfile: (profile) =>
    set((state) => ({ user: state.user ? { ...state.user, ...profile } : null })),


  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));