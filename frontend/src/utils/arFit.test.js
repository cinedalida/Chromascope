// Run with: node --test src/utils/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SEASON_ORDER, deltaE2000, fitForShade, rankBrowseItems, seasonCodeFor, tierFor, userColors } from "./arFit.js";

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const fixtures = read("./arFit.fixtures.json");
const catalog = (region) => read(`../../public/data/ar-shades-${region}.json`).map((e) => ({ ...e, source: "browse", region }));

test("CIEDE2000 matches the published reference values (Sharma, Wu, Dalal 2005)", () => {
  const cases = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, expected] of cases) assert.ok(Math.abs(deltaE2000(a, b) - expected) <= 0.0101, `${a} vs ${b}`);
});

test("CIEDE2000 gives the backend's numbers on 154 reference pairs", () => {
  for (const { a, b, dE } of fixtures.pairs) assert.ok(Math.abs(deltaE2000(a, b) - dE) <= 0.0101, `${a} vs ${b}: ${deltaE2000(a, b)} != ${dE}`);
  assert.equal(deltaE2000(null, [1, 2, 3]), 999);
});

test("skin fit and tier match the backend on 150 reference cases", () => {
  const tierName = { best: "great", good: "good", fair: "fair", low: "low" };
  for (const c of fixtures.skin) {
    const fit = fitForShade({ region: c.region, lab: c.shade_lab }, { skinLab: c.user_lab, seasonCode: null });
    assert.ok(Math.abs(fit - c.fit) < 2e-3, `${c.region}: ${fit} != ${c.fit}`);
    const nearEdge = [0.75, 0.55, 0.35].some((edge) => Math.abs(c.fit - edge) < 2e-3);
    if (!nearEdge) assert.equal(tierFor(fit), tierName[c.tier]);
  }
});

test("SEASON_ORDER is the backend's order, and labels map to codes", () => {
  assert.deepEqual(SEASON_ORDER, fixtures.season_order);
  assert.equal(seasonCodeFor("Soft Autumn"), "au-soft");
  assert.equal(seasonCodeFor(" warm autumn "), "au-true");
  assert.equal(seasonCodeFor("Cool Winter"), "wi-true");
  assert.equal(seasonCodeFor(null), null);
  assert.equal(seasonCodeFor("Nonsense"), null);
});

test("no season or skin tone means no ranking and the list is returned untouched", () => {
  const items = catalog("lips").slice(0, 50);
  for (const profile of [null, {}, { seasonal_label: null, user_lab: null }, { user_lab: [1, 2] }]) {
    const out = rankBrowseItems(items, profile);
    assert.equal(out.ranked, false);
    assert.equal(out.items, items);
  }
  assert.deepEqual(userColors({ user_lab: ["a", 1, 2] }).skinLab, null);
});

const PROFILES = [
  { seasonal_label: "Deep Winter", user_lab: [38, 14, 14] },
  { seasonal_label: "Light Spring", user_lab: [76, 12, 22] },
  { seasonal_label: "Soft Autumn", user_lab: [62, 14, 24] },
  { seasonal_label: "Cool Summer", user_lab: [68, 12, 14] },
  { seasonal_label: "Bright Winter", user_lab: [55, 15, 16] },
  { seasonal_label: "Warm Autumn", user_lab: [50, 16, 28] },
];
const REGIONS = ["lips", "lipLiner", "cheeks", "eyeshadow", "foundation", "concealer", "bronzer", "highlighter", "brows"];

test("ordering is monotonic for every profile and region: products by best shade, shades by fit, unscored last", () => {
  for (const profile of PROFILES) {
    for (const region of REGIONS) {
      const items = catalog(region);
      const before = JSON.stringify(items);
      const { items: out, ranked } = rankBrowseItems(items, profile);
      assert.equal(JSON.stringify(items), before, "input must not be mutated");
      assert.equal(out.length, items.length);
      assert.equal(new Set(out.map((i) => i.id)).size, new Set(items.map((i) => i.id)).size);
      if (region === "brows") {
        assert.equal(ranked, false); // no color target
        continue;
      }
      assert.equal(ranked, true, `${profile.seasonal_label} ${region}`);
      // Group by product in output order.
      const seen = new Set();
      let lastBest = Infinity;
      let sawUnscored = false;
      for (let i = 0; i < out.length; ) {
        const url = out[i].url;
        let j = i;
        while (j < out.length && out[j].url === url) j += 1;
        assert.ok(!seen.has(url), "a product's shades must stay together");
        seen.add(url);
        const fits = out.slice(i, j).map((s) => s.fit);
        for (let k = 1; k < fits.length; k += 1) {
          assert.ok(fits[k - 1] === null ? fits[k] === null : fits[k] === null || fits[k] <= fits[k - 1], "shades by fit");
        }
        const best = fits[0];
        if (best === null) sawUnscored = true;
        else {
          assert.ok(!sawUnscored, "scored products before unscored ones");
          assert.ok(best <= lastBest + 1e-12, `products by best fit (${region}, ${profile.seasonal_label})`);
          lastBest = best;
        }
        i = j;
      }
    }
  }
});

// Hue angle of an [L, a, b] color in degrees; reds run ~20-40, pinks/berries higher-cool hues sit above ~35 for lips.
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

test("the top lip shades are the right kind of color for the season", () => {
  const top = (profile, n = 25) => rankBrowseItems(catalog("lips"), profile).items.slice(0, n);
  const deepWinter = top(PROFILES[0]);
  const lightSpring = top(PROFILES[1]);
  // Print the top 5 for a human look (visible with --test-reporter=spec).
  for (const [name, list] of [["Deep Winter", deepWinter], ["Light Spring", lightSpring]]) {
    console.log(name, list.slice(0, 5).map((s) => `${s.hex} L${s.lab[0].toFixed(0)} fit ${s.fit.toFixed(2)}`).join(" | "));
  }
  assert.ok(mean(deepWinter.map((s) => s.lab[0])) < mean(lightSpring.map((s) => s.lab[0])) - 10, "Deep Winter lips are darker than Light Spring lips");
  assert.ok(mean(deepWinter.map((s) => s.lab[0])) < 50, "Deep Winter lips are deep");
  assert.ok(mean(lightSpring.map((s) => s.lab[0])) > 55, "Light Spring lips are light");
  const hue = (s) => (Math.atan2(s.lab[2], s.lab[1]) * 180) / Math.PI;
  assert.ok(mean(lightSpring.map(hue)) > mean(deepWinter.map(hue)), "Light Spring (warm) leans warmer than Deep Winter (cool)");
});

test("foundation ranking puts the closest shade to the user's skin first", () => {
  const user = { seasonal_label: "Soft Autumn", user_lab: [62, 14, 24] };
  const { items } = rankBrowseItems(catalog("foundation"), user);
  const d = (s) => deltaE2000(user.user_lab, s.lab);
  assert.ok(d(items[0]) <= 4, `best foundation should be close to the skin, got dE ${d(items[0])}`);
  const dArr = items.slice(0, 40).map(d);
  assert.ok(Math.max(...dArr.slice(0, 5)) < mean(items.slice(-200).map(d)), "top shades are closer than the tail");
});
