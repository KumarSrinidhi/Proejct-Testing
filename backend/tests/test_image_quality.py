import numpy as np

from app.utils.image_quality import validate_training_image


def test_validate_training_image_rejects_small_image() -> None:
    image = np.zeros((32, 32, 3), dtype=np.uint8)

    reason = validate_training_image(image)

    assert reason is not None
    assert "too small" in reason.lower()


def test_validate_training_image_rejects_blurry_image() -> None:
    image = np.full((256, 256, 3), 128, dtype=np.uint8)

    reason = validate_training_image(image)

    assert reason == "Image is too blurry"


def test_validate_training_image_accepts_reasonable_image() -> None:
    image = np.random.default_rng(42).integers(
        0, 255, size=(256, 256, 3), dtype=np.uint8
    )

    reason = validate_training_image(image)

    assert reason is None
