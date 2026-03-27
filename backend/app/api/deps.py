from collections import defaultdict, deque
from datetime import datetime, timedelta
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.security import decode_token, TokenError
from app.config import get_settings


settings = get_settings()
_login_attempts: dict[str, deque[datetime]] = defaultdict(deque)


async def get_current_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        subject = decode_token(token, expected_type="access")
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    result = await db.execute(select(User).where(User.username == subject))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def check_login_rate_limit(username: str) -> None:
    now = datetime.utcnow()
    queue = _login_attempts[username]
    window_start = now - timedelta(seconds=settings.login_rate_limit_window_seconds)

    while queue and queue[0] < window_start:
        queue.popleft()

    if len(queue) >= settings.login_rate_limit_attempts:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts")


def record_login_attempt(username: str) -> None:
    _login_attempts[username].append(datetime.utcnow())
