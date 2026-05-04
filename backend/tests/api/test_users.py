"""
Tests for /api/users router.

Key facts from the implementation:
- GET    /api/users             → UserListResponse  (admin only)
- POST   /api/users             → UserRead          (admin only)
- PUT    /api/users/{id}/role   → UserRead          (admin only)
- PUT    /api/users/{id}/password → {"message": "Password updated"}
- DELETE /api/users/{id}        → {"message": "User deleted"}
- NO GET /api/users/{id} endpoint exists.
- Duplicate username/email returns 409 (not 400).
"""
import pytest
import uuid


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_users(client, admin_token, setup_users):
    resp = await client.get("/api/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert body["total"] >= 3  # admin + teacher + student from setup_users


@pytest.mark.asyncio
async def test_list_users_requires_admin(client, student_token):
    resp = await client.get("/api/users", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_user(client, admin_token, setup_users):
    username = f"newuser_{uuid.uuid4().hex[:8]}"
    resp = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "securepassword",
            "role": "student",
            "create_person_profile": False,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["username"] == username
    assert body["role"] == "student"
    assert "hashed_password" not in body   # must not leak


@pytest.mark.asyncio
async def test_create_user_defaults_without_linked_person(client, admin_token, setup_users):
    username = f"defaultuser_{uuid.uuid4().hex[:8]}"
    resp = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "securepassword",
            "role": "student",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["username"] == username
    assert body["person_name"] is None
    assert body["person_department"] is None


@pytest.mark.asyncio
async def test_create_user_duplicate_username(client, admin_token, setup_users):
    resp = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "admin",          # already created by setup_users
            "email": "other@example.com",
            "password": "password123",
            "role": "student",
            "create_person_profile": False,
        },
    )
    assert resp.status_code == 409         # Conflict, NOT 400


@pytest.mark.asyncio
async def test_create_user_duplicate_email(client, admin_token, setup_users):
    # First create a user with an email
    username = f"emailtest_{uuid.uuid4().hex[:8]}"
    email = f"{username}@example.com"
    await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": username,
            "email": email,
            "password": "password123",
            "role": "student",
            "create_person_profile": False,
        },
    )
    # Try to create another with the same email
    resp = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": f"other_{uuid.uuid4().hex[:8]}",
            "email": email,
            "password": "password123",
            "role": "student",
            "create_person_profile": False,
        },
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_user_role(client, admin_token, setup_users):
    student = setup_users[2]  # the student user
    resp = await client.put(
        f"/api/users/{student.id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "teacher"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "teacher"


@pytest.mark.asyncio
async def test_update_user_role_invalid(client, admin_token, setup_users):
    student = setup_users[2]
    resp = await client.put(
        f"/api/users/{student.id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "superuser"},   # not a valid role
    )
    assert resp.status_code == 422   # Pydantic validation error


@pytest.mark.asyncio
async def test_reset_user_password(client, admin_token, setup_users):
    teacher = setup_users[1]
    resp = await client.put(
        f"/api/users/{teacher.id}/password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"password": "newpassword123"},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Password updated"


@pytest.mark.asyncio
async def test_delete_user(client, admin_token, setup_users):
    student = setup_users[2]
    resp = await client.delete(
        f"/api/users/{student.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "User deleted"


@pytest.mark.asyncio
async def test_delete_user_not_found(client, admin_token):
    resp = await client.delete(
        "/api/users/999999",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_delete_last_admin(client, admin_token, setup_users):
    """Cannot delete the last remaining admin. setup_users has exactly one admin."""
    admin = setup_users[0]
    resp = await client.delete(
        f"/api/users/{admin.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # admin is the current user calling the endpoint — returns 400 "Cannot delete current admin user"
    assert resp.status_code == 400
