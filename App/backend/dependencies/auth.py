import hashlib
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from core.auth import AccessTokenError, decode_access_token, decode_supabase_access_token
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_name(payload: Dict[str, Any], email: str) -> Optional[str]:
    """Resolve a display name from a Supabase token's metadata claims."""
    user_metadata = payload.get("user_metadata") or payload.get("raw_user_meta_data") or {}
    name = (
        payload.get("name")
        or user_metadata.get("name")
        or user_metadata.get("full_name")
        or payload.get("full_name")
    )
    if name:
        return str(name)
    return email.split("@", 1)[0] if email else None


async def get_bearer_token(
    request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> str:
    """Extract the bearer token from the Authorization header or HttpOnly cookie.

    Priority:
      1. `Authorization: Bearer <token>` header (used by dev/fallback clients).
      2. `bf_access_token` HttpOnly cookie (primary path in production).

    Tokens are intentionally NOT accepted from the URL query string, which
    would leak them into logs and browser history.
    """
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials

    cookie_token = request.cookies.get("bf_access_token")
    if cookie_token:
        return cookie_token

    logger.debug("Authentication required for request %s %s", request.method, request.url.path)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication credentials were not provided")


async def get_current_user(token: str = Depends(get_bearer_token)) -> UserResponse:
    """Dependency to get current authenticated user via JWT token.

    Accepts two token families:
      1. Application JWTs issued by this backend (`JWT_SECRET_KEY`).
      2. Supabase access tokens (`SUPABASE_JWT_SECRET`) — used when the frontend
         authenticates directly against Supabase Auth and forwards the token as
         `Authorization: Bearer <token>`.
    """
    payload: Optional[Dict[str, Any]] = None

    try:
        payload = decode_access_token(token)
    except AccessTokenError as exc:
        # Log error type only, not the full exception which may contain sensitive token data
        logger.debug("App-token validation failed (%s); trying Supabase token", type(exc).__name__)
        payload = decode_supabase_access_token(token)

    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    last_login_raw = payload.get("last_login")
    last_login = None
    if isinstance(last_login_raw, str):
        try:
            last_login = datetime.fromisoformat(last_login_raw)
        except ValueError:
            # Log user hash instead of actual user ID to avoid exposing sensitive information
            user_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:8] if user_id else "unknown"
            logger.debug("Failed to parse last_login for user hash: %s", user_hash)

    email = str(payload.get("email") or "")
    name = payload.get("name") or _extract_name(payload, email)
    if name is None and email:
        name = email.split("@", 1)[0]

    # Supabase `role` claims ("authenticated" / "service_role") differ from the
    # application's `user`/`admin` roles. Only an explicit "admin" claim maps to
    # an admin; everything else stays a regular user.
    raw_role = str(payload.get("role") or "user")
    role = "admin" if raw_role == "admin" else "user"

    return UserResponse(
        id=str(user_id),
        email=email,
        name=name,
        role=role,
        last_login=last_login,
    )


async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Dependency to ensure current user has admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
