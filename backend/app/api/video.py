from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import require_admin
from app.utils.file_storage import save_uploaded_video


router = APIRouter(prefix="/api/video", tags=["video"])


@router.post("/upload")
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported video format")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty video file")

    path = save_uploaded_video(file.filename or "video.mp4", payload)
    return {"video_path": path}
