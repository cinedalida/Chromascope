// Checks how the app behaves when the backend is asleep (down) as the app opens, against the LOCAL SANDBOX only.
// Setup as for cache-gate.mjs, but the BACKEND (:8001) must be STOPPED when this starts.
//
//   MODE=recover node scripts/ar-qa/wake-gate.mjs <outDir>   # the backend is started ~20 s after the page opens
//   MODE=down    node scripts/ar-qa/wake-gate.mjs <outDir>   # the backend never comes up
//
// recover: the catalog must load by itself after the backend comes up, with no failed data request and no error screen,
//          and the pinging must stop once it answers.
// down:    the app must stay usable (an error screen with "Try again" after a bounded wait), with no uncaught errors,
//          and must not ping forever.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "wake-gate-out"] = process.argv.slice(2);
const MODE = process.env.MODE ?? "recover";
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const API_ROOT = process.env.API_ROOT ?? "http://127.0.0.1:8001/";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "wake-gate@example.com", name: "Wake Gate" };
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
const reachable = () => fetch(API_ROOT, { signal: AbortSignal.timeout(1500) }).then((r) => r.ok, () => false);

async function uidOf(email) {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return res.ok ? (await res.json()).localId : null;
}
async function setProfile(uid, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, { method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`profile update failed: ${res.status}`);
}

if (await reachable()) {
  console.error("The backend on :8001 is running. Stop it first: this gate needs it down when the page opens.");
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: process.env.AR_QA_CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

// What the page sent to the API, and what happened to it.
const api = { ping: 0, dataAttempts: 0, dataFailed: 0, dataOk: 0 };
const t0 = Date.now();
const isData = (u) => /\/(products|run-filter-batch|run-filter)$/.test(new URL(u).pathname);
const isPing = (r) => { const u = new URL(r.url()); return u.pathname === "/" && r.method() === "GET" && u.port === new URL(API_ROOT).port; };
page.on("request", (r) => { if (isPing(r)) api.ping += 1; else if (isData(r.url())) api.dataAttempts += 1; });
page.on("requestfailed", (r) => { if (isData(r.url())) api.dataFailed += 1; });
page.on("response", (r) => { if (isData(r.url())) { if (r.ok()) api.dataOk += 1; else api.dataFailed += 1; } });

// Account (needs only the Auth/Firestore emulators, which are up).
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

// Open the app fresh (a full page load: this is when the ping starts), sign in, and go to the catalog in-app.
const opened = Date.now();
await page.goto(`${APP}/auth`);
await page.waitForTimeout(500);
if (page.url().includes("/auth")) {
  await page.locator('input[name="email"]').fill(ACCT.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}
await page.evaluate(() => { window.history.pushState({}, "", "/catalog?view=all"); window.dispatchEvent(new PopStateEvent("popstate")); });
console.log(`  signed in and opened the catalog ${Math.round((Date.now() - opened) / 1000)} s after the page loaded; backend is ${(await reachable()) ? "UP" : "down"}`);

const CARD = "button.rounded-2xl.border-primary-lighter";
const bodyText = () => page.evaluate(() => document.body.innerText);

if (MODE === "recover") {
  // The shell starts the backend about 20 s after this script started. Time how long the cards take to appear after that.
  let upAt = null;
  const watcher = (async () => { while (upAt === null) { if (await reachable()) upAt = Date.now(); else await sleep(300); } })();
  await page.waitForSelector(CARD, { timeout: 150000 });
  const cardsAt = Date.now();
  await watcher;
  const text = await bodyText();
  const afterUp = cardsAt - upAt;
  console.log(`  backend became reachable at +${Math.round((upAt - t0) / 1000)} s; cards appeared ${afterUp} ms after that; pings sent: ${api.ping}`);
  check("the backend was down when the catalog was opened (the test is meaningful)", upAt - opened > 5000, `${Math.round((upAt - opened) / 1000)} s`);
  check("the catalog loaded by itself, with no click", await page.locator(CARD).count() > 0);
  check("cards appear within ~10 s of the backend answering (one ping interval + the load)", afterUp < 10000, `${afterUp} ms`);
  check("no failed data request: nothing was sent to the data endpoints while the server was asleep", api.dataFailed === 0, `${api.dataFailed} failed, ${api.dataOk} ok, ${api.dataAttempts} sent`);
  check("no error screen was shown", !/couldn't load|couldn't run your safety check/i.test(text));
  check("it pinged while waiting (so the wake-up started at page load, not at the first data request)", api.ping >= 2, `${api.ping} pings`);
  const pingsAtLoad = api.ping;
  await sleep(14000);
  check("pinging stops once the server answers", api.ping - pingsAtLoad <= 1, `${api.ping - pingsAtLoad} pings in the next 14 s`);
} else {
  // Never comes up. After the bounded wait the page must show its error screen with a way to retry.
  const started = Date.now();
  await page.waitForSelector("text=/couldn't load the catalog|couldn't run your safety check/i", { timeout: 150000 });
  const waited = Math.round((Date.now() - started) / 1000);
  console.log(`  error screen after ${waited} s; pings sent: ${api.ping}; data attempts: ${api.dataAttempts}`);
  check("an error screen with 'Try again' appears (the app does not hang)", (await page.getByRole("button", { name: /try again/i }).count()) > 0, `${waited} s`);
  check("the wait is bounded (under 2.5 minutes)", waited < 150, `${waited} s`);
  check("it did not hammer the server: data requests stay few", api.dataAttempts <= 20, `${api.dataAttempts} requests`);
  const pingsNow = api.ping;
  check("pings were spaced out (about one every 4 s at most)", pingsNow <= Math.ceil((Date.now() - opened) / 4000) + 3, `${pingsNow} pings in ${Math.round((Date.now() - opened) / 1000)} s`);
  check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));
  // The user taps "Try again" after the server is up (the shell starts it): it must then work.
}

check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));
fs.writeFileSync(path.join(outDir, `wake_gate_${MODE}.json`), JSON.stringify({ api, checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed  [${MODE}]`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
