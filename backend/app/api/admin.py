"""
Admin-only endpoints for data management and system operations.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.database import get_db
from app.models.attendance import Attendance
from app.models.attendance_exception import AttendanceException
from app.models.undetected_face import UndetectedFace
from app.models.training_log import TrainingLog
from app.models.audit_log import AuditLog
from app.models.user import User
from app.utils.audit import log_audit_event


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminResponse:
    """Standard admin operation response."""

    def __init__(self, message: str, details: dict[str, object] | None = None):
        self.message = message
        self.details = details or {}


@router.delete("/data/reset/attendance")
async def reset_attendance_data(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> dict[str, object]:
    """
    Delete all attendance records. Requires admin role.
    """
    try:
        result = await db.execute(select(Attendance))
        count = len(result.scalars().all())
        await db.execute(delete(Attendance))
        await db.commit()

        await log_audit_event(
            db,
            actor=current_admin,
            action="reset_attendance_data",
            entity_type="system",
            entity_id=0,
            metadata={"deleted_count": count},
        )

        logger.info(
            "Attendance data reset", extra={"admin_id": current_admin.id, "count": count}
        )
        return {
            "message": f"Deleted {count} attendance records",
            "deleted_count": count,
        }
    except Exception as exc:
        logger.exception("Failed to reset attendance data: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset attendance data",
        )


@router.delete("/data/reset/all")
async def reset_all_data(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> dict[str, object]:
    """
    Delete all application data (attendance, exceptions, undetected faces, training logs, audit logs).
    Requires admin role. Users and persons are preserved.
    """
    try:
        counts: dict[str, int] = {}

        # Delete attendance records
        result = await db.execute(select(Attendance))
        counts["attendance"] = len(result.scalars().all())
        await db.execute(delete(Attendance))

        # Delete attendance exceptions
        result = await db.execute(select(AttendanceException))
        counts["attendance_exceptions"] = len(result.scalars().all())
        await db.execute(delete(AttendanceException))

        # Delete undetected faces
        result = await db.execute(select(UndetectedFace))
        counts["undetected_faces"] = len(result.scalars().all())
        await db.execute(delete(UndetectedFace))

        # Delete training logs
        result = await db.execute(select(TrainingLog))
        counts["training_logs"] = len(result.scalars().all())
        await db.execute(delete(TrainingLog))

        # Delete audit logs
        result = await db.execute(select(AuditLog))
        counts["audit_logs"] = len(result.scalars().all())
        await db.execute(delete(AuditLog))

        await db.commit()

        total_deleted = sum(counts.values())
        logger.warning(
            "All application data reset",
            extra={"admin_id": current_admin.id, "counts": counts},
        )

        return {
            "message": f"Successfully reset all application data ({total_deleted} records deleted)",
            "counts": counts,
            "total_deleted": total_deleted,
        }
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to reset all data: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset data",
        )


@router.get("/info")
async def get_admin_info(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> dict[str, object]:
    """
    Get admin information and system status.
    """
    result = await db.execute(select(Attendance))
    attendance_count = len(result.scalars().all())

    result = await db.execute(select(User))
    user_count = len(result.scalars().all())

    result = await db.execute(select(AuditLog))
    audit_log_count = len(result.scalars().all())

    return {
        "admin_id": current_admin.id,
        "admin_username": current_admin.username,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total_users": user_count,
            "total_attendance_records": attendance_count,
            "total_audit_logs": audit_log_count,
        },
    }
