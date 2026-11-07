import { test, expect } from "@playwright/test";

// Phase A7 validation (PLAN_OPTIMIZATION.md): one-tap Delete account removes the login and the profile record.
// Emulator + local backend only.

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const DOCS = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";

test("Delete account removes the login and the profile record, then signs out", async ({ page, request }) => {
  const email = `delete-${Date.now()}@example.com`;
  const password = "testpass123";

  // Sign up through the app (creates the Auth user and users/{uid}).
  await page.goto("/auth");
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill("Delete Me");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  const uid = await page.evaluate(async () => (await import("/src/firebase.js")).auth.currentUser?.uid);
  const owner = { headers: { Authorization: "Bearer owner" } };
  expect((await request.get(`${DOCS}/users/${uid}`, owner)).status()).toBe(200);

  // Profile -> Delete my account -> Cancel keeps everything.
  await page.goto("/profile");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("dialog")).toContainText("Delete your account?");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await request.get(`${DOCS}/users/${uid}`, owner)).status()).toBe(200);

  // ...then Delete permanently.
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);

  // Profile record gone, login gone, and the app is signed out.
  expect((await request.get(`${DOCS}/users/${uid}`, owner)).status()).toBe(404);
  const login = await request.post(`${AUTH}/accounts:signInWithPassword?key=fake-api-key`, {
    data: { email, password, returnSecureToken: true },
  });
  expect(login.status()).toBe(400);
  expect(JSON.stringify(await login.json())).toMatch(/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|USER_NOT_FOUND/);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/auth$/);
});

test("the delete endpoint needs a login", async ({ request }) => {
  const res = await request.delete("http://127.0.0.1:8000/api/user/account");
  expect([401, 403]).toContain(res.status());
});
