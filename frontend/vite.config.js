import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Service worker for the installed app (docs/PWA_PLAN.md). Off in dev; built by `npm run build` only.
    VitePWA({
      strategies: "generateSW",
      // A new version waits for the user to tap Reload (rule P3). main.jsx registers the worker.
      registerType: "prompt",
      injectRegister: false,
      // public/manifest.webmanifest stays the only manifest (rule P6).
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        // App shell only (rule P7): code, styles, the page, the manifest, and the app icons.
        // Page photos, splash images, product images and the Browse JSON are not precached.
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}", "icons/*.png"],
        globIgnores: ["product-images/**", "data/**", "assets/**/*.{jpg,jpeg,png,webp}"],
        navigateFallback: "index.html",
        // Never answer API paths or file requests with the app page.
        navigateFallbackDenylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
        cleanupOutdatedCaches: true,
        // Runtime caches (rule P2): only these routes, nothing else. Each matcher is copied into sw.js as text,
        // so it must be self-contained. Requests with an Authorization header never match (rule P1).
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.origin === "https://cdn.jsdelivr.net" &&
              url.pathname.startsWith("/npm/@mediapipe/tasks-vision@1.0.1/wasm/") &&
              !request.headers.has("authorization"),
            handler: "CacheFirst",
            options: {
              cacheName: "mediapipe-runtime",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 8 },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              url.origin === "https://storage.googleapis.com" &&
              url.pathname.startsWith("/mediapipe-models/face_landmarker/") &&
              !request.headers.has("authorization"),
            handler: "CacheFirst",
            options: {
              cacheName: "mediapipe-model",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 2, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin && /^\/data\/ar-shades-[a-z]+\.json$/.test(url.pathname) && !request.headers.has("authorization"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ar-shades",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 3 },
            },
          },
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin && /^\/assets\/splash-animation-[\w-]+\.jpg$/.test(url.pathname) && !request.headers.has("authorization"),
            handler: "CacheFirst",
            options: {
              cacheName: "splash-images",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 6 },
            },
          },
          {
            // Page photos bundled by Vite (hashed names). Left out of the precache to keep it small (rule P7).
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin && /^\/assets\/[\w-]+\.(png|jpe?g)$/.test(url.pathname) && !request.headers.has("authorization"),
            handler: "CacheFirst",
            options: {
              cacheName: "page-images",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 20 },
            },
          },
          {
            // The font CSS comes from a CSS @import, so the response is opaque; StaleWhileRevalidate stores it.
            urlPattern: ({ url, request }) =>
              url.origin === "https://fonts.googleapis.com" && !request.headers.has("authorization"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-css",
              expiration: { maxEntries: 4 },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              url.origin === "https://fonts.gstatic.com" && !request.headers.has("authorization"),
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 20 },
            },
          },
        ],
      },
    }),
  ],
});
