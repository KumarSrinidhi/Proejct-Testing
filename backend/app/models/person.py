from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Person(Base):
    """
    Person model for storing individual records.
    
    Indexes are created for frequently queried fields to improve performance:
    - name: For search queries
    - email: For unique constraint and lookups  
    - created_at: For sorting and date range queries
    """
    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    department: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    images = relationship("PersonImage", back_populates="person", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="person")

    # Composite index for common queries
    __table_args__ = (
        Index("idx_person_active_created", "is_active", "created_at"),
    )


class PersonImage(Base):
    """
    PersonImage model for storing training images.
    
    Indexes are created for frequently queried fields:
    - person_id: For retrieving images for a specific person
    - uploaded_at: For sorting images by upload time
    """
    __tablename__ = "person_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id"), nullable=False, index=True)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    encoding_blob: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    person = relationship("Person", back_populates="images")
