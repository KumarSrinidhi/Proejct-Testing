from datetime import datetime
from pydantic import BaseModel


class TrainingSummary(BaseModel):
    total_persons: int
    total_images: int
    failed_images: int
    duration_ms: int
    status: str


class TrainingLogRead(BaseModel):
    id: int
    timestamp: datetime
    total_persons: int
    total_images: int
    status: str

    class Config:
        from_attributes = True
