import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Catalog plan Part B, Phase F5: favorites end to end. Runs on the Firebase emulators with the real firestore.rules,
// like the other UI tests. The backend is not started here, so the two catalog requests are answered from repo data
// only: lip products from the AR Browse catalog (public/data/ar-shades-lips.json) with the "Lipstick" sub-category
// that utils/arProductMap.js maps to the lips region, and verdicts from the safety filter's labelled research cases.
// Each test signs up its own emulator user, so the shared test user's favorites are never changed.

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf-8"));
const CASES = read("../../research/safety-filter/filter/cases.json").dev;
const PRODUCTS = [];
const seen = new Set();
for (const entry of read("../public/data/ar-shades-lips.json")) {
  if (seen.has(entry.url) || seen.size >= 4) continue;
  seen.add(entry.url);
  const c = CASES[PRODUCTS.length];
  PRODUCTS.push({
    product_id: `lips-${entry.id}`, product_name: entry.product, brand: entry.brand, category: "Lip",
    sub_category: "Lipstick", price: entry.price, price_currency: entry.currency, hex_color: entry.hex, image_url: "",
    full_inci_list: c.inci, verdict: c.expected.toLowerCase(), flagged_ingredients: [],
  });
}
const FILTER_ONLY = new Set(["verdict", "flagged_ingredients"]);
const RAW = PRODUCTS.map((p) => Object.fromEntries(Object.entries(p).filter(([key]) => !FILTER_ONLY.has(key))));
const SAFE = PRODUCTS.find((p) => p.verdict === "safe");

async function mockApi(page) {
  await page.route("http://localhost:8000/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/products") return route.fulfill({ json: RAW });
    if (pathname === "/api/run-filter") {
      const lips = String(route.request().postDataJSON().category).toLowerCase() === "lips";
      const items = lips ? PRODUCTS : [];
      return route.fulfill({ json: { safety_results: items, color_matched: items, active_profile: {} } });
    }
    return route.fulfill({ json: {} });
  });
}

async function signUpWithProfile(page) {
  await page.goto("/auth");
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill("Favorites Tester");
  await page.locator('input[name="email"]').fill(`favorites-${Date.now()}@example.com`);
  await page.locator('input[name="password"]').fill("testpass123");
  await page.locator('input[name="confirmPassword"]').fill("testpass123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/onboarding/);
  const uid = await page.evaluate(async () => (await import("/src/firebase.js")).auth.currentUser.uid);
  const docs = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
  const res = await page.request.patch(
    `${docs}/users/${uid}?updateMask.fieldPaths=skin_type&updateMask.fieldPaths=profile_completed`,
    { headers: { Authorization: "Bearer owner" },
      data: { fields: { skin_type: { stringValue: "Normal" }, profile_completed: { booleanValue: true } } } },
  );
  expect(res.ok()).toBe(true);
}

test.use({ storageState: { cookies: [], origins: [] } });
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one viewport is enough for the flow");
  await mockApi(page);
  await signUpWithProfile(page);
});

test("heart a product, see it on Favorites, open it in try-on, remove it", async ({ page }) => {
  // Heart it in the catalog.
  await page.goto("/catalog?view=all");
  const card = page.locator("main ul.grid li").filter({ hasText: SAFE.product_name }).first();
  await card.getByRole("button", { name: "Add to favorites" }).click();
  await expect(card.getByRole("button", { name: "Remove from favorites" })).toBeVisible();

  // It is on the Favorites page, with its current verdict. Navigate inside the app (sidebar), as a user would:
  // a full page reload right after the tap could cancel the save that is still on its way.
  await page.locator("aside nav").getByRole("button", { name: "Favorites" }).click();
  const favorite = page.locator("main ul.grid > li").filter({ hasText: SAFE.product_name });
  await expect(favorite.getByText("Safety verdict: Safe")).toBeAttached();

  // Try on opens AR with its lip shade already applied (fake camera from playwright.config.js).
  await favorite.getByRole("button", { name: "Try on" }).click();
  await expect(page).toHaveURL(/\/ar-tryon$/);
  await expect(page.getByRole("button", { name: "Remove lips shade" })).toBeVisible();

  // Remove it from Favorites.
  await page.goto("/favorites");
  await page.locator("main ul.grid > li").filter({ hasText: SAFE.product_name })
    .getByRole("button", { name: "Remove from favorites" }).click();
  await expect(page.getByRole("heading", { name: "No favorite products yet" })).toBeVisible();
});

test("save a look in try-on and find it by name on Favorites", async ({ page }) => {
  await page.goto("/catalog?view=all");
  await page.locator("main ul.grid li").filter({ hasText: SAFE.product_name }).first()
    .getByRole("button", { name: "Add to favorites" }).click();
  await page.locator("aside nav").getByRole("button", { name: "Favorites" }).click();
  await page.locator("main ul.grid > li").filter({ hasText: SAFE.product_name }).getByRole("button", { name: "Try on" }).click();
  await page.getByRole("button", { name: "Save look" }).click();
  const dialog = page.getByRole("dialog", { name: "Save look" });
  await dialog.getByRole("textbox").fill("Office lips");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("link", { name: "See your looks" })).toBeVisible();
  await page.goto("/favorites?tab=looks");
  await expect(page.getByRole("heading", { name: "Office lips" })).toBeVisible();
});
