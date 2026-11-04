import { Buffer } from "node:buffer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

// Phase A6 validation (PLAN_OPTIMIZATION.md): face photos are processed in memory and never stored.
// Uploads a >2 MB photo (large enough for the server to spool it to a temporary file) that carries a unique marker,
// then checks that no file containing that marker is left in the backend folder or the system temp folder, and that
// no image data reaches the user's record. Other programs' temp files are ignored (they don't contain the marker).
// Pending the model weights: the analysis itself stops at "model unavailable"; re-run once the weights are in.

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const API = "http://127.0.0.1:8000/api";
const DOCS = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
const SKIP_BACKEND = /[\\/](venv|node_modules|\.git|__pycache__)([\\/]|$)/;
const SKIP_TMP = /[\\/](claude|ms-playwright|playwright[^\\/]*)([\\/]|$)/i;

// Minimal PNG encoder: random pixels compress badly, so the file stays large.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function noisePng(w, h, marker) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let i = 0; i < raw.length; i++) raw[i] = i % (w * 3 + 1) === 0 ? 0 : (Math.random() * 256) | 0;
  // tEXt chunk with a unique marker, so a stored copy of THIS photo can be recognised on disk.
  const text = chunk("tEXt", Buffer.from(`Comment\0${marker}`, "latin1"));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), text,
    chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function listFiles(dir, skip) {
  const out = new Map();
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (skip.test(p)) continue;
      if (e.isDirectory()) walk(p);
      else { try { out.set(p, fs.statSync(p).mtimeMs); } catch { /* vanished */ } }
    }
  };
  walk(dir);
  return out;
}
const newOrChanged = (before, after) => [...after].filter(([p, t]) => !before.has(p) || before.get(p) !== t).map(([p]) => p);

// True if the file contains the marker (read in 1 MB chunks; a file another program holds open is skipped).
function containsMarker(file, marker) {
  const needle = Buffer.from(marker, "latin1");
  let fd;
  try { fd = fs.openSync(file, "r"); } catch { return false; }
  try {
    const buf = Buffer.alloc(1 << 20);
    let tail = Buffer.alloc(0), pos = 0, n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, pos)) > 0) {
      const hay = Buffer.concat([tail, buf.subarray(0, n)]);
      if (hay.includes(needle)) return true;
      tail = hay.subarray(Math.max(0, hay.length - needle.length)); pos += n;
    }
    return false;
  } finally { fs.closeSync(fd); }
}

test("the marker check finds a copy of the photo (self-test)", async () => {
  const marker = `selftest-${Date.now()}`;
  const f = path.join(os.tmpdir(), `chromascope-selftest-${Date.now()}.bin`);
  fs.writeFileSync(f, Buffer.concat([Buffer.alloc(3 << 20, 7), Buffer.from(`xx${marker}yy`)]));
  try {
    expect(containsMarker(f, marker)).toBe(true);           // found past the 1 MB chunk boundary
    expect(containsMarker(f, "not-in-this-file")).toBe(false);
  } finally { fs.unlinkSync(f); }
});

test("an uploaded photo leaves no copy on the server and no image data in the user's record", async ({ request }) => {
  const signUp = await request.post(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    data: { email: `nophoto-${Date.now()}@example.com`, password: "testpass123", returnSecureToken: true },
  });
  const { idToken, localId } = await signUp.json();
  const marker = `chromascope-photo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const photo = noisePng(900, 900, marker);
  expect(photo.length).toBeGreaterThan(2 * 1024 * 1024);

  const tmpDir = os.tmpdir();
  const backendBefore = listFiles(BACKEND_DIR, SKIP_BACKEND);
  const tmpBefore = listFiles(tmpDir, SKIP_TMP);

  const res = await request.post(`${API}/analyze-color`, {
    headers: { Authorization: `Bearer ${idToken}` },
    multipart: { file: { name: "face.png", mimeType: "image/png", buffer: photo } },
  });
  expect([503, 422, 200]).toContain(res.status()); // 503 until the model weights are installed

  await new Promise((r) => setTimeout(r, 1000));
  // Nothing at all may be written inside the backend folder; in the shared temp folder, only files that contain
  // this photo's marker count (other programs' temp files are ignored).
  const backendNew = newOrChanged(backendBefore, listFiles(BACKEND_DIR, SKIP_BACKEND));
  const tmpCopies = newOrChanged(tmpBefore, listFiles(tmpDir, SKIP_TMP)).filter((f) => containsMarker(f, marker));
  expect(backendNew, "files written in the backend folder").toEqual([]);
  expect(tmpCopies, "copies of the photo left in the system temp folder").toEqual([]);

  const doc = await request.get(`${DOCS}/users/${localId}`, { headers: { Authorization: "Bearer owner" } });
  const text = doc.ok() ? await doc.text() : "";
  expect(text, "user record holds no image data").not.toMatch(/bytesValue|data:image|iVBORw0KGgo|"photo|"image/);
  test.info().annotations.push({ type: "pending", description: "Full analysis path: re-run once the model weights are installed" });
});
