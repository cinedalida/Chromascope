import { defineConfig, devices } from "@playwright/test";

// PWA tests (docs/PWA_PLAN.md). They need the real service worker, so they run against a production build
// served by `vite preview` on :4173, not the dev server, and without the Firebase emulators.
export default defineConfig({
  testDir: "./tests-pwa",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", serviceWorkers: "allow", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npm run build && npm run preview -- --port 4173 --strictPort",
      url: "http://localhost:4173",
      timeout: 180_000,
      // Never reuse: an old preview would test an old build.
      reuseExistingServer: false,
    },
    {
      // Same build on :4174, able to serve a "new version" of sw.js for the update prompt test.
      command: "node tests-pwa/serve-two-versions.mjs",
      url: "http://localhost:4174/__test/ping",
      env: { PORT: "4174" },
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
