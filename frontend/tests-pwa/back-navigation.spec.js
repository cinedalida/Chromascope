import { test, expect } from "@playwright/test";

// Phase 5 (docs/PWA_PLAN.md): pages outside the main layout have an in-app way back, because the installed
// app has no browser back button. Onboarding and Admin need sign-in, so they are a human check.

test("the sign-in page has a Back control to the start page, even when opened first", async ({ page }) => {
  // Opened directly, like an installed app launched on /auth: there is no history to go back to.
  await page.goto("/auth");
  await page.getByTestId("auth-back").click();
  await expect(page).toHaveURL(/\/$/);
});
