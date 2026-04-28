from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import numpy as np
import pytest

from app.models.attendance import Attendance
from app.models.person import Person
from app.services.attendance_service import AttendanceService


@pytest.mark.asyncio
async def test_mark_attendance_success(db_session) -> None:
    service = AttendanceService()
    person = Person(name="Test Person", email="test.person@example.com", department="QA")
    db_session.add(person)
    await db_session.commit()
    await db_session.refresh(person)
    frame = np.zeros((64, 64, 3), dtype=np.uint8)

    with patch(
        "app.services.attendance_service.save_cropped_face", return_value="crop.jpg"
    ):
        ok, message = await service.mark_attendance(
            db=db_session, person_id=person.id, confidence=0.95, cropped_face=frame
        )

    assert ok is True
    assert message == "Attendance marked"
    result = await db_session.execute(
        Attendance.__table__.select().where(Attendance.person_id == person.id)
    )
    rows = result.fetchall()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_mark_attendance_window_blocked(db_session) -> None:
    service = AttendanceService()
    person = Person(name="Test Person", email="test.person2@example.com", department="QA")
    db_session.add(person)
    await db_session.commit()
    await db_session.refresh(person)
    frame = np.zeros((64, 64, 3), dtype=np.uint8)

    existing = Attendance(
        person_id=person.id,
        timestamp=datetime.now(timezone.utc) - timedelta(seconds=10),
        confidence_score=0.9,
        cropped_face_path="/tmp/existing.jpg",
    )
    db_session.add(existing)
    await db_session.commit()

    ok, message = await service.mark_attendance(
        db=db_session, person_id=person.id, confidence=0.95, cropped_face=frame
    )

    assert ok is False
    assert "Attendance already marked" in message


@pytest.mark.asyncio
async def test_mark_attendance_after_window_expires(db_session) -> None:
    service = AttendanceService()
    person = Person(name="Test Person", email="test.person3@example.com", department="QA")
    db_session.add(person)
    await db_session.commit()
    await db_session.refresh(person)
    frame = np.zeros((64, 64, 3), dtype=np.uint8)

    existing = Attendance(
        person_id=person.id,
        timestamp=datetime.now(timezone.utc) - timedelta(hours=3),
        confidence_score=0.9,
        cropped_face_path="/tmp/existing-old.jpg",
    )
    db_session.add(existing)
    await db_session.commit()

    with patch(
        "app.services.attendance_service.save_cropped_face", return_value="crop.jpg"
    ):
        ok, message = await service.mark_attendance(
            db=db_session, person_id=person.id, confidence=0.95, cropped_face=frame
        )

    assert ok is True
    assert message == "Attendance marked"


@pytest.mark.asyncio
async def test_mark_attendance_handles_naive_timestamp(db_session) -> None:
    service = AttendanceService()
    person = Person(name="Test Person", email="test.person4@example.com", department="QA")
    db_session.add(person)
    await db_session.commit()
    await db_session.refresh(person)
    frame = np.zeros((64, 64, 3), dtype=np.uint8)

    existing = Attendance(
        person_id=person.id,
        timestamp=datetime.utcnow() - timedelta(seconds=10),
        confidence_score=0.9,
        cropped_face_path="/tmp/existing-naive.jpg",
    )
    db_session.add(existing)
    await db_session.commit()

    ok, message = await service.mark_attendance(
        db=db_session, person_id=person.id, confidence=0.95, cropped_face=frame
    )

    assert ok is False
    assert "Attendance already marked" in message
