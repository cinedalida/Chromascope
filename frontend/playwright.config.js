import { defineConfig, devices } from "@playwright/test";

// UI tests run against the Vite dev server in "emulators" mode with the Firebase Emulator Suite (demo-chromascope
// project), so signing in never touches the real Firebase project. Chromium's fake camera feeds the AR loop.
// Real FPS numbers must still come from real phones; these tests only check that the features work.
const fakeCamera = {
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
};
const STORAGE_STATE = "playwright/.auth/user.json"; // written by tests/auth.setup.js
const signedIn = { storageState: STORAGE_STATE };

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
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
      command: "npm run dev:emulators -- --port 5173 --strictPort",
      url: "http://localhost:5173",
      // Never reuse: a normal dev server on :5173 would point the tests at the REAL Firebase project.
      // (If port 5173 is busy, the run stops with an error instead.)
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "setup", testMatch: /auth\.setup\.js/, use: { ...devices["Desktop Chrome"] } },
    { name: "desktop", dependencies: ["setup"], use: { ...devices["Desktop Chrome"], ...fakeCamera, ...signedIn } },
    // Phone viewports (Chromium engine; iPhone size, not real Safari).
    { name: "android", dependencies: ["setup"], use: { ...devices["Pixel 7"], ...fakeCamera, ...signedIn } },
    { name: "iphone-size", dependencies: ["setup"], use: { ...devices["iPhone 14"], browserName: "chromium", ...fakeCamera, ...signedIn } },
  ],
});
