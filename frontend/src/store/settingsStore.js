import { create } from "zustand";
import { persist } from "zustand/middleware";

// Device-level app settings, saved in this browser's localStorage so they
// survive reloads. Not synced to the user's Firestore profile.
export const useSettingsStore = create(
  persist(
    (set) => ({
      // Show the FPS / latency badge on the AR try-on screen (survey items TR1–TR3).
      showPerfStats: true,
      setShowPerfStats: (value) => set({ showPerfStats: Boolean(value) }),
      // DEV only: show the blend tuning panel on the AR try-on screen.
      showBlendTuner: false,
      setShowBlendTuner: (value) => set({ showBlendTuner: Boolean(value) }),
    }),
    {
      name: "chromascope-settings",
      // v1: the badge became on by default; turn it on once for browsers that saved "off" before.
      version: 1,
      migrate: (state, version) => (version < 1 ? { ...state, showPerfStats: true } : state),
    }
  )
);
