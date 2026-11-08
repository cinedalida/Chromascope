// Checks that Recommended results survive a page reload, and are dropped when they should be, on the real pages,
// against the LOCAL SANDBOX only. Setup as for cache-gate.mjs (emulators, backend :8001, app :5181).
//
//   node scripts/ar-qa/persist-gate.mjs <outDir>
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "persist-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const A = { email: "persist-a@example.com", name: "Persist A" };
const B = { email: "persist-b@example.com", name: "Persist B" };
const PREFIX = "chromascope:ar-rec:v3:";
fs.mkdirSync(outDir, { recursive: true });

const num = (v) => ({ doubleValue: v });
const arr = (list) => ({ arrayValue: { values: list } });
const str = (v) => ({ stringValue: v });
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
const profileFor = (season, lab, avoid = [], skin = "normal") => ({
  seasonal_label: str(season), user_lab: arr(lab.map(num)), season_confidence_level: num(0.9), profile_completed: { booleanValue: true },
  skin_type: str(skin), concerns: arr([]), avoid_ingredients: arr(avoid.map(str)),
});

const browser = await chromium.launch({
  executablePath: process.env.AR_QA_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

async function newSession({ blockOurStorage = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
  if (blockOurStorage) {
    // Only this feature's keys fail, as with a full quota or blocked site data. (Firebase sign-in keeps its own storage.)
    await context.addInitScript((prefix) => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) { if (String(k).startsWith(prefix)) throw new Error("blocked"); return get.call(this, k); };
      Storage.prototype.setItem = function (k, v) { if (String(k).startsWith(prefix)) throw new Error("blocked"); return set.call(this, k, v); };
    }, PREFIX);
  }
  const page = await context.newPage();
  const s = { context, page, filterCalls: [], pageErrors: [] };
  page.on("pageerror", (e) => s.pageErrors.push(String(e)));
  page.on("request", (r) => r.url().includes("/run-filter") && s.filterCalls.push(JSON.parse(r.postData() ?? "{}").category));
  return s;
}
async function signUp(s, { email, name }) {
  const { page } = s;
  await page.goto(`${APP}/auth`);
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/onboarding/);
}
async function login(s, { email }) {
  const { page } = s;
  await page.goto(`${APP}/auth`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}
async function ensureAccount(acct) {
  if (await uidOf(acct.email)) return;
  const s = await newSession();
  await signUp(s, acct);
  await s.context.close();
}
const tab = (page, text) => page.getByRole("button", { name: new RegExp(`^${text}$`, "i") }).last();
const spaGo = (page, to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);
const savedKeys = (page) => page.evaluate((prefix) => Object.keys(localStorage).filter((k) => k.startsWith(prefix)), PREFIX);
const panelLines = (page) => page.evaluate(() => {
  const lists = [...document.querySelectorAll(".overflow-y-auto")];
  return ((lists[lists.length - 1]?.innerText) ?? "").split("\n").map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
});

// Open AR (full load when `reload`, else in-app), look at every group's Recommended list. Returns the lists.
async function openAR(s, { reload }) {
  const { page } = s;
  if (reload) await page.goto(`${APP}/ar-tryon`);
  else await spaGo(page, "/ar-tryon");
  await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(3500);
  await tab(page, "Recommended").click();
  const rows = {};
  for (const g of ["LIPS", "CHEEKS", "EYES", "FACE"]) {
    await tab(page, g).click();
    await page.waitForTimeout(1200);
    rows[g] = await panelLines(page);
  }
  return rows;
}
async function waitForSaved(s, count = 4) {
  const start = Date.now();
  while ((await savedKeys(s.page)).length < count && Date.now() - start < 40000) await sleep(500);
  return savedKeys(s.page);
}

await ensureAccount(A);
await ensureAccount(B);
const uidA = await uidOf(A.email);
const uidB = await uidOf(B.email);
await setProfile(uidA, profileFor("Soft Autumn", [60, 10, 12]));
await setProfile(uidB, profileFor("Deep Winter", [38, 14, 14], ["Fragrance / Parfum"]));

// ---- 1. Reload: nothing is refetched, and the lists are the same ----
{
  const s = await newSession();
  await login(s, A);
  const keys = await waitForSaved(s);
  check("results are saved to storage after sign-in (one slot per group)", keys.length === 4, keys.map((k) => k.slice(PREFIX.length + uidA.length + 1)).join(","));
  const beforeReload = await openAR(s, { reload: false }); // served by the live (memory) cache
  s.filterCalls.length = 0;
  const before = await openAR(s, { reload: true }); // a full page load: memory is gone, storage is not
  check("reload: opening AR makes no /run-filter", s.filterCalls.length === 0, `${s.filterCalls.length} calls`);
  check("reload: lists are shown", ["LIPS", "CHEEKS", "EYES", "FACE"].every((g) => before[g].some((l) => l.includes("[T]"))));
  check("reload: lists are identical to the ones shown before the reload", JSON.stringify(beforeReload) === JSON.stringify(before));
  fs.writeFileSync(path.join(outDir, "rows_reload.json"), JSON.stringify(before, null, 1));

  // ---- 2. Profile changed since (here: edited elsewhere) => the saved results are not used ----
  await setProfile(uidA, profileFor("Soft Autumn", [60, 10, 12], ["Fragrance / Parfum"], "oily"));
  s.filterCalls.length = 0;
  const after = await openAR(s, { reload: true });
  check("changed profile + reload: the server is asked again, once per category", s.filterCalls.length === 5, s.filterCalls.join(","));
  check("changed profile + reload: the new profile applies (scented product gone)", before.LIPS.some((l) => /Scented Berry/.test(l)) && !after.LIPS.some((l) => /Scented Berry/.test(l)));
  s.filterCalls.length = 0;
  await openAR(s, { reload: true });
  check("then another reload: served from storage again", s.filterCalls.length === 0, `${s.filterCalls.length} calls`);

  // ---- 3. Sign-out drops the saved results; the next person gets only their own ----
  await s.page.getByRole("button", { name: /log out/i }).first().click();
  const confirm = s.page.getByRole("button", { name: /^(log out|yes|confirm)/i }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
  await s.page.waitForURL(/\/auth|\/$/, { timeout: 15000 });
  await sleep(1500);
  check("sign-out: no saved results are left", (await savedKeys(s.page)).length === 0, (await savedKeys(s.page)).join(","));
  await login(s, B);
  const keysB = await waitForSaved(s);
  check("next user: saved results exist and are only theirs", keysB.length === 4 && keysB.every((k) => k.startsWith(`${PREFIX}${uidB}:`)), `${keysB.length} keys`);
  check("no uncaught errors", s.pageErrors.length === 0, s.pageErrors.slice(0, 2).join(" || "));
  await s.context.close();
}

// ---- 4. Storage that fails: the app still works from memory ----
{
  const s = await newSession({ blockOurStorage: true });
  await login(s, A);
  await sleep(6000); // the prefetch runs, and every save fails
  s.filterCalls.length = 0;
  const first = await openAR(s, { reload: false });
  await spaGo(s.page, "/profile");
  await sleep(1000);
  s.filterCalls.length = 0;
  const second = await openAR(s, { reload: false });
  check("blocked storage: lists still shown", ["LIPS", "CHEEKS", "EYES", "FACE"].every((g) => first[g].some((l) => l.includes("[T]"))));
  check("blocked storage: re-entering AR is still served from memory", s.filterCalls.length === 0 && JSON.stringify(first) === JSON.stringify(second), `${s.filterCalls.length} calls`);
  check("blocked storage: nothing was saved and nothing crashed", (await savedKeys(s.page).catch(() => [])).length === 0 && s.pageErrors.length === 0, s.pageErrors.slice(0, 2).join(" || "));
  await s.context.close();
}

fs.writeFileSync(path.join(outDir, "persist_gate_report.json"), JSON.stringify({ checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
