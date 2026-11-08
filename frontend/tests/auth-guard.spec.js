import { test, expect } from "@playwright/test";

// Phase A8 validation (PLAN_OPTIMIZATION.md): app pages require login; public pages stay open.

const GUARDED = ["/home", "/profile", "/ar-tryon", "/color-analysis", "/color-analysis/processing",
  "/color-analysis/subtype", "/catalog", "/ingredient-filter", "/product-catalog", "/onboarding", "/admin"];
const PUBLIC = ["/", "/auth", "/terms", "/privacy", "/user-manual"];

test.describe("logged out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of GUARDED) {
    test(`${route} redirects to login`, async ({ page }, info) => {
      test.skip(info.project.name !== "android", "one viewport is enough");
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth$/);
    });
  }
  for (const route of PUBLIC) {
    test(`${route} stays open`, async ({ page }, info) => {
      test.skip(info.project.name !== "android", "one viewport is enough");
      await page.goto(route);
      await page.waitForTimeout(1500);
      expect(new URL(page.url()).pathname).toBe(route);
    });
  }
});

test("signed in: guarded pages open, and login returns to the requested page", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "android", "one viewport is enough");
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile$/);

  // Logged-out user asks for /profile -> login -> lands back on /profile.
  const fresh = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const p = await fresh.newPage();
  const email = `guard-${Date.now()}@example.com`;
  await p.request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", {
    data: { email, password: "testpass123", returnSecureToken: true },
  });
  await p.goto(page.url().replace(/\/profile$/, "/profile"));
  await expect(p).toHaveURL(/\/auth$/);
  await p.locator('input[name="email"]').fill(email);
  await p.locator('input[name="password"]').fill("testpass123");
  await p.getByRole("button", { name: /^log in/i }).first().click();
  await expect(p).toHaveURL(/\/profile$/);
  await fresh.close();
});
