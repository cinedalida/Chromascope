"""30-day auto-delete of face data (PLAN_OPTIMIZATION.md, Phase A12; decision D2).

The consent screen promises: "If you don't use Chromascope for 30 days, we permanently delete your photos and face
data." Photos are never stored (Phase A6), so this removes the FACE-DERIVED data of inactive users: seasonal_label,
user_lab and season_confidence_level. The account, skin profile and allergy choices are kept (deleting the account is
the user's own choice, via Delete account).

Activity = `last_active` (server time), refreshed on signed-in API calls (see app/api/auth_utils.py). Accounts that
have never sent a request since this was added fall back to their newest of last_active / last_login / updated_at /
setup_at / created_at.
"""
import datetime as dt
import logging

from firebase_admin import firestore

log = logging.getLogger("chromascope.retention")
INACTIVE_DAYS = 30
FACE_FIELDS = ["seasonal_label", "user_lab", "season_confidence_level"]
_ACTIVITY_FIELDS = ["last_active", "last_login", "updated_at", "setup_at", "created_at"]


def _as_datetime(value):
    if isinstance(value, dt.datetime):
        return value if value.tzinfo else value.replace(tzinfo=dt.timezone.utc)
    if isinstance(value, str):
        try:
            v = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
            return v if v.tzinfo else v.replace(tzinfo=dt.timezone.utc)
        except ValueError:
            return None
    return None


def last_activity(data: dict):
    times = [t for t in (_as_datetime(data.get(f)) for f in _ACTIVITY_FIELDS) if t is not None]
    return max(times) if times else None


def purge_inactive_face_data(db, apply: bool, now: dt.datetime | None = None, days: int = INACTIVE_DAYS) -> dict:
    """Remove face data from users inactive for `days`+ days. apply=False only counts (preview)."""
    now = now or dt.datetime.now(dt.timezone.utc)
    cutoff = now - dt.timedelta(days=days)
    stats = {"checked": 0, "inactive_with_face_data": 0, "cleared": 0, "no_activity_date": 0}
    for snap in db.collection("users").stream():
        stats["checked"] += 1
        data = snap.to_dict() or {}
        present = [f for f in FACE_FIELDS if f in data]
        if not present:
            continue
        last = last_activity(data)
        if last is None:
            stats["no_activity_date"] += 1   # never deleted blindly; reported for a manual look
            continue
        if last < cutoff:
            stats["inactive_with_face_data"] += 1
            if apply:
                snap.reference.update({f: firestore.DELETE_FIELD for f in present} |
                                      {"face_data_deleted_at": firestore.SERVER_TIMESTAMP})
                stats["cleared"] += 1
    log.info("Face-data retention (%s, %d days): %s", "apply" if apply else "preview", days, stats)
    return stats
