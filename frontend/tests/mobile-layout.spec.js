import { test, expect } from "@playwright/test";

// Phase 2 validation (PLAN_MOBILE.md): every page fits a phone screen.
// Checks: no horizontal page scroll, and no element wider than the viewport.
// Full-page screenshots go to test-results/layout/ for a human look.

const ROUTES = [
  "/", "/user-manual", "/terms", "/privacy", "/auth", "/onboarding",
  "/home", "/ar-tryon", "/color-analysis", "/color-analysis/processing", "/color-analysis/subtype",
  "/ingredient-filter", "/profile", "/product-catalog",
];

for (const route of ROUTES) {
  test(`fits the screen: ${route}`, async ({ page }, info) => {
    test.skip(info.project.name === "desktop", "phone viewports only");
    await page.goto(route);
    // "load", not "networkidle": signed in, the app keeps a live Firestore connection open, so the network
    // is never idle and the old wait always ran into its timeout.
    await page.waitForLoadState("load");
    await page.waitForTimeout(1_500); // let splash / entrance animations settle

    const result = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const pageWidth = document.documentElement.scrollWidth;
      // Elements whose right edge sticks out past the screen (ignoring those clipped by an overflow-hidden parent).
      const offenders = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) continue;
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) { clipped = true; break; }
        }
        if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`);
      }
      return { vw, pageWidth, offenders: offenders.slice(0, 8) };
    });

    const safe = route.replace(/\//g, "_") || "_root";
    await page.screenshot({ path: `test-results/layout/${info.project.name}${safe}.png`, fullPage: true });

    expect(result.pageWidth, `page scrolls sideways: ${JSON.stringify(result)}`).toBeLessThanOrEqual(result.vw);
    expect(result.offenders, `elements past the right edge (vw=${result.vw})`).toEqual([]);
  });
}
