import json
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import SessionLocal
from app.services.video_ingestion import VideoIngestionService
from app.utils.image_utils import crop_face


logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/process")
async def process_stream_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    config = await websocket.receive_json()
    source_type = config.get("source_type", "webcam")
    source_path = config.get("source_path")

    from app.main import app

    face_service = app.state.face_service
    attendance_service = app.state.attendance_service
    ingestion = VideoIngestionService(source_type=source_type, source_path=source_path)

    async def on_frame(frame) -> None:
        async with SessionLocal() as db:
            person_id, name, confidence, face = face_service.recognize_face(frame)
            payload = {
                "type": "recognition",
                "timestamp": datetime.utcnow().isoformat(),
                "person_id": person_id,
                "name": name,
                "confidence": confidence,
                "attendance_marked": False,
                "message": "No match",
                "bbox": None,
            }

            if face is not None:
                bbox = [int(v) for v in face.bbox]
                payload["bbox"] = bbox

            if person_id and face is not None:
                cropped = crop_face(frame, face.bbox)
                ok, message = await attendance_service.mark_attendance(db, person_id, confidence, cropped)
                payload["attendance_marked"] = ok
                payload["message"] = message

            await websocket.send_text(json.dumps(payload))

    try:
        await ingestion.process_stream(on_frame)
        await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as exc:
        logger.exception("WebSocket processing failed: %s", exc)
        await websocket.send_json({"type": "error", "message": str(exc)})
    finally:
        ingestion.stop()
        await websocket.close()
