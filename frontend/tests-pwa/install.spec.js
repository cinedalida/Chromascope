import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, devices } from "@playwright/test";

// Phase 5 (docs/PWA_PLAN.md): the install button, iOS steps, and the manifest additions.
// Tested on /user-manual, which shows the same button as the Profile page without signing in.

// iPhone 14 size and user agent, run in Chromium (the preset's browser type is for the project setting only).
const IPHONE = Object.fromEntries(Object.entries(devices["iPhone 14"]).filter(([key]) => key !== "defaultBrowserType"));

// Fires a fake beforeinstallprompt, the way Chromium does when the app is installable.
async function offerInstall(page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = () => {
      window.__installPrompted = true;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
  });
}

test("an install prompt shows the button, and clicking it opens the browser dialog", async ({ page }) => {
  await page.goto("/user-manual");
  const button = page.getByTestId("install-app-button");
  await expect(button).toHaveCount(0);

  await offerInstall(page);
  await expect(button).toBeVisible();
  await button.click();
  expect(await page.evaluate(() => window.__installPrompted === true)).toBe(true);
  // A saved prompt works only once, so the button goes away.
  await expect(button).toHaveCount(0);
});

test("iPhone Safari shows the Add to Home Screen steps", async ({ browser }) => {
  const context = await browser.newContext(IPHONE);
  const page = await context.newPage();
  await page.goto("http://localhost:4173/user-manual");
  await expect(page.getByTestId("install-ios-steps")).toBeVisible();
  await expect(page.getByTestId("install-ios-steps")).toContainText("Add to Home Screen");
  await context.close();
});

test("nothing is shown inside the installed app", async ({ browser }) => {
  // Installed on iPhone: navigator.standalone is true.
  const ios = await browser.newContext(IPHONE);
  await ios.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
  const iosPage = await ios.newPage();
  await iosPage.goto("http://localhost:4173/user-manual");
  await iosPage.waitForLoadState("networkidle");
  await expect(iosPage.getByTestId("install-ios-steps")).toHaveCount(0);
  await ios.close();

  // Installed on Chromium: display-mode is standalone (Playwright cannot emulate it, so matchMedia is patched).
  const chromium = await browser.newContext();
  await chromium.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      query === "(display-mode: standalone)"
        ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} }
        : original(query);
  });
  const page = await chromium.newPage();
  await page.goto("http://localhost:4173/user-manual");
  await offerInstall(page);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("install-app-button")).toHaveCount(0);
  await chromium.close();
});

test("the manifest adds lang and shortcuts and keeps the app identity", async ({ request }) => {
  const served = await (await request.get("/manifest.webmanifest")).json();
  const source = JSON.parse(readFileSync(fileURLToPath(new URL("../public/manifest.webmanifest", import.meta.url)), "utf8"));
  expect(served).toEqual(source);

  // Rule P6: these must never change.
  expect(served.id).toBe("/");
  expect(served.start_url).toBe("/");
  expect(served.scope).toBe("/");
  expect(served.icons).toEqual([
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ]);

  expect(served.lang).toBe("en");
  expect(served.shortcuts.map((s) => s.url)).toEqual(["/ar-tryon", "/color-analysis"]);
  for (const shortcut of served.shortcuts) {
    expect(typeof shortcut.name).toBe("string");
    expect((await request.get(shortcut.icons[0].src)).status()).toBe(200);
  }
});
