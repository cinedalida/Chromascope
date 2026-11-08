// Measures what a production build downloads and checks every route still renders, against the LOCAL SANDBOX only.
//
//   VITE_API_URL=http://127.0.0.1:8001/api node node_modules/vite/bin/vite.js build --mode emulators --outDir <dist>
//   node scripts/ar-qa/bundle-gate.mjs <dist> <outDir> <label>        (SKIP_CHUNK_FAILURE=1 for a build without lazy routes)
//
// It serves <dist> with `vite preview` on :5191 (the sandbox backend must allow that origin: ALLOWED_ORIGINS includes
// http://localhost:5191), then:
//   1. opens /auth on a cold cache and counts the JavaScript downloaded (raw and gzipped);
//   2. signs in and visits every page through the app's own navigation, checking each renders and logs no errors;
//   3. (lazy builds) blocks the download of one page's code to see what a user gets after a new deploy, then recovers.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [dist, outDir = "bundle-gate-out", label = "run"] = process.argv.slice(2);
if (!dist || !fs.existsSync(path.join(dist, "index.html"))) {
  console.error("usage: node scripts/ar-qa/bundle-gate.mjs <dist with index.html> <outDir> <label>");
  process.exit(2);
}
const PORT = 5191;
const APP = `http://localhost:${PORT}`;
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "bundle-gate@example.com", name: "Bundle Gate" };
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
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

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

// ---- serve the build
const preview = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--mode", "emulators", "--outDir", dist, "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stopPreview = () => { try { preview.kill(); } catch { /* already gone */ } };
process.on("exit", stopPreview);
for (let i = 0; i < 30; i += 1) { if (await fetch(APP).then((r) => r.ok, () => false)) break; await sleep(500); }

