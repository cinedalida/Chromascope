import { test, expect } from "@playwright/test";
import path from "node:path";

// The 30 s average counts only frames with a tracked face (commit 375ad33). Chromium's fake camera shows a test
// pattern without a face, so that part runs only when PERF_FACE_VIDEO points at a .y4m face video, e.g.
//   PERF_FACE_VIDEO=cam.y4m npx playwright test tests/perf-stats.spec.js
const FACE_VIDEO = globalThis.process?.env?.PERF_FACE_VIDEO; // via globalThis: the lint config knows browser globals only

// Phase 1 validation (PLAN_MOBILE.md): the "Show performance stats (FPS)" setting.

async function setPerfStats(page, on) {
  await page.goto("/profile");
  const toggle = page.getByTestId("perf-stats-toggle");
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-checked")) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(on));
}

// The "Start Try-On Now" screen is skipped when camera permission is already granted (the fake camera grants it),
// so the button is clicked only if that screen shows up.
async function startTryOn(page) {
  await page.goto("/ar-tryon");
  const start = page.getByRole("button", { name: /Start Try-On Now/i });
  // The permission check can remove the screen between seeing it and clicking it: a vanished button is fine.
  if (await start.isVisible({ timeout: 3_000 }).catch(() => false)) await start.click({ timeout: 3_000 }).catch(() => {});
  await expect(start).toHaveCount(0);
}

// The badge is on by default (settingsStore v1); turning it off is remembered across reloads.
test("setting is on by default and survives a reload", async ({ page }) => {
  await page.goto("/profile");
  const toggle = page.getByTestId("perf-stats-toggle");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(page.getByTestId("perf-stats-toggle")).toHaveAttribute("aria-checked", "false");
});

test("badge hidden when the setting is off", async ({ page }) => {
  await setPerfStats(page, false);
  await startTryOn(page);
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.waitForTimeout(5_000);
  await expect(page.getByTestId("perf-stats")).toHaveCount(0);
});

test("badge shows live FPS/latency; the 30 s average waits for a face", async ({ page }, info) => {
  test.setTimeout(150_000);
  await setPerfStats(page, true);
  await startTryOn(page);

  const badge = page.getByTestId("perf-stats");
  await expect(badge).toBeVisible();

  // Live line appears once the MediaPipe model is loaded and frames are processed.
  const live = page.getByTestId("perf-live");
  await expect(live).toBeVisible({ timeout: 60_000 });
  const liveText = await live.innerText();
  const liveFps = Number(liveText.match(/Live: ([\d.]+) FPS/)?.[1]);
  expect(liveFps).toBeGreaterThan(0);

  // Without a face (the fake camera) the average has not started; with one it is measuring.
  await expect(page.getByTestId("perf-waiting-face").or(page.getByTestId("perf-measuring"))).toBeVisible();

  // The AR controls are still usable (badge does not block them).
  await expect(page.getByRole("button", { name: /lips/i }).first()).toBeVisible();

  await page.screenshot({ path: `test-results/perf-badge-${info.project.name}.png` });
  info.annotations.push({ type: "reading", description: liveText });
  console.log(`[${info.project.name}] ${liveText}`);
});

test.describe("with a face video as the camera", () => {
  if (FACE_VIDEO) {
    test.use({
      launchOptions: {
        args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
          `--use-file-for-fake-video-capture=${path.resolve(FACE_VIDEO)}`],
      },
    });
  }

  test("the 30 s average appears after a face is tracked", async ({ page }, info) => {
    test.skip(!FACE_VIDEO, "needs PERF_FACE_VIDEO: the fake camera has no face, and the average counts face frames only");
    test.setTimeout(150_000);
    await setPerfStats(page, true);
    await startTryOn(page);
    await expect(page.getByTestId("perf-measuring")).toBeVisible({ timeout: 60_000 });
    const avg = page.getByTestId("perf-avg");
    await expect(avg).toBeVisible({ timeout: 45_000 });
    const avgText = await avg.innerText();
    const [, avgFps, avgMs] = avgText.match(/30 s avg: ([\d.]+) FPS · ([\d.]+) ms/) ?? [];
    expect(Number(avgFps)).toBeGreaterThan(0);
    expect(Number(avgMs)).toBeGreaterThan(0);
    info.annotations.push({ type: "reading", description: avgText });
    console.log(`[${info.project.name}] ${avgText}`);
  });
});
