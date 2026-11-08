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
let counts = { products: 0, filter: 0 };
page.on("request", (r) => {
  const u = new URL(r.url());
  if (u.pathname.endsWith("/run-filter")) counts.filter += 1;
  else if (u.pathname.endsWith("/products") && r.method() === "GET") counts.products += 1;
});
await page.route(/\/(run-filter|products)(\?|$)/, async (route) => {
  await sleep(DELAY_MS);
  await route.continue();
});

const spaGo = (to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);
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

// Opens the Safe-for-me catalog view in-app; returns requests made, time until the first card, and the page text.
async function visit(label) {
  counts = { products: 0, filter: 0 };
  const start = Date.now();
  await spaGo("/catalog?view=safe");
  await page.waitForSelector(CARD, { timeout: 30000 });
  const ms = Date.now() - start;
  await sleep(2500); // let the slower requests finish, so late ones are counted too
  const text = await page.evaluate(() => document.body.innerText);
  const out = { label, ...counts, ms, text };
  console.log(`  [${label}] /products=${out.products} /run-filter=${out.filter} first card after ${ms} ms`);
  return out;
}

const first = await visit("first visit");
check("first visit: catalog loads from the server", first.products >= 1 && first.filter >= 1, `${first.products} /products, ${first.filter} /run-filter`);
check("first visit: each request is made once (6 categories + the product list), even when the page effect runs twice", first.products === 1 && first.filter === 6, `${first.products} /products, ${first.filter} /run-filter`);
check("first visit: scented product is shown (nothing blocked yet)", /Scented Berry/.test(first.text));

await spaGo("/profile");
await sleep(1500);
const back = await visit("back from Profile");
check("coming back: no /products and no /run-filter", back.products === 0 && back.filter === 0, `${back.products} /products, ${back.filter} /run-filter`);
check(`coming back: cards appear in under ${DELAY_MS / 2} ms`, back.ms < DELAY_MS / 2, `${back.ms} ms vs ${first.ms} ms on the first visit`);
check("coming back: same products as before", /Scented Berry/.test(back.text));

// A real profile edit through the Profile page: the safety filter's inputs change, so the catalog must ask again.
await spaGo("/profile");
await sleep(1500);
await page.getByRole("button", { name: /^edit$/i }).click();
await page.getByRole("button", { name: "Fragrance / Parfum" }).click();
await page.getByRole("button", { name: /^save$/i }).click();
await sleep(2500);
const edited = await visit("after blocking fragrance");
check("profile edit: the safety results are fetched again, once per category", edited.filter === 6, `${edited.filter} /run-filter`);
check("profile edit: the product list itself is not refetched", edited.products === 0, `${edited.products} /products`);
check("profile edit: scented product is gone", !/Scented Berry/.test(edited.text));
await spaGo("/profile");
await sleep(1000);
const again = await visit("again");
check("then back again: served from memory", again.products === 0 && again.filter === 0, `${again.products} /products, ${again.filter} /run-filter`);

check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));
fs.writeFileSync(path.join(outDir, "catalog_gate_report.json"), JSON.stringify({ checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
