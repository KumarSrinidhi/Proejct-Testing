from datetime import datetime, timedelta, timezone
import logging

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.attendance import Attendance
from app.utils.file_storage import save_cropped_face


logger = logging.getLogger(__name__)
settings = get_settings()


class AttendanceService:
    @staticmethod
    def _as_utc(moment: datetime) -> datetime:
        if moment.tzinfo is None or moment.utcoffset() is None:
            return moment.replace(tzinfo=timezone.utc)
        return moment.astimezone(timezone.utc)

    async def mark_attendance(
        self,
        db: AsyncSession,
        person_id: int,
        confidence: float,
        cropped_face: np.ndarray,
    ) -> tuple[bool, str]:
        now = datetime.now(timezone.utc)

        if confidence <= settings.recognition_threshold:
            return False, "Confidence too low"

        result = await db.execute(
            select(Attendance)
            .where(Attendance.person_id == person_id)
            .order_by(Attendance.timestamp.desc())
            .limit(1)
        )
        latest_attendance = result.scalar_one_or_none()
        if latest_attendance is not None:
            latest_timestamp = self._as_utc(latest_attendance.timestamp)
            elapsed = (now - latest_timestamp).total_seconds()
            if elapsed < settings.attendance_window_seconds:
                remaining = int(settings.attendance_window_seconds - elapsed)
                return False, f"Attendance already marked for this window ({remaining}s remaining)"

        try:
            face_path = save_cropped_face(
                person_id=person_id, cropped_face=cropped_face, timestamp=now
            )
            db.add(
                Attendance(
                    person_id=person_id,
                    timestamp=now,
                    confidence_score=confidence,
                    cropped_face_path=face_path,
                )
            )
            await db.commit()
            logger.info(
                "Attendance marked",
                extra={"person_id": person_id, "confidence": confidence},
            )
            return True, "Attendance marked"
        except Exception as exc:
            await db.rollback()
            logger.exception("Failed to mark attendance: %s", exc)
            return False, "Failed to save attendance"
