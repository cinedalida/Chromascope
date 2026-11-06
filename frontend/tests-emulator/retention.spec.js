import { test, expect } from "@playwright/test";

// Phase A12 validation (decision D2): face data of users inactive for 30+ days is deleted daily; everything else stays.
// Emulator + local backend (CRON_SECRET=test-cron-secret, set in playwright.emulator.config.js).

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const API = "http://127.0.0.1:8000";
const DOCS = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const owner = { Authorization: "Bearer owner" };
const DAY = 24 * 3600 * 1000;
const stamp = Date.now();

const face = {
  seasonal_label: { stringValue: "Deep Winter" },
  user_lab: { arrayValue: { values: [{ doubleValue: 60 }, { doubleValue: 10 }, { doubleValue: 12 }] } },
  season_confidence_level: { doubleValue: 80 },
  avoid_ingredients: { arrayValue: { values: [{ stringValue: "Fragrance / Parfum" }] } },
};
const ts = (msAgo) => ({ timestampValue: new Date(Date.now() - msAgo).toISOString() });
const iso = (msAgo) => ({ stringValue: new Date(Date.now() - msAgo).toISOString() });

async function put(request, id, fields) {
  const res = await request.patch(`${DOCS}/users/${id}`, { headers: owner, data: { fields } });
  expect(res.ok(), await res.text()).toBeTruthy();
}
const get = async (request, id) => (await (await request.get(`${DOCS}/users/${id}`, { headers: owner })).json()).fields;
const purge = (request, secret) => request.post(`${API}/internal/retention/purge-face-data`,
  { headers: secret === undefined ? {} : { "X-Cron-Secret": secret } });

test("the retention job is locked without the right secret", async ({ request }) => {
  expect((await purge(request)).status()).toBe(403);
  expect((await purge(request, "wrong")).status()).toBe(403);
});

test("face data is deleted after 30 days of inactivity; account and allergies are kept", async ({ request }) => {
  const ids = { old: `ret-old-${stamp}`, recent: `ret-29d-${stamp}`, today: `ret-today-${stamp}`,
    legacy: `ret-legacy-${stamp}`, nodate: `ret-nodate-${stamp}` };
  await put(request, ids.old, { ...face, display_name: { stringValue: "Old" }, last_active: ts(31 * DAY) });
  await put(request, ids.recent, { ...face, display_name: { stringValue: "Recent" }, last_active: ts(29 * DAY) });
  await put(request, ids.today, { ...face, display_name: { stringValue: "Today" }, last_active: ts(0) });
  // Accounts from before last_active existed: fall back to their newest date (here created_at, 40 days ago).
  await put(request, ids.legacy, { ...face, display_name: { stringValue: "Legacy" }, created_at: iso(40 * DAY) });
  // No date at all: never deleted blindly.
  await put(request, ids.nodate, { ...face, display_name: { stringValue: "No date" } });

  const res = await purge(request, "test-cron-secret");
  expect(res.status()).toBe(200);
  const stats = await res.json();
  expect(stats.cleared).toBeGreaterThanOrEqual(2);
  expect(stats.no_activity_date).toBeGreaterThanOrEqual(1);

  for (const id of [ids.old, ids.legacy]) {
    const f = await get(request, id);
    expect(f.seasonal_label, `${id}: season removed`).toBeUndefined();
    expect(f.user_lab, `${id}: skin colour removed`).toBeUndefined();
    expect(f.season_confidence_level).toBeUndefined();
    expect(f.face_data_deleted_at?.timestampValue).toBeTruthy();
    expect(f.display_name).toBeDefined();                                        // account kept
    expect(f.avoid_ingredients.arrayValue.values[0].stringValue).toBe("Fragrance / Parfum"); // allergies kept
  }
  for (const id of [ids.recent, ids.today, ids.nodate]) {
    const f = await get(request, id);
    expect(f.seasonal_label?.stringValue, `${id}: untouched`).toBe("Deep Winter");
    expect(f.user_lab).toBeDefined();
  }
});

test("opening the app records activity (last_active)", async ({ request }) => {
  const res = await request.post(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    data: { email: `active-${stamp}@example.com`, password: "testpass123", returnSecureToken: true },
  });
  const { idToken, localId } = await res.json();
  await put(request, localId, { display_name: { stringValue: "Active" } });
  expect((await request.post(`${API}/api/user/active`, { headers: { Authorization: `Bearer ${idToken}` } })).status()).toBe(200);
  const f = await get(request, localId);
  expect(f.last_active?.timestampValue).toBeTruthy();
  expect(Date.now() - Date.parse(f.last_active.timestampValue)).toBeLessThan(60_000);
});
