/**
 * ProductSwatchPicker: wrapping grid of round shade swatches, with the
 * selected shade's name shown underneath.
 * Tapping the selected swatch again passes null, which removes the shade.
 */
export function ProductSwatchPicker({ shades, selectedId, onSelect }) {
  const selectedShade = shades.find((shade) => shade.id === selectedId);
  return (
    <div className="pt-2">
      <div className="flex flex-wrap gap-2">
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
              className={`h-8 w-8 shrink-0 rounded-full shadow-sm ring-offset-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${
                isSelected ? "ring-2 ring-primary" : "ring-1 ring-black/10 hover:scale-110"
              }`}
              style={{ backgroundColor: shade.hex }}
            />
          );
        })}
      </div>
      <p className="mt-2 truncate text-[11px] text-gray-light">
        {selectedShade ? (
          <>
            Selected: <span className="font-semibold text-black">{selectedShade.shade || selectedShade.product}</span>
          </>
        ) : (
          "Tap a shade to try it on"
        )}
      </p>
    </div>
  );
}
