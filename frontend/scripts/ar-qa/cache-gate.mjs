// Checks the Recommended-results cache on the real AR page, against the LOCAL SANDBOX only (emulators, never the real project).
// Same setup as e2e.mjs: emulators (auth 9099, firestore 8080), a backend on :8001 in emulator mode, the app on :5181
// (`vite --mode emulators`, VITE_API_URL=http://127.0.0.1:8001/api).
//
//   node scripts/ar-qa/cache-gate.mjs <outDir> [reload]
//
// Visit 1 opens AR and opens every group tab. Then the page leaves AR and comes back WITHOUT a reload (the in-memory cache
// survives) and does it again. With the cache, visit 2 must send no /run-filter. With "reload" the second visit is a full page load.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "cache-gate-out", mode = "spa"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const EMAIL = "cache-gate@example.com";
const PASSWORD = "testpass123";
fs.mkdirSync(outDir, { recursive: true });

const num = (v) => ({ doubleValue: v });
const arr = (list) => ({ arrayValue: { values: list } });
async function uidOf() {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  return res.ok ? (await res.json()).localId : null;
}
async function setProfile(uid, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, {
    method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`profile update failed: ${res.status} ${await res.text()}`);
}

const LIST = "div.overflow-y-auto.space-y-2";
// Labels are mixed case in the DOM (CSS upper-cases them). The control bar has toggles with the same names, the panel's come last.
const tab = (page, text) => page.getByRole("button", { name: new RegExp(`^${text}$`, "i") }).last();
// Visible text of the panel's scrolling list, one entry per line (brand, verdict, product name, price, ...), in on-screen order.
const rowTexts = (page) => page.evaluate(() => {
  const lists = [...document.querySelectorAll(".overflow-y-auto")];
  const panel = lists[lists.length - 1];
  return (panel?.innerText ?? "").split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
});

const browser = await chromium.launch({
  executablePath: process.env.AR_QA_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && errors.push(m.text()));
let filterCalls = [];
page.on("request", (r) => r.url().includes("/run-filter") && filterCalls.push(JSON.parse(r.postData() ?? "{}").category));

// Sign in (or up) through the real UI.
await page.goto(`${APP}/auth`);
if (!(await uidOf())) {
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill("Cache Gate");
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/onboarding/);
} else {
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}
const uid = await uidOf();
await setProfile(uid, {
  seasonal_label: { stringValue: "Soft Autumn" }, user_lab: arr([60, 10, 12].map(num)), season_confidence_level: num(0.9),
  profile_completed: { booleanValue: true }, skin_type: { stringValue: "normal" }, concerns: arr([]), avoid_ingredients: arr([]),
});

async function visit(label, { reload }) {
  filterCalls = [];
  if (reload) await page.goto(`${APP}/ar-tryon`);
  else await page.evaluate(() => { window.history.pushState({}, "", "/ar-tryon"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(4000);
  if (!(await tab(page, "LIPS").count())) {
    await page.screenshot({ path: path.join(outDir, `${label}_no_panel.png`) });
    console.log("no LIPS tab; url:", page.url(), "buttons:", await page.getByRole("button").allInnerTexts());
  }
  const rows = {};
  for (const group of ["LIPS", "CHEEKS", "EYES", "FACE"]) {
    await tab(page, group).click();
    await page.waitForTimeout(1500);
    rows[group] = await rowTexts(page);
  }
  await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  return { filterCalls: [...filterCalls], rows };
}

const first = await visit("visit1", { reload: true });
// Leave AR through the router: no page reload, so module state (the cache) stays.
await page.evaluate(() => { window.history.pushState({}, "", "/profile"); window.dispatchEvent(new PopStateEvent("popstate")); });
await page.waitForTimeout(1500);
const second = await visit("visit2", { reload: mode === "reload" });

// Applying a shade must still work from a cached list: the first product of the Lips tab turns "pressed".
await tab(page, "LIPS").click();
await page.waitForTimeout(800);
const product = page.locator(".overflow-y-auto button[aria-label][aria-pressed]").first();
const hasProduct = (await product.count()) > 0;
let applied = false;
if (hasProduct) {
  await product.click();
  await page.waitForTimeout(1500);
  applied = (await product.getAttribute("aria-pressed")) === "true";
}

const report = {
  mode,
  shadeApplied: applied,
  visit1_filterCalls: first.filterCalls,
  visit2_filterCalls: second.filterCalls,
  sameRows: JSON.stringify(first.rows) === JSON.stringify(second.rows),
  rowCounts: Object.fromEntries(Object.entries(first.rows).map(([k, v]) => [k, v.length])),
  rows: first.rows,
  errors: errors.slice(0, 5),
};
fs.writeFileSync(path.join(outDir, `report_${mode}.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
