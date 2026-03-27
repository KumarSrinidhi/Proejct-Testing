import json
import logging
from pathlib import Path
from time import perf_counter
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.person import Person, PersonImage
from app.models.training_log import TrainingLog
from app.utils.cuda_utils import is_cuda_available
from app.utils.image_utils import load_image


logger = logging.getLogger(__name__)
settings = get_settings()


class FaceRecognitionService:
    def __init__(self) -> None:
        self._face_app: Any | None = None
        self._faiss: Any | None = None
        self._index: Any | None = None
        self._gpu_resources: Any | None = None
        self._index_to_person_id: list[int] = []
        self._person_name_cache: dict[int, str] = {}
        self._embeddings_cache: dict[int, list[float]] = {}
        self._model_dir = Path("data/models")
        self._model_dir.mkdir(parents=True, exist_ok=True)

    def initialize(self) -> None:
        try:
            import insightface

            ctx_id = 0 if settings.cuda_enabled and is_cuda_available() else -1
            self._face_app = insightface.app.FaceAnalysis(name=settings.insightface_model)
            self._face_app.prepare(ctx_id=ctx_id, det_thresh=0.5)
            logger.info("InsightFace initialized", extra={"ctx_id": ctx_id})
        except Exception as exc:
            logger.exception("Failed to initialize InsightFace: %s", exc)
            self._face_app = None

        try:
            import faiss

            self._faiss = faiss
            self._index = faiss.IndexFlatIP(512)
            if settings.cuda_enabled and is_cuda_available():
                try:
                    self._gpu_resources = faiss.StandardGpuResources()
                    self._index = faiss.index_cpu_to_gpu(self._gpu_resources, 0, self._index)
                    logger.info("FAISS GPU index initialized")
                except Exception as gpu_exc:
                    logger.warning("FAISS GPU unavailable, using CPU: %s", gpu_exc)
            logger.info("FAISS index initialized")
        except Exception as exc:
            logger.exception("Failed to initialize FAISS: %s", exc)
            self._faiss = None
            self._index = None

    def _normalize(self, emb: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(emb)
        if norm == 0:
            return emb
        return emb / norm

    def _extract_face(self, image: np.ndarray) -> Any | None:
        if self._face_app is None:
            logger.error("Face app not initialized")
            return None
        faces = self._face_app.get(image)
        if not faces:
            return None
        return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

    def extract_embedding(self, image: np.ndarray) -> tuple[np.ndarray | None, Any | None]:
        try:
            face = self._extract_face(image)
            if face is None:
                return None, None
            embedding = np.array(face.embedding, dtype=np.float32)
            return self._normalize(embedding), face
        except Exception as exc:
            logger.warning("Embedding extraction failed: %s", exc)
            return None, None

    async def add_person_embeddings(self, person_id: int, image_paths: list[str], db: AsyncSession) -> tuple[int, int]:
        added = 0
        failed = 0
        for image_path in image_paths:
            try:
                image = load_image(image_path)
                if image is None:
                    failed += 1
                    continue
                embedding, _ = self.extract_embedding(image)
                if embedding is None:
                    failed += 1
                    continue

                result = await db.execute(
                    select(PersonImage).where(PersonImage.person_id == person_id, PersonImage.image_path == image_path)
                )
                person_image = result.scalar_one_or_none()
                if person_image is None:
                    person_image = PersonImage(person_id=person_id, image_path=image_path)
                    db.add(person_image)

                person_image.encoding_blob = json.dumps(embedding.tolist())
                added += 1
            except Exception as exc:
                logger.warning("Failed processing image", extra={"path": image_path, "error": str(exc)})
                failed += 1

        await db.commit()
        return added, failed

    async def get_person_embedding(self, person_id: int, db: AsyncSession) -> np.ndarray | None:
        result = await db.execute(select(PersonImage).where(PersonImage.person_id == person_id))
        rows = result.scalars().all()
        vectors: list[np.ndarray] = []
        for row in rows:
            if not row.encoding_blob:
                continue
            try:
                vec = np.array(json.loads(row.encoding_blob), dtype=np.float32)
                vectors.append(vec)
            except Exception as exc:
                logger.warning("Invalid encoding blob", extra={"person_id": person_id, "error": str(exc)})

        if not vectors:
            return None
        mean_vec = np.mean(np.stack(vectors), axis=0)
        return self._normalize(mean_vec.astype(np.float32))

    def _build_faiss_index(self, vectors: np.ndarray) -> None:
        if self._faiss is None:
            return
        self._index = self._faiss.IndexFlatIP(512)
        if settings.cuda_enabled and is_cuda_available():
            try:
                self._gpu_resources = self._faiss.StandardGpuResources()
                self._index = self._faiss.index_cpu_to_gpu(self._gpu_resources, 0, self._index)
            except Exception as exc:
                logger.warning("Failed to create FAISS GPU index: %s", exc)
        self._index.add(vectors)

    async def rebuild_index(self, db: AsyncSession) -> dict[str, int]:
        start = perf_counter()
        total_images = 0
        failed_images = 0
        self._index_to_person_id = []
        self._person_name_cache = {}
        self._embeddings_cache = {}

        result = await db.execute(select(Person).where(Person.is_active.is_(True)))
        persons = result.scalars().all()

        embeddings: list[np.ndarray] = []
        for person in persons:
            self._person_name_cache[person.id] = person.name
            image_result = await db.execute(select(PersonImage).where(PersonImage.person_id == person.id))
            images = image_result.scalars().all()
            total_images += len(images)

            # Backfill missing encodings when possible.
            for img in images:
                if img.encoding_blob:
                    continue
                source = load_image(img.image_path)
                if source is None:
                    failed_images += 1
                    continue
                emb, _ = self.extract_embedding(source)
                if emb is None:
                    failed_images += 1
                    continue
                img.encoding_blob = json.dumps(emb.tolist())

            mean_emb = await self.get_person_embedding(person.id, db)
            if mean_emb is None:
                continue

            embeddings.append(mean_emb)
            self._index_to_person_id.append(person.id)
            self._embeddings_cache[person.id] = mean_emb.tolist()

        await db.commit()
        if embeddings:
            matrix = np.stack(embeddings).astype(np.float32)
            self._build_faiss_index(matrix)
        else:
            self._index = None

        status = "success" if embeddings else "empty"
        db.add(
            TrainingLog(
                total_persons=len(self._index_to_person_id),
                total_images=total_images,
                status=status,
            )
        )
        await db.commit()

        duration_ms = int((perf_counter() - start) * 1000)
        self._save_cache_to_disk()
        self._save_index_to_disk()
        return {
            "total_persons": len(self._index_to_person_id),
            "total_images": total_images,
            "failed_images": failed_images,
            "duration_ms": duration_ms,
        }

    def recognize_face(self, face_image: np.ndarray) -> tuple[int | None, str | None, float, Any | None]:
        if self._index is None or not self._index_to_person_id:
            return None, None, 0.0, None

        emb, face = self.extract_embedding(face_image)
        if emb is None:
            return None, None, 0.0, None

        if self._faiss is None:
            # Fallback path when FAISS is unavailable.
            best_person = None
            best_score = -1.0
            for person_id, vector in self._embeddings_cache.items():
                candidate = np.array(vector, dtype=np.float32)
                score = float(np.dot(emb, candidate))
                if score > best_score:
                    best_person = person_id
                    best_score = score
            if best_person is None or best_score <= settings.recognition_threshold:
                return None, None, 0.0, face
            return best_person, self._person_name_cache.get(best_person), best_score, face

        query = emb.reshape(1, -1).astype(np.float32)
        scores, indices = self._index.search(query, k=1)
        score = float(scores[0][0])
        idx = int(indices[0][0])
        if idx < 0 or idx >= len(self._index_to_person_id):
            return None, None, 0.0, face

        person_id = self._index_to_person_id[idx]
        if score <= settings.recognition_threshold:
            return None, None, score, face
        return person_id, self._person_name_cache.get(person_id), score, face

    def _save_index_to_disk(self) -> None:
        if self._faiss is None or self._index is None:
            return
        try:
            index_path = self._model_dir / "faiss_index.bin"
            cpu_index = self._index
            if hasattr(self._faiss, "index_gpu_to_cpu"):
                try:
                    cpu_index = self._faiss.index_gpu_to_cpu(self._index)
                except Exception:
                    cpu_index = self._index
            self._faiss.write_index(cpu_index, str(index_path))
        except Exception as exc:
            logger.warning("Failed to save FAISS index: %s", exc)

    def _save_cache_to_disk(self) -> None:
        try:
            cache_path = self._model_dir / "embeddings_cache.json"
            payload = {
                "index_to_person_id": self._index_to_person_id,
                "embeddings_cache": self._embeddings_cache,
                "person_name_cache": self._person_name_cache,
            }
            cache_path.write_text(json.dumps(payload), encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to save embedding cache: %s", exc)

    def load_index_from_disk(self) -> None:
        cache_path = self._model_dir / "embeddings_cache.json"
        if not cache_path.exists():
            return

        try:
            payload = json.loads(cache_path.read_text(encoding="utf-8"))
            self._index_to_person_id = [int(x) for x in payload.get("index_to_person_id", [])]
            self._embeddings_cache = {int(k): v for k, v in payload.get("embeddings_cache", {}).items()}
            self._person_name_cache = {int(k): v for k, v in payload.get("person_name_cache", {}).items()}

            vectors = [np.array(v, dtype=np.float32) for _, v in sorted(self._embeddings_cache.items())]
            if vectors:
                self._build_faiss_index(np.stack(vectors).astype(np.float32))
        except Exception as exc:
            logger.warning("Failed to load embedding cache: %s", exc)
