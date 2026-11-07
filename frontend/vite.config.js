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
      },
    }),
  ],
});
