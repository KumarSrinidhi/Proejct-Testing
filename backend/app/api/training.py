from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.database import get_db
from app.models.training_log import TrainingLog
from app.schemas.training import TrainingLogListResponse, TrainingLogRead, TrainingLogUpdate, TrainingSummary
from fastapi import HTTPException, status


router = APIRouter(prefix="/api/train", tags=["training"])


@router.post("", response_model=TrainingSummary)
async def trigger_training(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> TrainingSummary:
    summary = await request.app.state.face_service.rebuild_index(db)
    return TrainingSummary(**summary, status="success")


@router.get("/status", response_model=TrainingLogRead | None)
async def get_training_status(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> TrainingLogRead | None:
    result = await db.execute(select(TrainingLog).order_by(TrainingLog.timestamp.desc()).limit(1))
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
    total_result = await db.execute(select(func.count(TrainingLog.id)))
    total = int(total_result.scalar() or 0)

    result = await db.execute(
        select(TrainingLog)
        .order_by(TrainingLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = result.scalars().all()
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training log not found")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training log not found")

    row.status = payload.status.strip() if payload.status else row.status
    await db.commit()
    await db.refresh(row)
    return TrainingLogRead.model_validate(row)
