// Stage 3 gate for the Catalog: "Full catalog" is the plain product list (no safety or color check), "Compatible with me"
// still filters. LOCAL SANDBOX only (emulators, backend :8001, app :5181).
//
//   node scripts/ar-qa/full-catalog-gate.mjs <outDir>
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "full-catalog-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const API = process.env.E2E_API ?? "http://127.0.0.1:8001/api";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "full-catalog-gate@example.com", name: "Full Gate" };
fs.mkdirSync(outDir, { recursive: true });

const str = (v) => ({ stringValue: v });
const num = (v) => ({ doubleValue: v });
const arr = (list) => ({ arrayValue: { values: list } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function signIn(email) {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return res.ok ? await res.json() : null;
}
async function setProfile(uid, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, {
    method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`profile update failed: ${res.status} ${await res.text()}`);
}

const browser = await chromium.launch({ executablePath: process.env.AR_QA_CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
const counts = { batch: 0, filter: 0 };
page.on("request", (r) => {
  const p = new URL(r.url()).pathname;
  if (p.endsWith("/run-filter-batch")) counts.batch += 1;
  else if (p.endsWith("/run-filter")) counts.filter += 1;
});
const reset = () => { counts.batch = 0; counts.filter = 0; };

if (!(await signIn(ACCT.email))) {
  await page.goto(`${APP}/auth`);
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill(ACCT.name);
  await page.locator('input[name="email"]').fill(ACCT.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/onboarding/);
  await page.evaluate(() => { localStorage.clear(); });
  await page.context().clearCookies();
}
const acct = await signIn(ACCT.email);
// Soft Autumn, and fragrance blocked, so "Scented ..." products are Excluded for this user.
await setProfile(acct.localId, {
  seasonal_label: str("Soft Autumn"), user_lab: arr([60, 10, 12].map(num)),
  profile_completed: { booleanValue: true }, skin_type: str("normal"), concerns: arr([]),
  avoid_ingredients: arr([str("Fragrance / Parfum")]),
});

// What the API says the catalog is.
const apiProducts = await (await fetch(`${API}/products`, { headers: { authorization: `Bearer ${acct.idToken}` } })).json();
const total = Array.isArray(apiProducts) ? apiProducts.length : (apiProducts.products ?? []).length;
console.log(`  API catalog: ${total} products`);

await page.goto(`${APP}/auth`);
await page.locator('input[name="email"]').fill(ACCT.email);
await page.locator('input[name="password"]').fill(PASSWORD);
await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
await sleep(6000); // background warm-up

const SAFETY_WORDS = /\b(Safe|Caution|Excluded|Not checked)\b|Safety verdict|Excluded for your profile|% match|fit you/;
const mainText = () => page.evaluate(() => document.querySelector("main")?.innerText ?? "");
const cards = () => page.locator("main ul li button.rounded-2xl").count();

// ---- Full catalog, fresh load.
reset();
await page.goto(`${APP}/catalog?view=all`);
await page.waitForSelector("main ul li button.rounded-2xl", { timeout: 30000 });
await sleep(4000);
const fullText = await mainText();
await page.screenshot({ path: path.join(outDir, "full_view.png") });
const fullCards = await cards();
check("full catalog: no safety check is requested", counts.batch + counts.filter === 0, `${counts.batch} batch, ${counts.filter} single`);
check("full catalog: lists every product in the catalog", fullCards === total && new RegExp(`${total} products`).test(fullText), `${fullCards} cards, ${total} in API`);
check("full catalog: the scented product (Excluded for this user) is listed like any other", /Scented/.test(fullText));
check("full catalog: no safety badge, verdict filter, Excluded section or match text", !SAFETY_WORDS.test(fullText), (fullText.match(SAFETY_WORDS) ?? [""])[0]);
check("full catalog: no season banner", (await page.locator('[data-testid="season-context-banner"]').count()) === 0);
check("full catalog: category filter still there", /category/i.test(fullText));

// Detail dialog in the full view.
await page.locator("main ul li button.rounded-2xl", { hasText: "Scented" }).first().click();
await page.waitForSelector('[role="dialog"]');
const detail = await page.locator('[role="dialog"]').innerText();
await page.screenshot({ path: path.join(outDir, "full_detail.png") });
check("full catalog detail: no safety badge, disclaimer or flagged ingredients", !/\b(Safe|Caution|Excluded|Not checked)\b|Based on your skin profile|Flagged ingredients|fit you/.test(detail), (detail.match(/\b(Safe|Caution|Excluded|Not checked)\b|Based on your skin profile|Flagged ingredients/) ?? [""])[0]);
check("full catalog detail: still shows the product (Try on offered)", /Try on|Not available in try-on/.test(detail));
await page.keyboard.press("Escape");
await sleep(500);

// ---- Switch to Compatible with me through the toggle.
reset();
await page.getByRole("button", { name: "Compatible with me" }).click();
await page.waitForSelector('[data-testid="season-context-banner"]', { timeout: 15000 });
await page.waitForSelector("main ul li button.rounded-2xl", { timeout: 30000 });
await sleep(3000);
const safeText = await mainText();
await page.screenshot({ path: path.join(outDir, "compatible_view.png") });
const safeCards = await cards();
check("compatible: the safety check is requested once (one batch call)", counts.batch === 1 && counts.filter === 0, `${counts.batch} batch, ${counts.filter} single`);
check("compatible: banner names the season", /Soft Autumn/.test(await page.locator('[data-testid="season-context-banner"]').innerText()));
check("compatible: shows safety badges", /\bSafe\b/.test(safeText));
check("compatible: the scented (Excluded) product is hidden", !/Scented/.test(safeText));
check("compatible: fewer products than the full catalog", safeCards > 0 && safeCards < fullCards, `${safeCards} vs ${fullCards}`);

// ---- And back to Full: no new request, full list again.
reset();
await page.getByRole("button", { name: "Full catalog" }).click();
await sleep(2500);
const back = await mainText();
check("back to full: no new request and every product again", counts.batch + counts.filter === 0 && (await cards()) === total && /Scented/.test(back) && !SAFETY_WORDS.test(back));

check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ checks }, null, 1));
console.log(`\n${checks.filter((x) => x.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((x) => x.ok) ? 0 : 1);
