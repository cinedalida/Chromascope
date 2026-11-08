import { test, expect } from "@playwright/test";
import { loadControlled } from "./helpers.js";

// Phase 3 (docs/PWA_PLAN.md): a new version waits for the user (rule P3).
// Runs against serve-two-versions.mjs on :4174, which serves a byte-different sw.js after
// POST /__test/new-version, the same as a redeploy. The tests share that server, so they run in order.

const SERVER = "http://localhost:4174";
test.use({ baseURL: SERVER });
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.post(`${SERVER}/__test/reset`);
});

async function deployNewVersion(page, request) {
  await request.post(`${SERVER}/__test/new-version`);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
}

test("a first install shows no update prompt", async ({ page }) => {
  await loadControlled(page);
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("pwa-update-prompt")).toHaveCount(0);
});

test("a new version prompts, Later keeps the page, and Reload loads the new version", async ({ page, request }) => {
  await loadControlled(page);
  const prompt = page.getByTestId("pwa-update-prompt");

  await deployNewVersion(page, request);
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText("A new version is ready.");

  // Later: the card hides, the page is not reloaded (the marker survives), and the update keeps waiting.
  await page.evaluate(() => {
    window.__updateTestMarker = true;
  });
  await prompt.getByRole("button", { name: "Later" }).click();
  await expect(prompt).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__updateTestMarker === true)).toBe(true);
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);

  // The next page load shows the card again while the update waits.
  await page.reload();
  await expect(prompt).toBeVisible();

  // Reload: the waiting version takes over and this page reloads (the marker set after the load is gone).
  await page.evaluate(() => {
    window.__updateTestMarker = true;
  });
  const reloaded = page.waitForEvent("load");
  await prompt.getByRole("button", { name: "Reload" }).click();
  await reloaded;

  const state = await page.evaluate(async () => ({
    marker: window.__updateTestMarker === true,
    waiting: Boolean((await navigator.serviceWorker.getRegistration()).waiting),
    controlled: Boolean(navigator.serviceWorker.controller),
  }));
  expect(state).toEqual({ marker: false, waiting: false, controlled: true });
  await expect(prompt).toHaveCount(0);
});

test("a second tab is not reloaded when the first tab updates", async ({ page, context, request }) => {
  await loadControlled(page);
  const other = await context.newPage();
  await other.goto("/privacy");
  await expect.poll(() => other.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await deployNewVersion(page, request);
  await expect(page.getByTestId("pwa-update-prompt")).toBeVisible();
  await expect(other.getByTestId("pwa-update-prompt")).toBeVisible();

  // The other tab is, for example, in the middle of a camera session.
  await other.evaluate(() => {
    window.__updateTestMarker = true;
  });
  const reloaded = page.waitForEvent("load");
  await page.getByTestId("pwa-update-prompt").getByRole("button", { name: "Reload" }).click();
  await reloaded;

  await other.waitForTimeout(1500);
  expect(await other.evaluate(() => window.__updateTestMarker === true)).toBe(true);
  // It still offers the reload, which now only reloads that tab.
  await expect(other.getByTestId("pwa-update-prompt")).toBeVisible();
});
