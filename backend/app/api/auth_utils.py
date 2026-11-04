import logging
import time

from firebase_admin import auth, firestore
from google.api_core import exceptions as gexc
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..firebase_init import init_firebase

init_firebase()
log = logging.getLogger("chromascope.auth")

# Activity for the 30-day face-data retention (core/retention.py): refreshed at most once an hour per user.
_TOUCH_EVERY_SECONDS = 3600
_last_touch: dict[str, float] = {}


def _touch_last_active(uid: str) -> None:
    now = time.monotonic()
    if now - _last_touch.get(uid, -_TOUCH_EVERY_SECONDS) < _TOUCH_EVERY_SECONDS:
        return
    _last_touch[uid] = now
    try:
        # update(), not set(): never re-creates a profile (e.g. a stale token right after Delete account).
        firestore.client().collection("users").document(uid).update({"last_active": firestore.SERVER_TIMESTAMP})
    except gexc.NotFound:
        pass
    except Exception:
        log.warning("Could not record activity", exc_info=True)

security = HTTPBearer()

async def get_current_user(res: HTTPAuthorizationCredentials = Depends(security)):
    """
    This is a FastAPI dependency. It will:
    1. Look for the 'Authorization: Bearer <token>' header.
    2. Verify that token with Firebase.
    3. Return the user's UID.
    """
    token = res.credentials
    
    try:
        # Verify the ID token sent from the frontend
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        
        if not uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
            
        _touch_last_active(uid)
        return uid

    except HTTPException:
        raise
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your sign-in has expired. Please log in again."
        )
    except Exception:
        # Details stay in the server log; the client gets a generic message.
        log.warning("Rejected an invalid ID token", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in again."
        )