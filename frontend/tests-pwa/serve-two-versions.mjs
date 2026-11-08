// Test-only static server for the update prompt test (docs/PWA_PLAN.md, Phase 3).
// Serves the production build in ../dist like `vite preview`, but can switch to a "new version":
// after POST /__test/new-version, sw.js gets one extra comment line, so the browser sees an update.
// Playwright cannot intercept the browser's own sw.js update check, so this stands in for a redeploy.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = Number(process.env.PORT ?? 4174);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

let version = 1;

async function send(res, path) {
  let body = await readFile(path);
  if (path === join(DIST, "sw.js") && version > 1) body = Buffer.concat([body, Buffer.from(`\n// version ${version}\n`)]);
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "cache-control": "no-cache" });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(PORT);

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // Readiness check for Playwright: 503 until the build exists (the :4173 server builds it first).
  if (url.pathname === "/__test/ping") {
    const ready = await stat(join(DIST, "sw.js")).then(() => true, () => false);
    res.writeHead(ready ? 204 : 503).end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/__test/new-version") {
    version += 1;
    res.writeHead(204).end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/__test/reset") {
    version = 1;
    res.writeHead(204).end();
    return;
  }

  const file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(normalize(DIST))) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isFile()) return await send(res, file);
  } catch {
    // not a file: fall through to the app page
  }
  if (extname(url.pathname)) {
    res.writeHead(404).end();
    return;
  }
  await send(res, join(DIST, "index.html"));
}
