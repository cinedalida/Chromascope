import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Catalog plan Part A, Phase 6: the merged catalog page (/catalog).
// Runs on the Firebase emulators like the other UI tests. The backend is not started here, so the two catalog
// requests are answered from repo data only: products from the AR Browse catalogs (public/data/ar-shades-*.json),
// verdicts and ingredient lists from the safety filter's labelled research cases. Each test signs up its own
// emulator user, so the shared test user's profile is never changed.

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf-8"));
const CASES = read("../../research/safety-filter/filter/cases.json").dev;
const SOURCES = { Lip: "lips", Cheek: "cheeks", Face: "foundation" };
const PRODUCTS = [];
for (const [category, region] of Object.entries(SOURCES)) {
  const seen = new Set();
  for (const entry of read(`../public/data/ar-shades-${region}.json`)) {
    if (seen.has(entry.url) || seen.size >= 4) continue;
    seen.add(entry.url);
    const c = CASES[PRODUCTS.length];
    PRODUCTS.push({
      product_id: `${region}-${entry.id}`, product_name: entry.product, brand: entry.brand, category,
      price: entry.price, price_currency: entry.currency, hex_color: entry.hex, image_url: "",
      full_inci_list: c.inci, verdict: c.expected.toLowerCase(), flagged_ingredients: [],
    });
  }
}
// /api/products has no verdicts.
const FILTER_ONLY = new Set(["verdict", "flagged_ingredients"]);
const RAW = PRODUCTS.map((p) => Object.fromEntries(Object.entries(p).filter(([key]) => !FILTER_ONLY.has(key))));
// Same mapping as backend/app/api/api.py category_map.
const CATEGORY = { face: "Face", concealer: "Concealer", cheeks: "Cheek", lips: "Lip", eyes: "Eye", multiuse: "Multi-Use" };

async function mockApi(page) {
  const calls = { products: 0, runFilter: 0 };
  await page.route("http://localhost:8000/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/products") {
      calls.products++;
      return route.fulfill({ json: RAW });
    }
    if (pathname === "/api/run-filter") {
      calls.runFilter++;
      const category = CATEGORY[String(route.request().postDataJSON().category).toLowerCase()];
      const items = PRODUCTS.filter((p) => p.category === category);
      return route.fulfill({ json: { safety_results: items, color_matched: items } });
    }
    return route.fulfill({ json: {} });
  });
  return calls;
}

async function signUpWithProfile(page) {
  const email = `catalog-${Date.now()}@example.com`;
  await page.goto("/auth");
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill("Catalog Tester");
  await page.locator('input[name="email"]').fill(email);
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

const count = (v) => PRODUCTS.filter((p) => p.verdict === v).length;
const cardNames = async (page) => (await page.locator("main ul.grid li button span.font-heading").allInnerTexts()).sort();

test.use({ storageState: { cookies: [], origins: [] } });
// The flows run once, on desktop; the phone layout test at the end runs on the phone projects.
const PHONE_LAYOUT = "fits a phone screen: two columns, no sideways scroll, detail as a bottom sheet";
test.beforeEach(async ({ page }, info) => {
  const phone = info.project.name !== "desktop";
  test.skip(phone !== (info.title === PHONE_LAYOUT), phone ? "flows run on desktop" : "phone viewports only");
  await signUpWithProfile(page);
});

test("loads Safe for me, and the toggle switches views and updates the URL", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/catalog");
  const toggle = page.getByRole("group", { name: "Catalog view" });
  await expect(toggle.getByRole("button", { name: "Safe for me" })).toHaveAttribute("aria-pressed", "true");
  const safeCount = count("safe") + count("caution");
  await expect(page.getByText(`${safeCount} products for your skin`, { exact: false })).toBeVisible();
  await expect.poll(async () => (await cardNames(page)).length).toBe(safeCount);
  await expect(page.locator("main ul.grid li").filter({ hasText: "Excluded" })).toHaveCount(0);

  const before = { ...calls };
  await toggle.getByRole("button", { name: "Full catalog" }).click();
  await expect(page).toHaveURL(/view=all/);
  await expect.poll(async () => (await cardNames(page)).length).toBe(PRODUCTS.length);
  if (count("excluded") > 0) {
    await expect(page.getByRole("heading", { name: `Excluded for your profile (${count("excluded")})` })).toBeVisible();
  }
  expect(calls).toEqual(before); // switching views reuses the loaded data
});

