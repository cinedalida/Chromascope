// Builds the AR Browse shade catalogs (public/data/ar-shades-<region>.json) for the regions that the scraper-based
// build_ar_shade_catalog.py does not cover: lip liner, bronzer, contour, highlighter, eyeliner, brows, mascara,
// foundation, concealer, powder. Uses the same sub_category -> region mapping as the app (src/utils/arProductMap.js).
//
//   python ../backend/scripts/export_products_v2.py ../backend/serviceAccountKey.json products_v2.json
//   node scripts/build-ar-extra-catalogs.mjs products_v2.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { regionForProduct } = await import(pathToFileURL(resolve(here, "../src/utils/arProductMap.js")).href);

// These three keep their scraper-built files (which also carry the finish text).
const SCRAPER_REGIONS = new Set(["lips", "cheeks", "eyeshadow"]);

const products = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = {};
let skipped = 0;

for (const p of products) {
  const region = regionForProduct(p);
  if (!region || SCRAPER_REGIONS.has(region)) continue;
  for (const shade of p.shades ?? []) {
    const hex = String(shade.hex ?? "").toUpperCase();
    const lab = shade.lab;
    // Same validity rule as the app: a real hex, and not the #FFFFFF / Lab 0 placeholder.
    if (!/^#[0-9A-F]{6}$/.test(hex) || !Array.isArray(lab) || (hex === "#FFFFFF" && lab.every((v) => !Number(v)))) {
      skipped += 1;
      continue;
    }
    (out[region] ??= []).push({
      id: shade.shade_id,
      store: p.store,
      brand: p.brand ?? "",
      product: String(p.product_name ?? "").replace(/ • [^•]*$/, "").trim(), // drop a trailing size such as " • 30ml"
      shade: shade.name ?? "",
      hex,
      lab,
      price: typeof p.price === "number" ? p.price : null,
      currency: p.price_currency ?? null,
      finish: null,
      url: p.where_to_buy ?? p.product_id,
    });
  }
}

for (const [region, entries] of Object.entries(out)) {
  const file = resolve(here, `../public/data/ar-shades-${region}.json`);
  writeFileSync(file, JSON.stringify(entries));
  console.log(`${region}: ${entries.length} shades -> ${file}`);
}
console.log(`skipped ${skipped} shades with no usable color`);
