// `npm run dev:local`: the whole app on this computer, in a SANDBOX (no real Firebase data is ever touched).
//   1. Firebase emulators (Auth + Firestore, project "demo-chromascope") with a small [TEST] product catalog
//   2. the backend in emulator mode (http://127.0.0.1:8000)
//   3. the app (http://localhost:5173)
// Open http://localhost:5173 in Chrome; for the phone view press F12, then Ctrl+Shift+M and pick a phone.
// Ctrl+C stops everything. Accounts you create here vanish when it stops.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  GCLOUD_PROJECT: "demo-chromascope",
  PRODUCTS_COLLECTION: "products", // the sandbox catalog is loaded here (the backend default is products_v2)
};
// --full-catalog: also load the scraped catalog (chromascope-data/derived/app_catalog.json, built by
// backend/scripts/build_catalog.py) into the sandbox. Set CHROMASCOPE_DATA_DIR if the data repo is elsewhere.
if (process.argv.includes("--full-catalog")) {
  const dataDir = env.CHROMASCOPE_DATA_DIR || path.resolve(frontendDir, "../../chromascope-data");
  env.CATALOG_JSON = path.join(dataDir, "derived", "app_catalog.json");
  env.CATALOG_IMAGES_DIR = path.join(dataDir, "derived", "catalog_images"); // photos served by the backend
  console.log(`Full catalog: ${env.CATALOG_JSON}`);
}
// The Firestore emulator needs Java 21; use JAVA_HOME if it is set but not on PATH yet.
if (env.JAVA_HOME) env.PATH = `${path.join(env.JAVA_HOME, "bin")}${path.delimiter}${env.PATH}`;

const children = [];
function start(name, command, args, opts = {}) {
  const child = spawn(command, args, { cwd: frontendDir, env, stdio: ["ignore", "pipe", "pipe"], ...opts });
  const tag = `[${name}]`.padEnd(11);
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (buf) => {
      for (const line of buf.toString().split(/\r?\n/)) if (line.trim()) console.log(`${tag} ${line}`);
    });
  }
  child.on("exit", (code) => {
    console.log(`${tag} stopped (exit ${code})`);
    if (!stopping) shutdown(1);
  });
  children.push(child);
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping the sandbox...");
  for (const c of children) {
    if (c.exitCode === null) {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
      else c.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 1500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting the Chromascope sandbox (emulators, backend, app)...\n");
start("emulators", "npx", ["firebase", "emulators:start", "--only", "auth,firestore", "--project", "demo-chromascope",
  "--config", "../firebase.json"], { shell: true });
start("backend", process.execPath, [path.join(frontendDir, "scripts", "start-test-backend.mjs")]);
start("app", "npx", ["vite", "--mode", "emulators", "--port", "5173", "--strictPort"], { shell: true });
console.log("App: http://localhost:5173  |  Emulator dashboard: http://127.0.0.1:4000  |  Ctrl+C to stop\n");
