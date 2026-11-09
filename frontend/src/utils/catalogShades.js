// The shades of a catalog product, for showing its colors on a card or in the detail view.
//
// A product from the safety filter carries every shade (`shades`) and, when the user has a season / skin tone, the ones
// that fit them (`matching_shades`, best first). The full catalog shows ALL shades, with the fitting ones marked; Safe
// for me shows only the fitting ones. Products with nothing to match (brows, mascara...) just show all their shades.

/** [{ id, hex, name, matches }]: `onlyMatching` keeps just the shades that fit the user, best first. */
export function catalogShades(product, { onlyMatching = false } = {}) {
  const all = (product?.shades || []).filter((shade) => shade?.hex);
  if (all.length === 0) {
    return product?.hex_color ? [{ id: "color", hex: product.hex_color, name: null, matches: false }] : [];
  }
  const fitting = Array.isArray(product.matching_shades) ? product.matching_shades.filter((shade) => shade?.hex) : null;
  if (!fitting) return all.map((shade) => ({ id: shade.shade_id ?? shade.hex, hex: shade.hex, name: shade.name ?? null, matches: false }));
  if (onlyMatching) {
    return fitting.map((shade) => ({ id: shade.shade_id ?? shade.hex, hex: shade.hex, name: shade.name ?? null, matches: true }));
  }
  const fittingIds = new Set(fitting.map((shade) => shade.shade_id));
  return all.map((shade) => ({
    id: shade.shade_id ?? shade.hex,
    hex: shade.hex,
    name: shade.name ?? null,
    matches: fittingIds.has(shade.shade_id),
  }));
}
