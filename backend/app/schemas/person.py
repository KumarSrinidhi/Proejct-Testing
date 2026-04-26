from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class PersonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    department: str = Field(min_length=1, max_length=200)
    create_user_account: bool = False
    username: str | None = Field(default=None, min_length=3, max_length=150)
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: str = Field(default="student", pattern="^(admin|teacher|student)$")


class PersonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    department: str | None = Field(default=None, min_length=1, max_length=200)
    is_active: bool | None = None


class PersonImageRead(BaseModel):
    id: int
    image_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class PersonRead(BaseModel):
    id: int
    name: str
    email: str
    department: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PersonListResponse(BaseModel):
    items: list[PersonRead]
    total: int
    page: int
    page_size: int


class PersonDetail(PersonRead):
    image_count: int
    attendance_count: int
