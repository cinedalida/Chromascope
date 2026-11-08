// AR visual QA harness (dev tool). Drives /dev/ar-lab?still=1 through window.__arLab with a folder of face photos.
//
//   node scripts/ar-qa/run.mjs detect <photosDir> <outDir>                 face found? skin L*, mouth openness, per photo
//   node scripts/ar-qa/run.mjs matrix <photosDir> <outDir> [label] [list]  render every look for the photos in `list`
//                                                                          (a JSON array of file names; default: all)
//
// Needs a dev server (default http://localhost:5180, override with AR_QA_URL), e.g. `npx vite --mode emulators --port 5180`.
// Photos should already be 4:5 (the lab stretches whatever it is given to 720x900). Nothing here touches Firebase.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { LOOKS, SOLO, STACKS, baseSets, matchedStacks } from "./looks.mjs";

const [mode, photosDir, outDir, label = "run", listFile] = process.argv.slice(2);
if (!mode || !photosDir || !outDir) {
  console.error("usage: run.mjs <detect|matrix> <photosDir> <outDir> [label] [listFile]");
  process.exit(2);
}
// AR_QA_ONLY=fnd_,stack_  renders only the looks whose name starts with one of these (plus "bare"); default: all.
const ONLY = process.env.AR_QA_ONLY ? process.env.AR_QA_ONLY.split(",") : null;
const BASE = process.env.AR_QA_URL ?? "http://localhost:5180";
fs.mkdirSync(outDir, { recursive: true });

let files = fs.readdirSync(photosDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
if (listFile) files = JSON.parse(fs.readFileSync(listFile, "utf8"));

const dataUrl = (file) => {
  const buf = fs.readFileSync(path.join(photosDir, file));
  const type = /png$/i.test(file) ? "image/png" : "image/jpeg";
  return `data:${type};base64,${buf.toString("base64")}`;
};
const save = (file, png) => fs.writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));

// AR_QA_CHROMIUM: path to a chrome.exe when the browser build Playwright expects is not installed.
const browser = await chromium.launch({ executablePath: process.env.AR_QA_CHROMIUM || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 800, height: 980 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && errors.push(m.text()));

await page.goto(`${BASE}/dev/ar-lab?still=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__arLab, null, { timeout: 60_000 });

// Mouth openness = inner-lip gap / mouth width, from MediaPipe points 13/14 (inner lips) and 61/291 (corners).
const metrics = (lm) => {
  const p = lm.points;
  const d = (a, b) => Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]);
  return { skinL: lm.skinL, mouthOpen: d(13, 14) / d(61, 291), faceW: d(234, 454), faceH: d(10, 152) };
};

const report = {};
for (const file of files) {
  try {
    await page.evaluate((u) => window.__arLab.setImage(u), dataUrl(file));
  } catch (e) {
    report[file] = { face: false, error: String(e.message ?? e).slice(0, 80) };
    console.log("NO FACE", file);
    continue;
  }
  const lm = await page.evaluate(() => window.__arLab.landmarks());
  report[file] = { face: true, ...metrics(lm) };
  if (mode === "detect") {
    console.log("ok", file, JSON.stringify(report[file], (k, v) => (typeof v === "number" ? +v.toFixed(3) : v)));
    continue;
  }

  const dir = path.join(outDir, label, file.replace(/\.[^.]+$/, ""));
  fs.mkdirSync(dir, { recursive: true });
  const renderSet = async (name, set) => {
    if (ONLY && name !== "bare" && !ONLY.some((prefix) => name.startsWith(prefix))) return;
    await page.evaluate((s) => window.__arLab.render(s), set);
    save(path.join(dir, `${name}.png`), await page.evaluate(() => window.__arLab.capture()));
  };
  await renderSet("bare", { colors: {}, finishes: {} });
  for (const [name, set] of Object.entries(SOLO)) await renderSet(name.startsWith("fin_") ? name : `solo_${name}`, set);
  for (const [name, set] of Object.entries(STACKS)) await renderSet(`stack_${name}`, set);
  // Landmarks and the measured skin color, for the numeric checks (analyze.py), plus shades built from that skin.
  fs.writeFileSync(path.join(dir, "landmarks.json"), JSON.stringify(lm));
  for (const [name, set] of Object.entries(baseSets(lm.skin))) await renderSet(name, set);
  for (const [name, set] of Object.entries(matchedStacks(lm.skin))) await renderSet(name, set);
  console.log("rendered", file);
}
fs.writeFileSync(path.join(outDir, `${mode}_${label}.json`), JSON.stringify({ report, errors, looks: LOOKS }, null, 1));
console.log(`${Object.values(report).filter((r) => r.face).length}/${files.length} faces; ${errors.length} page errors`);
await browser.close();
