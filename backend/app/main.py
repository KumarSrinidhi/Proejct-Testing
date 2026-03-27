import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api import attendance, auth, persons, training, video
from app.database import Base, SessionLocal, engine
from app.models.user import User
from app.services.attendance_service import AttendanceService
from app.services.face_recognition import FaceRecognitionService
from app.utils.security import hash_password
from app.websocket.stream_handler import router as ws_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="Face Recognition Attendance System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"http://.*:5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(persons.router)
app.include_router(training.router)
app.include_router(attendance.router)
app.include_router(video.router)
app.include_router(ws_router)


@app.on_event("startup")
async def startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Ensure a default admin exists for first-time setup.
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()
        if user is None:
            db.add(User(username="admin", hashed_password=hash_password("admin123"), is_admin=True))
            await db.commit()

    app.state.face_service = FaceRecognitionService()
    app.state.face_service.initialize()
    app.state.face_service.load_index_from_disk()
    app.state.attendance_service = AttendanceService()

    # Attempt startup training if no index was loaded.
    async with SessionLocal() as db:
        if not app.state.face_service._index_to_person_id:
            await app.state.face_service.rebuild_index(db)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
