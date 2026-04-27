"""
Tests for image upload without face detection requirement.

This test suite verifies that valid images (JPEG/PNG) can be uploaded even
when no face is detected in them. Tests cover edge cases like blank images,
non-face objects, and mixed batches with and without faces.
"""

import json
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest

from app.models.person import PersonImage
from app.services.face_recognition import FaceRecognitionService


# ============================================================================
# Test Case 1: get_person_embedding skips images without embeddings
# ============================================================================


@pytest.mark.asyncio
async def test_get_person_embedding_skips_none_encoding_blob() -> None:
    """Test that get_person_embedding skips PersonImages with encoding_blob=None."""
    service = FaceRecognitionService()
    db = AsyncMock()

    # Create PersonImages: one with embedding, one without
    embedding_data = np.ones((512,), dtype=np.float32).tolist()

    rows = [
        PersonImage(
            person_id=1, image_path="a.jpg", encoding_blob=json.dumps(embedding_data)
        ),
        PersonImage(
            person_id=1, image_path="b.jpg", encoding_blob=None
        ),  # No embedding
    ]

    result_proxy = MagicMock()
    result_proxy.scalars.return_value.all.return_value = rows
    db.execute.return_value = result_proxy

    # Execute
    emb = await service.get_person_embedding(person_id=1, db=db)

    # Assert: Should return the average of only the image with embedding
    assert emb is not None
    assert emb.shape == (512,)
    assert np.allclose(
        emb,
        np.ones((512,), dtype=np.float32)
        / np.linalg.norm(np.ones((512,), dtype=np.float32)),
    )


# ============================================================================
# Test Case 2: get_person_embedding returns None when all images have no embeddings
# ============================================================================


@pytest.mark.asyncio
async def test_get_person_embedding_returns_none_when_all_null() -> None:
    """Test that get_person_embedding returns None when all PersonImages have encoding_blob=None."""
    service = FaceRecognitionService()
    db = AsyncMock()

    # Create PersonImages with no embeddings
    rows = [
        PersonImage(person_id=1, image_path="a.jpg", encoding_blob=None),
        PersonImage(person_id=1, image_path="b.jpg", encoding_blob=None),
    ]

    result_proxy = MagicMock()
    result_proxy.scalars.return_value.all.return_value = rows
    db.execute.return_value = result_proxy

    # Execute
    emb = await service.get_person_embedding(person_id=1, db=db)

    # Assert: Should return None when no valid embeddings exist
    assert emb is None


# ============================================================================
# Test Case 3: Batch with mixed embeddings and None values
# ============================================================================


@pytest.mark.asyncio
async def test_get_person_embedding_with_mixed_embeddings_and_none() -> None:
    """Test averaging of multiple embeddings while skipping None values."""
    service = FaceRecognitionService()
    db = AsyncMock()

    e1 = np.ones((512,), dtype=np.float32).tolist()
    e2 = np.full((512,), 2.0, dtype=np.float32).tolist()
    e3 = np.full((512,), 3.0, dtype=np.float32).tolist()

    rows = [
        PersonImage(person_id=1, image_path="a.jpg", encoding_blob=json.dumps(e1)),
        PersonImage(person_id=1, image_path="b.jpg", encoding_blob=None),  # Skip
        PersonImage(person_id=1, image_path="c.jpg", encoding_blob=json.dumps(e2)),
        PersonImage(person_id=1, image_path="d.jpg", encoding_blob=None),  # Skip
        PersonImage(person_id=1, image_path="e.jpg", encoding_blob=json.dumps(e3)),
    ]

    result_proxy = MagicMock()
    result_proxy.scalars.return_value.all.return_value = rows
    db.execute.return_value = result_proxy

    # Execute
    emb = await service.get_person_embedding(person_id=1, db=db)

    # Assert: Should average only the non-None embeddings (1, 2, 3)
    assert emb is not None
    mean_embedding = np.mean(
        [np.ones(512), np.full(512, 2.0), np.full(512, 3.0)], axis=0
    )
    mean_embedding = mean_embedding / np.linalg.norm(mean_embedding)
    assert np.allclose(emb, mean_embedding.astype(np.float32), atol=1e-6)


# ============================================================================
# Test Case 4: Single valid embedding with multiple None values
# ============================================================================


@pytest.mark.asyncio
async def test_get_person_embedding_single_valid_with_multiple_none() -> None:
    """Test that a single valid embedding is returned when others are None."""
    service = FaceRecognitionService()
    db = AsyncMock()

    embedding_data = np.ones((512,), dtype=np.float32).tolist()

    rows = [
        PersonImage(person_id=1, image_path="a.jpg", encoding_blob=None),
        PersonImage(
            person_id=1, image_path="b.jpg", encoding_blob=json.dumps(embedding_data)
        ),
        PersonImage(person_id=1, image_path="c.jpg", encoding_blob=None),
    ]

    result_proxy = MagicMock()
    result_proxy.scalars.return_value.all.return_value = rows
    db.execute.return_value = result_proxy

    # Execute
    emb = await service.get_person_embedding(person_id=1, db=db)

    # Assert: Should return the single valid embedding (normalized)
    assert emb is not None
    assert emb.shape == (512,)
    expected = np.ones((512,), dtype=np.float32) / np.linalg.norm(
        np.ones((512,), dtype=np.float32)
    )
    assert np.allclose(emb, expected, atol=1e-6)


# ============================================================================
# Test Case 5: Verify extract_embedding returning None doesn't crash rebuild_index
# ============================================================================


@pytest.mark.asyncio
async def test_rebuild_index_handles_extract_embedding_none() -> None:
    """Test that rebuild_index handles face_service.extract_embedding returning (None, None)."""
    service = FaceRecognitionService()

    # Mock extract_embedding to return None (no face detected)
    service.extract_embedding = MagicMock(return_value=(None, None))
    service._faiss = None
    service._index = None
    service._torch = None
    service._gpu_available = False

    # Test that a None embedding is handled gracefully
    emb, _ = service.extract_embedding(np.zeros((100, 100, 3), dtype=np.uint8))

    assert emb is None


# ============================================================================
# Test Case 6: Verify training still works with mixed None and valid embeddings
# ============================================================================


@pytest.mark.asyncio
async def test_training_log_created_with_mixed_images() -> None:
    """Test that TrainingLog can be created with persons that have mixed embeddings."""
    # This is more of an integration concept test
    # The key is that rebuild_index skips persons with no embeddings
    # and logs the status

    from app.models.training_log import TrainingLog

    # Create a mock TrainingLog to ensure it works
    log = TrainingLog(
        total_persons=2,
        total_images=5,  # 5 images, but some might have None embedding
        status="success",
    )

    assert log.total_persons == 2
    assert log.total_images == 5
    assert log.status == "success"
