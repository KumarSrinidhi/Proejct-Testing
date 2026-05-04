import asyncio
import logging
import os
from urllib.parse import urlsplit, urlunsplit
from typing import Awaitable, Callable

from fastapi.concurrency import run_in_threadpool
import cv2
import numpy as np

from app.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()

FrameCallback = Callable[[np.ndarray], Awaitable[None]]
StatusCallback = Callable[[dict[str, object]], Awaitable[None]]

_VALID_SOURCE_TYPES = {"file", "webcam", "rtsp"}
_VALID_RTSP_SCHEMES = {"rtsp", "rtsps"}


class VideoIngestionService:
    def __init__(self, source_type: str, source_path: str | None = None) -> None:
        self.source_type = source_type.strip().lower()
        self.source_path = str(source_path).strip() if source_path is not None else None
        self._running = False

    @staticmethod
    def _mask_sensitive_url(value: str | None) -> str:
        if not value:
            return ""
        try:
            parsed = urlsplit(value)
        except ValueError:
            return "<invalid-url>"
        if parsed.scheme.lower() not in _VALID_RTSP_SCHEMES or not parsed.netloc:
            return value

        try:
            port = parsed.port
        except ValueError:
            port = None

        host = parsed.hostname or parsed.netloc.rsplit("@", 1)[-1]
        if port:
            host = f"{host}:{port}"
        if parsed.username or parsed.password:
            host = f"***:***@{host}"
        return urlunsplit(
            (parsed.scheme, host, parsed.path, parsed.query, parsed.fragment)
        )

    def _validate_source(self) -> None:
        if self.source_type not in _VALID_SOURCE_TYPES:
            raise ValueError(f"Unsupported source_type: {self.source_type}")
        if self.source_type == "file" and not self.source_path:
            raise ValueError("source_path is required for file source")
        if self.source_type == "rtsp":
            if not self.source_path:
                raise ValueError("source_path is required for rtsp source")
            try:
                parsed = urlsplit(self.source_path)
            except ValueError as exc:
                raise ValueError("RTSP source URL is invalid") from exc
            try:
                parsed.port
            except ValueError as exc:
                raise ValueError("RTSP source URL is invalid") from exc
            if parsed.scheme.lower() not in _VALID_RTSP_SCHEMES or not parsed.netloc:
                raise ValueError("RTSP source URL must start with rtsp:// or rtsps://")

    def _set_capture_property(
        self, capture: cv2.VideoCapture, prop_name: str, value: int
    ) -> None:
        prop_id = getattr(cv2, prop_name, None)
        if prop_id is None:
            return
        if not hasattr(capture, "set"):
            return
        try:
            capture.set(prop_id, value)
        except cv2.error:
            logger.debug("OpenCV ignored capture property %s", prop_name, exc_info=True)

    def _open_rtsp_capture(self) -> cv2.VideoCapture:
        option_candidates = [
            settings.rtsp_ffmpeg_capture_options,
            "rtsp_transport;udp|stimeout;8000000|max_delay;500000",
            "",
        ]

        last_capture: cv2.VideoCapture | None = None
        for options in option_candidates:
            if options:
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = options
            else:
                os.environ.pop("OPENCV_FFMPEG_CAPTURE_OPTIONS", None)

            capture = cv2.VideoCapture(self.source_path, cv2.CAP_FFMPEG)
            if not capture.isOpened():
                capture.release()
                capture = cv2.VideoCapture(self.source_path)

            last_capture = capture
            if capture.isOpened():
                if options:
                    logger.info("RTSP capture opened with FFmpeg options: %s", options)
                else:
                    logger.info("RTSP capture opened with default FFmpeg options")
                break

        if last_capture is None:
            last_capture = cv2.VideoCapture(self.source_path)

        self._set_capture_property(
            last_capture,
            "CAP_PROP_OPEN_TIMEOUT_MSEC",
            int(settings.rtsp_open_timeout_seconds * 1000),
        )
        self._set_capture_property(
            last_capture,
            "CAP_PROP_READ_TIMEOUT_MSEC",
            int(settings.rtsp_read_timeout_seconds * 1000),
        )
        self._set_capture_property(
            last_capture,
            "CAP_PROP_BUFFERSIZE",
            settings.rtsp_capture_buffer_size,
        )
        return last_capture

    def _open_capture(self) -> cv2.VideoCapture:
        self._validate_source()
        if self.source_type == "file":
            return cv2.VideoCapture(self.source_path)
        if self.source_type == "webcam":
            camera_index = 0 if not self.source_path else int(self.source_path)
            return cv2.VideoCapture(camera_index)
        if self.source_type == "rtsp":
            return self._open_rtsp_capture()
        raise ValueError(f"Unsupported source_type: {self.source_type}")

    async def _emit_status(
        self, status_callback: StatusCallback | None, **payload: object
    ) -> None:
        if status_callback is None:
            return
        await status_callback({"type": "stream_status", **payload})

    async def _open_checked_capture(self) -> cv2.VideoCapture:
        capture = await run_in_threadpool(self._open_capture)
        if not capture.isOpened():
            capture.release()
            if self.source_type == "webcam":
                raise RuntimeError(
                    "Unable to open webcam source on backend host. "
                    "Set webcam Source Path to a valid camera index (for example 0, 1) "
                    "or use Video File input."
                )
            if self.source_type == "rtsp":
                safe_source = self._mask_sensitive_url(self.source_path)
                raise RuntimeError(
                    "Unable to open RTSP source. Verify the camera URL, credentials, "
                    f"codec support, and backend network access. Source={safe_source}"
                )
            raise RuntimeError(
                f"Unable to open {self.source_type} source: {self.source_path}"
            )
        return capture

    async def process_stream(
        self,
        frame_callback: FrameCallback,
        status_callback: StatusCallback | None = None,
    ) -> None:
        self._running = True
        capture: cv2.VideoCapture | None = None
        read_failures = 0
        reconnect_attempts = 0
        read_failure_threshold = max(1, settings.rtsp_read_failure_threshold)
        max_reconnect_attempts = max(0, settings.rtsp_reconnect_attempts)
        try:
            await self._emit_status(status_callback, status="opening")
            capture = await self._open_checked_capture()
            await self._emit_status(status_callback, status="connected")

            while self._running:
                if capture is None:
                    raise RuntimeError("Video capture is not initialized")
                ok, frame = await run_in_threadpool(capture.read)
                if not ok or frame is None:
                    if self.source_type == "file":
                        await self._emit_status(status_callback, status="ended")
                        break
                    if self.source_type == "rtsp":
                        read_failures += 1
                        if read_failures < read_failure_threshold:
                            if settings.frame_process_interval and settings.frame_process_interval > 0:
                                await asyncio.sleep(settings.frame_process_interval)
                            continue

                        capture.release()
                        capture = None
                        if max_reconnect_attempts <= 0:
                            raise RuntimeError(
                                "RTSP stream stopped after repeated read failures"
                            )

                        while (
                            reconnect_attempts < max_reconnect_attempts
                            and self._running
                        ):
                            reconnect_attempts += 1
                            delay = min(
                                settings.rtsp_reconnect_base_delay_seconds
                                * (2 ** (reconnect_attempts - 1)),
                                settings.rtsp_reconnect_max_delay_seconds,
                            )
                            await self._emit_status(
                                status_callback,
                                status="reconnecting",
                                attempt=reconnect_attempts,
                                delay_seconds=round(delay, 2),
                            )
                            await asyncio.sleep(delay)

                            try:
                                capture = await self._open_checked_capture()
                            except Exception as exc:
                                logger.warning(
                                    "RTSP reconnect attempt %s failed: %s",
                                    reconnect_attempts,
                                    exc,
                                )
                                if reconnect_attempts >= max_reconnect_attempts:
                                    raise RuntimeError(
                                        "Unable to reconnect to RTSP stream"
                                    ) from exc
                                continue

                            read_failures = 0
                            await self._emit_status(
                                status_callback,
                                status="connected",
                                reconnect_attempt=reconnect_attempts,
                            )
                            break
                        continue
                    if settings.frame_process_interval and settings.frame_process_interval > 0:
                        await asyncio.sleep(settings.frame_process_interval)
                    continue

                read_failures = 0
                reconnect_attempts = 0
                await frame_callback(frame)
                if settings.frame_process_interval and settings.frame_process_interval > 0:
                    await asyncio.sleep(settings.frame_process_interval)
            await self._emit_status(status_callback, status="stopped")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Video processing failed: %s", exc)
            raise
        finally:
            if capture is not None:
                capture.release()
            self._running = False

    def stop(self) -> None:
        self._running = False
