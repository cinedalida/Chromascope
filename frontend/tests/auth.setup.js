import { test as setup, expect } from "@playwright/test";

// Signs up one throwaway user in the Firebase Auth EMULATOR and saves the login (incl. IndexedDB, where Firebase
// keeps it) so the UI tests can open pages that require login (Phase A8). Never touches the real project.
export const STORAGE_STATE = "playwright/.auth/user.json";

setup("sign in a test user (emulator)", async ({ page }) => {
  const email = `ui-${Date.now()}@example.com`;
  await page.goto("/auth");
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill("UI Tester");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("testpass123");
  await page.locator('input[name="confirmPassword"]').fill("testpass123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.context().storageState({ path: STORAGE_STATE, indexedDB: true });
});
