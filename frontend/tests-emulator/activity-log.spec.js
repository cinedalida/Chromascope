import { test, expect } from "@playwright/test";

// Activity log (docs/DERM_FEEDBACK_PLAN.md, Phase 3 and 4): onboarding and profile changes are logged with server
// time and show live on Home and the Activity page; the rules keep the log append-only and private; Delete account
// removes it. Emulator + local backend only.

const DOCS = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const owner = { headers: { Authorization: "Bearer owner" } };

async function signUp(page, name) {
  await page.goto("/auth");
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="email"]').fill(`activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.locator('input[name="password"]').fill("testpass123");
  await page.locator('input[name="confirmPassword"]').fill("testpass123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  return page.evaluate(async () => (await import("/src/firebase.js")).auth.currentUser?.uid);
}

async function completeOnboarding(page) {
  await page.getByText(/^Normal$/).first().click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /skip for now/i }).click();
  await page.getByRole("button", { name: /skip for now/i }).click();
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: /confirm & complete/i }).click();
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(page).toHaveURL(/\/home/);
}

// The stored entries, read with admin access, oldest first.
async function activityDocs(request, uid) {
  const res = await request.get(`${DOCS}/users/${uid}/activity`, owner);
  expect(res.ok()).toBeTruthy();
  const docs = (await res.json()).documents ?? [];
  return docs.map((d) => d.fields).sort((a, b) => a.at.timestampValue.localeCompare(b.at.timestampValue));
}

