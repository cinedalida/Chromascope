import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against LOCAL services only: Firebase Emulator Suite (demo-chromascope project), the backend in
// emulator mode, and the Vite dev server in "emulators" mode. Nothing here can reach the real Firebase project.
// Run: npx playwright test -c playwright.emulator.config.js
const emulatorEnv = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  GCLOUD_PROJECT: "demo-chromascope",
  CRON_SECRET: "test-cron-secret", // enables the retention endpoint for tests only
};

export default defineConfig({
  testDir: "./tests-emulator",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5174", ...devices["Pixel 7"], trace: "retain-on-failure" },
  webServer: [
    {
      command: "npx firebase emulators:start --only auth,firestore --project demo-chromascope --config ../firebase.json",
      // Wait for Firestore itself (Java, starts last); the hub on :4400 answers several seconds earlier.
      url: "http://127.0.0.1:8080/",
      timeout: 180_000,
      // Never reuse: emulators left over from a previous run may be shutting down (flaky "connection refused").
      // If they are still running, the run stops with a clear "port in use" error instead.
      reuseExistingServer: false,
    },
    {
      // Readiness check only: also wait for the Auth emulator (:9099) before any test starts.
      command: "node -e \"setInterval(() => {}, 1 << 30)\"",
      url: "http://127.0.0.1:9099/",
      timeout: 180_000,
      reuseExistingServer: true, // check-only entry: finding Auth already up is the goal
    },
    {
      // Started without a shell so the "Claude Code" space in the path is not split (scripts/start-test-backend.mjs).
      command: "node scripts/start-test-backend.mjs",
      env: emulatorEnv,
      url: "http://127.0.0.1:8000/",
      timeout: 300_000,
      reuseExistingServer: false,
    },
    {
      command: "npx vite --mode emulators --port 5174 --strictPort",
      url: "http://localhost:5174",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
