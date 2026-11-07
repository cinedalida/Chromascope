import { create } from "zustand";
import { persist } from "zustand/middleware";

// Device-level app settings, saved in this browser's localStorage so they
// survive reloads. Not synced to the user's Firestore profile.
export const useSettingsStore = create(
  persist(
    (set) => ({
      // Show the FPS / latency badge on the AR try-on screen (survey items TR1–TR3).
      showPerfStats: false,
      setShowPerfStats: (value) => set({ showPerfStats: Boolean(value) }),
    }),
    { name: "chromascope-settings" }
  )
);
