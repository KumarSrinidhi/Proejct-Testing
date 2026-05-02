import base64
import binascii
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from fastapi.concurrency import run_in_threadpool

from app.api.deps import authenticate_access_token
from app.config import get_settings
from app.database import SessionLocal
from app.models.user import ROLE_ADMIN, ROLE_TEACHER
from app.services.video_ingestion import VideoIngestionService
from app.utils.file_storage import VIDEO_UPLOADS_ROOT
from app.utils.image_utils import crop_face
from app.utils.audit import log_audit_event


logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# Roles allowed to open the live recognition stream
_WEBCAM_ALLOWED_ROLES = {ROLE_ADMIN, ROLE_TEACHER}
_SERVER_SOURCE_TYPES = {"file", "rtsp"}
_CLIENT_SOURCE_TYPES = {"browser_webcam"}
_ALLOWED_SOURCE_TYPES = _SERVER_SOURCE_TYPES | _CLIENT_SOURCE_TYPES


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


def _encode_preview_frame(frame: np.ndarray) -> str | None:
    if frame is None or frame.size == 0:
        return None

    preview = frame
    if preview.ndim == 2:
        preview = cv2.cvtColor(preview, cv2.COLOR_GRAY2BGR)
    elif preview.ndim == 3 and preview.shape[2] == 4:
        preview = cv2.cvtColor(preview, cv2.COLOR_BGRA2BGR)
    elif preview.ndim != 3:
        return None

    if preview.dtype != np.uint8:
        preview = cv2.normalize(preview, None, 0, 255, cv2.NORM_MINMAX)
        preview = preview.astype(np.uint8)

    preview = np.ascontiguousarray(preview)

    height, width = preview.shape[:2]
    max_width = max(1, settings.stream_preview_width)
    if width > max_width:
        preview_height = max(1, round(height * (max_width / width)))
        preview = cv2.resize(
            preview,
            (max_width, preview_height),
            interpolation=cv2.INTER_AREA,
        )

    quality = min(95, max(20, int(settings.stream_preview_jpeg_quality)))
    ok, encoded = cv2.imencode(
        ".jpg",
        preview,
        [int(cv2.IMWRITE_JPEG_QUALITY), quality],
    )
    if not ok:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(encoded).decode("ascii")


async def _process_frame(
    websocket: WebSocket,
    frame: np.ndarray,
    face_service,
    attendance_service,
    undetected_face_service,
    source_type: str,
) -> None:
    started = perf_counter()
    async with SessionLocal() as db:
        recognized_faces = await run_in_threadpool(face_service.recognize_faces, frame)
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
                ok, mark_message = await attendance_service.mark_attendance(
                    db, int(person_id), confidence, cropped
                )
                attendance_marked = ok
                message = mark_message
                any_match = True
            elif face is not None:
                try:
                    cropped = crop_face(frame, face.bbox)
                    if cropped.size > 0:
                        await undetected_face_service.capture_unknown_face(
                            db, cropped, source_type
                        )
                except Exception as exc:
                    logger.warning("Failed to capture undetected face: %s", exc)

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
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "person_id": primary.get("person_id") if primary else None,
            "name": primary.get("name") if primary else None,
            "confidence": float(primary.get("confidence") or 0.0) if primary else 0.0,
            "attendance_marked": bool(primary.get("attendance_marked"))
            if primary
            else False,
            "message": primary.get("message") if primary else "No match",
            "bbox": primary.get("bbox") if primary else None,
            "frame_width": int(frame.shape[1]),
            "frame_height": int(frame.shape[0]),
            "faces": faces_payload,
            "face_count": len(faces_payload),
            "any_match": any_match,
            "processing_ms": round((perf_counter() - started) * 1000, 2),
        }

        if source_type in _SERVER_SOURCE_TYPES:
            frame_image = await run_in_threadpool(_encode_preview_frame, frame)
            if frame_image:
                payload["frame_image"] = frame_image

        await websocket.send_text(json.dumps(payload))


@router.websocket("/ws/process")
async def process_stream_socket(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token") or websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=1008)
        return

    async with SessionLocal() as auth_db:
        try:
            user = await authenticate_access_token(token, auth_db)
        except Exception:
            await websocket.close(code=1008)
            return

        # Role gate: only admin and teacher may access the live webcam feed.
        # Students are explicitly excluded for privacy reasons.
        user_role = user.role or (ROLE_ADMIN if user.is_admin else "")
        if user_role not in _WEBCAM_ALLOWED_ROLES:
            logger.warning(
                "WebSocket access denied role=%s username=%s",
                user_role,
                user.username,
            )
            try:
                await log_audit_event(
                    auth_db,
                    actor=user,
                    action="webcam_access_denied",
                    entity_type="websocket",
                    entity_id=None,
                    metadata={"role": user_role, "reason": "insufficient_role"},
                )
            except Exception:
                pass
            await websocket.close(code=1008)
            return


    await websocket.accept()
    try:
        config = await websocket.receive_json()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected before config payload")
        return

    source_type = str(config.get("source_type", "webcam")).strip().lower()
    source_path = config.get("source_path")
    if source_type == "webcam":
        source_type = "browser_webcam"

    if source_type not in _ALLOWED_SOURCE_TYPES:
        await websocket.send_json(
            {
                "type": "error",
                "fatal": True,
                "message": f"Unsupported source type: {source_type}",
            }
        )
        await websocket.close(code=1003)
        return

    face_service = websocket.app.state.face_service
    attendance_service = websocket.app.state.attendance_service
    undetected_face_service = websocket.app.state.undetected_face_service

    if source_type == "file" and source_path:
        resolved_source = Path(source_path).resolve()
        if not resolved_source.is_relative_to(VIDEO_UPLOADS_ROOT.resolve()):
            await websocket.send_json(
                {
                    "type": "error",
                    "fatal": True,
                    "message": "Invalid source path",
                }
            )
            await websocket.close(code=1008)
            return
        source_path = str(resolved_source)

    ingestion = VideoIngestionService(source_type=source_type, source_path=source_path)

    async def on_stream_status(payload: dict[str, object]) -> None:
        await websocket.send_json(payload)

    async def on_frame(frame) -> None:
        await _process_frame(
            websocket,
            frame,
            face_service,
            attendance_service,
            undetected_face_service,
            source_type,
        )

    try:
        if source_type == "browser_webcam":
            while True:
                message = await websocket.receive_json()
                msg_type = message.get("type")
                if msg_type == "stop":
                    break
                if msg_type != "frame":
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": f"Unsupported message type: {msg_type}",
                        }
                    )
                    continue

                raw_image = message.get("image", "")
                if (
                    isinstance(raw_image, str)
                    and len(raw_image.encode("utf-8")) > settings.max_ws_frame_bytes
                ):
                    await websocket.send_json(
                        {"type": "error", "message": "Frame payload too large"}
                    )
                    continue

                frame = await run_in_threadpool(_decode_data_url_image, raw_image)
                if frame is None:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid webcam frame payload"}
                    )
                    continue

                await _process_frame(
                    websocket,
                    frame,
                    face_service,
                    attendance_service,
                    undetected_face_service,
                    source_type,
                )
        else:
            await ingestion.process_stream(on_frame, on_stream_status)

        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as exc:
        logger.exception("WebSocket processing failed: %s", exc)
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json(
                {"type": "error", "fatal": True, "message": str(exc)}
            )
    finally:
        ingestion.stop()
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.close()
            except RuntimeError:
                # Close frame already sent or connection already closed.
                pass
