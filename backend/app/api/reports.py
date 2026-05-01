"""
Additional admin/reporting endpoints:
  - GET  /api/reports/department       — attendance summary by department
  - POST /api/hr/export                — push attendance data to an external HR webhook
  - CRUD /api/holidays                 — manage public holidays (attendance skip)
  - CRUD /api/shifts                   — manage shift windows per department
"""
import logging
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.config import get_settings
from app.database import get_db
from app.models.attendance import Attendance
from app.models.holiday import Holiday
from app.models.person import Person
from app.models.shift import Shift
from app.utils.audit import log_audit_event
from app.utils.ist_utils import ist_day_start_utc, now_ist

logger = logging.getLogger(__name__)
router = APIRouter(tags=["reports"])
settings = get_settings()


# ---------------------------------------------------------------------------
# #11 — Department Attendance Report
# ---------------------------------------------------------------------------

@router.get("/api/reports/department", summary="Attendance count by department for a date range (IST)")
async def department_report(
    date_from: date = Query(
        default=None,
        description="Start date (YYYY-MM-DD) in IST. Defaults to 30 days ago.",
    ),
    date_to: date = Query(
        default=None,
        description="End date (YYYY-MM-DD) in IST. Defaults to today.",
    ),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> dict[str, object]:
    today_ist = now_ist().date()
    start = date_from or (today_ist - timedelta(days=29))
    end = date_to or today_ist

    start_utc = ist_day_start_utc(
        __import__("datetime").datetime.combine(start, __import__("datetime").time.min)
        .replace(tzinfo=__import__("zoneinfo").ZoneInfo("Asia/Kolkata"))
    )
    end_utc = ist_day_start_utc(
        __import__("datetime").datetime.combine(end + timedelta(days=1), __import__("datetime").time.min)
        .replace(tzinfo=__import__("zoneinfo").ZoneInfo("Asia/Kolkata"))
    )

    rows = await db.execute(
        select(
            Person.department,
            func.count(Attendance.id).label("attendance_count"),
            func.count(func.distinct(Attendance.person_id)).label("unique_persons"),
        )
        .join(Person, Person.id == Attendance.person_id)
        .where(
            Attendance.timestamp >= start_utc,
            Attendance.timestamp < end_utc,
            Attendance.is_active.is_(True),
            Person.is_active.is_(True),
        )
        .group_by(Person.department)
        .order_by(func.count(Attendance.id).desc())
    )
    data = [
        {
            "department": dept or "Unassigned",
            "attendance_count": att_cnt,
            "unique_persons": uniq,
        }
        for dept, att_cnt, uniq in rows.all()
    ]
    return {
        "date_from": str(start),
        "date_to": str(end),
        "departments": data,
        "total_attendance": sum(r["attendance_count"] for r in data),
    }


# ---------------------------------------------------------------------------
# #8 — HR System Webhook Push
# ---------------------------------------------------------------------------

@router.post("/api/hr/export", summary="Push today's attendance to the configured HR webhook")
async def hr_export(
    date_from: date = Query(default=None, description="IST start date (YYYY-MM-DD)"),
    date_to: date = Query(default=None, description="IST end date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, object]:
    webhook_url: str = getattr(settings, "hr_webhook_url", "")
    if not webhook_url:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="HR_WEBHOOK_URL is not configured. Set it in .env to enable HR integration.",
        )

    today_ist = now_ist().date()
    start = date_from or today_ist
    end = date_to or today_ist

    import zoneinfo, datetime as _dt
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
    start_utc = _dt.datetime.combine(start, _dt.time.min, tzinfo=IST).astimezone(_dt.timezone.utc)
    end_utc = _dt.datetime.combine(end + timedelta(days=1), _dt.time.min, tzinfo=IST).astimezone(_dt.timezone.utc)

    rows = await db.execute(
        select(
            Person.name,
            Person.email,
            Person.department,
            Attendance.timestamp,
            Attendance.confidence_score,
        )
        .join(Person, Person.id == Attendance.person_id)
        .where(
            Attendance.timestamp >= start_utc,
            Attendance.timestamp < end_utc,
            Attendance.is_active.is_(True),
            Person.is_active.is_(True),
        )
        .order_by(Attendance.timestamp)
    )

    records = [
        {
            "name": name,
            "email": email,
            "department": dept,
            # Convert to IST ISO string for HR system
            "timestamp_ist": ts.astimezone(IST).isoformat() if ts.tzinfo else ts.isoformat(),
            "confidence_score": round(conf, 4),
        }
        for name, email, dept, ts, conf in rows.all()
    ]

    payload = {
        "source": "VisionAttend",
        "date_from": str(start),
        "date_to": str(end),
        "record_count": len(records),
        "records": records,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(webhook_url, json=payload)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"HR webhook returned {exc.response.status_code}: {exc.response.text[:200]}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to reach HR webhook: {exc}",
        ) from exc

    await log_audit_event(
        db,
        actor=current_admin,
        action="hr_export",
        entity_type="attendance",
        entity_id=None,
        metadata={"date_from": str(start), "date_to": str(end), "record_count": len(records)},
    )
    return {"status": "exported", "record_count": len(records), "date_from": str(start), "date_to": str(end)}


# ---------------------------------------------------------------------------
# #12 — Holiday CRUD
# ---------------------------------------------------------------------------

@router.get("/api/holidays", summary="List all holidays")
async def list_holidays(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> list[dict[str, object]]:
    result = await db.execute(select(Holiday).order_by(Holiday.holiday_date))
    return [
        {
            "id": h.id,
            "holiday_date": str(h.holiday_date),
            "name": h.name,
            "is_recurring": h.is_recurring,
        }
        for h in result.scalars().all()
    ]


@router.post("/api/holidays", status_code=status.HTTP_201_CREATED, summary="Create a holiday")
async def create_holiday(
    holiday_date: date = Query(..., description="Date in YYYY-MM-DD (IST)"),
    name: str = Query(..., description="Holiday name, e.g. 'Republic Day'"),
    is_recurring: bool = Query(default=False, description="Recurs annually on same month+day"),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, object]:
    existing = await db.execute(select(Holiday).where(Holiday.holiday_date == holiday_date))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Holiday already exists for this date")
    h = Holiday(holiday_date=holiday_date, name=name.strip(), is_recurring=is_recurring)
    db.add(h)
    await db.commit()
    await db.refresh(h)
    await log_audit_event(db, actor=current_admin, action="create_holiday", entity_type="holiday",
                          entity_id=h.id, metadata={"date": str(holiday_date), "name": name})
    return {"id": h.id, "holiday_date": str(h.holiday_date), "name": h.name, "is_recurring": h.is_recurring}


@router.delete("/api/holidays/{holiday_id}", summary="Delete a holiday")
async def delete_holiday(
    holiday_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(Holiday).where(Holiday.id == holiday_id))
    h = result.scalar_one_or_none()
    if h is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found")
    await db.delete(h)
    await db.commit()
    await log_audit_event(db, actor=current_admin, action="delete_holiday", entity_type="holiday",
                          entity_id=holiday_id, metadata={})
    return {"message": "Holiday deleted"}


# ---------------------------------------------------------------------------
# #12 — Helper: is a given IST date a holiday?
# ---------------------------------------------------------------------------

async def is_holiday_ist(check_date: date, db: AsyncSession) -> bool:
    """Return True if `check_date` (IST) is a registered holiday."""
    # Exact date match
    exact = await db.execute(select(Holiday).where(Holiday.holiday_date == check_date))
    if exact.scalar_one_or_none():
        return True
    # Recurring: same month+day, any year
    recurring = await db.execute(
        select(Holiday).where(
            Holiday.is_recurring.is_(True),
            func.strftime("%m-%d", Holiday.holiday_date) == check_date.strftime("%m-%d"),
        )
    )
    return recurring.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# #13 — Shift CRUD
# ---------------------------------------------------------------------------

@router.get("/api/shifts", summary="List all active shifts")
async def list_shifts(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Shift).where(Shift.is_active.is_(True)).order_by(Shift.name)
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "department": s.department,
            "start_time": str(s.start_time),
            "end_time": str(s.end_time),
            "grace_minutes": s.grace_minutes,
        }
        for s in result.scalars().all()
    ]


@router.post("/api/shifts", status_code=status.HTTP_201_CREATED, summary="Create a shift")
async def create_shift(
    name: str = Query(...),
    start_time: str = Query(..., description="HH:MM (IST), e.g. '09:00'"),
    end_time: str = Query(..., description="HH:MM (IST), e.g. '18:00'"),
    department: str = Query(default=None, description="Department name, or omit for all"),
    grace_minutes: int = Query(default=15, ge=0, le=120),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, object]:
    import datetime as _dt
    try:
        st = _dt.time.fromisoformat(start_time)
        et = _dt.time.fromisoformat(end_time)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="start_time/end_time must be HH:MM or HH:MM:SS")
    s = Shift(name=name.strip(), department=department, start_time=st, end_time=et,
               grace_minutes=grace_minutes)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    await log_audit_event(db, actor=current_admin, action="create_shift", entity_type="shift",
                          entity_id=s.id, metadata={"name": name, "department": department})
    return {"id": s.id, "name": s.name, "department": s.department,
            "start_time": str(s.start_time), "end_time": str(s.end_time),
            "grace_minutes": s.grace_minutes}


@router.delete("/api/shifts/{shift_id}", summary="Deactivate a shift")
async def delete_shift(
    shift_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(Shift).where(Shift.id == shift_id))
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
    s.is_active = False
    await db.commit()
    await log_audit_event(db, actor=current_admin, action="delete_shift", entity_type="shift",
                          entity_id=shift_id, metadata={})
    return {"message": "Shift deactivated"}
