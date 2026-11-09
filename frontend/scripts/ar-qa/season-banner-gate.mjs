// Stage 2 gate for the Catalog "Compatible with me" view: the season banner. LOCAL SANDBOX only (emulators, backend :8001, app :5181).
//
//   node scripts/ar-qa/season-banner-gate.mjs <outDir>
//
// One throwaway account has its profile edited through the Firestore emulator between scenarios.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "season-banner-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "season-banner-gate@example.com", name: "Banner Gate" };
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
// PATCH with a mask: fields named in `clear` but absent from `fields` are deleted.
async function setProfile(uid, fields, clear = []) {
  const mask = [...Object.keys(fields), ...clear].map((k) => `updateMask.fieldPaths=${k}`).join("&");
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
const batchCalls = { n: 0 };
page.on("request", (r) => { if (new URL(r.url()).pathname.endsWith("/run-filter-batch")) batchCalls.n += 1; });

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
}
const uid = await uidOf(ACCT.email);
const FULL = { profile_completed: { booleanValue: true }, skin_type: str("normal"), concerns: arr([]), avoid_ingredients: arr([]) };
await setProfile(uid, { ...FULL, seasonal_label: str("Soft Autumn"), user_lab: arr([60, 10, 12].map(num)) });

await page.goto(`${APP}/auth`);
await page.locator('input[name="email"]').fill(ACCT.email);
await page.locator('input[name="password"]').fill(PASSWORD);
await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/auth"));

const BANNER = '[data-testid="season-context-banner"]';
async function open(label, url) {
  await page.goto(`${APP}${url}`);
  await page.waitForSelector("h1", { timeout: 20000 });
  await sleep(3500); // let the user doc and the filter settle
  const banner = (await page.locator(BANNER).count()) ? (await page.locator(BANNER).first().innerText()).replace(/\s+/g, " ") : null;
  const text = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  return { banner, text };
}

// 1. Season + skin tone.
const a = await open("1_season", "/catalog?view=safe");
check("season user: banner names the season", a.banner && /Soft Autumn/.test(a.banner), a.banner ?? "no banner");
check("season user: banner mentions skin tone", a.banner && /skin tone/.test(a.banner));
check("season user: toggle reads 'Compatible with me'", /Compatible with me/.test(a.text) && !/Safe for me/.test(a.text));
const full = await open("1b_full_view", "/catalog?view=all");
check("full catalog: no season banner", full.banner === null);

// 2. Profile but no season / no skin tone.
await setProfile(uid, FULL, ["seasonal_label", "user_lab"]);
const b = await open("2_no_season", "/catalog?view=safe");
check("no-season user: banner says colors are not matched", b.banner && /don.t have your season/i.test(b.banner), b.banner ?? "no banner");
check("no-season user: banner links to the color analysis", (await page.locator(`${BANNER} a[href="/color-analysis"]`).count()) === 1);
check("no-season user: page does not claim a season", b.banner && !/Your season is/.test(b.banner));

// 3. No profile at all.
await setProfile(uid, {}, ["profile_completed", "skin_type", "concerns", "avoid_ingredients", "seasonal_label", "user_lab"]);
const c = await open("3_no_profile", "/catalog?view=safe");
check("no-profile user: no season banner, set-up message instead", c.banner === null && /Set up your skin profile first/.test(c.text), c.banner ?? "");

check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ checks }, null, 1));
console.log(`\n${checks.filter((x) => x.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((x) => x.ok) ? 0 : 1);
