from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.database import get_db
from app.models.training_log import TrainingLog
from app.schemas.training import (
    TrainingLogListResponse,
    TrainingLogRead,
    TrainingLogUpdate,
    TrainingSummary,
)
from app.utils.audit import log_audit_event
from app.utils.pagination import paginate_select
from fastapi import HTTPException, status


router = APIRouter(prefix="/api/train", tags=["training"])


@router.post("", response_model=TrainingSummary)
async def trigger_training(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> TrainingSummary:
    summary = await request.app.state.face_service.rebuild_index(db)
    await log_audit_event(
        db,
        actor=current_admin,
        action="trigger_training",
        entity_type="training",
        entity_id=None,
        metadata=summary,
    )
    return TrainingSummary(**summary, status="success")


@router.get("/status", response_model=TrainingLogRead | None)
async def get_training_status(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> TrainingLogRead | None:
    result = await db.execute(
        select(TrainingLog).order_by(TrainingLog.timestamp.desc()).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return TrainingLogRead.model_validate(row)


@router.get("/logs", response_model=TrainingLogListResponse)
async def list_training_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> TrainingLogListResponse:
    total, rows = await paginate_select(
        db,
        select(TrainingLog).order_by(TrainingLog.timestamp.desc()),
        select(func.count(TrainingLog.id)),
        page=page,
        page_size=page_size,
    )
    return TrainingLogListResponse(
        items=[TrainingLogRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/logs/{log_id}", response_model=TrainingLogRead)
async def get_training_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> TrainingLogRead:
    result = await db.execute(select(TrainingLog).where(TrainingLog.id == log_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Training log not found"
        )
    return TrainingLogRead.model_validate(row)


@router.put("/logs/{log_id}", response_model=TrainingLogRead)
async def update_training_log(
    log_id: int,
    payload: TrainingLogUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> TrainingLogRead:
    result = await db.execute(select(TrainingLog).where(TrainingLog.id == log_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Training log not found"
        )

    row.status = payload.status.strip() if payload.status else row.status
    await db.commit()
    await db.refresh(row)
    return TrainingLogRead.model_validate(row)


# ---------------------------------------------------------------------------
# Incremental training — train a single person without full rebuild
# ---------------------------------------------------------------------------

@router.post("/person/{person_id}", summary="Incrementally add/refresh a single person in the FAISS index")
async def train_person(
    person_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, object]:
    """
    Add or refresh a single person's embeddings in the live FAISS index.
    Faster than a full rebuild and isolates failures to one person.
    """
    ok = await request.app.state.face_service.add_person_to_index(person_id, db)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person {person_id} not found or has no valid training images",
        )
    await log_audit_event(
        db,
        actor=current_admin,
        action="incremental_train_person",
        entity_type="person",
        entity_id=person_id,
        metadata={"incremental": True},
    )
    return {"person_id": person_id, "status": "indexed"}


@router.delete("/person/{person_id}", summary="Remove a person from the FAISS index (soft delete helper)")
async def remove_person_from_index(
    person_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, object]:
    removed = await request.app.state.face_service.remove_person_from_index(person_id)
    await log_audit_event(
        db,
        actor=current_admin,
        action="remove_person_from_index",
        entity_type="person",
        entity_id=person_id,
        metadata={"was_present": removed},
    )
    return {"person_id": person_id, "removed": removed}


# ---------------------------------------------------------------------------
# FAISS snapshot (backup / recovery)
# ---------------------------------------------------------------------------

@router.get("/snapshots", summary="List all FAISS index snapshots")
async def list_snapshots(
    request: Request,
    _: object = Depends(require_admin),
) -> dict[str, object]:
    snaps = request.app.state.face_service.list_snapshots()
    return {"snapshots": snaps, "total": len(snaps)}


@router.post("/snapshots", summary="Create a FAISS index snapshot (backup)")
async def create_snapshot(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
    label: str = Query(default="", description="Optional human-readable label"),
) -> dict[str, object]:
    snap_name = request.app.state.face_service.save_snapshot(label=label)
    if snap_name is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create snapshot",
        )
    await log_audit_event(
        db,
        actor=current_admin,
        action="create_faiss_snapshot",
        entity_type="snapshot",
        entity_id=None,
        metadata={"snapshot_name": snap_name, "label": label},
    )
    return {"snapshot_name": snap_name, "status": "created"}


@router.post("/snapshots/{snap_name}/restore", summary="Restore FAISS index from a snapshot")
async def restore_snapshot(
    snap_name: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(require_admin),
) -> dict[str, object]:
    ok = request.app.state.face_service.restore_snapshot(snap_name)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot '{snap_name}' not found or could not be restored",
        )
    await log_audit_event(
        db,
        actor=current_admin,
        action="restore_faiss_snapshot",
        entity_type="snapshot",
        entity_id=None,
        metadata={"snapshot_name": snap_name},
    )
    return {"snapshot_name": snap_name, "status": "restored"}
