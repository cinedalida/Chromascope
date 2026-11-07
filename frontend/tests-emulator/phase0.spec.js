import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

// Phase 0 validation (PLAN_OPTIMIZATION.md), against the emulator only (demo-chromascope project).
// Color analysis with a real photo is pending the model weights; the API must answer 503 "model_unavailable".

const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const email = `phase0-${Date.now()}@example.com`;
const password = "testpass123";

test.describe.configure({ mode: "serial" });
let uid = null;

// Safety net: the app must never contact the real Firebase project during these tests.
// Matches the HOST only: the Auth emulator also puts "identitytoolkit.googleapis.com" in its URL path.
const realFirebase = /^https?:\/\/(firestore|identitytoolkit|securetoken|www)\.googleapis\.com\//;
let realCalls = [];
test.beforeEach(async ({ context }) => {
  realCalls = [];
  await context.route(realFirebase, (route) => { realCalls.push(route.request().url()); route.abort(); });
});
test.afterEach(() => {
  expect(realCalls, "requests to the real Firebase project").toEqual([]);
});

test("sign up creates an account in the emulator and opens onboarding", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill("Phase Zero");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  uid = await page.evaluate(async () => (await import("/src/firebase.js")).auth.currentUser?.uid);
  expect(uid).toBeTruthy();
});

test("onboarding saves the profile with consent, then opens home", async ({ page, request }) => {
  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^log in/i }).first().click();
  await page.waitForURL(/\/(home|onboarding)/);
  await page.goto("/onboarding");
  await page.getByText(/^Normal$/).first().click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /skip for now/i }).click();
  await page.getByRole("button", { name: /skip for now/i }).click();
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: /confirm & complete/i }).click();
  // Second step: the "Complete your profile?" dialog.
  await expect(page.getByText("Complete your profile?")).toBeVisible();
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(page).toHaveURL(/\/home/);

  // Read the stored record straight from the emulator (admin access via the "owner" token).
  const res = await request.get(`${FIRESTORE}/users/${uid}`, { headers: { Authorization: "Bearer owner" } });
  expect(res.ok()).toBeTruthy();
  const f = (await res.json()).fields;
  expect(f.profile_completed?.booleanValue).toBe(true);
  expect(f.ethics_consent?.mapValue?.fields?.agreed_to_terms?.booleanValue).toBe(true);
  expect(JSON.stringify(f.skin_type ?? {})).toMatch(/normal/i);
});

test("profile page shows the saved account and skin type", async ({ page }) => {
  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^log in/i }).first().click();
  await page.waitForURL(/\/home/);
  await page.goto("/profile");
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.getByText(/^normal$/i).first()).toBeVisible();
});

test("safety filter returns the seeded test products through the backend", async ({ page }) => {
  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^log in/i }).first().click();
  await page.waitForURL(/\/home/);
  const filterCall = page.waitForResponse((r) => r.url().includes("/api/run-filter"));
  await page.goto("/ingredient-filter");
  const res = await filterCall;
  expect(res.status()).toBe(200);
  const body = await res.json();
  const names = body.safety_results.map((p) => p.product_name);
  expect(names).toEqual(expect.arrayContaining(["[TEST] Plain Foundation", "[TEST] Scented Foundation", "[TEST] Coconut Foundation"]));
  await expect(page.getByText("[TEST] Plain Foundation").first()).toBeVisible();
});

test("color analysis without model weights answers 503 model_unavailable (real analysis pending weights)", async ({ page, request }) => {
  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^log in/i }).first().click();
  await page.waitForURL(/\/home/);
  const token = await page.evaluate(async () => (await import("/src/firebase.js")).auth.currentUser.getIdToken());
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const res = await request.post("http://127.0.0.1:8000/api/analyze-color", {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { file: { name: "test.png", mimeType: "image/png", buffer: png } },
  });
  expect(res.status()).toBe(503);
  expect((await res.json()).detail.code).toBe("model_unavailable");
  test.info().annotations.push({ type: "pending", description: "Real color analysis: waiting on model weights" });
});
