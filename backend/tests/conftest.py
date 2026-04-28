import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import logging

from app.main import app
from app.database import Base, get_db
from app.utils.security import create_access_token, hash_password
from app.models.user import User, ROLE_ADMIN, ROLE_TEACHER, ROLE_STUDENT

# ---------------------------------------------------------------------------
# In-memory SQLite database for tests
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Silence passlib/bcrypt noise in test logs
logging.getLogger("passlib").setLevel(logging.ERROR)


# ---------------------------------------------------------------------------
# Event loop  (session-scoped to share tables across fixtures)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the entire test session (required by asyncio_mode=auto)."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# DB session – function scoped (fresh schema per test)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
async def db_session():
    """
    Fresh in-memory database per test:
    - Creates all tables before the test
    - Drops all tables after the test
    Guarantees full isolation.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        await session.close()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# Pre-seed the standard users into every test DB
# ---------------------------------------------------------------------------

async def _seed_users(db_session: AsyncSession):
    """Insert admin/teacher/student into db_session and return them."""
    admin = User(
        username="admin",
        email="admin@example.com",
        role=ROLE_ADMIN,
        is_admin=True,
        hashed_password=hash_password("adminpass"),
    )
    teacher = User(
        username="teacher",
        email="teacher@example.com",
        role=ROLE_TEACHER,
        is_admin=False,
        hashed_password=hash_password("teacherpass"),
    )
    student = User(
        username="student",
        email="student@example.com",
        role=ROLE_STUDENT,
        is_admin=False,
        hashed_password=hash_password("studentpass"),
    )
    db_session.add_all([admin, teacher, student])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(teacher)
    await db_session.refresh(student)
    return admin, teacher, student


# ---------------------------------------------------------------------------
# HTTP client – always has the three base users seeded
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
async def client(db_session):
    """
    AsyncClient wired to the in-memory DB.
    The three base users (admin / teacher / student) are seeded before the
    client is yielded so any token-based test can authenticate out of the box.
    """
    # Seed users so token-based auth works for every test
    await _seed_users(db_session)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Token fixtures (synchronous — just JWT string generation, no DB needed)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def admin_token() -> str:
    """Valid JWT access token for username='admin'."""
    token, _ = create_access_token("admin")
    return token


@pytest.fixture(scope="function")
def teacher_token() -> str:
    """Valid JWT access token for username='teacher'."""
    token, _ = create_access_token("teacher")
    return token


@pytest.fixture(scope="function")
def student_token() -> str:
    """Valid JWT access token for username='student'."""
    token, _ = create_access_token("student")
    return token


# ---------------------------------------------------------------------------
# setup_users – for tests that need the User ORM objects (e.g. to read .id)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
async def setup_users(db_session):
    """
    Returns (admin, teacher, student) User objects already in the DB.

    NOTE: the `client` fixture ALSO seeds these users. If a test uses both
    `client` and `setup_users`, call `setup_users` AFTER `client` to avoid
    duplicate rows — or simply rely on what client already inserted.

    For tests that use `setup_users` without `client`, the seeding happens here.
    For tests that use both, the client fixture seeds first; setup_users then
    just queries what's already there.
    """
    from sqlalchemy import select

    result = await db_session.execute(select(User).where(User.username == "admin"))
    existing_admin = result.scalar_one_or_none()

    if existing_admin is not None:
        # Already seeded by the client fixture — just return the rows
        r = await db_session.execute(select(User))
        users = {u.username: u for u in r.scalars().all()}
        return users["admin"], users["teacher"], users["student"]

    # Seed from scratch (tests that use setup_users without client)
    return await _seed_users(db_session)
