import logging

import cv2
import numpy as np

from app.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()


def validate_training_image(image: np.ndarray) -> str | None:
    if image is None:
        return "Unreadable image"

    height, width = image.shape[:2]
    if width < settings.min_training_image_width or height < settings.min_training_image_height:
        return f"Image too small (minimum {settings.min_training_image_width}x{settings.min_training_image_height})"

    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(grayscale, cv2.CV_64F).var())
    if sharpness < settings.min_training_image_sharpness:
        return "Image is too blurry"

    return None
