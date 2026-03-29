from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Attendance(Base):
    """
    Attendance model for storing face recognition attendance records.
    
    Indexes are created for frequently queried fields to improve performance:
    - person_id: For retrieving records for a specific person
    - timestamp: For sorting by time and date range queries
    - created_at: For historical queries and analytics
    """
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    cropped_face_path: Mapped[str] = mapped_column(String(500), nullable=False)

    person = relationship("Person", back_populates="attendance_records")

    # Composite index for common queries (e.g., attendance by person and date range)
    __table_args__ = (
        Index("idx_attendance_person_timestamp", "person_id", "timestamp"),
    )
