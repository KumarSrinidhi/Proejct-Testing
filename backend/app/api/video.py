from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from slowapi import RateLimiter
from werkzeug.utils import secure_filename
import logging

from app.api.deps import require_admin
from app.config import get_settings
from app.utils.file_storage import save_uploaded_video


router = APIRouter(prefix="/api/video", tags=["video"])
settings = get_settings()


def _is_supported_video_bytes(payload: bytes) -> bool:
    # MP4/QuickTime family (ftyp)
    if len(payload) >= 12 and payload[4:8] == b"ftyp":
        return True
    # AVI
    if len(payload) >= 12 and payload[:4] == b"RIFF" and payload[8:12] == b"AVI ":
        return True
    # Matroska / WebM
    if len(payload) >= 4 and payload[:4] == b"\x1a\x45\xdf\xa3":
        return True
    return False


@router.post("/upload", dependencies=[Depends(RateLimiter(requests=5, window=60))])
async def upload_video(
    file: UploadFile = File(...),
    _: object = Depends(require_admin),
) -> dict[str, str]:
    if file.content_type not in {
        "video/mp4",
        "video/x-msvideo",
        "video/quicktime",
        "video/x-matroska",
        "video/webm",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported video format"
        )

    payload = await file.read(settings.max_video_upload_bytes + 1)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty video file"
        )
    if len(payload) > settings.max_video_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Video too large",
        )
    if not _is_supported_video_bytes(payload):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video file content"
        )

    filename = secure_filename(file.filename or "video.mp4")
    path = save_uploaded_video(filename, payload)
    logging.info(f"Video uploaded: {filename} to {path}")
    return {"video_path": path}
