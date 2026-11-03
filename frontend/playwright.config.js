import { defineConfig, devices } from "@playwright/test";

// UI tests run against the Vite dev server with Chromium's fake camera, so the
// AR loop gets real frames without a webcam. Real FPS numbers must still come
// from real phones; these tests only check that the features work.
const fakeCamera = {
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
};

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...fakeCamera } },
    // Phone viewports (Chromium engine; iPhone size, not real Safari).
    { name: "android", use: { ...devices["Pixel 7"], ...fakeCamera } },
    { name: "iphone-size", use: { ...devices["iPhone 14"], browserName: "chromium", ...fakeCamera, launchOptions: fakeCamera.launchOptions } },
  ],
});
