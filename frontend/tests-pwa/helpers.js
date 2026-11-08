import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";

// Shared by the Phase 2 specs. The preview server serves the build in ../dist.

export const MEDIAPIPE_JS = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm/vision_wasm_internal.js";
export const MEDIAPIPE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
export const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=MuseoModerno:ital,wght@0,100..900;1,100..900&display=swap";

// Allowed runtime routes, the same as runtimeCaching in vite.config.js (cache name -> URL test).
export const RUNTIME_ROUTES = {
  "mediapipe-runtime": (u) =>
    u.origin === "https://cdn.jsdelivr.net" && u.pathname.startsWith("/npm/@mediapipe/tasks-vision@1.0.1/wasm/"),
  "mediapipe-model": (u) =>
    u.origin === "https://storage.googleapis.com" && u.pathname.startsWith("/mediapipe-models/face_landmarker/"),
  "ar-shades": (u) => u.origin === "http://localhost:4173" && /^\/data\/ar-shades-[a-z]+\.json$/.test(u.pathname),
  "splash-images": (u) =>
    u.origin === "http://localhost:4173" && /^\/assets\/splash-animation-[\w-]+\.jpg$/.test(u.pathname),
  "page-images": (u) => u.origin === "http://localhost:4173" && /^\/assets\/[\w-]+\.(png|jpe?g)$/.test(u.pathname),
  "google-fonts-css": (u) => u.origin === "https://fonts.googleapis.com",
  "google-fonts-files": (u) => u.origin === "https://fonts.gstatic.com",
};

export const ENTRY_LIMITS = {
  "mediapipe-runtime": 8,
  "mediapipe-model": 2,
  "ar-shades": 3,
  "splash-images": 6,
  "page-images": 20,
  "google-fonts-css": 4,
  "google-fonts-files": 20,
};

// Built asset names (hashed), read from the build the preview server is serving.
export function builtAsset(pattern) {
  const dir = fileURLToPath(new URL("../dist/assets/", import.meta.url));
  const name = readdirSync(dir).find((file) => pattern.test(file));
  if (!name) throw new Error(`No built asset matches ${pattern}`);
  return `/assets/${name}`;
}

// Waits until the worker is active, then reloads so it controls the page (a first visit is never controlled).
export async function loadControlled(page, path = "/") {
  await page.goto(path);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

// Every cached request URL, grouped by cache name.
export function cacheContents(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      out[name] = (await cache.keys()).map((request) => request.url);
    }
    return out;
  });
}

// Whether a cache holds a URL (ignoring the precache revision query).
export function isCached(page, cacheName, url) {
  return page.evaluate(
    async ([name, target]) => {
      const cache = await caches.open(name);
      return Boolean(await cache.match(new URL(target, location.href).href, { ignoreSearch: false }));
    },
    [cacheName, url],
  );
}