test("onboarding and profile changes are logged with server time and show live on Home and the Activity page", async ({ page, request }) => {
  const uid = await signUp(page, "Activity Tester");
  await completeOnboarding(page);

  let log = await activityDocs(request, uid);
  expect(log).toHaveLength(1);
  expect(log[0].type.stringValue).toBe("profile_setup");
  expect(log[0].at.timestampValue).toBeTruthy();
  expect(JSON.stringify(log[0].changes)).toContain("Normal");

  // Home renders the list twice (phone list and desktop table, one hidden by CSS), so text checks match visible only.
  const recent = page.locator("section").filter({ hasText: "Recent activity" });
  await expect(recent.getByText("Profile set up").locator("visible=true")).toBeVisible();
  await expect(recent.getByText("Just now").locator("visible=true").first()).toBeVisible();

  // Edit the profile in a second tab; Home in the first tab updates without a reload.
  const profileTab = await page.context().newPage();
  await profileTab.goto("/profile");
  await profileTab.getByRole("button", { name: /edit/i }).first().click();
  await profileTab.locator('input[type="text"]').first().fill("Activity Tester Two");
  await profileTab.getByRole("button", { name: /^Oily$/ }).click();
  await profileTab.getByRole("button", { name: /^Parabens$/ }).click();
  await profileTab.getByRole("button", { name: /save/i }).first().click();
  await expect(profileTab.getByText("Active Profile Data")).toBeVisible();

  await expect(recent.getByText("Profile updated").locator("visible=true")).toBeVisible();
  log = await activityDocs(request, uid);
  expect(log).toHaveLength(2);
  expect(log[1].type.stringValue).toBe("profile_update");
  const changes = JSON.stringify(log[1].changes);
  expect(changes).toContain("display_name");
  expect(changes).not.toContain("Activity Tester"); // the name itself is never copied into the log
  expect(changes).toContain("Oily");
  expect(changes).toContain("Parabens");

  // Saving with nothing changed adds no entry.
  await profileTab.getByRole("button", { name: /edit/i }).first().click();
  await profileTab.getByRole("button", { name: /save/i }).first().click();
  await expect(profileTab.getByText("Active Profile Data")).toBeVisible();
  await profileTab.waitForTimeout(1500);
  expect(await activityDocs(request, uid)).toHaveLength(2);

  // Profile links to the full log too.
  await profileTab.getByRole("button", { name: "View activity log" }).click();
  await expect(profileTab).toHaveURL(/\/activity$/);
  await profileTab.close();

  // View All opens the full log: newest first, every detail line, "Account created" at the bottom.
  await recent.getByRole("button", { name: "View All" }).click();
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.getByRole("heading", { name: "Activity log" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  const titles = page.locator("main ol > li p.font-semibold");
  await expect(titles).toHaveText(["Profile updated", "Profile set up", "Account created"]);
  for (const line of ["Name changed", "Skin type changed to Oily", "Ingredients to avoid added: Parabens", "Skin type: Normal"]) {
    await expect(page.getByText(line, { exact: true })).toBeVisible();
  }

  // Filters.
  const filters = page.getByRole("group", { name: "Show" });
  await filters.getByRole("button", { name: "Color analysis" }).click();
  await expect(page.getByText("Nothing of this kind yet.")).toBeVisible();
  await filters.getByRole("button", { name: "Profile" }).click();
  await expect(titles).toHaveText(["Profile updated", "Profile set up"]);
});

test("rules: the browser can only append profile entries to its own log, stamped with server time", async ({ page }) => {
  const uid = await signUp(page, "Rules Tester");
  const results = await page.evaluate(async (myUid) => {
    // The same Firestore module and database the app uses (Vite's pre-bundled copy, found through the service).
    const src = await (await fetch("/src/services/activityService.js")).text();
    const fs = await import(src.match(/from\s+"([^"]*firebase_firestore[^"]*)"/)[1]);
    const { db } = await import("/src/firebase.js");
    const mine = fs.collection(db, "users", myUid, "activity");
    const theirs = fs.collection(db, "users", "someone-else", "activity");
    const attempt = async (fn) => {
      try {
        await fn();
        return "ok";
      } catch (error) {
        return error.code || String(error);
      }
    };
    const valid = { type: "profile_update", at: fs.serverTimestamp(), changes: [] };
    const entry = fs.doc(mine);
    return {
      validEntry: await attempt(() => fs.setDoc(entry, valid)),
      colorAnalysisFromBrowser: await attempt(() => fs.addDoc(mine, { ...valid, type: "color_analysis" })),
      clientChosenTime: await attempt(() => fs.addDoc(mine, { ...valid, at: fs.Timestamp.fromDate(new Date(2020, 0, 1)) })),
      extraField: await attempt(() => fs.addDoc(mine, { ...valid, season: "Deep Winter" })),
      missingChanges: await attempt(() => fs.addDoc(mine, { type: "profile_update", at: fs.serverTimestamp() })),
      fiveChanges: await attempt(() => fs.addDoc(mine, { ...valid, changes: [1, 2, 3, 4, 5].map(() => ({ field: "skin_type" })) })),
      editEntry: await attempt(() => fs.updateDoc(entry, { changes: [{ field: "display_name" }] })),
      deleteEntry: await attempt(() => fs.deleteDoc(entry)),
      readOwn: await attempt(() => fs.getDocs(mine)),
      readOthers: await attempt(() => fs.getDocs(theirs)),
      writeOthers: await attempt(() => fs.addDoc(theirs, valid)),
    };
  }, uid);
  expect(results).toEqual({
    validEntry: "ok",
    colorAnalysisFromBrowser: "permission-denied",
    clientChosenTime: "permission-denied",
    extraField: "permission-denied",
    missingChanges: "permission-denied",
    fiveChanges: "permission-denied",
    editEntry: "permission-denied",
    deleteEntry: "permission-denied",
    readOwn: "ok",
    readOthers: "permission-denied",
    writeOthers: "permission-denied",
  });
});

test("Delete account removes the activity log with the profile", async ({ page, request }) => {
  const uid = await signUp(page, "Delete Log Tester");
  await completeOnboarding(page);
  expect(await activityDocs(request, uid)).toHaveLength(1);

  await page.goto("/profile");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);

  expect((await request.get(`${DOCS}/users/${uid}`, owner)).status()).toBe(404);
  expect(await activityDocs(request, uid)).toHaveLength(0);
});
