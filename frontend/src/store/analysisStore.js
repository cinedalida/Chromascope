/**
 * analysisStore — FUTURE USE (ColorAnalysisPage / ColorAnalysisProcessingPage)
 *
 * Zustand store for persisting color analysis state across page transitions.
 * `result` holds the analysis output ({ season, palette, confidence }).
 * `progress` (0–100) drives the progress bar in ColorAnalysisProcessingPage.
 * Wire to useColorAnalysis hook and colorAnalysisService on implementation.
 */
import { create } from "zustand";

export const useAnalysisStore = create((set) => ({
  result: null,
  progress: 0,
  setResult(result) {
    set({ result });
  },
  setProgress(progress) {
    set({ progress });
  },
}));
