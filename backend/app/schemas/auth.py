from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserMeResponse(BaseModel):
    username: str
    is_admin: bool
    role: str
    email: str | None = None


class UserRead(BaseModel):
    id: int
    username: str
    email: str | None = None
    is_admin: bool
    role: str
    person_id: int | None = None
    person_name: str | None = None
    person_department: str | None = None
    created_at: datetime


class UserListResponse(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    page_size: int


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=150)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="student", pattern="^(admin|teacher|student)$")
    create_person_profile: bool = False
    person_name: str | None = Field(default=None, min_length=1, max_length=200)
    person_department: str | None = Field(default=None, min_length=1, max_length=200)


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(pattern="^(admin|teacher|student)$")


class UserPasswordResetRequest(BaseModel):
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    username: str
    role: str
    is_admin: bool
    email: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str | None = None
