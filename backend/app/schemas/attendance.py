from datetime import datetime
from pydantic import BaseModel, Field


class AttendanceRead(BaseModel):
    id: int
    person_id: int
    person_name: str
    department: str
    timestamp: datetime
    confidence_score: float
    cropped_face_path: str


class AttendanceTodaySummary(BaseModel):
    total_today: int
    unique_today: int
    avg_confidence: float


class AttendanceListResponse(BaseModel):
    items: list[AttendanceRead]
    total: int
    page: int
    page_size: int


class AttendanceUpdate(BaseModel):
    timestamp: datetime
    confidence_score: float = Field(ge=0.0, le=1.0)


class AttendanceManualCreate(BaseModel):
    """Payload for manually logging attendance from the Undetected Faces review queue."""
    person_id: int
    timestamp: datetime | None = None          # defaults to now (UTC) on the backend
    undetected_face_id: int | None = None      # optional — for audit trail linkage
