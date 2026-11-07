// Browse shades: static catalog built by backend/scripts/build_ar_shade_catalog.py.
// These shades are not checked by the ingredient safety filter.

import { ALL_REGIONS, groupByKey } from "../utils/arGroups";

export const REGION_KEYS = ALL_REGIONS;

// One fetch per region per page load.
const cache = new Map();

function toShadeItem(entry, region) {
  return {
    id: entry.id,
    source: "browse",
    region,
    brand: entry.brand,
    product: entry.product,
    shade: entry.shade,
    hex: entry.hex,
    lab: entry.lab,
    price: entry.price,
    currency: entry.currency,
    finish: entry.finish,
    url: entry.url,
    verdict: null,
    seasonMatch: false,
  };
}

async function fetchShades(region) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/ar-shades-${region}.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Shade catalog is not an array");
  return data.map((entry) => toShadeItem(entry, region));
}

export async function getShades(region) {
  if (!REGION_KEYS.includes(region)) throw new Error(`Unknown AR region: ${region}`);

  if (!cache.has(region)) {
    const request = fetchShades(region).catch((error) => {
      console.error(`Error loading ${region} shades:`, error);
      cache.delete(region);
      return [];
    });
    cache.set(region, request);
  }
  return cache.get(region);
}

// Browse shades for a whole panel group (e.g. every face region), one list.
export async function getGroupShades(groupKey) {
  const group = groupByKey(groupKey);
  if (!group) throw new Error(`Unknown AR group: ${groupKey}`);
  const lists = await Promise.all(group.regions.map((region) => getShades(region)));
  return lists.flat();
}
