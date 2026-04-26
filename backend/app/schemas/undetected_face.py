from datetime import datetime

from pydantic import BaseModel


class UndetectedFaceRead(BaseModel):
    id: int
    source_type: str
    reviewed: bool
    created_at: datetime


class UndetectedFaceCleanupResponse(BaseModel):
    deleted_records: int
