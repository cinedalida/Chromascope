import { test, expect } from "@playwright/test";
import {
  ENTRY_LIMITS,
  FONT_CSS,
  MEDIAPIPE_JS,
  MEDIAPIPE_MODEL,
  RUNTIME_ROUTES,
  builtAsset,
  cacheContents,
  isCached,
  loadControlled,
} from "./helpers.js";

// Phase 2 (docs/PWA_PLAN.md): the AR runtime, Browse shades, page images and fonts work offline after one visit.

test("the MediaPipe CDNs answer with CORS", async ({ page }) => {
  await page.goto("/");
  const results = await page.evaluate(
    (urls) =>
      Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url, { mode: "cors" });
          return { ok: response.ok, type: response.type };
        }),
      ),
    [MEDIAPIPE_JS, MEDIAPIPE_MODEL],
  );
  expect(results).toEqual([
    { ok: true, type: "cors" },
    { ok: true, type: "cors" },
  ]);
});

test("each runtime route is served from its cache when offline", async ({ page, context }) => {
  test.setTimeout(180_000); // the MediaPipe wasm and model are about 15 MB

  await loadControlled(page);
  // A font file the page itself loaded and the worker stored (the splash page text uses the Google fonts).
  // Read from the cache: after a reload the browser reuses fonts from memory, so they are not in
  // the page's resource timing list.
  const firstFontFile = () => cacheContents(page).then((contents) => contents["google-fonts-files"]?.[0] ?? null);
  await expect.poll(firstFontFile).not.toBeNull();
  const fontFile = await firstFontFile();

  // The font CSS is loaded by a CSS @import, which is a no-cors request: the browser gets an opaque
  // response (status 0). The test requests it the same way. Everything else is a normal fetch.
  const routes = [
    { url: MEDIAPIPE_JS, cache: "mediapipe-runtime", mode: "cors", status: 200 },
    { url: MEDIAPIPE_MODEL, cache: "mediapipe-model", mode: "cors", status: 200 },
    { url: "/data/ar-shades-lips.json", cache: "ar-shades", mode: "cors", status: 200 },
    { url: builtAsset(/^splash-animation-1-[\w-]+\.jpg$/), cache: "splash-images", mode: "cors", status: 200 },
    { url: builtAsset(/^tryon-1-[\w-]+\.png$/), cache: "page-images", mode: "cors", status: 200 },
    { url: FONT_CSS, cache: "google-fonts-css", mode: "no-cors", status: 0 },
    { url: fontFile, cache: "google-fonts-files", mode: "cors", status: 200 },
  ];
  const fetchStatus = (route) =>
    page.evaluate(async ({ url, mode }) => (await fetch(url, { mode })).status, route);

  // Prime online, then wait for each entry (StaleWhileRevalidate stores after it responds).
  for (const route of routes) {
    expect(await fetchStatus(route), route.url).toBe(route.status);
    await expect.poll(() => isCached(page, route.cache, route.url), { message: `${route.url} in ${route.cache}` }).toBe(true);
  }

  await context.setOffline(true);
  for (const route of routes) {
    expect(await fetchStatus(route), `offline ${route.url}`).toBe(route.status);
  }
  await context.setOffline(false);

  // Only the expected cache names exist, and each stays within its entry limit.
  const contents = await cacheContents(page);
  for (const [name, urls] of Object.entries(contents)) {
    if (name.includes("precache")) continue;
    expect(Object.keys(RUNTIME_ROUTES), `unexpected cache ${name}`).toContain(name);
    expect(urls.length, `${name} entries`).toBeLessThanOrEqual(ENTRY_LIMITS[name]);
  }
});
