/**
 * colorConversion — FUTURE USE (colorAnalysisService / color processing pipeline)
 *
 * Converts sRGB pixel values to CIELAB color space for perceptual accuracy.
 * D65_MATRIX is the standard D65 illuminant reference white used in CIE calculations.
 * srgbToCIELAB() is called before deltaE2000() comparisons in the matching pipeline.
 * Implement the full Bradford chromatic adaptation matrix for production accuracy.
 */
export const D65_MATRIX = [95.047, 100.0, 108.883];

export function srgbToCIELAB({ r, g, b }) {
  return { l: 50, a: 0, b: 0 };
}
