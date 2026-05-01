from datetime import timedelta
from sqlalchemy import Float, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.models.person import Person
from app.utils.ist_utils import now_ist, ist_day_start_utc

# IST offset in minutes (UTC+05:30 = 330 minutes).
# SQLite stores timestamps as UTC text strings.  Passing "+330 minutes" as a
# modifier to strftime() shifts each timestamp into IST before formatting.
_IST_OFFSET = "+330 minutes"


class AnalyticsService:
    async def get_heatmap_data(self, db: AsyncSession) -> dict[str, object]:
        # Group by IST hour so the heatmap reflects India office hours, not UTC.
        hourly_result = await db.execute(
            select(
                func.strftime("%H", Attendance.timestamp, _IST_OFFSET).label("hour"),
                func.count(Attendance.id),
            ).group_by("hour")
        )
        # Group by IST weekday (SQLite %w: 0=Sunday … 6=Saturday).
        daily_result = await db.execute(
            select(
                func.strftime("%w", Attendance.timestamp, _IST_OFFSET).label("weekday"),
                func.count(Attendance.id),
            ).group_by("weekday")
        )

        # Use IST "today" so window boundaries align with the Indian calendar.
        today_ist = now_ist()
        week_start_utc = ist_day_start_utc(today_ist - timedelta(days=6))
        month_start_utc = ist_day_start_utc(today_ist - timedelta(days=28))

        week_result = await db.execute(
            select(
                func.date(Attendance.timestamp, _IST_OFFSET).label("day"),
                func.count(Attendance.id),
            )
            .where(Attendance.timestamp >= week_start_utc)
            .group_by("day")
            .order_by("day")
        )

        month_result = await db.execute(
            select(
                func.strftime("%Y-%W", Attendance.timestamp, _IST_OFFSET).label("week"),
                func.count(Attendance.id),
            )
            .where(Attendance.timestamp >= month_start_utc)
            .group_by("week")
            .order_by("week")
        )

        weekday_map = {
            "0": "Sunday",
            "1": "Monday",
            "2": "Tuesday",
            "3": "Wednesday",
            "4": "Thursday",
            "5": "Friday",
            "6": "Saturday",
        }

        return {
            "hourly": {
                f"{int(hour):02d}:00": count for hour, count in hourly_result.all()
            },
            "daily": {
                weekday_map[str(day)]: count for day, count in daily_result.all()
            },
            "weekly_trend": [count for _, count in week_result.all()],
            "monthly_trend": [count for _, count in month_result.all()],
        }

    async def get_trends(self, db: AsyncSession) -> dict[str, object]:
        dept_result = await db.execute(
            select(Person.department, func.count(Attendance.id))
            .join(Attendance, Attendance.person_id == Person.id)
            .group_by(Person.department)
            .order_by(func.count(Attendance.id).desc())
        )

        confidence_result = await db.execute(
            select(
                func.round(Attendance.confidence_score, 1).label("bucket"),
                func.count(Attendance.id),
            )
            .group_by("bucket")
            .order_by("bucket")
        )

        top_result = await db.execute(
            select(Person.name, func.count(Attendance.id).label("count"))
            .join(Attendance, Attendance.person_id == Person.id)
            .group_by(Person.id)
            .order_by(func.count(Attendance.id).desc())
            .limit(5)
        )

        low_result = await db.execute(
            select(Person.name, func.count(Attendance.id).label("count"))
            .join(Attendance, Attendance.person_id == Person.id)
            .group_by(Person.id)
            .order_by(func.count(Attendance.id).asc())
            .limit(5)
        )

        avg_conf_result = await db.execute(
            select(func.avg(cast(Attendance.confidence_score, Float)))
        )
        avg_conf = avg_conf_result.scalar() or 0.0

        return {
            "attendance_by_department": [
                {"department": d, "count": c} for d, c in dept_result.all()
            ],
            "confidence_distribution": [
                {"bucket": float(b), "count": c} for b, c in confidence_result.all()
            ],
            "most_frequent_attendees": [
                {"name": n, "count": c} for n, c in top_result.all()
            ],
            "least_frequent_attendees": [
                {"name": n, "count": c} for n, c in low_result.all()
            ],
            "average_confidence": float(avg_conf),
        }