const browser = await chromium.launch({
  executablePath: process.env.AR_QA_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

// ---- 1. what /auth downloads on a cold cache (service worker blocked, so every byte is a real request)
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const scripts = [];
  page.on("response", async (r) => {
    if (r.request().resourceType() === "script" && r.url().startsWith(APP)) scripts.push(r.body().then((b) => ({ url: r.url().replace(APP, ""), raw: b.length, gz: zlib.gzipSync(b).length, hasFaceModel: b.includes("createFromOptions") && b.includes("FaceLandmarker") })).catch(() => null));
  });
  await page.goto(`${APP}/auth`, { waitUntil: "networkidle" });
  const got = (await Promise.all(scripts)).filter(Boolean);
  const raw = got.reduce((a, s) => a + s.raw, 0);
  const gz = got.reduce((a, s) => a + s.gz, 0);
  console.log(`  /auth cold load: ${got.length} script file(s), ${kb(raw)} raw, ${kb(gz)} gzipped`);
  for (const s of got.sort((a, b) => b.raw - a.raw).slice(0, 6)) console.log(`      ${kb(s.raw).padStart(7)} raw ${kb(s.gz).padStart(7)} gz  ${s.url}`);
  const aiOnAuth = got.some((s) => s.hasFaceModel);
  fs.writeFileSync(path.join(outDir, `bundle_${label}.json`), JSON.stringify({ files: got, raw, gz }, null, 1));
  global.authBytes = { raw, gz, files: got.length, aiOnAuth };
  await context.close();
}

// ---- 2. every route renders, through the app's own navigation
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
page.on("console", (m) => { if (m.type() === "error" && !/Could not reach Cloud Firestore backend|^INFO: /.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`); });

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
await sleep(3000);

const spaGo = (to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);
// Pages and one thing each must show (a heading, a control, a canvas), so a blank or stuck page fails.
const ROUTES = [
  ["/home", /Home|Welcome|Hello|Chromascope/i],
  ["/catalog?view=all", /Full catalog/i],
  ["/favorites", /Favorites/i],
  ["/color-analysis", /Color Analysis|analysis/i],
  ["/profile", /Profile|Skin/i],
  ["/ar-tryon", null],
  ["/user-manual", /manual|guide|how/i],
  ["/terms", /terms/i],
];
const seen = {};
for (const [route, text] of ROUTES) {
  const before = errors.length;
  const start = Date.now();
  await spaGo(route);
  if (route === "/ar-tryon") {
    await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 4000 }).catch(() => {});
    await page.waitForSelector("canvas", { timeout: 30000 }).catch(() => {});
  } else {
    await page.waitForFunction((re) => new RegExp(re, "i").test(document.body.innerText), text.source, { timeout: 20000 }).catch(() => {});
  }
  await sleep(800);
  const body = await page.evaluate(() => document.body.innerText);
  const stuck = await page.locator('[data-route-fallback]').count();
  const ok = (route === "/ar-tryon" ? (await page.locator("canvas").count()) > 0 : text.test(body)) && stuck === 0 && errors.length === before;
  seen[route] = { ok, ms: Date.now() - start };
  check(`route ${route} renders (no stuck loading state, no errors)`, ok, `${Date.now() - start} ms${errors.length > before ? `; ${errors.slice(before).join(" | ")}` : ""}`);
}

// ---- 3. a page's code that fails to download (a user with an old tab after a new deploy)
if (process.env.SKIP_CHUNK_FAILURE) {
  console.log("  (chunk-failure test skipped for this build)");
} else {
  const lazyFile = fs.readdirSync(path.join(dist, "assets")).find((f) => /^FavoritesPage-.*\.js$/.test(f));
  check("the build has a separate file for the Favorites page (lazy route)", Boolean(lazyFile), lazyFile ?? "none");
  if (lazyFile) {
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const p2 = await ctx2.newPage();
    let blocked = true;
    await p2.route(new RegExp(`/assets/${lazyFile.replace(/[.]/g, "\\.")}`), (route) => (blocked ? route.abort() : route.continue()));
    const e2 = [];
    p2.on("pageerror", (e) => e2.push(String(e)));
    await p2.goto(`${APP}/auth`);
    await p2.waitForTimeout(500);
    if (p2.url().includes("/auth")) {
      await p2.locator('input[name="email"]').fill(ACCT.email);
      await p2.locator('input[name="password"]').fill(PASSWORD);
      await p2.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
      await p2.waitForURL((u) => !u.pathname.startsWith("/auth"));
    }
    await p2.evaluate(() => sessionStorage.clear());
    let loads = 0;
    p2.on("load", () => { loads += 1; });
    await p2.evaluate(() => { window.history.pushState({}, "", "/favorites"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await p2.waitForSelector("text=/new version|reload/i", { timeout: 20000 }).catch(() => {});
    const msg = await p2.evaluate(() => document.body.innerText);
    check("download failure: the page reloaded itself once, then shows a clear message with a Reload button (no blank screen)", loads === 1 && /reload/i.test(msg) && (await p2.getByRole("button", { name: /reload/i }).count()) > 0, `${loads} automatic reload(s)`);
    check("download failure: the navigation bar is still there (only the page area is affected)", /Catalog|Favorites|Profile/i.test(msg));
    blocked = false;
    await p2.getByRole("button", { name: /reload/i }).first().click();
    await p2.waitForSelector("text=/Favorites/i", { timeout: 20000 }).catch(() => {});
    check("download failure: after the connection is back, Reload brings the page up", /Favorites/.test(await p2.evaluate(() => document.body.innerText)));
    check("download failure: no uncaught errors", e2.length === 0, e2.slice(0, 2).join(" | "));
    await ctx2.close();
  }
}

check("the face-model (MediaPipe) code is not downloaded on the login page", !global.authBytes.aiOnAuth);
fs.writeFileSync(path.join(outDir, `bundle_gate_${label}.json`), JSON.stringify({ authBytes: global.authBytes, seen, checks }, null, 1));
console.log(`\n/auth downloads ${kb(global.authBytes.raw)} raw / ${kb(global.authBytes.gz)} gzipped in ${global.authBytes.files} file(s)`);
console.log(`${checks.filter((c) => c.ok).length}/${checks.length} checks passed  [${label}]`);
await browser.close();
stopPreview();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
