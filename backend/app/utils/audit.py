import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User


async def log_audit_event(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    metadata: dict[str, Any] | None = None,
    success: bool = True,
) -> None:
    db.add(
        AuditLog(
            actor_username=actor.username,
            actor_role=actor.role or "student",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=json.dumps(metadata or {}, ensure_ascii=True, default=str),
            success=success,
        )
    )
    await db.commit()
