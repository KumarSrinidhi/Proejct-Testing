from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.database import get_db
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogListResponse, AuditLogRead
from app.utils.pagination import paginate_select


router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    actor_username: str | None = Query(default=None),
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    search: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> AuditLogListResponse:
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    filters = []
    if actor_username:
        filters.append(AuditLog.actor_username == actor_username)
    if action:
        filters.append(AuditLog.action == action)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if search:
        like = f"%{search}%"
        filters.append((AuditLog.actor_username.ilike(like)) | (AuditLog.action.ilike(like)) | (AuditLog.entity_type.ilike(like)))

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total, rows = await paginate_select(
        db,
        query.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()),
        count_query,
        page=page,
        page_size=page_size,
    )
    return AuditLogListResponse(
        items=[AuditLogRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
