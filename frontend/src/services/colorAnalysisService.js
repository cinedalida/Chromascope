/**
 * colorAnalysisService — FUTURE USE (ColorAnalysisPage → useColorAnalysis hook)
 *
 * Sends an image to the backend for seasonal color analysis and retrieves palette data.
 * analyzeColorImage() accepts a File and returns { season, profile, confidence }.
 * fetchSeasonPalette() retrieves hex colors for a given season label.
 * Replace stubs with real API integration (e.g. POST /api/color-analysis).
 */
export async function analyzeColorImage(imageFile) {
  return Promise.resolve({ season: "autumn", profile: "warm" });
}

export async function fetchSeasonPalette(season) {
  return Promise.resolve(["#9B5DE5", "#F15BB5", "#00BBF9"]);
}
