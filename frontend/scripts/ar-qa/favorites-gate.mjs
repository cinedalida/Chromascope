// Checks that the Favorites page and a favorite's "Try on" do not refetch on every visit, and still follow the profile,
// against the LOCAL SANDBOX only. Setup as for cache-gate.mjs (emulators, backend :8001, app :5181, products_v2 test catalog).
//
//   node scripts/ar-qa/favorites-gate.mjs <outDir>
//
// Every /products and /run-filter is held DELAY_MS to stand in for a slow server (an assumption, not a measurement).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "favorites-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const DELAY_MS = Number(process.env.DELAY_MS ?? 600);
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "favorites-gate@example.com", name: "Favorites Gate" };
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
const OWNER = { authorization: "Bearer owner", "content-type": "application/json" };

async function uidOf(email) {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return res.ok ? (await res.json()).localId : null;
}
async function setProfile(uid, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`profile update failed: ${res.status}`);
}
const item = (region, productId) => ({
  mapValue: { fields: { region: str(region), source: str("catalog"), product_id: str(productId), shade_id: { nullValue: null } } },
});
async function addFavorite(uid, type, name, items, createdAt) {
  const res = await fetch(`${FIRESTORE}/users/${uid}/favorites`, {
    method: "POST", headers: OWNER,
    body: JSON.stringify({ fields: { type: str(type), name: name ? str(name) : { nullValue: null }, items: arr(items), created_at: str(createdAt), updated_at: str(createdAt) } }),
  });
  if (!res.ok) throw new Error(`favorite failed: ${res.status} ${await res.text()}`);
}
async function clearFavorites(uid) {
  const res = await fetch(`${FIRESTORE}/users/${uid}/favorites`, { headers: OWNER });
  for (const doc of (await res.json()).documents ?? []) await fetch(`http://127.0.0.1:8080/v1/${doc.name}`, { method: "DELETE", headers: OWNER });
}

