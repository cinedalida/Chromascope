// Activity log helpers (docs/DERM_FEEDBACK_PLAN.md, Phase 3). Pure functions: no Firebase, so node --test can run them.
//
// An entry in users/{uid}/activity: { type, at, retake?, changes? }
//   type     "color_analysis" (written by the backend), "profile_setup" or "profile_update" (written by the app)
//   at       server time (Firestore Timestamp)
//   retake   color_analysis only: true when the user already had a result
//   changes  profile_* only: one entry per changed field, see diffProfile
// The log never holds the color result (season, LAB values, confidence) or the name itself (decisions D1, D2).

export const PROFILE_FIELDS = ["display_name", "skin_type", "concerns", "avoid_ingredients"];
const LIST_FIELDS = new Set(["concerns", "avoid_ingredients"]);

export const ACTIVITY_FILTERS = [
  { key: "all", label: "All" },
  { key: "analysis", label: "Color analysis" },
  { key: "profile", label: "Profile" },
];

const norm = (value) => String(value ?? "").trim().toLowerCase();
const asList = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : []);

/**
 * What changed between two profiles, one entry per field (only fields present in `after` are compared):
 *   { field: "display_name" }                         the name itself is not copied
 *   { field: "skin_type", to: "Oily" }
 *   { field: "concerns" | "avoid_ingredients", added: [...], removed: [...] }
 * Comparison ignores case and surrounding spaces, as the Profile page does when toggling items.
 */
export function diffProfile(before, after) {
  const prev = before || {};
  const next = after || {};
  const changes = [];
  for (const field of PROFILE_FIELDS) {
    if (!(field in next)) continue;
    if (LIST_FIELDS.has(field)) {
      const oldList = asList(prev[field]);
      const newList = asList(next[field]);
      const oldKeys = new Set(oldList.map(norm));
      const newKeys = new Set(newList.map(norm));
      const added = newList.filter((item) => !oldKeys.has(norm(item)));
      const removed = oldList.filter((item) => !newKeys.has(norm(item)));
      if (added.length || removed.length) changes.push({ field, added, removed });
    } else if (norm(prev[field]) !== norm(next[field])) {
      changes.push(field === "skin_type" ? { field, to: String(next[field] ?? "") } : { field });
    }
  }
  return changes;
}

/** A Firestore Timestamp, {seconds, nanoseconds}, Date, ISO string or epoch ms as a Date; null when unreadable. */
export function toDate(value) {
  if (value == null || value === "") return null;
  let date = null;
  if (value instanceof Date) date = value;
  else if (typeof value.toDate === "function") date = value.toDate();
  else if (typeof value === "object" && Number.isFinite(value.seconds)) {
    date = new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
  } else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

const LOCALE = "en-US";
const timeOf = (date) => date.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

/** Full date and time, e.g. "Nov 16, 2026, 3:42 PM". */
export function formatExact(date) {
  return `${date.toLocaleDateString(LOCALE, { month: "short", day: "numeric", year: "numeric" })}, ${timeOf(date)}`;
}

/**
 * Short "when" for a list: "Just now", "5 min ago", "3 hr ago" (same day), "Yesterday, 3:42 PM",
 * "Mon, 3:42 PM" (within a week), then the full date. A time slightly in the future (clock skew) is "Just now".
 */
export function formatRelative(date, now = new Date()) {
  if (!date) return "Not recorded";
  const seconds = (now - date) / 1000;
  if (seconds < 60) return "Just now";
  const days = daysBetween(date, now);
  if (days === 0) {
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`;
  }
  if (days === 1) return `Yesterday, ${timeOf(date)}`;
  if (days < 7) return `${date.toLocaleDateString(LOCALE, { weekday: "short" })}, ${timeOf(date)}`;
  return formatExact(date);
}

/** Heading for a day group: "Today", "Yesterday", or e.g. "Mon, Nov 9, 2026". */
export function dayLabel(date, now = new Date()) {
  const days = daysBetween(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** Entries (newest first) grouped by calendar day: [{ key, label, entries }]. Entries with no time go last. */
export function groupByDay(entries, now = new Date()) {
  const groups = [];
  const byKey = new Map();
  for (const entry of entries) {
    const date = toDate(entry.at);
    const key = date ? startOfDay(date).toISOString() : "none";
    if (!byKey.has(key)) {
      const group = { key, label: date ? dayLabel(date, now) : "Date not recorded", entries: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).entries.push(entry);
  }
  return groups.sort((a, b) => (a.key === "none") - (b.key === "none"));
}

export function activityCategory(entry) {
  if (entry?.type === "color_analysis") return "analysis";
  if (entry?.type === "profile_setup" || entry?.type === "profile_update") return "profile";
  if (entry?.type === "account_created") return "account";
  return "other";
}

const joinItems = (items) => items.join(", ");

function describeChange(change, isSetup) {
  switch (change.field) {
    case "display_name":
      return ["Name changed"];
    case "skin_type":
      return [isSetup ? `Skin type: ${change.to || "not set"}` : `Skin type changed to ${change.to || "not set"}`];
    case "concerns":
    case "avoid_ingredients": {
      const what = change.field === "concerns" ? "Skin concerns" : "Ingredients to avoid";
      const lines = [];
      const added = asList(change.added);
      const removed = asList(change.removed);
      if (added.length) lines.push(isSetup ? `${what}: ${joinItems(added)}` : `${what} added: ${joinItems(added)}`);
      if (removed.length) lines.push(`${what} removed: ${joinItems(removed)}`);
      return lines;
    }
    default:
      return [];
  }
}

/** Title and detail lines for one entry, e.g. { title: "Profile updated", details: ["Ingredients to avoid added: Parabens"] }. */
export function describeActivity(entry) {
  const changes = Array.isArray(entry?.changes) ? entry.changes : [];
  switch (entry?.type) {
    case "color_analysis":
      return {
        title: entry.retake ? "Color analysis retaken" : "Color analysis completed",
        details: [entry.retake ? "Your color profile was updated" : "Your color profile was created"],
      };
    case "profile_setup":
      return { title: "Profile set up", details: changes.flatMap((c) => describeChange(c, true)) };
    case "profile_update":
      return { title: "Profile updated", details: changes.flatMap((c) => describeChange(c, false)) };
    case "account_created":
      return { title: "Account created", details: [] };
    default:
      return { title: "Activity", details: [] };
  }
}
