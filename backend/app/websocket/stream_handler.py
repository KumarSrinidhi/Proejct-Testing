import base64
import binascii
import json
import logging
from datetime import datetime
from time import perf_counter

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.database import SessionLocal
from app.services.video_ingestion import VideoIngestionService
from app.utils.image_utils import crop_face


logger = logging.getLogger(__name__)
router = APIRouter()


def _decode_data_url_image(data_url: str) -> np.ndarray | None:
    try:
        if "," in data_url:
            _, encoded = data_url.split(",", 1)
        else:
            encoded = data_url
        raw = base64.b64decode(encoded)
        arr = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except (ValueError, binascii.Error):
        return None


async def _process_frame(
    websocket: WebSocket,
    frame: np.ndarray,
    face_service,
    attendance_service,
) -> None:
    started = perf_counter()
    async with SessionLocal() as db:
        recognized_faces = face_service.recognize_faces(frame)
        faces_payload: list[dict[str, object]] = []
        any_match = False

        for item in recognized_faces:
            person_id = item.get("person_id")
            confidence = float(item.get("confidence") or 0.0)
            face = item.get("face")
            bbox = item.get("bbox")

            attendance_marked = False
            message = "No match"
            if person_id and face is not None:
                cropped = crop_face(frame, face.bbox)
                ok, mark_message = await attendance_service.mark_attendance(db, int(person_id), confidence, cropped)
                attendance_marked = ok
                message = mark_message
                any_match = True

            faces_payload.append(
                {
                    "person_id": person_id,
                    "name": item.get("name"),
                    "confidence": confidence,
                    "bbox": bbox,
                    "attendance_marked": attendance_marked,
                    "message": message,
                }
            )

        primary = faces_payload[0] if faces_payload else None
        payload = {
            "type": "recognition",
            "timestamp": datetime.utcnow().isoformat(),
            "person_id": primary.get("person_id") if primary else None,
            "name": primary.get("name") if primary else None,
            "confidence": float(primary.get("confidence") or 0.0) if primary else 0.0,
            "attendance_marked": bool(primary.get("attendance_marked")) if primary else False,
            "message": primary.get("message") if primary else "No match",
            "bbox": primary.get("bbox") if primary else None,
            "frame_width": int(frame.shape[1]),
            "frame_height": int(frame.shape[0]),
            "faces": faces_payload,
            "face_count": len(faces_payload),
            "any_match": any_match,
            "processing_ms": round((perf_counter() - started) * 1000, 2),
        }

        await websocket.send_text(json.dumps(payload))


@router.websocket("/ws/process")
async def process_stream_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        config = await websocket.receive_json()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected before config payload")
        return

    source_type = config.get("source_type", "webcam")
    source_path = config.get("source_path")

    from app.main import app

    face_service = app.state.face_service
    attendance_service = app.state.attendance_service
    ingestion = VideoIngestionService(source_type=source_type, source_path=source_path)

    async def on_frame(frame) -> None:
        await _process_frame(websocket, frame, face_service, attendance_service)

    try:
        if source_type == "browser_webcam":
            while True:
                message = await websocket.receive_json()
                msg_type = message.get("type")
                if msg_type == "stop":
                    break
                if msg_type != "frame":
                    continue

                frame = _decode_data_url_image(message.get("image", ""))
                if frame is None:
                    await websocket.send_json({"type": "error", "message": "Invalid webcam frame payload"})
                    continue

                await _process_frame(websocket, frame, face_service, attendance_service)
        else:
            await ingestion.process_stream(on_frame)

        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as exc:
        logger.exception("WebSocket processing failed: %s", exc)
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"type": "error", "message": str(exc)})
    finally:
        ingestion.stop()
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
