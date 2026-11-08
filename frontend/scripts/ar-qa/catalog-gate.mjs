// Checks that the Catalog page does not refetch every time you come back to it, against the LOCAL SANDBOX only.
// Setup as for cache-gate.mjs (emulators, backend :8001, app :5181), with the same products_v2 test catalog.
//
//   node scripts/ar-qa/catalog-gate.mjs <outDir>
//
// Every /products and /run-filter is held DELAY_MS to stand in for a slow server (an assumption, not a measurement).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "catalog-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const DELAY_MS = Number(process.env.DELAY_MS ?? 600);
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "catalog-gate@example.com", name: "Catalog Gate" };
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

async function uidOf(email) {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return res.ok ? (await res.json()).localId : null;
}
async function setProfile(uid, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, {
    method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`profile update failed: ${res.status}`);
}

const browser = await chromium.launch({ executablePath: process.env.AR_QA_CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
let counts = { products: 0, batch: 0, filter: 0 };
// /run-filter-batch (one request for all categories) and /run-filter (one per category) are counted apart.
const track = (p, c) => p.on("request", (r) => {
  const u = new URL(r.url());
  if (u.pathname.endsWith("/run-filter-batch")) c().batch += 1;
  else if (u.pathname.endsWith("/run-filter")) c().filter += 1;
  else if (u.pathname.endsWith("/products") && r.method() === "GET") c().products += 1;
});
const delayRoute = (p) => p.route(/\/(run-filter-batch|run-filter|products)(\?|$)/, async (route) => {
  await sleep(DELAY_MS);
  await route.fallback();
});
track(page, () => counts);
await delayRoute(page);

const spaGo = (to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);
// The verdict badge, not the "Excluded" option in the filter sidebar.
const EXCLUDED = /Safety verdict:\s*Excluded/;
const CARD = "button.rounded-2xl.border-primary-lighter";

// Sign up once (UI), then give the account a finished profile.
if (!(await uidOf(ACCT.email))) {
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
  await page.goto(`${APP}/auth`);
}
const uid = await uidOf(ACCT.email);
await setProfile(uid, {
  seasonal_label: str("Soft Autumn"), user_lab: arr([60, 10, 12].map(num)), season_confidence_level: num(0.9),
  profile_completed: { booleanValue: true }, skin_type: str("normal"), concerns: arr([]), avoid_ingredients: arr([]),
});
await page.goto(`${APP}/auth`);
await page.locator('input[name="email"]').fill(ACCT.email);
await page.locator('input[name="password"]').fill(PASSWORD);
await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
await sleep(8000); // let any background warm-up settle so it is not counted against the page

// Opens the Full catalog view in-app (every product with its verdict, whatever the "Safe for me" view hides); returns requests made, time until the first card, and the page text.
async function visit(label) {
  counts = { products: 0, batch: 0, filter: 0 };
  const start = Date.now();
  await spaGo("/catalog?view=all");
  await page.waitForSelector(CARD, { timeout: 30000 });
  const ms = Date.now() - start;
  await sleep(2500); // let the slower requests finish, so late ones are counted too
  const text = await page.evaluate(() => document.body.innerText);
  const out = { label, ...counts, ms, text };
  fs.writeFileSync(path.join(outDir, `page_${label.replace(/\W+/g, "_")}.txt`), text);
  console.log(`  [${label}] /products=${out.products} /run-filter-batch=${out.batch} /run-filter=${out.filter} first card after ${ms} ms`);
  return out;
}

const first = await visit("first visit");
check("first visit: catalog loads from the server", first.products >= 1 && first.batch >= 1, `${first.products} /products, ${first.batch} /run-filter-batch`);
check("first visit: two requests in all (the product list and ONE filter call for all six categories), even when the page effect runs twice", first.products === 1 && first.batch === 1 && first.filter === 0, `${first.products} /products, ${first.batch} /run-filter-batch, ${first.filter} /run-filter`);
check("first visit: scented product is listed and nothing is Excluded yet", /Scented Berry/.test(first.text) && !EXCLUDED.test(first.text));

await spaGo("/profile");
await sleep(1500);
const back = await visit("back from Profile");
check("coming back: no requests at all", back.products + back.batch + back.filter === 0, `${back.products} /products, ${back.batch} /run-filter-batch, ${back.filter} /run-filter`);
check(`coming back: cards appear in under ${DELAY_MS / 2} ms`, back.ms < DELAY_MS / 2, `${back.ms} ms vs ${first.ms} ms on the first visit`);
check("coming back: same products as before", /Scented Berry/.test(back.text) && !EXCLUDED.test(back.text));

// A real profile edit through the Profile page: the safety filter's inputs change, so the catalog must ask again.
await spaGo("/profile");
await sleep(1500);
await page.getByRole("button", { name: /^edit$/i }).click();
await page.getByRole("button", { name: "Fragrance / Parfum" }).click();
await page.getByRole("button", { name: /^save$/i }).click();
await sleep(2500);
const edited = await visit("after blocking fragrance");
check("profile edit: the safety results are fetched again, in one request", edited.batch === 1 && edited.filter === 0, `${edited.batch} /run-filter-batch, ${edited.filter} /run-filter`);
check("profile edit: the product list itself is not refetched", edited.products === 0, `${edited.products} /products`);
check("profile edit: the scented product is now Excluded", EXCLUDED.test(edited.text));
await spaGo("/profile");
await sleep(1000);
const again = await visit("again");
check("then back again: served from memory", again.products + again.batch + again.filter === 0, `${again.products} /products, ${again.batch} /run-filter-batch, ${again.filter} /run-filter`);

// ---- An old backend (not redeployed yet): the batch route answers 404 with CORS headers, like the real server would.
const page2 = await context.newPage();
page2.on("pageerror", (e) => pageErrors.push(String(e)));
let counts2 = { products: 0, batch: 0, filter: 0 };
track(page2, () => counts2);
await delayRoute(page2);
const CORS = { "access-control-allow-origin": APP, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PATCH,DELETE" };
await page2.route(/\/run-filter-batch(\?|$)/, (route) =>
  route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 404, headers: CORS, contentType: "application/json", body: '{"detail":"Not Found"}' }));
const startOld = Date.now();
await page2.goto(`${APP}/catalog?view=all`);
await page2.waitForSelector(CARD, { timeout: 40000 });
await sleep(6000);
const oldText = await page2.evaluate(() => document.body.innerText);
console.log(`  [old backend] /products=${counts2.products} /run-filter-batch=${counts2.batch} /run-filter=${counts2.filter} (${Date.now() - startOld} ms to load)`);
check("old backend: the page still loads, by asking per category (batch tried once, then six single calls)", counts2.batch === 1 && counts2.filter === 6, `${counts2.batch} /run-filter-batch, ${counts2.filter} /run-filter`);
check("old backend: shows exactly what the batch showed (same page text)", oldText.replace(/\s+/g, " ") === again.text.replace(/\s+/g, " "), `${oldText.length} vs ${again.text.length} chars`);
counts2 = { products: 0, batch: 0, filter: 0 };
await page2.evaluate(() => { window.history.pushState({}, "", "/profile"); window.dispatchEvent(new PopStateEvent("popstate")); });
await sleep(1200);
await page2.evaluate(() => { window.history.pushState({}, "", "/catalog?view=all"); window.dispatchEvent(new PopStateEvent("popstate")); });
await page2.waitForSelector(CARD, { timeout: 10000 });
await sleep(1500);
check("old backend: coming back still makes no requests", counts2.products + counts2.batch + counts2.filter === 0, `${counts2.products + counts2.batch + counts2.filter} requests`);

check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));
fs.writeFileSync(path.join(outDir, "catalog_gate_report.json"), JSON.stringify({ checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
