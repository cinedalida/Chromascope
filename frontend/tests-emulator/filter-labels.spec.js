import { test, expect } from "@playwright/test";

// Bug fix (found during Phase A4): the app's "ingredients to avoid" labels never matched the filter's keys, so 8 of
// 15 choices (incl. Fragrance, MI/MIT, PPD, Formaldehyde releasers) were silently ignored. Emulator + local backend.

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const API = "http://127.0.0.1:8000/api";

async function newUser(request, name) {
  const res = await request.post(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    data: { email: `${name}-${Date.now()}@example.com`, password: "testpass123", returnSecureToken: true },
  });
  return { headers: { Authorization: `Bearer ${(await res.json()).idToken}` } };
}
const verdictOf = (body, name) => body.safety_results.find((p) => p.product_name === name)?.verdict;

test("avoiding 'Fragrance / Parfum' (the app's label) excludes a product that contains parfum", async ({ request }) => {
  const u = await newUser(request, "avoid-fragrance");
  const res = await request.post(`${API}/run-filter`, {
    headers: u.headers,
    data: { category: "Face", skin_type: "Normal", avoid_ingredients: ["Fragrance / Parfum"] },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(verdictOf(body, "[TEST] Scented Foundation")).toBe("excluded");
  expect(verdictOf(body, "[TEST] Plain Foundation")).not.toBe("excluded");
});

test("without that choice the same product is not excluded for fragrance", async ({ request }) => {
  const u = await newUser(request, "no-avoid");
  const res = await request.post(`${API}/run-filter`, { headers: u.headers, data: { category: "Face", skin_type: "Normal" } });
  expect(verdictOf(await res.json(), "[TEST] Scented Foundation")).not.toBe("excluded");
});
