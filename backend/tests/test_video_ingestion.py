import numpy as np
import pytest

from app.services import video_ingestion
from app.services.video_ingestion import VideoIngestionService


class FakeCapture:
    def __init__(self, *, opened=True, reads=None):
        self.opened = opened
        self.reads = list(reads or [])
        self.released = False

    def isOpened(self):
        return self.opened

    def read(self):
        if not self.reads:
            return False, None
        return self.reads.pop(0)

    def release(self):
        self.released = True


@pytest.mark.asyncio
async def test_file_stream_emits_frames_and_completion_status(monkeypatch):
    frame = np.zeros((10, 20, 3), dtype=np.uint8)
    capture = FakeCapture(reads=[(True, frame), (False, None)])
    monkeypatch.setattr(video_ingestion.cv2, "VideoCapture", lambda *args: capture)
    monkeypatch.setattr(video_ingestion.settings, "frame_process_interval", 0.0)

    frames = []
    statuses = []
    service = VideoIngestionService("file", "sample.mp4")

    await service.process_stream(
        lambda item: _append_async(frames, item),
        lambda payload: _append_async(statuses, payload),
    )

    assert len(frames) == 1
    assert frames[0] is frame
    assert [item["status"] for item in statuses] == [
        "opening",
        "connected",
        "ended",
        "stopped",
    ]
    assert capture.released is True


def test_rtsp_source_rejects_non_rtsp_url():
    service = VideoIngestionService("rtsp", "http://camera.local/live")

    with pytest.raises(ValueError, match="rtsp:// or rtsps://"):
        service._validate_source()


@pytest.mark.asyncio
async def test_rtsp_open_error_masks_credentials(monkeypatch):
    capture = FakeCapture(opened=False)
    monkeypatch.setattr(video_ingestion.cv2, "VideoCapture", lambda *args: capture)

    service = VideoIngestionService(
        "rtsp",
        "rtsp://admin:super-secret@camera.local:554/live",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await service._open_checked_capture()

    message = str(exc_info.value)
    assert "super-secret" not in message
    assert "rtsp://***:***@camera.local:554/live" in message
    assert capture.released is True


def test_rtsp_open_falls_back_when_ffmpeg_backend_does_not_open(monkeypatch):
    ffmpeg_capture = FakeCapture(opened=False)
    generic_capture = FakeCapture(opened=True)
    captures = [ffmpeg_capture, generic_capture]
    calls = []

    def fake_video_capture(*args):
        calls.append(args)
        return captures.pop(0)

    monkeypatch.setattr(video_ingestion.cv2, "VideoCapture", fake_video_capture)

    service = VideoIngestionService("rtsp", "rtsp://camera.local/live")
    capture = service._open_capture()

    assert capture is generic_capture
    assert ffmpeg_capture.released is True
    assert calls == [
        ("rtsp://camera.local/live", video_ingestion.cv2.CAP_FFMPEG),
        ("rtsp://camera.local/live",),
    ]


@pytest.mark.asyncio
async def test_rtsp_reconnects_after_failed_read(monkeypatch):
    frame = np.zeros((12, 16, 3), dtype=np.uint8)
    first_capture = FakeCapture(reads=[(False, None)])
    second_capture = FakeCapture(reads=[(True, frame)])
    captures = [first_capture, second_capture]

    monkeypatch.setattr(
        video_ingestion.cv2,
        "VideoCapture",
        lambda *args: captures.pop(0),
    )
    monkeypatch.setattr(video_ingestion.settings, "frame_process_interval", 0.0)
    monkeypatch.setattr(video_ingestion.settings, "rtsp_read_failure_threshold", 1)
    monkeypatch.setattr(video_ingestion.settings, "rtsp_reconnect_attempts", 2)
    monkeypatch.setattr(
        video_ingestion.settings,
        "rtsp_reconnect_base_delay_seconds",
        0.0,
    )
    monkeypatch.setattr(
        video_ingestion.settings,
        "rtsp_reconnect_max_delay_seconds",
        0.0,
    )

    frames = []
    statuses = []
    service = VideoIngestionService("rtsp", "rtsp://camera.local/live")

    async def on_frame(item):
        frames.append(item)
        service.stop()

    await service.process_stream(
        on_frame,
        lambda payload: _append_async(statuses, payload),
    )

    assert len(frames) == 1
    assert frames[0] is frame
    assert first_capture.released is True
    assert second_capture.released is True
    assert any(item["status"] == "reconnecting" for item in statuses)
    assert any(item.get("reconnect_attempt") == 1 for item in statuses)


async def _append_async(items, item):
    items.append(item)
