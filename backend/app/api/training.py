from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.database import get_db
from app.models.training_log import TrainingLog
from app.schemas.training import TrainingLogRead, TrainingSummary


router = APIRouter(prefix="/api/train", tags=["training"])


@router.post("", response_model=TrainingSummary)
async def trigger_training(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> TrainingSummary:
    from app.main import app

    summary = await app.state.face_service.rebuild_index(db)
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


@router.get("/logs", response_model=list[TrainingLogRead])
async def list_training_logs(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> list[TrainingLogRead]:
    result = await db.execute(select(TrainingLog).order_by(TrainingLog.timestamp.desc()).limit(100))
    rows = result.scalars().all()
    return [TrainingLogRead.model_validate(row) for row in rows]
