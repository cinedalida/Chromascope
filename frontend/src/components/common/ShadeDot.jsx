import { useEffect, useRef } from "react";

/**
 * ShadeDot: a block of a makeup shade's colour. Give it a size and, for a dot, `rounded-full`.
 *
 * The colour is painted on a <canvas>, not set as a CSS background. Phone and browser "forced dark mode" recolours web
 * pages, and it inverted very light CSS backgrounds: a pale foundation or nude shade turned dark brown in the picker
 * while the same shade on the camera (also a canvas) stayed pale. Checked in Chromium with forced dark mode on, for
 * light, mid and dark shades at 12 px and 80 px: canvas kept every colour exactly; CSS backgrounds changed the light
 * shades; SVG fills changed the dark and mid shades; `color-scheme` did not help. The CSS background underneath is only
 * a fallback (it is covered by the canvas). Without a `hex` it is an empty block, so the caller's own background shows.
 */
export function ShadeDot({ hex, className = "", style, title, ...rest }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !hex) return;
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [hex]);

  return (
    <span
      {...rest}
      title={title}
      className={`relative block overflow-hidden ${className}`}
      style={hex ? { backgroundColor: hex, ...style } : style}
    >
      {hex ? <canvas ref={canvasRef} width={1} height={1} aria-hidden="true" className="absolute inset-0 h-full w-full" /> : null}
    </span>
  );
}
