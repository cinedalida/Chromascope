// Checks the AR prefetch that runs after sign-in, on the real pages, against the LOCAL SANDBOX only.
// Setup as for cache-gate.mjs (emulators, backend :8001, app :5181).
//
//   node scripts/ar-qa/prefetch-gate.mjs <outDir>
//
// The local backend answers in milliseconds, which hides what a slow or cold server feels like. So every /run-filter
// request is held for DELAY_MS before it is sent on (an assumption standing in for server latency, printed with the
// results). "Time to shades" is measured from entering AR to the first product being on screen.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "prefetch-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const DELAY_MS = Number(process.env.DELAY_MS ?? 800);
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const DONE = { email: "prefetch-done@example.com", name: "Prefetch Done" };
const NEW = { email: "prefetch-new@example.com", name: "Prefetch New" };
fs.mkdirSync(outDir, { recursive: true });

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
const COMPLETE = {
  seasonal_label: { stringValue: "Soft Autumn" }, user_lab: arr([60, 10, 12].map(num)), season_confidence_level: num(0.9),
  profile_completed: { booleanValue: true }, skin_type: { stringValue: "normal" }, concerns: arr([]), avoid_ingredients: arr([]),
};
const INCOMPLETE = { profile_completed: { booleanValue: false } };

const browser = await chromium.launch({
  executablePath: process.env.AR_QA_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

// A fresh, signed-out browser with request logging. `filter` decides what happens to /run-filter requests.
async function newSession(filter = "delay") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
  const page = await context.newPage();
  const s = { context, page, t0: Date.now(), filterCalls: [], shadeCalls: [], pageErrors: [] };
  page.on("pageerror", (e) => s.pageErrors.push(String(e)));
  page.on("request", (r) => {
    const at = Date.now() - s.t0;
    if (r.url().includes("/run-filter")) s.filterCalls.push({ at, category: JSON.parse(r.postData() ?? "{}").category });
    if (/\/data\/ar-shades-.*\.json/.test(r.url())) s.shadeCalls.push({ at, url: r.url().split("/").pop() });
  });
  await context.route("**/run-filter", async (route) => {
    if (filter === "abort") return route.abort();
    if (filter === "delay") await sleep(DELAY_MS);
    if (typeof filter === "number") await sleep(filter);
    return route.continue();
  });
  return s;
}
const login = async (s, { email }) => {
  const { page } = s;
  await page.goto(`${APP}/auth`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
  s.loggedInAt = Date.now() - s.t0;
};
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
  s.loggedInAt = Date.now() - s.t0;
}
const spaGo = (page, to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);
const tab = (page, text) => page.getByRole("button", { name: new RegExp(`^${text}$`, "i") }).last();

// Enter AR in-app and wait for the first product. Returns { total, shadeWait }: `total` is entering AR until the first
// product is on screen (dominated by camera and model start-up); `shadeWait` is the part after the shade panel itself is
// on screen, i.e. what a slow server or an empty cache adds, which is what the prefetch is meant to remove.
async function enterAR(s) {
  const { page } = s;
  const t = Date.now();
  // Timestamps taken inside the page (performance.now) at the moment the Recommended tab and the first product appear,
  // so a busy test runner cannot add to the difference.
  await page.evaluate(() => {
    window.__ar = { panel: null, items: null };
    const look = () => {
      const a = window.__ar;
      if (a.panel === null && [...document.querySelectorAll("button")].some((b) => /^recommended$/i.test(b.innerText.trim()))) a.panel = performance.now();
      if (a.items === null && [...document.querySelectorAll(".overflow-y-auto")].some((el) => el.innerText.includes("[T]"))) a.items = performance.now();
      if (a.items !== null) window.__arObserver?.disconnect();
    };
    window.__arObserver = new MutationObserver(look);
    window.__arObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await spaGo(page, "/ar-tryon");
  await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 6000 }).catch(() => {});
  await page.waitForFunction(() => window.__ar.items !== null, null, { timeout: 40000 });
  const seen = await page.evaluate(() => window.__ar);
  return { total: Date.now() - t, shadeWait: Math.round(seen.items - seen.panel) };
}

// Make sure both accounts exist. The complete one gets a full profile before it is used.
async function ensureAccount(acct) {
  if (await uidOf(acct.email)) return;
  const s = await newSession(null);
  await signUp(s, acct);
  await s.context.close();
}
await ensureAccount(DONE);
await setProfile(await uidOf(DONE.email), COMPLETE);
await ensureAccount(NEW);
await setProfile(await uidOf(NEW.email), INCOMPLETE);

console.log(`(every /run-filter held ${DELAY_MS} ms to stand in for server latency)\n`);

// ---- 1. Prefetch after login; opening AR afterwards is fast and makes no request ----
{
  const s = await newSession("delay");
  await login(s, DONE);
  await s.page.waitForSelector("text=Try-On", { timeout: 15000 });
  const homeShownAt = Date.now() - s.t0;
  await sleep(9000); // idle time on the home page
  const prefetched = [...s.filterCalls];
  const shadePrefetched = [...s.shadeCalls];
  const before = { filter: s.filterCalls.length, shade: s.shadeCalls.length };
  const ar = await enterAR(s);
  const after = { filter: s.filterCalls.length - before.filter, shade: s.shadeCalls.length - before.shade };
  await s.page.screenshot({ path: path.join(outDir, "1_after_prefetch.png") });
  console.log(`   home shown at ${homeShownAt} ms; AR: first product ${ar.total} ms after entering, ${ar.shadeWait} ms of that after the panel appeared\n`);
  check("prefetch: one /run-filter per category while on the home page", prefetched.length === 5, prefetched.map((c) => c.category).join(","));
  check("prefetch: it starts after the home page is shown (not in the way of first paint)", prefetched.length > 0 && prefetched.every((c) => c.at >= homeShownAt - 50), `home ${homeShownAt} ms, first request ${prefetched[0]?.at ?? "-"} ms`);
  check("prefetch: the browse shade files were warmed too", shadePrefetched.length > 0, `${shadePrefetched.length} files`);
  check("open AR: no new /run-filter", after.filter === 0, `${after.filter} calls`);
  check(`open AR: products are there when the panel appears (no wait; an empty cache would add ~${DELAY_MS} ms)`, ar.shadeWait < DELAY_MS / 2, `${ar.shadeWait} ms`);
  check("no uncaught errors", s.pageErrors.length === 0, s.pageErrors.slice(0, 2).join(" || "));
  await s.context.close();
}

// ---- 2. No prefetch for a signed-out visitor or an incomplete profile ----
{
  const s = await newSession("delay");
  await s.page.goto(`${APP}/auth`);
  await sleep(4000);
  check("signed out: no /run-filter", s.filterCalls.length === 0, `${s.filterCalls.length} calls`);
  await s.context.close();

  const n = await newSession("delay");
  await login(n, NEW);
  await sleep(8000);
  check("incomplete profile: no /run-filter", n.filterCalls.length === 0, `${n.filterCalls.length} calls`);
  await n.context.close();
}

// ---- 3. A failing prefetch is silent, and opening AR afterwards still works ----
{
  const s = await newSession("abort");
  await login(s, DONE);
  await sleep(8000);
  const text = await s.page.evaluate(() => document.body.innerText);
  check("failed prefetch: nothing was sent that succeeded, no error shown to the user", s.filterCalls.length > 0 && !/could not load|try again|error/i.test(text), `${s.filterCalls.length} attempts`);
  check("failed prefetch: no uncaught errors", s.pageErrors.length === 0, s.pageErrors.slice(0, 2).join(" || "));
  await s.context.unroute("**/run-filter");
  await s.context.route("**/run-filter", (route) => route.continue());
  const before = s.filterCalls.length;
  let ar = null;
  try { ar = await enterAR(s); } catch { /* reported below */ }
  check("failed prefetch: opening AR retries and shows products", ar !== null && s.filterCalls.length > before, `${ar?.total ?? "-"} ms, ${s.filterCalls.length - before} new calls`);
  await s.context.close();
}

// ---- 4. Opening AR while the prefetch is still in flight reuses it ----
{
  const s = await newSession(5000);
  await login(s, DONE);
  const start = Date.now();
  while (s.filterCalls.length === 0 && Date.now() - start < 15000) await sleep(100);
  const ar = await enterAR(s);
  await sleep(1500);
  const lips = s.filterCalls.filter((c) => c.category === "lips").length;
  // The warm-up fetches one group at a time and each request is held 5 s, so only the first groups have started by now.
  const perCategory = Object.values(s.filterCalls.reduce((m, c) => ({ ...m, [c.category]: (m[c.category] ?? 0) + 1 }), {}));
  check("in flight: opening AR reuses the running request (no category is requested twice)", lips === 1 && perCategory.every((n) => n === 1), s.filterCalls.map((c) => c.category).join(","));
  console.log(`   (AR first product ${ar.total} ms after entering, ${ar.shadeWait} ms after the panel appeared, prefetch already running)`);
  await s.context.close();
}

fs.writeFileSync(path.join(outDir, "prefetch_gate_report.json"), JSON.stringify({ delayMs: DELAY_MS, checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
