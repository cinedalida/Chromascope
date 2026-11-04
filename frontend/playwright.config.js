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
      url: "http://127.0.0.1:4400/emulators",
      timeout: 180_000,
      reuseExistingServer: true,
    },
    {
      command: "npm run dev:emulators -- --port 5173 --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: true,
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
