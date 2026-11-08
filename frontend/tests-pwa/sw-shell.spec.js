import { test, expect } from "@playwright/test";

// Phase 1 (docs/PWA_PLAN.md): the service worker precaches the app shell only, and the shell renders offline.

// Waits until the worker is active, then reloads so it controls the page (a first visit is never controlled).
async function loadControlled(page, path = "/") {
  await page.goto(path);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

// Paths (without the revision query) of every entry in the Workbox precache.
function precachedPaths(page) {
  return page.evaluate(async () => {
    const paths = [];
    for (const name of await caches.keys()) {
      if (!name.includes("precache")) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths;
  });
}

test("the service worker registers, activates and controls the page", async ({ page }) => {
  await loadControlled(page);
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return { scope: new URL(registration.scope).pathname, active: registration.active?.state };
  });
  expect(state).toEqual({ scope: "/", active: "activated" });
});

test("the precache holds the app shell and nothing else", async ({ page }) => {
  await loadControlled(page);
  const paths = await precachedPaths(page);

  expect(paths).toContain("/index.html");
  expect(paths).toContain("/manifest.webmanifest");
  expect(paths.some((p) => /^\/assets\/index-[\w-]+\.js$/.test(p))).toBe(true);
  expect(paths.some((p) => /^\/assets\/index-[\w-]+\.css$/.test(p))).toBe(true);

  // Rule P7: no photos or large data in the precache.
  expect(paths.filter((p) => /\.(jpe?g|webp)$/.test(p))).toEqual([]);
  expect(paths.filter((p) => /^\/assets\/.+\.png$/.test(p))).toEqual([]);
  expect(paths.filter((p) => /^\/(product-images|data)\//.test(p))).toEqual([]);
});

test("the app shell renders offline, including a deep link", async ({ page, context }) => {
  await loadControlled(page);
  await context.setOffline(true);

  await page.reload();
  await expect(page.locator("#root")).not.toBeEmpty();

  await page.goto("/privacy");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page).toHaveTitle("Chromascope");

  await context.setOffline(false);
});
