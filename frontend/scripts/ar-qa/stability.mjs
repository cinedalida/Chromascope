// Skin sampler stability: loads each photo, renders it repeatedly (and with different looks) and reports the spread of the
// measured skin color. A stable sampler gives the same Lab every time, so makeup strength does not flicker.
//
//   node scripts/ar-qa/stability.mjs <photosDir> <listFile> [repeats]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [photosDir, listFile, repeatsArg = "6"] = process.argv.slice(2);
const files = JSON.parse(fs.readFileSync(listFile, "utf8"));
const repeats = Number(repeatsArg);
const browser = await chromium.launch({ executablePath: process.env.AR_QA_CHROMIUM || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 800, height: 980 } });
await page.goto(`${process.env.AR_QA_URL ?? "http://localhost:5180"}/dev/ar-lab?still=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__arLab, null, { timeout: 60_000 });

const sets = [{}, { lips: "#b03060" }, { foundation: "#d9b08c", cheeks: "#e07a8a" }, { foundation: "#8a5a40", bronzer: "#b07a55", highlighter: "#f3d9b8" }];
let worst = 0;
for (const file of files) {
  const buf = fs.readFileSync(path.join(photosDir, file));
  await page.evaluate((u) => window.__arLab.setImage(u), `data:image/jpeg;base64,${buf.toString("base64")}`);
  const samples = [];
  for (let i = 0; i < repeats; i++) {
    await page.evaluate((colors) => window.__arLab.render({ colors, finishes: {} }), sets[i % sets.length]);
    samples.push(await page.evaluate(() => window.__arLab.landmarks().skin));
  }
  const spread = (k) => Math.max(...samples.map((s) => s[k])) - Math.min(...samples.map((s) => s[k]));
  const row = { L: spread("L"), a: spread("a"), b: spread("b") };
  worst = Math.max(worst, row.L, row.a, row.b);
  console.log(file.slice(0, 40).padEnd(40), `spread over ${repeats} renders  L ${row.L.toFixed(2)}  a ${row.a.toFixed(2)}  b ${row.b.toFixed(2)}`);
}
console.log(`worst spread ${worst.toFixed(2)} (must stay below 1.0)`);
await browser.close();
process.exit(worst < 1 ? 0 : 1);
