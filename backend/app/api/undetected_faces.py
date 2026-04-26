from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_teacher_or_admin
from app.database import get_db
from app.models.undetected_face import UndetectedFace
from app.schemas.undetected_face import UndetectedFaceCleanupResponse, UndetectedFaceRead
from app.utils.file_storage import UNDETECTED_FACES_ROOT


router = APIRouter(prefix="/api/undetected-faces", tags=["undetected-faces"])


@router.get("", response_model=list[UndetectedFaceRead])
async def list_undetected_faces(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> list[UndetectedFaceRead]:
    result = await db.execute(select(UndetectedFace).order_by(UndetectedFace.created_at.desc()))
    rows = result.scalars().all()
    return [
        UndetectedFaceRead(
            id=row.id,
            source_type=row.source_type,
            reviewed=row.reviewed,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/{face_id}/preview")
async def preview_undetected_face(
    face_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> FileResponse:
    result = await db.execute(select(UndetectedFace).where(UndetectedFace.id == face_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Undetected face not found")

    path = Path(row.image_path)
    allowed_root = UNDETECTED_FACES_ROOT.resolve()
    try:
        resolved_path = path.resolve()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image path")

    if not resolved_path.is_relative_to(allowed_root):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Image path outside allowed directory")

    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found on disk")

    return FileResponse(path=str(resolved_path), media_type="image/jpeg")


@router.delete("/{face_id}")
async def delete_undetected_face(
    face_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_teacher_or_admin),
) -> dict[str, str]:
    result = await db.execute(select(UndetectedFace).where(UndetectedFace.id == face_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Undetected face not found")

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
