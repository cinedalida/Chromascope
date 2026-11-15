// The signed-in user's activity log, users/{uid}/activity (docs/DERM_FEEDBACK_PLAN.md, Phase 3).
// Append-only: the app adds profile entries in the same batch as the profile change; the backend adds color analysis
// entries when it saves a result. Nobody edits or deletes an entry, except Delete account (backend, all of them).
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { diffProfile } from "../utils/activityLog";

const activityRef = (uid) => collection(db, "users", uid, "activity");

/**
 * Live view of the newest `max` entries. onChange(entries, hasMore) runs now and after every change, including this
 * device's own writes before the server confirms them (their time is then the local estimate). Returns unsubscribe.
 */
export function subscribeActivity(uid, max, onChange, onError) {
  const newest = query(activityRef(uid), orderBy("at", "desc"), limit(max + 1));
  return onSnapshot(
    newest,
    (snapshot) => {
      const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
      onChange(entries.slice(0, max), entries.length > max);
    },
    (error) => onError?.(error),
  );
}

/**
 * Saves a profile change and its log entry together (both or neither). `before` is the profile as it was, so only
 * real changes are logged; an update that changes nothing writes no entry. Setup is always logged.
 */
export async function saveProfileWithActivity(uid, profileData, before, type = "profile_update") {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), profileData);
  const changes = diffProfile(before, profileData);
  if (type === "profile_setup" || changes.length) {
    batch.set(doc(activityRef(uid)), { type, at: serverTimestamp(), changes });
  }
  await batch.commit();
  return changes;
}
