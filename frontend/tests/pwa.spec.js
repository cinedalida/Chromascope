import { test, expect } from "@playwright/test";

// Phase 3 validation (PLAN_MOBILE.md): the app is installable to the home screen.

test("manifest is linked, valid, and its icons load at the right sizes", async ({ page, request }) => {
  test.skip(test.info().project.name !== "android", "one run is enough");
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const res = await request.get(href);
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.name).toBe("Chromascope");
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/");

  for (const icon of m.icons) {
    const img = await request.get(icon.src);
    expect(img.ok(), icon.src).toBeTruthy();
    const size = await page.evaluate(async (src) => {
      const i = new Image(); i.src = src; await i.decode(); return `${i.naturalWidth}x${i.naturalHeight}`;
    }, icon.src);
    expect(size, icon.src).toBe(icon.sizes);
  }
  expect(m.icons.some((i) => i.purpose === "maskable")).toBeTruthy();

  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(apple)).ok()).toBeTruthy();
});

test("Chromium reports no installability errors", async ({ page }) => {
  test.skip(test.info().project.name !== "android", "one run is enough");
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
});
