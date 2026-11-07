import { test, expect } from "@playwright/test";

// Phase A2 validation (PLAN_OPTIMIZATION.md): Firestore rules isolate users. Emulator only (demo-chromascope).
// Talks to the emulators' REST APIs directly with each user's own ID token, the same access the browser has.

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const DOCS = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const API = "http://127.0.0.1:8000/api";
const stamp = Date.now();

async function signUp(request, name) {
  const res = await request.post(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    data: { email: `${name}-${stamp}@example.com`, password: "testpass123", returnSecureToken: true },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const b = await res.json();
  return { uid: b.localId, token: b.idToken, email: b.email };
}
const auth = (u) => (u ? { Authorization: `Bearer ${u.token}` } : {});
const str = (v) => ({ stringValue: v });
const userDoc = (u, extra = {}) => ({
  fields: { display_name: str("Test User"), email: str(u.email), profile_completed: { booleanValue: false },
    concerns: { arrayValue: {} }, avoid_ingredients: { arrayValue: {} }, ...extra },
});

test.describe.configure({ mode: "serial" });
let A, B;

test("each user can create and read only their own record", async ({ request }) => {
  A = await signUp(request, "usera");
  B = await signUp(request, "userb");
  for (const u of [A, B]) {
    const created = await request.patch(`${DOCS}/users/${u.uid}`, { headers: auth(u), data: userDoc(u) });
    expect(created.status(), await created.text()).toBe(200);
  }
  expect((await request.get(`${DOCS}/users/${A.uid}`, { headers: auth(A) })).status()).toBe(200);
});

test("user B cannot read, change or delete user A's record", async ({ request }) => {
  expect((await request.get(`${DOCS}/users/${A.uid}`, { headers: auth(B) })).status()).toBe(403);
  const edit = await request.patch(`${DOCS}/users/${A.uid}?updateMask.fieldPaths=display_name`, {
    headers: auth(B), data: { fields: { display_name: str("hacked") } },
  });
  expect(edit.status()).toBe(403);
  expect((await request.delete(`${DOCS}/users/${A.uid}`, { headers: auth(B) })).status()).toBe(403);
  // A's record is unchanged.
  const a = await (await request.get(`${DOCS}/users/${A.uid}`, { headers: auth(A) })).json();
  expect(a.fields.display_name.stringValue).toBe("Test User");
});

test("no one can list all users, and logged-out requests are refused", async ({ request }) => {
  expect((await request.get(`${DOCS}/users`, { headers: auth(B) })).status()).toBe(403);
  expect((await request.get(`${DOCS}/users/${A.uid}`)).status()).toBe(403);
  expect((await request.get(`${DOCS}/products`)).status()).toBe(403);
});

test("a user cannot fake an analysis result or add unknown fields", async ({ request }) => {
  const fakeSeason = await request.patch(`${DOCS}/users/${A.uid}?updateMask.fieldPaths=seasonal_label`, {
    headers: auth(A), data: { fields: { seasonal_label: str("true_winter") } },
  });
  expect(fakeSeason.status()).toBe(403);
  const extra = await request.patch(`${DOCS}/users/${A.uid}?updateMask.fieldPaths=is_admin`, {
    headers: auth(A), data: { fields: { is_admin: { booleanValue: true } } },
  });
  expect(extra.status()).toBe(403);
  const tooLong = await request.patch(`${DOCS}/users/${A.uid}?updateMask.fieldPaths=display_name`, {
    headers: auth(A), data: { fields: { display_name: str("x".repeat(500)) } },
  });
  expect(tooLong.status()).toBe(403);
  // A normal profile edit still works.
  const ok = await request.patch(`${DOCS}/users/${A.uid}?updateMask.fieldPaths=skin_type`, {
    headers: auth(A), data: { fields: { skin_type: str("oily") } },
  });
  expect(ok.status()).toBe(200);
});

test("products are readable when signed in; server-only collections are not", async ({ request }) => {
  expect((await request.get(`${DOCS}/products`, { headers: auth(A) })).status()).toBe(200);
  for (const c of ["ingredients", "safety_profiles", "synergy_pairs"]) {
    expect((await request.get(`${DOCS}/${c}`, { headers: auth(A) })).status(), c).toBe(403);
  }
});

test("the API uses only the caller's own profile and refuses missing tokens", async ({ request }) => {
  expect([401, 403]).toContain((await request.post(`${API}/run-filter`, { data: { category: "Face" } })).status());
  // B's request reads B's profile (skin type unset -> normal), never A's (oily).
  const res = await request.post(`${API}/run-filter`, { headers: auth(B), data: { category: "Face" } });
  expect(res.status()).toBe(200);
  expect((await res.json()).active_profile.skin_type).toBe("normal");
});
