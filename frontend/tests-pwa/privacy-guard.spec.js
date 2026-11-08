import { test, expect } from "@playwright/test";
import { RUNTIME_ROUTES, cacheContents, isCached, loadControlled } from "./helpers.js";

// Phase 2 privacy guard (docs/PWA_PLAN.md, rules P1 and P2): caches hold allowlisted static files only.

const FORBIDDEN = [/\/api\//, /firestore\.googleapis\.com/, /identitytoolkit/, /securetoken/, /^blob:/, /^data:/, /:8000\//];

test("after visiting the public pages, every cached URL is allowlisted", async ({ page }) => {
  await loadControlled(page, "/");
  for (const path of ["/auth", "/privacy", "/terms"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  const contents = await cacheContents(page);
  const all = Object.entries(contents).flatMap(([name, urls]) => urls.map((url) => ({ name, url })));
  expect(all.length).toBeGreaterThan(0);

  for (const { name, url } of all) {
    for (const pattern of FORBIDDEN) expect(url, `${name} holds ${url}`).not.toMatch(pattern);
    if (name.includes("precache")) {
      expect(new URL(url).origin, `${name} holds ${url}`).toBe("http://localhost:4173");
      continue;
    }
    expect(RUNTIME_ROUTES[name], `unexpected cache ${name}`).toBeDefined();
    expect(RUNTIME_ROUTES[name](new URL(url)), `${name} holds ${url}`).toBe(true);
  }
});

test("a request with an Authorization header is never stored", async ({ page }) => {
  await loadControlled(page);

  // Positive control: the same kind of request without the header is stored, so the check can see a miss.
  await page.evaluate(() => fetch("/data/ar-shades-lips.json"));
  await expect.poll(() => isCached(page, "ar-shades", "/data/ar-shades-lips.json")).toBe(true);

  const status = await page.evaluate(
    async () => (await fetch("/data/ar-shades-cheeks.json", { headers: { Authorization: "Bearer test-token" } })).status,
  );
  expect(status).toBe(200);
  await page.waitForTimeout(1000); // give a wrongly matching route time to write
  expect(await isCached(page, "ar-shades", "/data/ar-shades-cheeks.json")).toBe(false);
});
