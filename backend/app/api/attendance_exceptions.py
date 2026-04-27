from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_teacher_or_admin
from app.database import get_db
from app.models.attendance import Attendance
from app.models.attendance_exception import AttendanceException
from app.models.user import User
from app.schemas.attendance_exception import (
    AttendanceExceptionCreate,
    AttendanceExceptionListResponse,
    AttendanceExceptionRead,
)
from app.utils.audit import log_audit_event
from app.utils.pagination import paginate_select


router = APIRouter(prefix="/api/attendance-exceptions", tags=["attendance-exceptions"])
VALID_EXCEPTION_TYPES = {"late", "excused", "manual_adjustment", "absence"}


@router.get("", response_model=AttendanceExceptionListResponse)
async def list_attendance_exceptions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    attendance_id: int | None = Query(default=None),
    exception_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> AttendanceExceptionListResponse:
    query = select(AttendanceException)
    count_query = select(func.count(AttendanceException.id))
    filters = []
    if attendance_id is not None:
        filters.append(AttendanceException.attendance_id == attendance_id)
    if exception_type:
        filters.append(AttendanceException.exception_type == exception_type)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total, rows = await paginate_select(
        db,
        query.order_by(
            AttendanceException.created_at.desc(), AttendanceException.id.desc()
        ),
        count_query,
        page=page,
        page_size=page_size,
    )
    return AttendanceExceptionListResponse(
        items=[AttendanceExceptionRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=AttendanceExceptionRead)
async def create_attendance_exception(
    payload: AttendanceExceptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
) -> AttendanceExceptionRead:
    if payload.exception_type not in VALID_EXCEPTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid exception type"
        )

    attendance_result = await db.execute(
        select(Attendance).where(Attendance.id == payload.attendance_id)
    )
    attendance = attendance_result.scalar_one_or_none()
    if attendance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found"
        )

    row = AttendanceException(
        attendance_id=payload.attendance_id,
        exception_type=payload.exception_type,
        reason=payload.reason.strip(),
        created_by_username=current_user.username,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    await log_audit_event(
        db,
        actor=current_user,
        action="create_attendance_exception",
        entity_type="attendance_exception",
        entity_id=row.id,
        metadata={
            "attendance_id": payload.attendance_id,
            "exception_type": payload.exception_type,
            "reason": payload.reason,
        },
    )

    return AttendanceExceptionRead.model_validate(row)