test("a category filter narrows the grid without new requests", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/catalog?view=all");
  await expect(page.locator("main ul.grid li").first()).toBeVisible();
  const before = { ...calls };
  await page.getByRole("complementary", { name: "Filters" }).getByRole("checkbox", { name: "Lip", exact: true }).check();
  await expect(page).toHaveURL(/category=lip/);
  const lips = PRODUCTS.filter((p) => p.category === "Lip").map((p) => p.product_name).sort();
  await expect.poll(() => cardNames(page)).toEqual(lips);
  expect(calls).toEqual(before);
});

test("a card opens the detail view, and Escape closes it", async ({ page }) => {
  await mockApi(page);
  await page.goto("/catalog?view=all");
  const card = page.locator("main ul.grid li button").first();
  const name = (await card.locator("span.font-heading").innerText()).trim();
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Full ingredient list" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("old routes redirect to the matching view", async ({ page }) => {
  await mockApi(page);
  await page.goto("/product-catalog");
  await expect(page).toHaveURL(/\/catalog\?view=all$/);
  await page.goto("/ingredient-filter");
  await expect(page).toHaveURL(/\/catalog\?view=safe$/);
});

// Price shown on each card, in grid order (null when a card shows no price).
const cardPrices = async (page) =>
  (await page.locator("main ul.grid li:has(button span.font-heading)").allInnerTexts()).map((text) => {
    const m = text.match(/₱([\d,]+(?:\.\d+)?)/);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  });

test("price sorting orders the grid, lives in the URL and survives a reload", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/catalog?view=all");
  // Real cards, not the loading skeleton (the mock never answers the "server awake" ping, so the page waits up to 45 s).
  await expect(page.locator("main ul.grid li button span.font-heading").first()).toBeVisible({ timeout: 90_000 });
  const sort = page.getByRole("combobox", { name: "Sort products" });
  await expect(sort).toHaveValue("");
  const before = { ...calls };

  await sort.selectOption("price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);
  await expect.poll(async () => {
    const prices = (await cardPrices(page)).filter((p) => p !== null);
    return prices.length > 1 && prices.every((p, i) => i === 0 || prices[i - 1] <= p);
  }).toBe(true);

  await sort.selectOption("price-desc");
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect.poll(async () => {
    const prices = (await cardPrices(page)).filter((p) => p !== null);
    return prices.length > 1 && prices.every((p, i) => i === 0 || prices[i - 1] >= p);
  }).toBe(true);
  expect(calls).toEqual(before); // sorting reuses the loaded data

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Sort products" })).toHaveValue("price-desc");

  await page.getByRole("combobox", { name: "Sort products" }).selectOption("");
  await expect(page).not.toHaveURL(/sort=/);
});

// Same checks as mobile-layout.spec.js (no sideways scroll, nothing past the right edge), with real cards loaded.
test(PHONE_LAYOUT, async ({ page }, info) => {
  await mockApi(page);
  await page.goto("/catalog?view=all");
  const grid = page.locator("main ul.grid").first();
  await expect(grid.locator("li").first()).toBeVisible();
  const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(2);

  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
      }
      if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    }
    return { vw, pageWidth: document.documentElement.scrollWidth, offenders: offenders.slice(0, 8) };
  });
  await page.screenshot({ path: `test-results/layout/${info.project.name}_catalog.png`, fullPage: true });
  expect(result.pageWidth, `page scrolls sideways: ${JSON.stringify(result)}`).toBeLessThanOrEqual(result.vw);
  expect(result.offenders, `elements past the right edge (vw=${result.vw})`).toEqual([]);

  await grid.locator("li button").first().click();
  const sheet = await page.getByRole("dialog").boundingBox();
  const viewport = page.viewportSize();
  expect(sheet.x).toBeGreaterThanOrEqual(0);
  expect(sheet.width).toBeLessThanOrEqual(viewport.width);
  expect(Math.round(sheet.y + sheet.height)).toBe(viewport.height); // anchored to the bottom edge
  expect(sheet.height).toBeLessThanOrEqual(viewport.height * 0.9);
});
