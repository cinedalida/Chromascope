// End-to-end check of the real AR page against the LOCAL SANDBOX (emulators only; never the real Firebase project).
//
// One throwaway account is used for every scenario: its season and skin tone are edited in the Firestore emulator between
// scenarios, as a tester would. A Y4M face video stands in for the webcam (Chromium's --use-file-for-fake-video-capture), so
// the page tracks a real face through the real camera code path.
//
// Needs, all on this machine:   Firebase emulators (auth 9099, firestore 8080)   backend on E2E_API (default :8001, emulator
// mode, catalog imported)   app on E2E_URL (default :5181, `vite --mode emulators` with VITE_API_URL pointing at that backend).
//
//   node scripts/ar-qa/e2e.mjs <outDir> <scenarioName>=<camera.y4m>|<season>|<L,a,b> [...]
//   e.g. node scripts/ar-qa/e2e.mjs out deep=cam_deep.y4m\|"Deep Winter"\|38,14,14
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir, ...specs] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const EMAIL = "e2e-tester@example.com";
const PASSWORD = "testpass123";
fs.mkdirSync(outDir, { recursive: true });

const num = (v) => ({ doubleValue: v });
async function uidOf() {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  return res.ok ? (await res.json()).localId : null;
}
// The rules stop the app itself from writing season / skin tone, so the sandbox is edited through the emulator's REST API.
async function setProfile(uid, season, lab) {
  const fields = {
    seasonal_label: { stringValue: season }, user_lab: { arrayValue: { values: lab.map(num) } },
    season_confidence_level: num(0.9), profile_completed: { booleanValue: true }, skin_type: { stringValue: "normal" },
    concerns: { arrayValue: { values: [] } }, avoid_ingredients: { arrayValue: { values: [] } },
  };
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, {
    method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`profile update failed: ${res.status} ${await res.text()}`);
}

// The panel's scrolling product list (the page also has control-bar toggles with the same labels, which must not count).
const LIST = "div.overflow-y-auto.space-y-2";
const tab = (page, text) => page.getByRole("button", { name: text, exact: true });

// Texts of the product rows currently listed, in order (a single-shade row is one button; a multi-shade row has a header).
const rowTexts = (page) => page.evaluate((list) => {
  const rows = [...document.querySelector(list).querySelectorAll("button[aria-label][aria-pressed], button[aria-expanded]")];
  return rows.map((b) => (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()).filter(Boolean);
}, LIST);

// Applies the first product in the list: a one-shade row is one click, a multi-shade row opens and takes its first swatch.
async function applyFirst(page) {
  const list = page.locator(LIST);
  const single = list.locator("button[aria-label][aria-pressed]");
  const header = list.locator("button[aria-expanded]").first();
  const firstSingleY = (await single.first().boundingBox().catch(() => null))?.y ?? Infinity;
  const firstHeaderY = (await header.boundingBox().catch(() => null))?.y ?? Infinity;
  if (firstSingleY === Infinity && firstHeaderY === Infinity) return false;
  if (firstSingleY < firstHeaderY) {
    await single.first().click();
  } else {
    await header.click();
    await list.locator("[aria-expanded='true']").first().locator("xpath=..").locator("button[aria-label]").first().click();
  }
  return true;
}

const report = {};
for (const spec of specs) {
  const [name, rest] = [spec.slice(0, spec.indexOf("=")), spec.slice(spec.indexOf("=") + 1)];
  const [camera, season, labText] = rest.split("|");
  const lab = labText.split(",").map(Number);
  console.log(`\n=== ${name}: ${season}, skin Lab ${lab} ===`);
  const browser = await chromium.launch({
    executablePath: process.env.AR_QA_CHROMIUM || undefined,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(camera)}`,
      "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && errors.push(m.text()));

  await page.goto(`${APP}/auth`);
  if (!(await uidOf())) {
    await page.getByRole("button", { name: /^sign up$/i }).click();
    await page.locator('input[name="name"]').fill("E2E Tester");
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
  await setProfile(uid, season, lab); // edit the one account's data, then reload so the app reads it

  await page.goto(`${APP}/ar-tryon`);
  await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 20000 }).catch(() => {});
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(9000); // model download + a few tracked frames
  const result = { errors, recommended: {}, browse: {} };

  for (const [source, key] of [["Recommended", "recommended"], ["Browse", "browse"]]) {
    await tab(page, source).click();
    for (const group of ["LIPS", "CHEEKS", "EYES", "FACE"]) {
      await tab(page, group).click();
      await page.waitForTimeout(1500);
      result[key][group] = (await rowTexts(page)).slice(0, 8);
    }
    await tab(page, "LIPS").click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, `${name}_${key}_list.png`) });
  }

  // Apply the top Recommended product of every group, one at a time, capturing the face as it builds up.
  await tab(page, "Recommended").click();
  for (const group of ["LIPS", "CHEEKS", "EYES", "FACE"]) {
    await tab(page, group).click();
    await page.waitForTimeout(1200);
    result[`applied_${group}`] = await applyFirst(page);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(outDir, `${name}_after_${group.toLowerCase()}.png`) });
  }
  const png = await page.evaluate(() => document.querySelector("canvas")?.toDataURL("image/png"));
  if (png) fs.writeFileSync(path.join(outDir, `${name}_canvas_final.png`), Buffer.from(png.split(",")[1], "base64"));
  report[name] = result;
  console.log(JSON.stringify({ errors: result.errors.slice(0, 3), applied: Object.keys(result).filter((k) => k.startsWith("applied_")).map((k) => `${k}=${result[k]}`) }));
  await browser.close();
}
fs.writeFileSync(path.join(outDir, "e2e_report.json"), JSON.stringify(report, null, 1));
console.log("\nreport:", path.join(outDir, "e2e_report.json"));
