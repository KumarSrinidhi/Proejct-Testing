from datetime import datetime

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: int
    timestamp: datetime
    actor_username: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: int | None = None
    metadata_json: str
    success: bool

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: list[AuditLogRead]
    total: int
    page: int
    page_size: int
