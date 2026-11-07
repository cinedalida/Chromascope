"""Signed receipts for color-analysis results (PLAN_OPTIMIZATION.md, Phase A4).

/api/analyze-color returns the result plus a receipt (HMAC over the user ID, the result and an expiry). The app saves
the result through /api/user/analysis-result only if the user did not cancel; the backend accepts it only with a
valid receipt for that same user and the exact same values. So the browser can never write a made-up result, and a
cancelled analysis is never stored.

Production: set ANALYSIS_RESULT_SECRET (a long random string) on Cloud Run, the same for every instance. Without it a
random per-process secret is used, which is fine locally but breaks saving when Cloud Run runs several instances.
"""
import hashlib
import hmac
import json
import logging
import os
import secrets
import time

log = logging.getLogger("chromascope.receipt")
RECEIPT_TTL_SECONDS = 15 * 60

_secret = os.environ.get("ANALYSIS_RESULT_SECRET", "").encode()
if not _secret:
    log.warning("ANALYSIS_RESULT_SECRET is not set; using a per-process secret (set it in production).")
    _secret = secrets.token_bytes(32)


def _payload(uid: str, season: str, lab: list, confidence: float, exp: int) -> bytes:
    data = {"uid": uid, "season": season, "lab": [round(float(x), 4) for x in lab],
            "confidence": round(float(confidence), 4), "exp": exp}
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode()


def issue(uid: str, season: str, lab: list, confidence: float) -> str:
    exp = int(time.time()) + RECEIPT_TTL_SECONDS
    sig = hmac.new(_secret, _payload(uid, season, lab, confidence, exp), hashlib.sha256).hexdigest()
    return f"{exp}.{sig}"


def verify(receipt: str, uid: str, season: str, lab: list, confidence: float) -> bool:
    try:
        exp_text, sig = receipt.split(".", 1)
        exp = int(exp_text)
    except (ValueError, AttributeError):
        return False
    if exp < time.time():
        return False
    expected = hmac.new(_secret, _payload(uid, season, lab, confidence, exp), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
