import { catalogShades } from "../../utils/catalogShades";
import { ShadeDot } from "../common/ShadeDot.jsx";

/**
 * ShadeSwatches: a product's colors as round dots. In the full catalog every shade is shown and the ones that fit the
 * user get a ring (`markFits`); in Safe for me only the fitting ones are shown (`onlyMatching`). Dots are spans, so this
 * can sit inside the product card's button. `size` is the dot size in px.
 */
export function ShadeSwatches({ product, onlyMatching = false, markFits = false, size = 12, className = "" }) {
  const shades = catalogShades(product, { onlyMatching });
  if (shades.length === 0) return null;
  const anyFit = markFits && shades.some((shade) => shade.matches);
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`} role="img" aria-label={`${shades.length} shade${shades.length === 1 ? "" : "s"}`}>
      {shades.map((shade) => (
        <ShadeDot
          key={shade.id}
          hex={shade.hex}
          title={shade.name ?? undefined}
          className={`shrink-0 rounded-full ${anyFit && shade.matches ? "ring-2 ring-primary ring-offset-1" : "ring-1 ring-black/10"}`}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}
