import pytest
from app.models.undetected_face import UndetectedFace
from datetime import datetime

@pytest.fixture
async def sample_undetected_face(db_session):
    uf = UndetectedFace(
        image_path="/tmp/fake_image.jpg",
        source_type="stream",
        reviewed=False,
        created_at=datetime.utcnow()
    )
    db_session.add(uf)
    await db_session.commit()
    await db_session.refresh(uf)
    return uf

@pytest.mark.asyncio
async def test_get_undetected_faces(client, admin_token, sample_undetected_face):
    response = await client.get("/api/undetected-faces", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) >= 1

@pytest.mark.asyncio
async def test_update_undetected_face_review(client, admin_token, sample_undetected_face):
    response = await client.put(
        f"/api/undetected-faces/{sample_undetected_face.id}/review",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"reviewed": True}
    )
    assert response.status_code == 200
    assert response.json()["reviewed"] is True

@pytest.mark.asyncio
async def test_delete_undetected_face(client, admin_token, sample_undetected_face):
    response = await client.delete(
        f"/api/undetected-faces/{sample_undetected_face.id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200

    # Ensure it's gone
    resp_get = await client.get("/api/undetected-faces", headers={"Authorization": f"Bearer {admin_token}"})
    assert len([x for x in resp_get.json()["items"] if x["id"] == sample_undetected_face.id]) == 0
