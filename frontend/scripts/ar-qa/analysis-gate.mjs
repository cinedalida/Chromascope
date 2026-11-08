// Checks that a new color analysis and a profile edit refresh the Recommended cache and the Browse ranking, on the real
// pages, against the LOCAL SANDBOX only (emulators, never the real project).
//
// Needs what cache-gate.mjs needs, plus the sandbox backend started with ANALYSIS_RESULT_SECRET=<same as ANALYSIS_SECRET below>.
// Only the browser's /analyze-color answer is stubbed (no model weights in the sandbox); the receipt in it is minted by the
// backend's own result_receipt.issue(), and the SAVE call (/user/analysis-result) is real and verified by the backend.
//
//   node scripts/ar-qa/analysis-gate.mjs <outDir>
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [outDir = "analysis-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const ANALYSIS_SECRET = process.env.ANALYSIS_SECRET ?? "sandbox-analysis-secret";
const BACKEND = path.resolve("../backend");
const PY = path.join(BACKEND, "venv", "Scripts", "python.exe");
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const EMAIL = "analysis-gate@example.com";
const PASSWORD = "testpass123";
fs.mkdirSync(outDir, { recursive: true });

const num = (v) => ({ doubleValue: v });
const arr = (list) => ({ arrayValue: { values: list } });
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

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
async function firestoreProfile(uid) {
  const res = await fetch(`${FIRESTORE}/users/${uid}`, { headers: { authorization: "Bearer owner" } });
  const f = (await res.json()).fields ?? {};
  return {
    seasonal_label: f.seasonal_label?.stringValue,
    user_lab: f.user_lab?.arrayValue?.values?.map((v) => v.doubleValue ?? Number(v.integerValue)),
    avoid_ingredients: f.avoid_ingredients?.arrayValue?.values?.map((v) => v.stringValue) ?? [],
  };
}
// A receipt the backend will accept for exactly this user and result.
const mintReceipt = (uid, season, lab, confidence) =>
  execFileSync(PY, ["-c", "import json,sys;from app.api.result_receipt import issue;print(issue(*json.loads(sys.argv[1])))", JSON.stringify([uid, season, lab, confidence])],
    { cwd: BACKEND, env: { ...process.env, ANALYSIS_RESULT_SECRET: ANALYSIS_SECRET } }).toString().trim();

const tab = (page, text) => page.getByRole("button", { name: new RegExp(`^${text}$`, "i") }).last();
const panelLines = (page) => page.evaluate(() => {
  const lists = [...document.querySelectorAll(".overflow-y-auto")];
  return ((lists[lists.length - 1]?.innerText) ?? "").split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
});
const storeProfile = (page) => page.evaluate(async () => {
  const { useUserStore } = await import("/src/store/userStore.js");
  const u = useUserStore.getState().user ?? {};
  return { seasonal_label: u.seasonal_label, user_lab: u.user_lab, avoid_ingredients: u.avoid_ingredients };
});
const spaGo = (page, to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);

const browser = await chromium.launch({
  executablePath: process.env.AR_QA_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && !/Could not reach Cloud Firestore|Failed to load resource|Profile save error: TypeError: Failed to fetch/.test(m.text()) && errors.push(m.text()));
let filterCalls = [];
const filterSeasons = [];
page.on("request", (r) => r.url().includes("/run-filter") && filterCalls.push(JSON.parse(r.postData() ?? "{}").category));
page.on("response", async (r) => {
  if (!r.url().includes("/run-filter")) return;
  filterSeasons.push((await r.json().catch(() => ({})))?.active_profile?.seasonal_label ?? null);
});

// Sign in (or up) through the real UI.
await page.goto(`${APP}/auth`);
if (!(await uidOf())) {
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill("Analysis Gate");
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
const START = { season: "Soft Autumn", lab: [60, 10, 12] };
await setProfile(uid, {
  seasonal_label: { stringValue: START.season }, user_lab: arr(START.lab.map(num)), season_confidence_level: num(0.9),
  profile_completed: { booleanValue: true }, skin_type: { stringValue: "normal" }, concerns: arr([]), avoid_ingredients: arr([]),
});

// Open AR (full load or in-app), look at every group, then at Browse > Lips. Returns what was requested and shown.
async function arVisit(label, { reload = false } = {}) {
  filterCalls = [];
  filterSeasons.length = 0;
  if (reload) await page.goto(`${APP}/ar-tryon`);
  else await spaGo(page, "/ar-tryon");
  await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 6000 }).catch(() => {});
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(3500);
  const rec = {};
  await tab(page, "Recommended").click();
  for (const g of ["LIPS", "CHEEKS", "EYES", "FACE"]) {
    await tab(page, g).click();
    await page.waitForTimeout(1300);
    rec[g] = await panelLines(page);
  }
  await tab(page, "LIPS").click();
  await tab(page, "Browse").click();
  await page.waitForTimeout(1800);
  const browse = (await panelLines(page)).slice(0, 16);
  await tab(page, "Recommended").click();
  await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  return { calls: [...filterCalls], seasons: [...filterSeasons], rec, browse };
}

// Runs a (stubbed) analysis through the real upload page and Run Analysis button.
async function runAnalysis(season, lab, confidence) {
  const token = mintReceipt(uid, season, lab, confidence);
  await context.route("**/analyze-color", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ season, lab_color: lab, confidence, result_token: token }) }));
  await spaGo(page, "/color-analysis");
  await page.waitForTimeout(1200);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "face.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: /run analysis/i }).click({ timeout: 8000 });
  await page.waitForURL((u) => /\/color-analysis\/(subtype|$)/.test(u.pathname) || u.pathname === "/color-analysis", { timeout: 30000 });
  await page.waitForTimeout(1500);
  await context.unroute("**/analyze-color");
}

