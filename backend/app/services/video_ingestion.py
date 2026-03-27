import asyncio
import logging
from typing import Awaitable, Callable

import cv2
import numpy as np

from app.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()

FrameCallback = Callable[[np.ndarray], Awaitable[None]]


class VideoIngestionService:
    def __init__(self, source_type: str, source_path: str | None = None) -> None:
        self.source_type = source_type
        self.source_path = source_path
        self._running = False

    def _open_capture(self) -> cv2.VideoCapture:
        if self.source_type == "file":
            if not self.source_path:
                raise ValueError("source_path is required for file source")
            return cv2.VideoCapture(self.source_path)
        if self.source_type == "webcam":
            return cv2.VideoCapture(0 if not self.source_path else int(self.source_path))
        if self.source_type == "rtsp":
            if not self.source_path:
                raise ValueError("source_path is required for rtsp source")
            return cv2.VideoCapture(self.source_path)
        raise ValueError(f"Unsupported source_type: {self.source_type}")

    async def process_stream(self, frame_callback: FrameCallback) -> None:
        capture = self._open_capture()
        self._running = True
        try:
            while self._running:
                ok, frame = capture.read()
                if not ok or frame is None:
                    if self.source_type == "file":
                        break
                    await asyncio.sleep(settings.frame_process_interval)
                    continue

                await frame_callback(frame)
                await asyncio.sleep(settings.frame_process_interval)
        except Exception as exc:
            logger.exception("Video processing failed: %s", exc)
        finally:
            capture.release()
            self._running = False

    def stop(self) -> None:
        self._running = False
