// Checks how long the AR face model takes to become ready on each entry to Try-On, against the LOCAL SANDBOX only.
// Setup as for cache-gate.mjs (emulators, backend :8001, app :5181). Needs internet: the model comes from a CDN.
//
//   node scripts/ar-qa/model-gate.mjs <outDir>
//
// Each entry goes through the app's own navigation (no reload), leaves to Profile, and comes back. "Ready" is the
// canvas's data-ar-status turning ready/tracking.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "model-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "model-gate@example.com", name: "Model Gate" };
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

const browser = await chromium.launch({
  executablePath: process.env.AR_QA_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
const page = await context.newPage();
const pageErrors = [];
const arErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && /\[AR\]/.test(m.text()) && arErrors.push(m.text()));

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
await page.goto(`${APP}/auth`);
await page.waitForTimeout(500);
if (page.url().includes("/auth")) {
  await page.locator('input[name="email"]').fill(ACCT.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}
await sleep(6000);

const spaGo = (to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);

// Enter Try-On in-app; returns ms from the navigation until the model is ready. The "Start Try-On Now" gate, when it
// shows (first time, camera not yet allowed), is clicked without waiting, so it is not counted as waiting for the model.
async function enter(label) {
  const start = Date.now();
  await spaGo("/ar-tryon");
  const ready = page.waitForSelector('canvas[data-ar-status="ready"], canvas[data-ar-status="tracking"]', { timeout: 60000 });
  page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 2000 }).catch(() => {});
  await ready;
  const ms = Date.now() - start;
  console.log(`  [${label}] model ready after ${ms} ms`);
  return ms;
}

const times = [];
for (let i = 1; i <= 3; i += 1) {
  times.push(await enter(i === 1 ? "first entry" : `entry ${i}`));
  await spaGo("/profile");
  await sleep(1500);
}
const [first, ...later] = times;
check("model becomes ready on the first entry", Number.isFinite(first), `${first} ms`);
check("coming back: the model is ready within 1 s", later.every((ms) => ms < 1000), `${later.join(", ")} ms vs ${first} ms first`);
check("coming back is at least 3x faster than the first entry", later.every((ms) => ms * 3 < first), `${later.join(", ")} vs ${first}`);
check("no [AR] errors and no uncaught errors", arErrors.length === 0 && pageErrors.length === 0, [...arErrors, ...pageErrors].slice(0, 2).join(" || "));

fs.writeFileSync(path.join(outDir, "model_gate_report.json"), JSON.stringify({ times, checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
