# Face Recognition Attendance System

A high-accuracy attendance platform using FastAPI, InsightFace (buffalo_l), FAISS vector similarity search, and a React analytics dashboard.

## Features

- Async FastAPI backend with SQLAlchemy ORM and SQLite
- JWT auth with refresh tokens, bcrypt hashing, and login rate limiting
- InsightFace embedding extraction using buffalo_l model
- FAISS IndexFlatIP for cosine-similarity search
- Training pipeline with logs and index/cache persistence
- Attendance cooldown logic with cropped-face archival
- WebSocket live recognition stream from file/webcam/rtsp placeholder
- React + Tailwind + Chart.js dashboard, heatmap, trends, CRUD, and live feed

## Project Structure

- backend: FastAPI app, services, models, tests
- frontend: React app with analytics and live view
- data: uploads and model index/cache files

## Backend Setup

1. Create and activate a Python virtual environment.
2. Create env file.
3. Install dependencies.
4. Start API server.

Linux/macOS:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Windows (PowerShell):

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

To deactivate the environment when finished:

```bash
deactivate
```

Default admin credentials:

- username: admin
- password: admin123

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: http://localhost:5173

## Docker Compose

```bash
docker compose up --build
```

## CUDA Notes

- InsightFace and FAISS are configured to auto-detect CUDA.
- Runtime uses:
  - ctx_id=0 when torch.cuda.is_available(), else -1
  - FAISS GPU index when available, else CPU fallback
- For CUDA deployment, use CUDA-compatible base image and install GPU-enabled PyTorch + FAISS.

## Training and Recognition Flow

1. Create persons via Persons page or POST /api/persons.
2. Upload multiple reference images.
3. Trigger POST /api/train.
4. Start live recognition through WebSocket /ws/process.
5. Attendance is auto-marked when confidence > threshold and cooldown passes.

## Environment Variables

See backend/.env.example for full configuration including:

- DATABASE_URL
- SECRET_KEY
- RECOGNITION_THRESHOLD
- ATTENDANCE_COOLDOWN_SECONDS
- FRAME_PROCESS_INTERVAL
- CUDA_ENABLED
- INSIGHTFACE_MODEL
- VIDEO_SOURCE_TYPE
- VIDEO_SOURCE_PATH

## Testing

```bash
cd backend
pytest -q
```

Unit tests included for:

- Face recognition embedding averaging and threshold behavior
- Attendance cooldown and successful marking

## API Endpoints

Auth:

- POST /api/auth/login
- POST /api/auth/refresh

Persons:

- POST /api/persons
- GET /api/persons
- GET /api/persons/{id}
- PUT /api/persons/{id}
- DELETE /api/persons/{id}
- POST /api/persons/{id}/images
- GET /api/persons/{id}/images
- DELETE /api/images/{id}

Training:

- POST /api/train
- GET /api/train/status
- GET /api/train/logs

Attendance:

- GET /api/attendance
- GET /api/attendance/today
- GET /api/attendance/export
- GET /api/attendance/heatmap
- GET /api/attendance/trends

WebSocket:

- WS /ws/process
