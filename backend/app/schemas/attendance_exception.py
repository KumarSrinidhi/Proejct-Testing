from datetime import datetime

from pydantic import BaseModel, Field


class AttendanceExceptionCreate(BaseModel):
    attendance_id: int
    exception_type: str = Field(min_length=3, max_length=50)
    reason: str = Field(default="", max_length=500)


class AttendanceExceptionRead(BaseModel):
    id: int
    attendance_id: int
    exception_type: str
    reason: str
    created_by_username: str
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceExceptionListResponse(BaseModel):
    items: list[AttendanceExceptionRead]
    total: int
    page: int
    page_size: int
