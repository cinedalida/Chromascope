// Checks vercel.json's caching rules and that they are safe for the files a build produces. No network, no servers.
//
//   node scripts/ar-qa/static-gate.mjs <dist>        (a production build: `vite build`)
//
// "immutable" tells a browser never to re-check a file for a year, which is only safe when the file name changes with its
// content. So the rule for /assets/ is accepted only if EVERY file in dist/assets has a content hash in its name.
import fs from "node:fs";
import path from "node:path";

const dist = process.argv[2];
if (!dist || !fs.existsSync(path.join(dist, "assets"))) {
  console.error("usage: node scripts/ar-qa/static-gate.mjs <dist built with `vite build`>");
  process.exit(2);
}
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const raw = fs.readFileSync(new URL("../../vercel.json", import.meta.url), "utf8");
let config = null;
try { config = JSON.parse(raw); } catch (error) { check("vercel.json is valid JSON", false, String(error)); }
if (config) {
  check("vercel.json is valid JSON", true);
  const rules = config.headers ?? [];
  const rule = (source) => rules.find((r) => r.source === source);
  const cacheControl = (r) => r?.headers?.find((h) => h.key.toLowerCase() === "cache-control")?.value ?? "";

  check("the service worker rule is still first and still never cached", rules[0]?.source === "/sw.js" && /max-age=0/.test(cacheControl(rules[0])) && /must-revalidate/.test(cacheControl(rules[0])), cacheControl(rules[0]));
  check("hashed /assets/ files are kept for a year and marked immutable", /max-age=31536000/.test(cacheControl(rule("/assets/(.*)"))) && /immutable/.test(cacheControl(rule("/assets/(.*)"))), cacheControl(rule("/assets/(.*)")));
  const photos = cacheControl(rule("/product-images/(.*)"));
  check("product photos are kept a week, not immutable (their names are reused)", /max-age=604800/.test(photos) && !/immutable/.test(photos), photos);
  check("the single-page-app rewrite is unchanged", JSON.stringify(config.rewrites) === JSON.stringify([{ source: "/((?!api/)[^.]*)", destination: "/index.html" }]));
  check("no rule matches the app page itself or /data (those must stay revalidated)", rules.every((r) => !/^\/(index\.html|data|\(\.\*\))/.test(r.source) && r.source !== "/(.*)"));

  const files = fs.readdirSync(path.join(dist, "assets"));
  const unhashed = files.filter((f) => !/-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/.test(f));
  check("every file in dist/assets has a content hash in its name (so 'immutable' is safe)", unhashed.length === 0, unhashed.length ? `unhashed: ${unhashed.slice(0, 5).join(", ")}` : `${files.length} files`);
  const index = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  const referenced = [...index.matchAll(/\/assets\/([^"']+)/g)].map((m) => m[1]);
  check("index.html (served revalidated) points only at hashed files", referenced.length > 0 && referenced.every((f) => files.includes(f) && /-[A-Za-z0-9_-]{8}\./.test(f)), `${referenced.length} references`);
}
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
