import { useEffect, useState } from "react";
import { getGroupShades } from "../services/arShadeService";
import { getRecommended } from "../services/arRecommendedService";

const IDLE = { items: [], status: null, seasonFilter: null, ranked: false };

async function loadShades(group, source) {
  if (source === "recommended") {
    const { status, items, seasonFilter, ranked } = await getRecommended(group);
    return { status, items, seasonFilter, ranked };
  }
  if (source === "browse") {
    const items = await getGroupShades(group);
    // The catalog files are never empty, so no items means the fetch failed.
    return { status: items.length > 0 ? "ok" : "error", items, seasonFilter: null, ranked: false };
  }
  throw new Error(`Unknown shade source: ${source}`);
}

/**
 * useARShades: shade items for one panel group (lips, cheeks, eyes, face) from one source.
 * Each result is stored with the group and source it was loaded for, so a
 * result for an older request is never shown, and `loading` is derived
 * instead of being set inside the effect.
 */
export function useARShades(group, source) {
  const requestKey = `${source}:${group}`;
  const [result, setResult] = useState({ requestKey: null, ...IDLE });

  useEffect(() => {
    let active = true;
    loadShades(group, source)
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
  }, [requestKey, group, source]);

  if (result.requestKey !== requestKey) return { ...IDLE, loading: true };
  return { items: result.items, status: result.status, seasonFilter: result.seasonFilter, ranked: result.ranked, loading: false };
}
