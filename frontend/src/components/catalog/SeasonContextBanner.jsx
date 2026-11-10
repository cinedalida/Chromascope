import { Link } from "react-router-dom";
import { Info } from "lucide-react";

/**
 * SeasonContextBanner: sits on top of the "Compatible with me" view and says what the list is matched to, so the user
 * knows why they see these products. With a season it names it; without one it says colors are not being matched and
 * points to the color analysis (safe and caution products still list, they are just not narrowed by color).
 */
export function SeasonContextBanner({ season, hasSkinTone }) {
  const label = typeof season === "string" ? season.trim() : "";
  return (
    <div
      data-testid="season-context-banner"
      className="flex items-start gap-2.5 rounded-2xl bg-white px-4 py-3 text-sm text-gray ring-1 ring-primary-lighter"
    >
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
      <p className="min-w-0">
        {label ? (
          <>
            Your season is <strong className="font-semibold text-black">{label}</strong>. Showing products that are safe
            for your skin and have shades that match your {label} colors{hasSkinTone ? " and skin tone" : ""}.
          </>
        ) : (
          <>
            We don&apos;t have your season yet, so colors aren&apos;t being matched. You see every product that is safe
            for your skin.{" "}
            <Link to="/color-analysis" className="font-semibold text-primary underline">
              Take the color analysis
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
