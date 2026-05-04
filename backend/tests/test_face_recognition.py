import json
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest

from app.models.person import PersonImage
from app.services.face_recognition import FaceRecognitionService


@pytest.mark.asyncio
async def test_get_person_embedding_averages_and_normalizes() -> None:
    service = FaceRecognitionService()
    db = AsyncMock()

    e1 = np.ones((512,), dtype=np.float32)
    e2 = np.full((512,), 2.0, dtype=np.float32)
    rows = [
        PersonImage(
            person_id=1, image_path="a.jpg", encoding_blob=json.dumps(e1.tolist())
        ),
        PersonImage(
            person_id=1, image_path="b.jpg", encoding_blob=json.dumps(e2.tolist())
        ),
    ]

    result_proxy = MagicMock()
    result_proxy.scalars.return_value.all.return_value = rows
    db.execute.return_value = result_proxy

    emb = await service.get_person_embedding(person_id=1, db=db)

    assert emb is not None
    assert emb.shape == (512,)
    assert np.isclose(np.linalg.norm(emb), 1.0)


def test_recognize_face_threshold() -> None:
    service = FaceRecognitionService()
    service._faiss = None
    service._index = object()
    service._index_to_person_id = [1]
    service._person_name_cache = {1: "Alice"}
    service._embeddings_cache = {1: np.ones((512,), dtype=np.float32).tolist()}

    def fake_extract(_):
        return np.ones((512,), dtype=np.float32), MagicMock(bbox=[0, 0, 10, 10])

    service.extract_embedding = fake_extract
    person_id, name, confidence, _ = service.recognize_face(
        np.zeros((16, 16, 3), dtype=np.uint8)
    )

    assert person_id == 1
    assert name == "Alice"
    assert confidence > 0.6


def test_extract_embedding_uses_resize_fallback() -> None:
    service = FaceRecognitionService()
    image = np.zeros((24, 24, 3), dtype=np.uint8)
    embedding = np.ones((512,), dtype=np.float32)
    face = MagicMock(bbox=[0, 0, 10, 10], embedding=embedding)

    class FakeFaceApp:
        def __init__(self) -> None:
            self.calls = 0

        def get(self, _img):
            self.calls += 1
            if self.calls == 1:
                return []
            return [face]

    service._face_app = FakeFaceApp()

    emb, detected_face = service.extract_embedding(image)

    assert emb is not None
    assert detected_face is face
    assert np.isclose(np.linalg.norm(emb), 1.0)


def test_recognize_faces_uses_batched_search() -> None:
    service = FaceRecognitionService()
    service._faiss = object()
    service._index_to_person_id = [10, 20]
    service._person_name_cache = {10: "Alice", 20: "Bob"}

    face1 = MagicMock(bbox=[0, 0, 10, 10], embedding=np.ones((512,), dtype=np.float32))
    face2 = MagicMock(bbox=[10, 0, 20, 10], embedding=np.full((512,), 2.0, dtype=np.float32))

    class FakeFaceApp:
        def get(self, _img):
            return [face1, face2]

    class FakeIndex:
        def search(self, query, k=1):
            assert query.shape == (2, 512)
            scores = np.array([[0.91], [0.82]], dtype=np.float32)
            indices = np.array([[0], [1]], dtype=np.int64)
            return scores, indices

    service._face_app = FakeFaceApp()
    service._index = FakeIndex()

    results = service.recognize_faces(np.zeros((16, 16, 3), dtype=np.uint8))

    assert len(results) == 2
    assert results[0]["person_id"] == 10
    assert results[0]["name"] == "Alice"
    assert results[1]["person_id"] == 20
    assert results[1]["name"] == "Bob"
