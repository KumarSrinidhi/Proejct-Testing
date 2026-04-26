import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi import Request
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.database import get_db
from app.models.attendance import Attendance
from app.models.person import Person, PersonImage
from app.models.user import ROLE_ADMIN, User
from app.schemas.person import PersonCreate, PersonDetail, PersonImageRead, PersonListResponse, PersonRead, PersonUpdate
from app.utils.audit import log_audit_event
from app.utils.file_storage import PERSON_IMAGES_ROOT, save_person_image
from app.utils.image_quality import validate_training_image
from app.utils.pagination import paginate_select
from app.utils.image_utils import bytes_to_cv2_image
from app.utils.security import hash_password
from app.config import get_settings


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["persons"])
settings = get_settings()


def _is_supported_image_bytes(payload: bytes) -> bool:
    # JPEG
    if len(payload) >= 3 and payload[:3] == b"\xff\xd8\xff":
        return True
    # PNG
    if len(payload) >= 8 and payload[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    return False


@router.post("/persons", response_model=PersonRead)
async def create_person(
    payload: PersonCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> PersonRead:
    existing_person_result = await db.execute(select(Person).where(Person.email == payload.email))
    if existing_person_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Person with this email already exists")

    existing_user_email_result = await db.execute(select(User).where(User.email == payload.email))
    if existing_user_email_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")

    person = Person(name=payload.name, email=payload.email, department=payload.department)
    db.add(person)

    if payload.create_user_account:
        if not payload.username or not payload.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username and password are required when creating a linked user",
            )

        existing_user_result = await db.execute(select(User).where(User.username == payload.username))
        if existing_user_result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

        normalized_role = payload.role.strip().lower()
        user = User(
            username=payload.username,
            email=str(payload.email),
            hashed_password=hash_password(payload.password),
            role=normalized_role,
            is_admin=normalized_role == ROLE_ADMIN,
        )
        db.add(user)

    await db.commit()
    await db.refresh(person)
    await log_audit_event(
        db,
        actor=current_admin,
        action="create_person",
        entity_type="person",
        entity_id=person.id,
        metadata={"email": person.email, "department": person.department, "linked_user": bool(payload.create_user_account)},
    )
    return PersonRead.model_validate(person)


@router.get("/persons", response_model=PersonListResponse)
async def list_persons(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    search: str = Query(default=""),
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> PersonListResponse:
    query = select(Person)
    count_query = select(func.count(Person.id))
    if not include_inactive:
        query = query.where(Person.is_active.is_(True))
        count_query = count_query.where(Person.is_active.is_(True))
    if search:
        like = f"%{search}%"
        search_filter = (Person.name.ilike(like)) | (Person.email.ilike(like)) | (Person.department.ilike(like))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total, rows = await paginate_select(
        db,
        query.order_by(Person.id.desc()),
        count_query,
        page=page,
        page_size=page_size,
    )
    return PersonListResponse(
        items=[PersonRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/persons/{person_id}", response_model=PersonDetail)
async def get_person(
    person_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> PersonDetail:
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    image_count_result = await db.execute(select(func.count(PersonImage.id)).where(PersonImage.person_id == person_id))
    attendance_count_result = await db.execute(select(func.count(Attendance.id)).where(Attendance.person_id == person_id))

    return PersonDetail(
        id=person.id,
        name=person.name,
        email=person.email,
        department=person.department,
        is_active=person.is_active,
        created_at=person.created_at,
        image_count=int(image_count_result.scalar() or 0),
        attendance_count=int(attendance_count_result.scalar() or 0),
    )


@router.put("/persons/{person_id}", response_model=PersonRead)
async def update_person(
    person_id: int,
    payload: PersonUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> PersonRead:
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(person, key, value)

    await db.commit()
    await db.refresh(person)
    await log_audit_event(
        db,
        actor=current_admin,
        action="update_person",
        entity_type="person",
        entity_id=person.id,
        metadata=payload.model_dump(exclude_none=True),
    )
    return PersonRead.model_validate(person)


@router.delete("/persons/{person_id}")
async def delete_person(
    person_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    person.is_active = False
    await db.commit()
    await log_audit_event(
        db,
        actor=current_admin,
        action="delete_person",
        entity_type="person",
        entity_id=person.id,
        metadata={"email": person.email, "department": person.department},
    )
    return {"message": "Person deactivated"}


@router.post("/persons/{person_id}/images")
async def upload_person_images(
    person_id: int,
    request: Request,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> dict[str, object]:
    person_result = await db.execute(select(Person).where(Person.id == person_id, Person.is_active.is_(True)))
    person = person_result.scalar_one_or_none()
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    face_service = request.app.state.face_service

    results: list[dict[str, object]] = []

    # FastAPI injects state on app instance; retrieve via db bind context fallback isn't practical here.
    # Use global app state through router dependency in runtime.
    for upload in files:
        try:
            if upload.content_type not in {"image/jpeg", "image/png"}:
                results.append({"filename": upload.filename, "status": "failed", "reason": "Invalid file type"})
                continue

            payload = await upload.read(settings.max_image_upload_bytes + 1)
            if len(payload) > settings.max_image_upload_bytes:
                results.append({"filename": upload.filename, "status": "failed", "reason": "Image too large"})
                continue
            if not _is_supported_image_bytes(payload):
                results.append({"filename": upload.filename, "status": "failed", "reason": "Invalid image content"})
                continue

            image = bytes_to_cv2_image(payload)
            if image is None:
                results.append({"filename": upload.filename, "status": "failed", "reason": "Unreadable image"})
                continue

            quality_issue = validate_training_image(image)
            if quality_issue is not None:
                results.append({"filename": upload.filename, "status": "failed", "reason": quality_issue})
                continue

            path = save_person_image(person_id, upload.filename or "image.jpg", payload)
            db_image = PersonImage(person_id=person_id, image_path=path)
            db.add(db_image)
            await db.flush()

            if face_service is not None:
                embedding, _ = face_service.extract_embedding(image)
                if embedding is not None:
                    db_image.encoding_blob = json.dumps(embedding.tolist())

            results.append({"filename": upload.filename, "status": "ok", "image_id": db_image.id})
        except Exception as exc:
            logger.warning("Image upload failed", extra={"file": upload.filename, "error": str(exc)})
            results.append({"filename": upload.filename, "status": "failed", "reason": str(exc)})

    await db.commit()
    await log_audit_event(
        db,
        actor=current_admin,
        action="upload_person_images",
        entity_type="person",
        entity_id=person.id,
        metadata={"filename_count": len(files), "results": results},
    )

    # Optional auto-training.
    try:
        from app.config import get_settings

        if get_settings().auto_train_on_upload:
            await request.app.state.face_service.rebuild_index(db)
    except Exception as exc:
        logger.warning("Auto-training skipped: %s", exc)

    return {"person_id": person_id, "results": results}


@router.get("/persons/{person_id}/images", response_model=list[PersonImageRead])
async def list_person_images(
    person_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> list[PersonImageRead]:
    result = await db.execute(select(PersonImage).where(PersonImage.person_id == person_id).order_by(PersonImage.id.desc()))
    images = result.scalars().all()
    return [PersonImageRead.model_validate(image) for image in images]


@router.get("/images/{image_id}/preview")
async def preview_image(
    image_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> FileResponse:
    result = await db.execute(select(PersonImage).where(PersonImage.id == image_id))
    image = result.scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    path = Path(image.image_path)
    allowed_root = PERSON_IMAGES_ROOT.resolve()
    try:
        resolved_path = path.resolve()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image path")

    if not resolved_path.is_relative_to(allowed_root):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Image path outside allowed directory")

    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found on disk")

    suffix = resolved_path.suffix.lower()
    media_type = "image/jpeg"
    if suffix == ".png":
        media_type = "image/png"
    elif suffix in {".jpg", ".jpeg"}:
        media_type = "image/jpeg"

    return FileResponse(path=str(resolved_path), media_type=media_type)


@router.delete("/images/{image_id}")
async def delete_image(
    image_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(PersonImage).where(PersonImage.id == image_id))
    image = result.scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    await db.delete(image)
    await db.commit()
    await log_audit_event(
        db,
        actor=current_admin,
        action="delete_person_image",
        entity_type="person_image",
        entity_id=image.id,
        metadata={"person_id": image.person_id, "image_path": image.image_path},
    )

    try:
        await request.app.state.face_service.rebuild_index(db)
    except Exception as exc:
        logger.warning("Retraining after delete failed: %s", exc)

    return {"message": "Image deleted"}
