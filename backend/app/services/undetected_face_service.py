import hashlib
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.undetected_face import UndetectedFace
from app.utils.file_storage import UNDETECTED_FACES_ROOT, save_undetected_face


logger = logging.getLogger(__name__)
settings = get_settings()


class UndetectedFaceService:
    def __init__(self) -> None:
        self._recent_seen: dict[str, datetime] = {}
        self._last_cleanup_at: datetime | None = None

    def _fingerprint_face(self, cropped_face: np.ndarray) -> str:
        resized = cropped_face
        if cropped_face.shape[0] > 64 or cropped_face.shape[1] > 64:
            import cv2

            resized = cv2.resize(cropped_face, (64, 64))
        digest = hashlib.sha256(resized.tobytes()).hexdigest()
        return digest

    def _should_store(self, face_key: str, now: datetime) -> bool:
        cooldown = timedelta(seconds=settings.undetected_face_capture_cooldown_seconds)
        last_seen = self._recent_seen.get(face_key)
        if last_seen and now - last_seen < cooldown:
            return False
        self._recent_seen[face_key] = now

        prune_before = now - timedelta(minutes=30)
        stale_keys = [key for key, ts in self._recent_seen.items() if ts < prune_before]
        for key in stale_keys:
            self._recent_seen.pop(key, None)

        return True

    async def capture_unknown_face(self, db: AsyncSession, cropped_face: np.ndarray, source_type: str) -> bool:
        now = datetime.now(timezone.utc)
        face_key = self._fingerprint_face(cropped_face)
        if not self._should_store(face_key, now):
            return False

        image_path = save_undetected_face(cropped_face=cropped_face, timestamp=now)
        db.add(
            UndetectedFace(
                image_path=image_path,
                source_type=source_type,
                reviewed=False,
                created_at=now,
            )
        )
        await db.commit()

        should_cleanup = (
            self._last_cleanup_at is None
            or now - self._last_cleanup_at >= timedelta(minutes=10)
        )
        if should_cleanup:
            await self.cleanup_expired(db)
            self._last_cleanup_at = now

        return True

    async def cleanup_expired(self, db: AsyncSession) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.undetected_face_retention_days)
        result = await db.execute(select(UndetectedFace).where(UndetectedFace.created_at < cutoff))
        rows = result.scalars().all()

        deleted = 0
        allowed_root = UNDETECTED_FACES_ROOT.resolve()
        for row in rows:
            path = Path(row.image_path)
            try:
                resolved = path.resolve()
                if resolved.is_relative_to(allowed_root) and resolved.exists() and resolved.is_file():
                    resolved.unlink()
            except Exception as exc:
                logger.warning("Failed to delete undetected face file: %s", exc)
            await db.delete(row)
            deleted += 1

        if deleted > 0:
            await db.commit()

        return deleted
