import { useEffect, useState } from "react";
import { getShades } from "../services/arShadeService";
import { getRecommended } from "../services/arRecommendedService";

const IDLE = { items: [], status: null, seasonFilter: null };

async function loadShades(region, source) {
  if (source === "recommended") {
    const { status, items, seasonFilter } = await getRecommended(region);
    return { status, items, seasonFilter };
  }
  if (source === "browse") {
    const items = await getShades(region);
    // The catalog files are never empty, so no items means the fetch failed.
    return { status: items.length > 0 ? "ok" : "error", items, seasonFilter: null };
  }
  throw new Error(`Unknown shade source: ${source}`);
}

/**
 * useARShades: shade items for one AR region from one source.
 * Each result is stored with the region and source it was loaded for, so a
 * result for an older request is never shown, and `loading` is derived
 * instead of being set inside the effect.
 */
export function useARShades(region, source) {
  const requestKey = `${source}:${region}`;
  const [result, setResult] = useState({ requestKey: null, ...IDLE });

  useEffect(() => {
    let active = true;
    loadShades(region, source)
      .catch((error) => {
        console.error("Error loading AR shades:", error);
        return { ...IDLE, status: "error" };
      })
      .then((next) => {
        if (active) setResult({ requestKey, ...next });
      });
    return () => {
      active = false;
    };
  }, [requestKey, region, source]);

  if (result.requestKey !== requestKey) return { ...IDLE, loading: true };
  return { items: result.items, status: result.status, seasonFilter: result.seasonFilter, loading: false };
}
