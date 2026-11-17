// Run with: node --test src/utils/activityLog.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { AVOID_INGREDIENTS, SKIN_CONCERNS, SKIN_TYPES } from "../constants/profileOptions.js";
import {
  activityCategory, dayLabel, describeActivity, diffProfile, formatExact, formatRelative, groupByDay, toDate,
} from "./activityLog.js";

test("diffProfile: one entry per changed field, name never copied", () => {
  const before = {
    display_name: "Ana Cruz",
    skin_type: SKIN_TYPES[0],
    concerns: [SKIN_CONCERNS[0]],
    avoid_ingredients: [AVOID_INGREDIENTS[0], AVOID_INGREDIENTS[1]],
  };
  const after = {
    display_name: "Ana C.",
    skin_type: SKIN_TYPES[1],
    concerns: [SKIN_CONCERNS[0], SKIN_CONCERNS[2]],
    avoid_ingredients: [AVOID_INGREDIENTS[1], AVOID_INGREDIENTS[4]],
    updated_at: "2026-11-16T00:00:00.000Z",
  };
  assert.deepEqual(diffProfile(before, after), [
    { field: "display_name" },
    { field: "skin_type", to: "Oily" },
    { field: "concerns", added: ["Eczema"], removed: [] },
    { field: "avoid_ingredients", added: ["Lanolin"], removed: ["Fragrance / Parfum"] },
  ]);
  assert.ok(!JSON.stringify(diffProfile(before, after)).includes("Ana"));
});

test("diffProfile: no changes, case and spaces ignored, fields missing from `after` skipped", () => {
  const profile = { display_name: "Ana", skin_type: "Dry", concerns: ["Rosacea"], avoid_ingredients: ["Parabens"] };
  assert.deepEqual(diffProfile(profile, { ...profile }), []);
  assert.deepEqual(diffProfile(profile, { display_name: " ana ", skin_type: "dry", concerns: ["rosacea"] }), []);
  assert.deepEqual(diffProfile(profile, { skin_type: "Dry" }), []);
});

test("diffProfile: first setup (no previous profile) lists everything as added", () => {
  const setup = { skin_type: "Combination", concerns: ["Sensitive"], avoid_ingredients: ["Parabens", "Silicones"] };
  assert.deepEqual(diffProfile(undefined, setup), [
    { field: "skin_type", to: "Combination" },
    { field: "concerns", added: ["Sensitive"], removed: [] },
    { field: "avoid_ingredients", added: ["Parabens", "Silicones"], removed: [] },
  ]);
  assert.deepEqual(diffProfile({}, { concerns: [], avoid_ingredients: [] }), []);
});

test("diffProfile: never more than 4 entries (firestore.rules allows at most 4)", () => {
  const all = { display_name: "x", skin_type: "Oily", concerns: SKIN_CONCERNS, avoid_ingredients: AVOID_INGREDIENTS };
  assert.equal(diffProfile({}, all).length, 4);
});

test("toDate reads Firestore Timestamps, {seconds}, ISO strings and Dates", () => {
  const ms = Date.UTC(2026, 10, 16, 7, 42, 0);
  assert.equal(toDate({ toDate: () => new Date(ms) }).getTime(), ms);
  assert.equal(toDate({ seconds: ms / 1000, nanoseconds: 5e8 }).getTime(), ms + 500);
  assert.equal(toDate("2026-11-16T07:42:00.000Z").getTime(), ms);
  assert.equal(toDate(new Date(ms)).getTime(), ms);
  assert.equal(toDate(ms).getTime(), ms);
  for (const bad of [null, undefined, "", "not a date", {}]) assert.equal(toDate(bad), null);
});

test("formatRelative: just now, minutes, hours, yesterday, weekday, then full date", () => {
  const now = new Date(2026, 10, 16, 15, 42);
  const at = (d, h, m) => new Date(2026, 10, d, h, m);
  assert.equal(formatRelative(at(16, 15, 41), now), "1 min ago");
  assert.equal(formatRelative(new Date(now - 20 * 1000), now), "Just now");
  assert.equal(formatRelative(new Date(now.getTime() + 5000), now), "Just now");
  assert.equal(formatRelative(at(16, 15, 2), now), "40 min ago");
  assert.equal(formatRelative(at(16, 9, 0), now), "6 hr ago");
  assert.equal(formatRelative(at(15, 23, 50), now), "Yesterday, 11:50 PM");
  assert.equal(formatRelative(at(12, 8, 5), now), "Thu, 8:05 AM");
  assert.equal(formatRelative(at(2, 8, 5), now), "Nov 2, 2026, 8:05 AM");
  assert.equal(formatRelative(null, now), "Not recorded");
  assert.equal(formatExact(at(16, 15, 42)), "Nov 16, 2026, 3:42 PM");
});

test("dayLabel and groupByDay: newest first, entries without a time last", () => {
  const now = new Date(2026, 10, 16, 10, 0);
  assert.equal(dayLabel(new Date(2026, 10, 16, 0, 1), now), "Today");
  assert.equal(dayLabel(new Date(2026, 10, 15, 23, 59), now), "Yesterday");
  assert.equal(dayLabel(new Date(2026, 10, 9, 12, 0), now), "Mon, Nov 9, 2026");
  const entries = [
    { id: "a", at: new Date(2026, 10, 16, 9, 0) },
    { id: "b", at: new Date(2026, 10, 16, 8, 0) },
    { id: "x", at: null },
    { id: "c", at: new Date(2026, 10, 14, 8, 0) },
  ];
  const groups = groupByDay(entries, now);
  assert.deepEqual(groups.map((g) => g.label), ["Today", "Sat, Nov 14, 2026", "Date not recorded"]);
  assert.deepEqual(groups[0].entries.map((e) => e.id), ["a", "b"]);
});

test("describeActivity and activityCategory", () => {
  assert.deepEqual(describeActivity({ type: "color_analysis", retake: false }), {
    title: "Color analysis completed", details: ["Your color profile was created"],
  });
  assert.equal(describeActivity({ type: "color_analysis", retake: true }).title, "Color analysis retaken");
  assert.deepEqual(
    describeActivity({
      type: "profile_update",
      changes: [
        { field: "display_name" },
        { field: "skin_type", to: "Dry" },
        { field: "avoid_ingredients", added: ["Parabens", "Lanolin"], removed: ["Silicones"] },
      ],
    }).details,
    ["Name changed", "Skin type changed to Dry", "Ingredients to avoid added: Parabens, Lanolin", "Ingredients to avoid removed: Silicones"],
  );
  assert.deepEqual(
    describeActivity({ type: "profile_setup", changes: [{ field: "concerns", added: ["Rosacea"], removed: [] }] }),
    { title: "Profile set up", details: ["Skin concerns: Rosacea"] },
  );
  assert.equal(describeActivity({ type: "account_created" }).title, "Account created");
  assert.equal(describeActivity({ type: "something_else" }).title, "Activity");
  assert.equal(describeActivity({ type: "profile_update", changes: "bad" }).details.length, 0);
  assert.equal(activityCategory({ type: "color_analysis" }), "analysis");
  assert.equal(activityCategory({ type: "profile_setup" }), "profile");
  assert.equal(activityCategory({ type: "profile_update" }), "profile");
  assert.equal(activityCategory({ type: "account_created" }), "account");
});
