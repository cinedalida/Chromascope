/**
 * deltaE — FUTURE USE (PaletteGuideProductPage / colorAnalysisService)
 *
 * Computes the perceptual color difference (ΔE) between two CIELAB colors.
 * deltaE2000() is the industry-standard formula for cosmetic shade matching.
 * Used to rank products by how closely their shade matches the user's skin tone.
 * Currently uses simplified Euclidean distance — replace with full CIE DE2000 formula for production.
 */
export function deltaE2000(labA, labB) {
  return Math.sqrt((labA.l - labB.l) ** 2 + (labA.a - labB.a) ** 2 + (labA.b - labB.b) ** 2);
}
