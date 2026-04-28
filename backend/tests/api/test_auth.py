"""
Tests for /api/auth router.

Key facts from the implementation:
- POST /api/auth/login    → TokenResponse (access_token, refresh_token, token_type, expires_at, username, role, is_admin)
  - Sends LoginRequest as JSON body (not form data)
  - Invalid credentials raise 401 with detail "Invalid credentials"
- POST /api/auth/logout   → {"message": "Logged out"}
- GET  /api/auth/me       → UserMeResponse (username, is_admin, role, email)
- POST /api/auth/refresh  → TokenResponse
- No auto-admin-creation on empty DB in this implementation.
"""
import pytest
from app.utils.security import create_refresh_token


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_success(client, setup_users):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "adminpass"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert body["username"] == "admin"
    assert body["role"] == "admin"
    assert body["is_admin"] is True


@pytest.mark.asyncio
async def test_login_wrong_password(client, setup_users):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong_password"},
    )
    assert resp.status_code == 401
    assert "Invalid credentials" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "ghost_user", "password": "any_password"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_teacher(client, setup_users):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "teacher", "password": "teacherpass"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "teacher"
    assert resp.json()["is_admin"] is False


@pytest.mark.asyncio
async def test_login_student(client, setup_users):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "student", "password": "studentpass"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "student"


# ---------------------------------------------------------------------------
# /me tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_me(client, setup_users, admin_token):
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "admin"
    assert body["role"] == "admin"
    assert body["is_admin"] is True
    assert "hashed_password" not in body


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_teacher(client, setup_users, teacher_token):
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {teacher_token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "teacher"


# ---------------------------------------------------------------------------
# Logout tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_logout(client):
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out"


# ---------------------------------------------------------------------------
# Refresh tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_with_valid_token(client, setup_users):
    """First login to get a real refresh token, then refresh it."""
    login_resp = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "adminpass"},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]

    refresh_resp = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    body = refresh_resp.json()
    assert "access_token" in body
    assert body["username"] == "admin"


@pytest.mark.asyncio
async def test_refresh_with_invalid_token(client):
    resp = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": "not.a.valid.token"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_with_no_token(client):
    resp = await client.post("/api/auth/refresh", json={})
    assert resp.status_code == 401
