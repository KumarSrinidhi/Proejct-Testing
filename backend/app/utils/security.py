from datetime import UTC, datetime, timedelta
import logging
from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12, deprecated="auto")


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str) -> tuple[str, datetime]:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256"), expire


def create_refresh_token(subject: str) -> tuple[str, datetime]:
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": subject, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256"), expire


def decode_token(token: str, expected_type: str = "access") -> str:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        token_type = payload.get("type")
        subject = payload.get("sub")
        if token_type != expected_type or not subject:
            raise TokenError("Invalid token payload")
        return str(subject)
    except JWTError as exc:
        logger.warning("Token decode failed: %s", exc)
        raise TokenError("Invalid token") from exc
