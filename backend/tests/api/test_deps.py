"""
Tests for app/api/deps.py.

We test the dependency functions by:
1. For get_current_user / role guards: hitting the real app routes that use them
   (e.g. GET /api/auth/me requires a valid token + user in DB)
2. For check_login_rate_limit / record_login_attempt: calling functions directly.
"""
import pytest
from fastapi import HTTPException

from app.api.deps import (
    check_login_rate_limit,
    record_login_attempt,
)


# ---------------------------------------------------------------------------
# get_current_user / role tests — exercised via real app routes
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_current_user_no_token(client):
    """Missing token → 401."""
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    assert "Missing bearer token" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user_invalid_token(client):
    """Malformed JWT → 401."""
    resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401
    assert "Invalid token" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user_valid_token(client, admin_token):
    """Valid token for a user that exists in DB → 200."""
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "admin"


@pytest.mark.asyncio
async def test_get_current_user_valid_cookie(client, student_token):
    """Token sent as cookie → 200."""
    client.cookies.set("access_token", student_token)
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == "student"
    client.cookies.clear()


@pytest.mark.asyncio
async def test_require_admin_success(client, admin_token):
    """Admin token can access admin-only endpoints."""
    resp = await client.get("/api/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_admin_forbidden_for_student(client, student_token):
    """Student token is rejected from admin-only endpoints."""
    resp = await client.get("/api/users", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_require_teacher_or_admin_teacher(client, teacher_token):
    """Teacher can access teacher-or-admin endpoints."""
    resp = await client.get("/api/attendance", headers={"Authorization": f"Bearer {teacher_token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_teacher_or_admin_admin(client, admin_token):
    """Admin can also access teacher-or-admin endpoints."""
    resp = await client.get("/api/attendance", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_teacher_or_admin_student_forbidden(client, student_token):
    """Student is rejected from teacher-or-admin endpoints."""
    resp = await client.get("/api/attendance", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Rate limit tests — called directly with the DB session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_rate_limit_not_triggered(db_session):
    """Under the attempt limit → no exception raised."""
    await record_login_attempt("almost_rate_limited", db_session)
    # Should not raise (only 1 attempt, default limit is 5)
    await check_login_rate_limit("almost_rate_limited", db_session)  # no exception


@pytest.mark.asyncio
async def test_login_rate_limit_triggered(db_session):
    """Exceed the attempt limit → 429 HTTPException."""
    username = "spammer_user"
    for _ in range(5):
        await record_login_attempt(username, db_session)

    with pytest.raises(HTTPException) as exc_info:
        await check_login_rate_limit(username, db_session)

    assert exc_info.value.status_code == 429
    assert exc_info.value.detail == "Too many login attempts"
