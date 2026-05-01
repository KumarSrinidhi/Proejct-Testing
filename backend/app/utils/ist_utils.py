"""
IST (India Standard Time, Asia/Kolkata, UTC+05:30) helpers.

All timestamps are stored in the database as UTC-aware values.
Use these helpers whenever you need:
  - The current time in IST          → now_ist()
  - The start of "today" in IST      → ist_day_start()
  - A UTC boundary for DB queries    → ist_day_start_utc()
  - Convert a UTC datetime to IST    → utc_to_ist(dt)
"""

import zoneinfo
from datetime import datetime, timezone

IST = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC = timezone.utc


def now_ist() -> datetime:
    """Return the current time as an IST-aware datetime."""
    return datetime.now(IST)


def utc_to_ist(dt: datetime) -> datetime:
    """Convert a UTC-aware (or naive-UTC) datetime to IST."""
    if dt.tzinfo is None or dt.utcoffset() is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(IST)


def ist_day_start(day: datetime | None = None) -> datetime:
    """
    Return midnight (00:00:00) IST of the given day.

    Args:
        day: Any datetime (aware or naive).  Defaults to today in IST.

    Returns:
        IST-aware datetime at 00:00:00 of that day.
    """
    ref = (day or now_ist()).astimezone(IST)
    return ref.replace(hour=0, minute=0, second=0, microsecond=0)


def ist_day_end(day: datetime | None = None) -> datetime:
    """
    Return 23:59:59.999999 IST of the given day (inclusive upper bound).
    """
    ref = (day or now_ist()).astimezone(IST)
    return ref.replace(hour=23, minute=59, second=59, microsecond=999999)


def ist_day_start_utc(day: datetime | None = None) -> datetime:
    """
    Return the IST midnight of `day` converted to a UTC-aware datetime.

    Use this value as the lower bound in SQLAlchemy queries, since all
    Attendance.timestamp values are stored in UTC.
    """
    return ist_day_start(day).astimezone(UTC)


def ist_day_end_utc(day: datetime | None = None) -> datetime:
    """Return IST end-of-day converted to UTC (for upper-bound DB queries)."""
    return ist_day_end(day).astimezone(UTC)
