from firebase_admin import auth
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..firebase_init import init_firebase

init_firebase()

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
            
        return uid  

    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token has expired"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )