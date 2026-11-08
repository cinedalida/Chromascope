// Repeated timing of the backend against the LOCAL SANDBOX only, to compare two builds (e.g. old code on :8002, new on :8001).
//
//   API=http://127.0.0.1:8001 node scripts/ar-qa/backend-perf.mjs [runs]
//
// For each of N runs: six /run-filter calls one after another, six at once, one /run-filter-batch (if the build has it),
// and how long a cheap GET / takes while the six concurrent calls are running (does the server stay responsive?).
import http from "node:http";

const API = new URL(process.env.API ?? "http://127.0.0.1:8001");
const RUNS = Number(process.argv[2] ?? 5);
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const CATS = ["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"];

function call(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({ host: API.hostname, port: API.port, path, method, headers: {
      "accept-encoding": "identity", ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}) } }, (res) => {
      let n = 0;
      res.on("data", (c) => { n += c.length; });
      res.on("end", () => resolve({ status: res.statusCode, ms: performance.now() - start, bytes: n }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const r = (n) => Math.round(n);

const sign = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "backend-gate@example.com", password: "testpass123", returnSecureToken: true }) });
const { idToken: token } = await sign.json();
const filter = (c) => call("POST", "/api/run-filter", { token, body: { category: c } });

for (const c of CATS) await filter(c); // warm up
const seq = [], par = [], batch = [], ping = [], pingMax = [];
for (let i = 0; i < RUNS; i += 1) {
  let t = performance.now();
  for (const c of CATS) await filter(c);
  seq.push(performance.now() - t);

  t = performance.now();
  const pings = [];
  const load = Promise.all(CATS.map((c) => filter(c)));
  const probe = (async () => { for (let k = 0; k < 8; k += 1) { await new Promise((s) => setTimeout(s, 60)); pings.push((await call("GET", "/")).ms); } })();
  await Promise.all([load, probe]);
  par.push(performance.now() - t);
  ping.push(median(pings));
  pingMax.push(Math.max(...pings));

  const b = await call("POST", "/api/run-filter-batch", { token, body: { categories: CATS } });
  if (b.status === 200) batch.push(b.ms);
}
console.log(`${API.origin}  (median of ${RUNS} runs, ms)`);
console.log(`  six calls one after another : ${r(median(seq))}`);
console.log(`  six calls at once           : ${r(median(par))}`);
console.log(`  one batch call              : ${batch.length ? r(median(batch)) : "not available"}`);
console.log(`  GET / while the six run     : median ${r(median(ping))}, worst ${r(median(pingMax))}  (a cheap request; shows whether the server stays responsive)`);
