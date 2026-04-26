from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.database import get_db
from app.models.person import Person
from app.models.user import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER, User
from app.schemas.auth import (
    UserCreateRequest,
    UserPasswordResetRequest,
    UserRead,
    UserRoleUpdateRequest,
)
from app.utils.security import hash_password


router = APIRouter(prefix="/api/users", tags=["users"])
VALID_ROLES = {ROLE_ADMIN, ROLE_TEACHER, ROLE_STUDENT}


def _normalize_role(role: str) -> str:
    candidate = role.strip().lower()
    if candidate not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    return candidate


def _effective_role(user: User) -> str:
    return user.role or (ROLE_ADMIN if user.is_admin else ROLE_STUDENT)


def _person_payload_for_user(person: Person | None) -> dict[str, object]:
    if person is None:
        return {"person_id": None, "person_name": None, "person_department": None}
    return {
        "person_id": person.id,
        "person_name": person.name,
        "person_department": person.department,
    }


@router.get("", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> list[UserRead]:
    result = await db.execute(select(User).order_by(User.created_at.desc(), User.id.desc()))
    rows = result.scalars().all()
    user_emails = [row.email for row in rows if row.email]
    person_by_email: dict[str, Person] = {}
    if user_emails:
        persons_result = await db.execute(select(Person).where(Person.email.in_(user_emails)))
        person_by_email = {person.email: person for person in persons_result.scalars().all()}

    return [
        UserRead(
            id=row.id,
            username=row.username,
            email=row.email,
            is_admin=bool(row.is_admin),
            role=_effective_role(row),
            **_person_payload_for_user(person_by_email.get(row.email or "")),
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("", response_model=UserRead)
async def create_user(
    payload: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> UserRead:
    role = _normalize_role(payload.role)
    email = str(payload.email).strip().lower()

    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    existing_email = await db.execute(select(User).where(User.email == email))
    if existing_email.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(
        username=payload.username,
        email=email,
        hashed_password=hash_password(payload.password),
        role=role,
        is_admin=(role == ROLE_ADMIN),
    )
    db.add(user)

    linked_person: Person | None = None
    if payload.create_person_profile:
        if not payload.person_name or not payload.person_department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Person name and department are required when creating a linked person profile",
            )
        person_result = await db.execute(select(Person).where(Person.email == email))
        linked_person = person_result.scalar_one_or_none()
        if linked_person is None:
            linked_person = Person(
                name=payload.person_name,
                email=email,
                department=payload.person_department,
                is_active=True,
            )
            db.add(linked_person)
        else:
            linked_person.name = payload.person_name
            linked_person.department = payload.person_department
            linked_person.is_active = True

    await db.commit()
    await db.refresh(user)
    if linked_person is not None:
        await db.refresh(linked_person)

    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        is_admin=bool(user.is_admin),
        role=_effective_role(user),
        **_person_payload_for_user(linked_person),
        created_at=user.created_at,
    )


@router.put("/{user_id}/role", response_model=UserRead)
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> UserRead:
    role = _normalize_role(payload.role)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    current_role = _effective_role(user)

    if current_role == ROLE_ADMIN and role != ROLE_ADMIN:
        count_result = await db.execute(
            select(func.count(User.id)).where(or_(User.role == ROLE_ADMIN, User.is_admin.is_(True)))
        )
        admin_count = int(count_result.scalar() or 0)
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last admin",
            )

    user.role = role
    user.is_admin = role == ROLE_ADMIN
    await db.commit()
    await db.refresh(user)

    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        is_admin=bool(user.is_admin),
        role=_effective_role(user),
        **_person_payload_for_user(None),
        created_at=user.created_at,
    )


@router.put("/{user_id}/password")
async def reset_user_password(
    user_id: int,
    payload: UserPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = hash_password(payload.password)
    await db.commit()
    return {"message": "Password updated"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete current admin user")

    if _effective_role(user) == ROLE_ADMIN:
        count_result = await db.execute(
            select(func.count(User.id)).where(or_(User.role == ROLE_ADMIN, User.is_admin.is_(True)))
        )
        admin_count = int(count_result.scalar() or 0)
        if admin_count <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the last admin")

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}
