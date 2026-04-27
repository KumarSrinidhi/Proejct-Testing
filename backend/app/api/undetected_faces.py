from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_teacher_or_admin
from app.database import get_db
from app.models.undetected_face import UndetectedFace
from app.models.user import User
from app.schemas.undetected_face import (
    UndetectedFaceCleanupResponse,
    UndetectedFaceListResponse,
    UndetectedFaceRead,
    UndetectedFaceReviewUpdate,
)
from app.utils.audit import log_audit_event
from app.utils.file_storage import UNDETECTED_FACES_ROOT
from app.utils.pagination import paginate_select


router = APIRouter(prefix="/api/undetected-faces", tags=["undetected-faces"])


@router.get("", response_model=UndetectedFaceListResponse)
async def list_undetected_faces(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    reviewed: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> UndetectedFaceListResponse:
    query = select(UndetectedFace)
    count_query = select(func.count(UndetectedFace.id))
    if reviewed is not None:
        query = query.where(UndetectedFace.reviewed.is_(reviewed))
        count_query = count_query.where(UndetectedFace.reviewed.is_(reviewed))

    total, rows = await paginate_select(
        db,
        query.order_by(UndetectedFace.created_at.desc(), UndetectedFace.id.desc()),
        count_query,
        page=page,
        page_size=page_size,
    )
    return UndetectedFaceListResponse(
        items=[
            UndetectedFaceRead(
                id=row.id,
                source_type=row.source_type,
                reviewed=row.reviewed,
                created_at=row.created_at,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.put("/{face_id}/review", response_model=UndetectedFaceRead)
async def update_undetected_face_review(
    face_id: int,
    payload: UndetectedFaceReviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
) -> UndetectedFaceRead:
    result = await db.execute(
        select(UndetectedFace).where(UndetectedFace.id == face_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Undetected face not found"
        )

    row.reviewed = payload.reviewed
    await db.commit()
    await db.refresh(row)

    await log_audit_event(
        db,
        actor=current_user,
        action="update_undetected_face_review",
        entity_type="undetected_face",
        entity_id=row.id,
        metadata={"reviewed": payload.reviewed, "source_type": row.source_type},
    )

    return UndetectedFaceRead(
        id=row.id,
        source_type=row.source_type,
        reviewed=row.reviewed,
        created_at=row.created_at,
    )


@router.get("/{face_id}/preview")
async def preview_undetected_face(
    face_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> FileResponse:
    result = await db.execute(
        select(UndetectedFace).where(UndetectedFace.id == face_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Undetected face not found"
        )

    path = Path(row.image_path)
    allowed_root = UNDETECTED_FACES_ROOT.resolve()
    try:
        resolved_path = path.resolve()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image path"
        )

    if not resolved_path.is_relative_to(allowed_root):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Image path outside allowed directory",
        )

    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found on disk"
        )

    return FileResponse(path=str(resolved_path), media_type="image/jpeg")


@router.delete("/{face_id}")
async def delete_undetected_face(
    face_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> dict[str, str]:
    result = await db.execute(
        select(UndetectedFace).where(UndetectedFace.id == face_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Undetected face not found"
        )

    try:
        path = Path(row.image_path).resolve()
        allowed_root = UNDETECTED_FACES_ROOT.resolve()
        if path.is_relative_to(allowed_root) and path.exists() and path.is_file():
            path.unlink()
    except Exception:
        pass

    await db.delete(row)
    await db.commit()
    return {"message": "Undetected face deleted"}


@router.post("/cleanup", response_model=UndetectedFaceCleanupResponse)
async def cleanup_undetected_faces(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> UndetectedFaceCleanupResponse:
    deleted = await request.app.state.undetected_face_service.cleanup_expired(db)
    return UndetectedFaceCleanupResponse(deleted_records=deleted)
