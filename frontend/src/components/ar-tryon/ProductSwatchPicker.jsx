/**
 * ProductSwatchPicker: horizontally scrollable row of round shade swatches.
 * Tapping the selected swatch again passes null, which removes the shade.
 */
export function ProductSwatchPicker({ shades, selectedId, onSelect }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1.5">
      {shades.map((shade) => {
        const label = shade.shade || shade.product;
        const isSelected = shade.id === selectedId;
        return (
          <button
            key={shade.id}
            type="button"
            onClick={() => onSelect(isSelected ? null : shade)}
            title={label}
            aria-label={label}
            aria-pressed={isSelected}
            className={`h-10 w-10 shrink-0 rounded-full shadow-sm ring-offset-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${
              isSelected ? "ring-2 ring-primary" : "ring-1 ring-black/10 hover:scale-105"
            }`}
            style={{ backgroundColor: shade.hex }}
          />
        );
      })}
    </div>
  );
}
