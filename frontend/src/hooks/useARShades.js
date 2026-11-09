import { useCallback, useEffect, useMemo, useState } from "react";
import { getGroupShades } from "../services/arShadeService";
import { getRecommended } from "../services/arRecommendedService";
import { rankBrowseItems } from "../utils/arFit";
import { useUserStore } from "../store/userStore";

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
  const profile = useUserStore((state) => state.user);
  const [result, setResult] = useState({ requestKey: null, ...IDLE });
  const [attempt, setAttempt] = useState(0); // bumped by retry() to load the same list again

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
  }, [requestKey, group, source, attempt]);

  const retry = useCallback(() => {
    setResult({ requestKey: null, ...IDLE }); // back to the loading state right away
    setAttempt((n) => n + 1);
  }, []);

  // Browse is a static catalog, so it is ranked here for the signed-in user (Recommended arrives ranked by the server).
  // Done at render time so it re-ranks once the profile has loaded.
  const loaded = result.requestKey === requestKey;
  const browse = useMemo(
    () => (loaded && source === "browse" && result.status === "ok" ? rankBrowseItems(result.items, profile) : null),
    [loaded, source, result, profile],
  );

  if (!loaded) return { ...IDLE, loading: true, retry };
  if (browse) return { items: browse.items, status: result.status, seasonFilter: null, ranked: browse.ranked, loading: false, retry };
  return { items: result.items, status: result.status, seasonFilter: result.seasonFilter, ranked: result.ranked, loading: false, retry };
}
