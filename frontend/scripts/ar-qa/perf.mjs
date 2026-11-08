// Per-frame cost of the AR loop (tracking + drawing) with every product applied, on one or more dev servers, alternating
// between them so machine noise hits all equally. In headless Chromium the page runs on software GL, so the absolute
// numbers are far worse than on a phone; only the DIFFERENCE between servers (e.g. the original code vs. new code) means anything.
//
//   node scripts/ar-qa/perf.mjs <photo.jpg> <url1> <url2> ...   (urls are dev servers, e.g. http://localhost:5181)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { LOOKS } from "./looks.mjs";

const [photo, ...urls] = process.argv.slice(2);
const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(photo).toString("base64")}`;
const browser = await chromium.launch({ executablePath: process.env.AR_QA_CHROMIUM || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = Object.fromEntries(urls.map((u) => [u, []]));
const ROUNDS = 4;
for (let round = 0; round < ROUNDS; round++) {
  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width: 800, height: 980 } });
    await page.goto(`${url}/dev/ar-lab?still=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__arLab, null, { timeout: 60_000 });
    await page.evaluate((u) => window.__arLab.setImage(u), dataUrl);
    await page.evaluate((colors) => window.__arLab.render({ colors, finishes: {} }), LOOKS);
    await page.evaluate(() => { window.__latencyMs = undefined; });
    await page.waitForTimeout(4000); // ~100+ frames with every product on; __latencyMs is a moving average
    results[url].push(await page.evaluate(() => window.__latencyMs));
    await page.close();
  }
}
for (const [url, v] of Object.entries(results)) {
  const sorted = [...v].sort((a, b) => a - b);
  console.log(url.padEnd(26), "per-frame ms by round:", v.map((x) => x.toFixed(1)).join(" "), "| median", sorted[Math.floor(sorted.length / 2)].toFixed(1));
}
await browser.close();
