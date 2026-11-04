"""Upload limits and a per-user rate limit for the analysis endpoint (PLAN_OPTIMIZATION.md, Phase A5).

The rate limit is kept in memory per server instance. Cloud Run may run several instances, so the real ceiling is
"limit x instances"; it still stops one account from hammering the expensive model. Login attempts are limited by
Firebase Authentication itself (plus App Check, configured in the Firebase console).
"""
import os
import threading
import time
from collections import defaultdict, deque

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "8")) * 1024 * 1024
MAX_IMAGE_SIDE = 6000                       # pixels; larger photos are rejected before analysis
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}   # checked from the file contents, not the file name
ANALYSIS_LIMIT = int(os.environ.get("ANALYSIS_LIMIT_PER_HOUR", "10"))
WINDOW_SECONDS = 3600


class RateLimiter:
    def __init__(self, limit: int, window: int):
        self.limit, self.window = limit, window
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> tuple[bool, int]:
        """(allowed, seconds until the next request is allowed)."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False, int(q[0] + self.window - now) + 1
            q.append(now)
            return True, 0


analysis_limiter = RateLimiter(ANALYSIS_LIMIT, WINDOW_SECONDS)
