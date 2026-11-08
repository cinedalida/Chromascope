// One-off audit (not a test): lists visible buttons/links smaller than 40 px on a phone viewport.
// Run: node tests/tap-targets.audit.js  (dev server must be running on :5173)
import { chromium, devices } from "@playwright/test";

const ROUTES = ["/", "/auth", "/onboarding", "/home", "/ar-tryon", "/color-analysis", "/catalog",
  "/profile", "/user-manual"];
const browser = await chromium.launch();
const page = await browser.newPage({ ...devices["iPhone 14"] });
for (const r of ROUTES) {
  await page.goto("http://localhost:5173" + r);
  await page.waitForTimeout(1500);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, a, [role=switch], input[type=checkbox], input[type=radio]")]
      .filter((el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
        return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && (b.width < 40 || b.height < 40); })
      .map((el) => { const b = el.getBoundingClientRect();
        return `${Math.round(b.width)}x${Math.round(b.height)} ${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.title || "").trim().slice(0, 30)}"`; }));
  console.log(`${r}: ${small.length} small`); small.slice(0, 12).forEach((s) => console.log("   " + s));
}
await browser.close();