// ---------- scenario ----------
const A = await arVisit("1_before", { reload: true });
check("start: first AR visit requests every category", A.calls.length === 5, A.calls.join(","));
check("start: server used the starting season", A.seasons.every((s) => s === START.season), [...new Set(A.seasons)].join(","));

const A2 = await arVisit("1b_revisit");
check("start: re-entering AR makes no request", A2.calls.length === 0, `${A2.calls.length} calls`);

// 1) New analysis => store matches Firestore, new values.
const NEW = { season: "Deep Winter", lab: [38, 14, 14], conf: 0.88 };
await runAnalysis(NEW.season, NEW.lab, NEW.conf);
const st = await storeProfile(page);
const fs1 = await firestoreProfile(uid);
check("analysis: URL moved on to the subtype page", /\/color-analysis\/subtype/.test(page.url()), page.url());
check("analysis: store holds the new season and skin color", st.seasonal_label === NEW.season && JSON.stringify(st.user_lab) === JSON.stringify(NEW.lab), JSON.stringify(st));
check("analysis: Firestore holds the same values as the store", fs1.seasonal_label === st.seasonal_label && JSON.stringify(fs1.user_lab) === JSON.stringify(st.user_lab), JSON.stringify(fs1));

// 2, 3) Back in AR with no reload: refetch, new season, Browse reranked.
const B = await arVisit("2_after_analysis");
check("analysis: AR asks the server again", B.calls.length === 5, B.calls.join(","));
check("analysis: server answers for the new season", B.seasons.length > 0 && B.seasons.every((s) => s === NEW.season), [...new Set(B.seasons)].join(","));
check("analysis: Browse ranking changed without a reload", JSON.stringify(A.browse) !== JSON.stringify(B.browse), `before: ${A.browse.slice(0, 4).join(" | ")}  after: ${B.browse.slice(0, 4).join(" | ")}`);
check("analysis: Recommended lists changed", JSON.stringify(A.rec) !== JSON.stringify(B.rec), "informational; the sandbox catalog is small");

// 4) A save that fails must leave the store alone and AR must keep using the cache.
await context.route("**/user/analysis-result", (route) => route.abort());
await runAnalysis("Light Spring", [75, 8, 18], 0.8);
await context.unroute("**/user/analysis-result");
const stFail = await storeProfile(page);
check("failed save: back on the upload page", /\/color-analysis$/.test(new URL(page.url()).pathname), page.url());
check("failed save: store keeps the previous result", stFail.seasonal_label === NEW.season && JSON.stringify(stFail.user_lab) === JSON.stringify(NEW.lab), JSON.stringify(stFail));
const B2 = await arVisit("3_after_failed_save");
check("failed save: AR still served from the cache", B2.calls.length === 0, `${B2.calls.length} calls`);

// 5) Profile edit through the real Profile page => refetch, and the blocked ingredient disappears.
const scentedBefore = B2.rec.LIPS.some((l) => /Scented Berry Lipstick/.test(l));
await spaGo(page, "/profile");
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^edit$/i }).click();
await page.getByRole("button", { name: "Fragrance / Parfum" }).click();
await page.getByRole("button", { name: /^save$/i }).click();
await page.waitForTimeout(2000);
const stEdit = await storeProfile(page);
const fsEdit = await firestoreProfile(uid);
check("profile edit: store and Firestore both hold the blocked ingredient", /fragrance/i.test(String(stEdit.avoid_ingredients)) && /fragrance/i.test(String(fsEdit.avoid_ingredients)), JSON.stringify([stEdit.avoid_ingredients, fsEdit.avoid_ingredients]));
const C = await arVisit("4_after_profile_edit");
check("profile edit: AR asks the server again", C.calls.length === 5, C.calls.join(","));
check("profile edit: scented product shown before, gone after", scentedBefore && !C.rec.LIPS.some((l) => /Scented Berry Lipstick/.test(l)), `before=${scentedBefore}`);

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" || "));
fs.writeFileSync(path.join(outDir, "analysis_gate_report.json"), JSON.stringify({ checks, A, B, C }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
