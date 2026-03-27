import io
import logging
from typing import Any

import cv2
import numpy as np
from PIL import Image


logger = logging.getLogger(__name__)


def load_image(path: str) -> np.ndarray | None:
    image = cv2.imread(path)
    if image is None:
        logger.warning("Unable to load image", extra={"path": path})
    return image


def bytes_to_cv2_image(payload: bytes) -> np.ndarray | None:
    try:
        image = Image.open(io.BytesIO(payload)).convert("RGB")
        np_image = np.array(image)
        return cv2.cvtColor(np_image, cv2.COLOR_RGB2BGR)
    except Exception as exc:
        logger.warning("Failed to parse uploaded image: %s", exc)
        return None


def crop_face(frame: np.ndarray, bbox: Any) -> np.ndarray:
    x1, y1, x2, y2 = [max(0, int(v)) for v in bbox]
    return frame[y1:y2, x1:x2]
