// Checks the backend's responses, speed and correctness, against the LOCAL SANDBOX only (Firestore + Auth emulators, backend :8001).
// Seed the emulator with scripts/ar-qa's test catalog first (seed_ar_products.py, plus ~1000 synthetic products for realistic sizes).
//
//   node scripts/ar-qa/backend-gate.mjs <outDir> [label]
//
// Prints sizes and timings (keep the output of a run on the old code to compare), then the checks.
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const [outDir = "backend-gate-out", label = "run"] = process.argv.slice(2);
const API = new URL(process.env.API ?? "http://127.0.0.1:8001");
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const EMAIL = "backend-gate@example.com";
const PASSWORD = "testpass123";
const CATS = ["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"];
fs.mkdirSync(outDir, { recursive: true });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const metrics = {};

// Raw HTTP so the bytes on the wire are visible (fetch hides them).
function call(method, urlPath, { headers = {}, body, gzip = false } = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      host: API.hostname, port: API.port, path: urlPath, method,
      headers: { ...(gzip ? { "accept-encoding": "gzip" } : { "accept-encoding": "identity" }), ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}), ...headers },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        const encoded = res.headers["content-encoding"] === "gzip";
        const data = encoded ? zlib.gunzipSync(raw) : raw;
        let json = null;
        try { json = JSON.parse(data.toString("utf8")); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, wire: raw.length, size: data.length, json, ms: performance.now() - start });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function token() {
  const body = JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true });
  let res = await fetch(`${AUTH}/accounts:signUp?key=fake`, { method: "POST", headers: { "content-type": "application/json" }, body });
  if (!res.ok) res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "content-type": "application/json" }, body });
  const j = await res.json();
  return { idToken: j.idToken, uid: j.localId };
}
const str = (v) => ({ stringValue: v });
const num = (v) => ({ doubleValue: v });
const arr = (list) => ({ arrayValue: { values: list } });
async function setProfile(uid, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${FIRESTORE}/users/${uid}?${mask}`, { method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`profile update failed: ${res.status}`);
}

const { idToken, uid } = await token();
await setProfile(uid, { seasonal_label: str("Soft Autumn"), user_lab: arr([60, 10, 12].map(num)), skin_type: str("normal"), concerns: arr([]), avoid_ingredients: arr([]) });
const auth = { authorization: `Bearer ${idToken}` };

// ---- warm up, so the first-request cost (products load, filter cache) is not counted in the timings
await call("GET", "/api/products", { headers: auth });
for (const c of CATS) await call("POST", "/api/run-filter", { headers: auth, body: { category: c } });

// ---- 1. products: size, compression, cache headers
const plain = await call("GET", "/api/products", { headers: auth });
const zipped = await call("GET", "/api/products", { headers: auth, gzip: true });
metrics.products = { items: plain.json?.length, rawBytes: plain.size, wirePlain: plain.wire, wireGzip: zipped.wire, encoding: zipped.headers["content-encoding"] ?? null, ms: Math.round(plain.ms), msGzip: Math.round(zipped.ms) };
console.log(`  /products: ${metrics.products.items} items, ${kb(plain.size)} as JSON; on the wire: ${kb(plain.wire)} plain, ${kb(zipped.wire)} when the client accepts gzip (content-encoding: ${metrics.products.encoding}); ${metrics.products.ms} ms`);
check("/products: gzip is used when the client accepts it, and shrinks the transfer a lot", zipped.headers["content-encoding"] === "gzip" && zipped.wire < plain.size * 0.3, `${kb(plain.size)} -> ${kb(zipped.wire)}`);
check("/products: not compressed when the client does not accept gzip", !plain.headers["content-encoding"]);
const etag = plain.headers.etag;
check("/products: has an ETag and a private Cache-Control", Boolean(etag) && /private/.test(plain.headers["cache-control"] ?? "") && /max-age=\d+/.test(plain.headers["cache-control"] ?? ""), `${etag} | ${plain.headers["cache-control"]}`);
const notModified = etag ? await call("GET", "/api/products", { headers: { ...auth, "if-none-match": etag } }) : null;
check("/products: a matching If-None-Match gets 304 with no body", notModified?.status === 304 && notModified.size === 0, `${notModified?.status}`);
const changedTag = etag ? await call("GET", "/api/products", { headers: { ...auth, "if-none-match": '"different"' } }) : null;
check("/products: a different If-None-Match gets the full list", changedTag?.status === 200 && changedTag.json?.length === plain.json?.length);

// ---- 2. auth is still required everywhere
for (const [m, p, b] of [["GET", "/api/products"], ["POST", "/api/run-filter", { category: "Lips" }], ["POST", "/api/run-filter-batch", { categories: ["Lips"] }], ["GET", "/api/catalog/summary"]]) {
  const r = await call(m, p, { body: b });
  check(`${m} ${p}: 401/403 without a token`, [401, 403].includes(r.status), `${r.status}`);
}

// ---- 3. run-filter: size, and speed of six calls one after another vs. all at once vs. one batch
const singleLips = await call("POST", "/api/run-filter", { headers: auth, body: { category: "Lips" } });
const singleLipsGz = await call("POST", "/api/run-filter", { headers: auth, body: { category: "Lips" }, gzip: true });
metrics.runFilterLips = { bytes: singleLips.size, wireGzip: singleLipsGz.wire, hasSafetyResults: "safety_results" in (singleLips.json ?? {}) };
console.log(`  /run-filter Lips: ${kb(singleLips.size)} as JSON, ${kb(singleLipsGz.wire)} with gzip; keys: ${Object.keys(singleLips.json ?? {}).join(", ")}`);
check("/run-filter: still returns safety_results and color_matched (old clients and the emulator tests)", Array.isArray(singleLips.json?.safety_results) && Array.isArray(singleLips.json?.color_matched));

const seqStart = performance.now();
const sequential = [];
for (const c of CATS) sequential.push(await call("POST", "/api/run-filter", { headers: auth, body: { category: c } }));
const seqMs = performance.now() - seqStart;
const parStart = performance.now();
const parallel = await Promise.all(CATS.map((c) => call("POST", "/api/run-filter", { headers: auth, body: { category: c } })));
const parMs = performance.now() - parStart;
metrics.sixCalls = { sequentialMs: Math.round(seqMs), concurrentMs: Math.round(parMs), bytesTotal: sequential.reduce((a, r) => a + r.size, 0) };
console.log(`  six /run-filter calls: ${Math.round(seqMs)} ms one after another, ${Math.round(parMs)} ms all at once; ${kb(metrics.sixCalls.bytesTotal)} together`);
const same = (a, b) => JSON.stringify(a.json) === JSON.stringify(b.json);
check("six concurrent calls give exactly the same answers as six sequential ones", parallel.every((r, i) => same(r, sequential[i])));

// ---- 4. batch endpoint
const b = await call("POST", "/api/run-filter-batch", { headers: auth, body: { categories: CATS } });
if (b.status === 200) {
  metrics.batch = { bytes: b.size, ms: Math.round(b.ms) };
  console.log(`  /run-filter-batch: ${kb(b.size)} as JSON, ${Math.round(b.ms)} ms (vs ${kb(metrics.sixCalls.bytesTotal)} and ${Math.round(seqMs)} ms for six single calls)`);
}
const pick = (p) => ({ id: p.product_id, verdict: p.verdict, fit: p.fit_score ?? null, shade: p.best_shade?.shade_id ?? p.best_shade?.name ?? null, basis: p.match_basis ?? null, season: p.is_season_match });
const sameList = (a, b2) => JSON.stringify((a ?? []).map(pick)) === JSON.stringify((b2 ?? []).map(pick));
check("batch: answers for all six categories under their requested names", b.status === 200 && CATS.every((c) => Array.isArray(b.json?.categories?.[c]?.color_matched)), `status ${b.status}`);
check("batch: no safety_results (every product is not sent twice)", b.status === 200 && !JSON.stringify(b.json).includes('"safety_results"'));
check("batch: same products, order, verdicts, fit and best shade as the six single calls (stored profile)", b.status === 200 && CATS.every((c, i) => sameList(b.json.categories[c].color_matched, sequential[i].json.color_matched)));
check("batch: the whole profile summary is present", b.status === 200 && b.json?.active_profile?.seasonal_label === "Soft Autumn");
check("batch: smaller than six single calls", b.status === 200 && b.size < metrics.sixCalls.bytesTotal * 0.7, `${kb(b.size)} vs ${kb(metrics.sixCalls.bytesTotal)}`);

// the same, with a different profile sent in the request (what the catalog page does)
const override = { seasonal_label: "Deep Winter", user_lab: [38, 14, 14], skin_type: "oily", avoid_ingredients: ["Fragrance / Parfum"] };
const singlesB = [];
for (const c of CATS) singlesB.push(await call("POST", "/api/run-filter", { headers: auth, body: { category: c, ...override } }));
const batchB = await call("POST", "/api/run-filter-batch", { headers: auth, body: { categories: CATS, ...override } });
check("batch: same results as single calls for a different profile sent in the request", batchB.status === 200 && CATS.every((c, i) => sameList(batchB.json.categories[c].color_matched, singlesB[i].json.color_matched)));
check("batch: the profile changes the results (not just a copy of the first)", batchB.status === 200 && !sameList(batchB.json.categories.Lips.color_matched, b.json?.categories?.Lips?.color_matched));

// bad input
const tooMany = await call("POST", "/api/run-filter-batch", { headers: auth, body: { categories: [...CATS, ...CATS] } });
const unknown = await call("POST", "/api/run-filter-batch", { headers: auth, body: { categories: ["Lips", "Nonsense"] } });
const empty = await call("POST", "/api/run-filter-batch", { headers: auth, body: { categories: [] } });
check("batch: rejects too many, empty or unknown categories with a client error, not a 500", [tooMany, unknown, empty].every((r) => r.status >= 400 && r.status < 500), `${tooMany.status}/${unknown.status}/${empty.status}`);

// ---- 5. shared state: many parallel calls, repeatedly, must not change any answer or the product list
const mixed = [];
for (let round = 0; round < 3; round += 1) {
  mixed.push(...CATS.map((c) => call("POST", "/api/run-filter", { headers: auth, body: { category: c } })));
  mixed.push(call("POST", "/api/run-filter-batch", { headers: auth, body: { categories: CATS } }));
  mixed.push(call("GET", "/api/products", { headers: auth }));
}
const results = await Promise.all(mixed);
const ok = results.every((r, i) => {
  const kind = i % 8;
  if (kind < 6) return r.status === 200 && same(r, sequential[kind]);
  if (kind === 6) return b.status !== 200 || (r.status === 200 && JSON.stringify(r.json) === JSON.stringify(b.json));
  return r.status === 200 && JSON.stringify(r.json) === JSON.stringify(plain.json);
});
check("21 mixed parallel calls (run-filter, batch, products): every answer identical to the sequential one", ok);
const after = await call("GET", "/api/products", { headers: auth });
check("the product list is unchanged after all of that (no shared cache was modified)", JSON.stringify(after.json) === JSON.stringify(plain.json));

// ---- 6. product photos (only when the backend runs with CATALOG_IMAGES_DIR holding IMAGE_FILE)
if (process.env.IMAGE_FILE) {
  const url = `/catalog-images/${process.env.IMAGE_FILE}`;
  const photo = await call("GET", url, { gzip: true });
  check("photo: served", photo.status === 200 && photo.size > 1000, `${photo.status}, ${kb(photo.size)}`);
  check("photo: not gzipped (already compressed) even when the client accepts gzip", !photo.headers["content-encoding"]);
  check("photo: long Cache-Control (a week, not immutable)", /max-age=604800/.test(photo.headers["cache-control"] ?? "") && !/immutable/.test(photo.headers["cache-control"] ?? ""), photo.headers["cache-control"]);
  const again = photo.headers.etag ? await call("GET", url, { headers: { "if-none-match": photo.headers.etag }, gzip: true }) : null;
  check("photo: a repeat check gets 304 with the same Cache-Control", again?.status === 304 && /max-age=604800/.test(again.headers["cache-control"] ?? ""), `${again?.status}`);
  const listing = await call("GET", "/catalog-images/", { gzip: true });
  check("photo folder: no directory listing", listing.status === 404 || listing.status === 307, `${listing.status}`);
  const apiAgain = await call("GET", "/api/products", { headers: auth, gzip: true });
  check("the API is still gzipped next to the photos", apiAgain.headers["content-encoding"] === "gzip");
}

fs.writeFileSync(path.join(outDir, `backend_gate_${label}.json`), JSON.stringify({ metrics, checks }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed  [${label}]`);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
