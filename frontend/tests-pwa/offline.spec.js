import { test, expect } from "@playwright/test";

// Phase 4 (docs/PWA_PLAN.md): the offline banner shows only while offline (rule P5: online is unchanged).

test("the offline banner appears offline and disappears online", async ({ page, context }) => {
  await page.goto("/auth");
  const banner = page.getByTestId("offline-banner");
  await expect(banner).toHaveCount(0);

  await context.setOffline(true);
  await expect(banner).toBeVisible();
  await expect(banner).toHaveText("You are offline. Some features need internet.");

  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
});

test("no public page shows the banner while online", async ({ page }) => {
  for (const path of ["/", "/auth", "/privacy", "/terms", "/user-manual"]) {
    await page.goto(path);
    await expect(page.getByTestId("offline-banner"), path).toHaveCount(0);
  }
});

test("the banner never blocks clicks on the page", async ({ page, context }) => {
  await page.goto("/auth");
  await context.setOffline(true);
  const banner = page.getByTestId("offline-banner");
  await expect(banner).toBeVisible();
  const pointerEvents = await banner.evaluate((el) => getComputedStyle(el.parentElement).pointerEvents);
  expect(pointerEvents).toBe("none");
  await context.setOffline(false);
});
