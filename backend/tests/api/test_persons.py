"""
Tests for /api/persons router.

Key facts:
- POST   /api/persons       → PersonRead
- GET    /api/persons        → PersonListResponse
- GET    /api/persons/{id}  → PersonDetail (has image_count + attendance_count)
- PUT    /api/persons/{id}  → PersonRead
- DELETE /api/persons/{id}  → soft-delete (sets is_active=False, returns {"message": "Person deactivated"})
"""
import pytest


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_person(client, admin_token):
    resp = await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "department": "Engineering",
            "create_user_account": False,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Jane Doe"
    assert body["email"] == "jane@example.com"
    assert body["department"] == "Engineering"
    assert "id" in body
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_create_person_duplicate_email(client, admin_token):
    payload = {
        "name": "Dup Person",
        "email": "dup@example.com",
        "department": "Finance",
        "create_user_account": False,
    }
    await client.post("/api/persons", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
    resp = await client.post("/api/persons", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_person_requires_admin(client, student_token):
    resp = await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "name": "Sneaky",
            "email": "sneaky@example.com",
            "department": "X",
            "create_user_account": False,
        },
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_persons(client, admin_token):
    # Create one person first
    await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "List Person",
            "email": "listperson@example.com",
            "department": "HR",
            "create_user_account": False,
        },
    )
    resp = await client.get("/api/persons", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert body["total"] >= 1


@pytest.mark.asyncio
async def test_get_person_by_id(client, admin_token):
    create_resp = await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Detail Person",
            "email": "detail@example.com",
            "department": "R&D",
            "create_user_account": False,
        },
    )
    assert create_resp.status_code == 200
    person_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/persons/{person_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == person_id
    assert body["name"] == "Detail Person"
    assert "image_count" in body       # PersonDetail schema
    assert "attendance_count" in body


@pytest.mark.asyncio
async def test_get_person_not_found(client, admin_token):
    resp = await client.get("/api/persons/999999", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_person(client, admin_token):
    create_resp = await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Bob Builder",
            "email": "bob@example.com",
            "department": "Construction",
            "create_user_account": False,
        },
    )
    person_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/persons/{person_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"department": "Architecture"},
    )
    assert resp.status_code == 200
    assert resp.json()["department"] == "Architecture"
    # Name should be unchanged
    assert resp.json()["name"] == "Bob Builder"


@pytest.mark.asyncio
async def test_update_person_not_found(client, admin_token):
    resp = await client.put(
        "/api/persons/999999",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"department": "Nowhere"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_person_soft_deletes(client, admin_token):
    """DELETE soft-deactivates the person; subsequent GET still returns 200 (person exists)."""
    create_resp = await client.post(
        "/api/persons",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "To Deactivate",
            "email": "deactivate@example.com",
            "department": "DevNull",
            "create_user_account": False,
        },
    )
    person_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/persons/{person_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Person deactivated"

    # Person still exists in DB (soft delete), so GET /api/persons/{id} returns 200
    get_resp = await client.get(
        f"/api/persons/{person_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] is False


@pytest.mark.asyncio
async def test_delete_person_not_found(client, admin_token):
    resp = await client.delete("/api/persons/999999", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 404
