import { useEffect, useRef, useState } from "react";

/**
 * An <img> that shows a shimmer until the picture has loaded, then fades it in.
 * The wrapper fills its parent, so put it where the plain <img> was. `className` goes on the image.
 * Images already in the browser cache show straight away (no flash of shimmer).
 */
export function FadeImage({ src, alt = "", className = "", onError, ...rest }) {
  const ref = useRef(null);
  const [loadedSrc, setLoadedSrc] = useState(null);
  const loaded = loadedSrc === src;

  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);

  return (
    <span className="relative block h-full w-full">
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <img
        ref={ref}
        src={src}
        alt={alt}
        onLoad={() => setLoadedSrc(src)}
        onError={onError}
        className={`${className} transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        {...rest}
      />
    </span>
  );
}
