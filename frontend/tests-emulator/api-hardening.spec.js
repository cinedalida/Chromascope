import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

// Phase A4 + A5 validation (PLAN_OPTIMIZATION.md): input validation, generic errors, CORS, upload limits,
// rate limiting and signed analysis results. Emulator + local backend only.

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const API = "http://127.0.0.1:8000/api";
const stamp = Date.now();
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function newUser(request, name) {
  const res = await request.post(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    data: { email: `${name}-${stamp}@example.com`, password: "testpass123", returnSecureToken: true },
  });
  const b = await res.json();
  return { uid: b.localId, headers: { Authorization: `Bearer ${b.idToken}` } };
}
const upload = (request, user, buffer, name = "photo.png", mimeType = "image/png") =>
  request.post(`${API}/analyze-color`, { headers: user.headers, multipart: { file: { name, mimeType, buffer } } });

test("filter and profile requests are validated", async ({ request }) => {
  const u = await newUser(request, "validate");
  const filter = (data) => request.post(`${API}/run-filter`, { headers: u.headers, data });
  expect((await filter({ category: "Face", skin_type: "Normal", seasonal_label: "Deep Autumn" })).status()).toBe(200);
  expect((await filter({ category: "Face", skin_type: "alien" })).status()).toBe(422);
  expect((await filter({ category: "Weapons" })).status()).toBe(422);
  expect((await filter({ category: "Face", concerns: Array(21).fill("x") })).status()).toBe(422);
  expect((await filter({ category: "Face", is_admin: true })).status()).toBe(422);

  const profile = (data) => request.patch(`${API}/user/profile`, { headers: u.headers, data });
  expect((await profile({ display_name: "Ana", skin_type: "Oily" })).status()).toBe(200);
  expect((await profile({ display_name: "x".repeat(81) })).status()).toBe(422);
  expect((await profile({ seasonal_label: "Deep Winter" })).status(), "season can't be set via profile").toBe(422);
  expect((await profile({ user_lab: [60, 10, 20] })).status()).toBe(422);
  expect((await profile({ dob: "2000-01-01" })).status(), "date of birth is no longer collected").toBe(422);
});

test("catalog and ingredient endpoints require login", async ({ request }) => {
  const u = await newUser(request, "catalog");
  for (const path of ["/products", "/ingredients"]) {
    expect([401, 403], `${path} without login`).toContain((await request.get(API + path)).status());
    expect((await request.get(API + path, { headers: u.headers })).status(), `${path} with login`).toBe(200);
  }
});

test("errors do not leak internals", async ({ request }) => {
  const res = await request.get(`${API}/products`, { headers: { Authorization: "Bearer not-a-real-token" } });
  expect(res.status()).toBe(401);
  expect((await res.json()).detail).toBe("Please log in again.");
});

test("CORS allows only the app's own sites", async ({ request }) => {
  const preflight = (origin) => request.fetch(`${API}/run-filter`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
  });
  const ok = await preflight("http://localhost:5174");
  expect(ok.headers()["access-control-allow-origin"]).toBe("http://localhost:5174");
  const evil = await preflight("https://evil.example");
  expect(evil.headers()["access-control-allow-origin"]).toBeUndefined();
});

test("uploads: size, type and contents are checked", async ({ request }) => {
  const u = await newUser(request, "upload");
  const big = await upload(request, u, Buffer.alloc(9 * 1024 * 1024, 1));
  expect(big.status()).toBe(413);
  expect((await big.json()).detail.code).toBe("file_too_large");
  const text = await upload(request, u, Buffer.from("this is not an image"), "fake.png");
  expect(text.status()).toBe(422);
  expect((await text.json()).detail.code).toBe("invalid_image");
  const gif = await upload(request, u, Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), "x.gif", "image/gif");
  expect(gif.status(), "GIF is not an accepted photo format").toBe(422);
  // A real PNG passes validation and reaches the model (503 here: no weights on this machine).
  expect((await upload(request, u, PNG_1PX)).status()).toBe(503);
});

test("analysis is limited to 10 per user per hour", async ({ request }) => {
  const u = await newUser(request, "ratelimit");
  for (let i = 1; i <= 10; i++) expect((await upload(request, u, PNG_1PX)).status(), `request ${i}`).toBe(503);
  const eleventh = await upload(request, u, PNG_1PX);
  expect(eleventh.status()).toBe(429);
  expect((await eleventh.json()).detail.code).toBe("rate_limited");
  expect(Number(eleventh.headers()["retry-after"])).toBeGreaterThan(0);
  // Another user is not affected.
  const other = await newUser(request, "ratelimit-other");
  expect((await upload(request, other, PNG_1PX)).status()).toBe(503);
});

test("a made-up analysis result cannot be saved", async ({ request }) => {
  const u = await newUser(request, "fakeresult");
  const res = await request.post(`${API}/user/analysis-result`, {
    headers: u.headers,
    data: { season: "Deep Winter", lab_color: [50, 5, 5], confidence: 99, result_token: `${Math.floor(Date.now() / 1000) + 600}.deadbeef` },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).detail.code).toBe("invalid_result");
  test.info().annotations.push({ type: "pending", description: "Saving a GENUINE result needs a successful analysis (model weights)" });
});
