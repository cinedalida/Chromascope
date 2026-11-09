// Checks, in the LOCAL SANDBOX only, that every shade that fits the user is offered per product on the Try-On cards, that
// a card follows the shade picked, that a saved look can be opened shade by shade, and that the Catalog sorts types
// under the right category. Setup as for cache-gate.mjs (emulators, backend :8001, app :5181) with a products_v2 test
// catalog that has multi-shade lipstick and foundation (T-LIP-MULTI, T-FND-MULTI), a single-shade lipstick, a blush, and
// a concealer tagged "Concealer;Lip gloss".
//
//   node scripts/ar-qa/shades-gate.mjs <outDir>
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [outDir = "shades-gate-out"] = process.argv.slice(2);
const APP = process.env.E2E_URL ?? "http://localhost:5181";
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PASSWORD = "testpass123";
const ACCT = { email: "shades-gate@example.com", name: "Shades Gate" };
fs.mkdirSync(outDir, { recursive: true });

const str = (v) => ({ stringValue: v });
const num = (v) => ({ doubleValue: v });
const arr = (list) => ({ arrayValue: { values: list } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OWNER = { authorization: "Bearer owner", "content-type": "application/json" };
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
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`profile update failed: ${res.status}`);
}
const item = (region, productId, shadeId = null) => ({
  mapValue: { fields: { region: str(region), source: str("catalog"), product_id: str(productId), shade_id: shadeId ? str(shadeId) : { nullValue: null } } },
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
const spaGo = (to) => page.evaluate((p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); }, to);
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

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
await addFavorite(uid, "look", "Gate Look", [item("lips", "T-LIP-MULTI", "T-LIP-MULTI-s2"), item("cheeks", "T-CHK-1", "T-CHK-1-s1")], "2026-01-01T00:00:00.000Z");

await page.goto(`${APP}/auth`);
await page.waitForTimeout(500);
if (page.url().includes("/auth")) {
  await page.locator('input[name="email"]').fill(ACCT.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^log ?in$|^sign in$/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}
await sleep(6000);

// ── Try-On: Lips
await spaGo("/ar-tryon");
await page.getByRole("button", { name: /start try-on now/i }).click({ timeout: 8000 }).catch(() => {});
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForSelector("text=/Multi Shade Lipstick/", { timeout: 60000 });
await sleep(1500);
await shot("tryon-lips");

const lipCard = page.locator("div.relative.flex.h-full", { hasText: "Multi Shade Lipstick" }).first();
const fitText = await lipCard.locator("p", { hasText: /shades fit you/ }).innerText();
const fitCount = Number(fitText.match(/(\d+) shades fit you/)?.[1]);
check("Lips: the multi-shade lipstick says how many shades fit you", fitCount > 1, fitText);
const group = lipCard.getByRole("group", { name: /fit you/ });
check("Lips: no '+N' / 'Less' button, every color is already visible", (await group.getByRole("button", { name: /^(\+\d+|Less)$/ }).count()) === 0);
const dotCount = await group.locator("button[aria-label]").evaluateAll((els) => els.filter((e) => !/^(\+\d+|Less)$/.test(e.textContent.trim())).length);
check("Lips: one dot per fitting shade, none dropped", dotCount === fitCount, `${dotCount} dots vs ${fitCount}`);
check("Lips: not every shade of the product is offered (the navy one does not fit)", fitCount < 12, `${fitCount} of 12`);
check("Lips: the single-shade lipstick shows no dot row", (await page.locator("div.relative.flex.h-full", { hasText: "Single Shade Lipstick" }).first().locator("text=/shades fit you/").count()) === 0);
const chipsBefore = await lipCard.locator("span[aria-label^='Seasons:']").first().getAttribute("aria-label").catch(() => null);
check("Lips: the card names every season of the shade shown, never '+N'", chipsBefore && !/\+\d/.test(chipsBefore), chipsBefore ?? "none");
check("Lips: a cool berry lipstick that does not fit a Soft Autumn user is left out", (await page.locator("text=/Cool Berry Lipstick/").count()) === 0);
check("Lips: no product-level 'All seasons' chip on Try-On cards", (await page.locator("text=/All seasons/").count()) === 0);

// pick a different shade: the dot becomes pressed and the card follows it
const dots = group.locator("button[aria-label]").filter({ hasNotText: /^(\+\d+|Less)$/ });
const labels = await dots.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const chipsByShade = {};
for (let i = 0; i < Math.min(dotCount, 6); i += 1) {
  await dots.nth(i).click();
  await sleep(300);
  const chips = await lipCard.locator("span[aria-label^='Seasons:']").first().getAttribute("aria-label").catch(() => "none");
  const pressed = await dots.nth(i).getAttribute("aria-pressed");
  chipsByShade[labels[i]] = chips;
  if (i === 1) check("Lips: tapping a dot applies that shade (dot pressed, card selected)", pressed === "true", labels[i]);
}
console.log("  seasons per shade:", JSON.stringify(chipsByShade));
check("Lips: different shades of one product can show different seasons", new Set(Object.values(chipsByShade)).size > 1, `${new Set(Object.values(chipsByShade)).size} distinct`);
await shot("tryon-lips-picked");
// the product photo opens a preview that lists the same shades and opens the catalog in a new tab
await lipCard.getByRole("button", { name: /^Preview/ }).click();
await page.waitForSelector("[role=dialog]");
const previewShades = await page.locator("[role=dialog] ul li").count();
check("Lips: the photo opens a preview listing every fitting shade", previewShades === fitCount, `${previewShades} vs ${fitCount}`);
check("Lips: 'Open in catalog' opens a new tab", (await page.getByRole("link", { name: /open in catalog/i }).getAttribute("target")) === "_blank");
await shot("tryon-preview");
await page.keyboard.press("Escape");
const cardHeart = await lipCard.getByRole("button", { name: /favorites/i }).count();
check("Lips: the heart is on the card", cardHeart === 1);

// ── Try-On: Face (percentage on skin products)
await page.getByRole("button", { name: /^face$/i }).last().click(); // the panel's tab, below the camera's region controls
await page.waitForSelector("text=/Multi Shade Foundation/", { timeout: 30000 }).catch(async () => {
  await shot("tryon-face-missing");
  console.log("  panel text:", (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 600));
  throw new Error("foundation card not found");
});
await sleep(1000);
const fndCard = page.locator("div.relative.flex.h-full", { hasText: "Multi Shade Foundation" }).first();
const pctBefore = await fndCard.locator("text=/\\d+% match/").first().innerText().catch(() => null);
check("Face: foundation shows a percentage", Boolean(pctBefore), pctBefore ?? "none");
const fndFit = Number((await fndCard.locator("p", { hasText: /shades fit you/ }).innerText()).match(/(\d+)/)[1]);
const fndGroup = fndCard.getByRole("group", { name: /fit you/ });
const fndDots = fndGroup.locator("button[aria-label]").filter({ hasNotText: /^(\+\d+|Less)$/ });
check("Face: one dot per fitting shade", (await fndDots.count()) === fndFit, `${await fndDots.count()} vs ${fndFit}`);
const pcts = new Set();
for (let i = 0; i < Math.min(await fndDots.count(), 4); i += 1) {
  await fndDots.nth(i).click();
  await sleep(250);
  pcts.add(await fndCard.locator("text=/\\d+% match/").first().innerText());
}
check("Face: the percentage follows the shade picked", pcts.size > 1, [...pcts].join(" | "));
check("Face: a foundation far from the user's skin is left out", (await page.locator("text=/Far Foundation/").count()) === 0);
await shot("tryon-face");

// ── Favorites: look through a set
await spaGo("/favorites?tab=looks");
await page.waitForSelector("text=/Gate Look/", { timeout: 30000 });
await page.waitForFunction(() => /Multi Shade Lipstick/.test(document.body.innerText), null, { timeout: 30000 });
const row = page.getByRole("button", { name: /Multi Shade Lipstick/ }).first();
await row.click();
await sleep(400);
await shot("favorites-look-open");
const detailsText = await page.locator("#" + (await row.getAttribute("aria-controls"))).innerText().catch(() => "");
check("Favorites: opening a row shows the product, saved shade and price", /Multi Shade Lipstick/.test(detailsText) && /Lip 2/.test(detailsText) && /₱799/.test(detailsText), detailsText.replace(/\s+/g, " ").slice(0, 120));
check("Favorites: the row has a 'View full details' button", (await page.getByRole("button", { name: /view full details/i }).count()) === 1);
await page.getByRole("button", { name: /view full details/i }).click();
await sleep(600);
check("Favorites: 'View full details' opens the product page", (await page.locator("[role=dialog]").count()) > 0);
await shot("favorites-detail");
await page.keyboard.press("Escape");

// ── Catalog: Safe for me shows only what fits, with only the fitting colors
await spaGo("/catalog?view=safe");
await page.waitForSelector("text=/Multi Shade Lipstick/", { timeout: 30000 });
await sleep(800);
const safeText = await page.evaluate(() => document.body.innerText);
check("Catalog (Safe for me): products that do not fit are left out", !/Cool Berry Lipstick/.test(safeText) && !/Far Foundation/.test(safeText));
const safeDots = await page.locator("li", { hasText: "Multi Shade Lipstick" }).first().locator("[role=img][aria-label$='shades']").getAttribute("aria-label");
check("Catalog (Safe for me): the card shows only the fitting colors", safeDots === `${fitCount} shades`, `${safeDots} vs ${fitCount} that fit`);
await shot("catalog-safe");

// ── Catalog: types sit under the right category
await spaGo("/catalog?view=all");
await page.waitForSelector("text=/Multi Shade Lipstick/", { timeout: 30000 });
const fullDots = await page.locator("li", { hasText: "Multi Shade Lipstick" }).first().locator("[role=img][aria-label$='shades']").getAttribute("aria-label");
check("Catalog (full): the card shows every color of the product", fullDots === "12 shades", fullDots);
check("Catalog (full): products that do not fit are still listed", (await page.locator("text=/Cool Berry Lipstick/").count()) > 0);
await shot("catalog-full");
await page.getByRole("button", { name: "Concealer", exact: true }).first().click();
await sleep(500);
const typeText = await page.locator("[role=group][aria-labelledby$='-sub']").first().innerText().catch(() => "");
check("Catalog: Concealer's types do not include Lip gloss", !/Lip gloss/.test(typeText), typeText.replace(/\s+/g, " "));
await page.getByRole("button", { name: "Lip", exact: true }).first().click();
await sleep(500);
const lipTypes = await page.locator("[role=group][aria-labelledby$='-sub']").first().innerText().catch(() => "");
check("Catalog: Lip shows its own types", /Lipstick/.test(lipTypes) && /Lip liner/.test(lipTypes) && /Lip gloss/.test(lipTypes), lipTypes.replace(/\s+/g, " "));
await shot("catalog-lip");

check("no uncaught errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" || "));
fs.writeFileSync(path.join(outDir, "shades_gate_report.json"), JSON.stringify({ checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