const browser = await chromium.launch({
  executablePath: process.env.AR_QA_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
let counts = { products: 0, batch: 0, filter: 0 };
const t0 = Date.now();
page.on("request", (r) => {
  const u = new URL(r.url());
  if (process.env.DEBUG_REQ && /\/(run-filter-batch|run-filter|products)$/.test(u.pathname)) console.log(`    +${Date.now() - t0} ms ${r.method()} ${u.pathname} ${r.postData()?.slice(0, 60) ?? ""}`);
  if (u.pathname.endsWith("/run-filter-batch")) counts.batch += 1;
  else if (u.pathname.endsWith("/run-filter")) counts.filter += 1;
  else if (u.pathname.endsWith("/products") && r.method() === "GET") counts.products += 1;
});
await page.route(/\/(run-filter-batch|run-filter|products)(\?|$)/, async (route) => {
  await sleep(DELAY_MS);
  await route.continue();
});
const spaGo = (to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);

if (!(await uidOf(ACCT.email))) {
  await page.goto(`${APP}/auth`);
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill(ACCT.name);
  await page.locator('input[name="email"]').fill(ACCT.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/onboarding/);
}
const uid = await uidOf(ACCT.email);
await setProfile(uid, {
  seasonal_label: str("Soft Autumn"), user_lab: arr([60, 10, 12].map(num)), season_confidence_level: num(0.9),
  profile_completed: { booleanValue: true }, skin_type: str("normal"), concerns: arr([]), avoid_ingredients: arr([]),
});
await clearFavorites(uid);
await addFavorite(uid, "product", null, [item("lips", "T-LIP-1")], "2026-01-03T00:00:00.000Z");
await addFavorite(uid, "product", null, [item("lips", "T-LIP-3")], "2026-01-02T00:00:00.000Z"); // scented: Excluded once fragrance is blocked
await addFavorite(uid, "look", "Gate Look", [item("lips", "T-LIP-1"), item("cheeks", "T-CHK-1")], "2026-01-01T00:00:00.000Z");

await page.goto(`${APP}/auth`);
await page.waitForTimeout(500);
if (page.url().includes("/auth")) {
  await page.locator('input[name="email"]').fill(ACCT.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}
await sleep(8000); // background warm-up settles first

// Opens Favorites in-app; returns requests made, ms until the first verdict badge, and the page text.
async function visit(label) {
  counts = { products: 0, batch: 0, filter: 0 };
  const start = Date.now();
  await spaGo("/favorites");
  await page.waitForSelector("text=/Rose Lipstick/", { timeout: 30000 });
  await page.waitForFunction(() => /Safety verdict:\s*(Safe|Caution|Excluded)/.test(document.body.innerText), null, { timeout: 30000 });
  const ms = Date.now() - start;
  await sleep(2500);
  const text = await page.evaluate(() => document.body.innerText);
  console.log(`  [${label}] /products=${counts.products} /run-filter-batch=${counts.batch} /run-filter=${counts.filter} verdicts after ${ms} ms`);
  return { label, ...counts, ms, text };
}

const first = await visit("first visit");
check("first visit: favorites show with a verdict", /Rose Lipstick/.test(first.text) && /Safe/.test(first.text), `${first.products} /products, ${first.batch} /run-filter-batch`);
check("first visit: two requests in all (the product list and one filter call for all categories)", first.products === 1 && first.batch === 1 && first.filter === 0, `${first.products} /products, ${first.batch} /run-filter-batch, ${first.filter} /run-filter`);
check("first visit: nothing is Excluded yet", !/Excluded/.test(first.text));

await spaGo("/profile");
await sleep(1500);
const back = await visit("back from Profile");
check("coming back: no requests at all", back.products + back.batch + back.filter === 0, `${back.products} /products, ${back.batch} /run-filter-batch, ${back.filter} /run-filter`);
check(`coming back: verdicts appear in under ${DELAY_MS / 2} ms`, back.ms < DELAY_MS / 2, `${back.ms} ms vs ${first.ms} ms on the first visit`);

// "Try on" from a favorite: the page already holds the data, so AR needs nothing more from the server for it.
counts = { products: 0, batch: 0, filter: 0 };
await page.getByRole("button", { name: /^try on$/i }).first().click();
await page.waitForURL(/\/ar-tryon/, { timeout: 15000 });
await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 3000 }).catch(() => {});
await page.waitForSelector("canvas", { timeout: 30000 });
await sleep(3000);
const arText = await page.evaluate(() => document.body.innerText);
check("Try on: opens Try-On with no 'Not applied' notice", !/Not applied/.test(arText));
check("Try on: no /products or filter request for it (the page's data is reused)", counts.products + counts.batch === 0, `${counts.products} /products, ${counts.batch} /run-filter-batch`);

// A real profile edit: the safety filter's inputs change, so the verdicts must be fetched again.
await spaGo("/profile");
await sleep(1500);
await page.getByRole("button", { name: /^edit$/i }).click();
await page.getByRole("button", { name: "Fragrance / Parfum" }).click();
await page.getByRole("button", { name: /^save$/i }).click();
await sleep(2500);
const edited = await visit("after blocking fragrance");
check("profile edit: verdicts are fetched again, in one request", edited.batch === 1 && edited.filter === 0 && edited.products === 0, `${edited.products} /products, ${edited.batch} /run-filter-batch, ${edited.filter} /run-filter`);
check("profile edit: the scented favorite is now Excluded", /Excluded/.test(edited.text));

await spaGo("/profile");
await sleep(1000);
const again = await visit("again");
check("then back again: served from memory", again.products + again.batch + again.filter === 0, `${again.products} /products, ${again.batch} /run-filter-batch, ${again.filter} /run-filter`);
check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));

fs.writeFileSync(path.join(outDir, "favorites_gate_report.json"), JSON.stringify({ checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
