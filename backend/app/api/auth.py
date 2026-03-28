import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import check_login_rate_limit, record_login_attempt
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.utils.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    verify_password,
    decode_token,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """
    User login endpoint.
    
    Security: Passwords are hashed with bcrypt (rounds=12).
    JWT tokens are created with HS256 algorithm.
    """
    check_login_rate_limit(payload.username)
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        record_login_attempt(payload.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token, expires_at = create_access_token(user.username)
    refresh_token, _ = create_refresh_token(user.username)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_at=expires_at)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """
    Token refresh endpoint.
    
    Security: Refresh tokens are validated before issuing new access tokens.
    Errors are logged without exposing sensitive data (no JWT secret in logs).
    """
    try:
        subject = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as exc:
        # Security: Log the error type but not the token or secret
        logger.warning("Token refresh failed: invalid refresh token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    result = await db.execute(select(User).where(User.username == subject))
    user = result.scalar_one_or_none()
    if user is None:
        logger.warning(f"Token refresh failed: user not found (username: {subject})")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    access_token, expires_at = create_access_token(user.username)
    refresh_token, _ = create_refresh_token(user.username)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_at=expires_at)
