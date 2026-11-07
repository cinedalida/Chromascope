import { test, expect } from "@playwright/test";

// Phase 1 validation (PLAN_MOBILE.md): the "Show performance stats (FPS)" setting.

async function setPerfStats(page, on) {
  await page.goto("/profile");
  const toggle = page.getByTestId("perf-stats-toggle");
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-checked")) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(on));
}

async function startTryOn(page) {
  await page.goto("/ar-tryon");
  await page.getByRole("button", { name: /Start Try-On Now/i }).click();
}

test("setting is off by default and survives a reload", async ({ page }) => {
  await page.goto("/profile");
  const toggle = page.getByTestId("perf-stats-toggle");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByTestId("perf-stats-toggle")).toHaveAttribute("aria-checked", "true");
});

test("badge hidden when the setting is off", async ({ page }) => {
  await setPerfStats(page, false);
  await startTryOn(page);
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.waitForTimeout(5_000);
  await expect(page.getByTestId("perf-stats")).toHaveCount(0);
});

test("badge shows live FPS/latency, then the 30 s average", async ({ page }, info) => {
  test.setTimeout(150_000);
  await setPerfStats(page, true);
  await startTryOn(page);

  const badge = page.getByTestId("perf-stats");
  await expect(badge).toBeVisible();

  // Live line appears once the MediaPipe model is loaded and frames are processed.
  const live = page.getByTestId("perf-live");
  await expect(live).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("perf-measuring")).toBeVisible();
  const liveText = await live.innerText();
  const liveFps = Number(liveText.match(/Live: ([\d.]+) FPS/)?.[1]);
  expect(liveFps).toBeGreaterThan(0);

  // After 30 s of frames the average line replaces the "Measuring" line.
  const avg = page.getByTestId("perf-avg");
  await expect(avg).toBeVisible({ timeout: 45_000 });
  const avgText = await avg.innerText();
  const [, avgFps, avgMs] = avgText.match(/30 s avg: ([\d.]+) FPS · ([\d.]+) ms/) ?? [];
  expect(Number(avgFps)).toBeGreaterThan(0);
  expect(Number(avgMs)).toBeGreaterThan(0);

  // The AR controls are still usable (badge does not block them).
  await expect(page.getByRole("button", { name: /lips/i }).first()).toBeVisible();

  await page.screenshot({ path: `test-results/perf-badge-${info.project.name}.png` });
  info.annotations.push({ type: "reading", description: `${liveText} | ${avgText}` });
  console.log(`[${info.project.name}] ${liveText} | ${avgText}`);
});
