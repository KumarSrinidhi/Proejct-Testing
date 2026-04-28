"""
Tests for the /api/attendance router.

Attendance records are created only by the WebSocket stream (no POST endpoint).
We seed Attendance rows directly in the DB via the db_session fixture.
"""
import pytest
from datetime import datetime, timezone

from app.models.attendance import Attendance


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture
async def seeded_attendance(db_session, client, admin_token):
    """Create a Person via API, then seed an Attendance row in the DB."""
    resp = await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Attendance Tester",
            "email": "attend_test@example.com",
            "department": "QA",
            "create_user_account": False,
        },
    )
    assert resp.status_code == 200, resp.text
    person_id = resp.json()["id"]

    record = Attendance(
        person_id=person_id,
        timestamp=datetime(2025, 1, 15, 9, 0, 0, tzinfo=timezone.utc),
        confidence_score=0.95,
        cropped_face_path="/tmp/face.jpg",
    )
    db_session.add(record)
    await db_session.commit()
    await db_session.refresh(record)
    return person_id, record


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_attendance_empty(client, admin_token):
    resp = await client.get("/api/attendance", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert isinstance(body["items"], list)


@pytest.mark.asyncio
async def test_list_attendance_with_records(client, admin_token, seeded_attendance):
    resp = await client.get("/api/attendance", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    first = body["items"][0]
    assert "id" in first
    assert "person_id" in first
    assert "confidence_score" in first


@pytest.mark.asyncio
async def test_list_attendance_requires_auth(client):
    resp = await client.get("/api/attendance")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_today_summary(client, admin_token):
    resp = await client.get("/api/attendance/today", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "total_today" in body
    assert "unique_today" in body
    assert "avg_confidence" in body


@pytest.mark.asyncio
async def test_update_attendance(client, admin_token, seeded_attendance):
    _, record = seeded_attendance
    resp = await client.put(
        f"/api/attendance/{record.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"timestamp": "2025-01-15T10:30:00Z", "confidence_score": 0.87},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == record.id
    assert abs(body["confidence_score"] - 0.87) < 0.001


@pytest.mark.asyncio
async def test_update_attendance_invalid_confidence(client, admin_token, seeded_attendance):
    """confidence_score must be in [0.0, 1.0]."""
    _, record = seeded_attendance
    resp = await client.put(
        f"/api/attendance/{record.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"timestamp": "2025-01-15T10:30:00Z", "confidence_score": 1.5},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_attendance_not_found(client, admin_token):
    resp = await client.put(
        "/api/attendance/999999",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"timestamp": "2025-01-15T10:30:00Z", "confidence_score": 0.5},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_attendance(client, admin_token, seeded_attendance):
    _, record = seeded_attendance
    resp = await client.delete(
        f"/api/attendance/{record.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Attendance record deleted"


@pytest.mark.asyncio
async def test_delete_attendance_not_found(client, admin_token):
    resp = await client.delete("/api/attendance/999999", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_export_csv(client, admin_token):
    resp = await client.get("/api/attendance/export", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_list_my_attendance(client, student_token):
    resp = await client.get("/api/attendance/mine", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 200
