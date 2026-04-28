"""
Tests for /api/attendance-exceptions router.

Valid exception_types: late, excused, manual_adjustment, absence
Schema for create: { attendance_id, exception_type, reason }
"""
import pytest
from datetime import datetime, timezone

from app.models.attendance import Attendance


@pytest.fixture
async def seeded_attendance(db_session, client, admin_token):
    """Create a Person via API and seed an Attendance row directly in the DB."""
    resp = await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Exception Subject",
            "email": "exc_subject@example.com",
            "department": "IT",
            "create_user_account": False,
        },
    )
    assert resp.status_code == 200, resp.text
    person_id = resp.json()["id"]

    record = Attendance(
        person_id=person_id,
        timestamp=datetime(2025, 3, 10, 8, 0, 0, tzinfo=timezone.utc),
        confidence_score=0.90,
        cropped_face_path="/tmp/exc_face.jpg",
    )
    db_session.add(record)
    await db_session.commit()
    await db_session.refresh(record)
    return record


@pytest.mark.asyncio
async def test_list_exceptions_empty(client, admin_token):
    resp = await client.get("/api/attendance-exceptions", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert isinstance(body["items"], list)


@pytest.mark.asyncio
async def test_list_exceptions_requires_auth(client):
    resp = await client.get("/api/attendance-exceptions")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_exception_late(client, admin_token, seeded_attendance):
    resp = await client.post(
        "/api/attendance-exceptions",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "attendance_id": seeded_attendance.id,
            "exception_type": "late",
            "reason": "Traffic jam on motorway.",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["attendance_id"] == seeded_attendance.id
    assert body["exception_type"] == "late"
    assert body["reason"] == "Traffic jam on motorway."
    assert "id" in body
    assert "created_at" in body


@pytest.mark.asyncio
async def test_create_exception_excused(client, admin_token, seeded_attendance):
    resp = await client.post(
        "/api/attendance-exceptions",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "attendance_id": seeded_attendance.id,
            "exception_type": "excused",
            "reason": "Medical appointment.",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["exception_type"] == "excused"


@pytest.mark.asyncio
async def test_create_exception_invalid_type(client, admin_token, seeded_attendance):
    resp = await client.post(
        "/api/attendance-exceptions",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "attendance_id": seeded_attendance.id,
            "exception_type": "holiday",
            "reason": "Vacation.",
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_exception_nonexistent_attendance(client, admin_token):
    resp = await client.post(
        "/api/attendance-exceptions",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "attendance_id": 999999,
            "exception_type": "absence",
            "reason": "Ghost record.",
        },
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_exceptions_filtered(client, admin_token, seeded_attendance):
    await client.post(
        "/api/attendance-exceptions",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "attendance_id": seeded_attendance.id,
            "exception_type": "absence",
            "reason": "No show.",
        },
    )
    resp = await client.get(
        f"/api/attendance-exceptions?attendance_id={seeded_attendance.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert item["attendance_id"] == seeded_attendance.id


@pytest.mark.asyncio
async def test_create_exception_teacher_allowed(client, teacher_token, seeded_attendance):
    resp = await client.post(
        "/api/attendance-exceptions",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={
            "attendance_id": seeded_attendance.id,
            "exception_type": "manual_adjustment",
            "reason": "System error corrected.",
        },
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_create_exception_student_forbidden(client, student_token, seeded_attendance):
    resp = await client.post(
        "/api/attendance-exceptions",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "attendance_id": seeded_attendance.id,
            "exception_type": "late",
            "reason": "Bus was late.",
        },
    )
    assert resp.status_code == 403
