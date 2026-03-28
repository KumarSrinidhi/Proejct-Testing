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
- Live preview panel with real-time bounding box overlay
- Live recognition events with IST timestamps and clear action
- React + Tailwind + Chart.js dashboard, heatmap, trends, CRUD, and live feed

## Project Structure

- backend: FastAPI app, services, models, tests
- frontend: React app with analytics and live view
- data: uploads and model index/cache files

## Installation Preflight

Run these checks before first install:

```bash
python3 --version
node --version
npm --version
```

Recommended versions:

- Python 3.11 or 3.12
- Node 20+
- npm 10+

Linux runtime packages required for OpenCV:

```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-0 libgl1
```

## Backend Setup

Prerequisites:

- Python 3.11 or 3.12
- `pip` and `venv`
- Linux packages for OpenCV runtime: `libglib2.0-0` and `libgl1` (or distro equivalent)

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
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If pip is old, upgrade installer tooling first:

```bash
pip install --upgrade pip setuptools wheel
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

You can override the bootstrap admin account in `.env` using:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Frontend Setup

If this is a fresh machine, verify Node and npm first:

```bash
node -v
npm -v
```

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
- Default setup is CPU-safe: `GPU_STRICT_MODE=false`.
- Set `GPU_STRICT_MODE=true` only when CUDA is available and correctly configured.
- Runtime uses:
  - ctx_id=0 when torch.cuda.is_available(), else -1
  - FAISS GPU index when available
  - Torch CUDA tensor similarity search for recognition matching
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
- FACE_DETECTION_THRESHOLD
- ATTENDANCE_COOLDOWN_SECONDS
- FRAME_PROCESS_INTERVAL
- CUDA_ENABLED
- GPU_STRICT_MODE
- INSIGHTFACE_MODEL
- VIDEO_SOURCE_TYPE
- VIDEO_SOURCE_PATH
- CORS_ORIGINS
- CORS_ORIGIN_REGEX
- ADMIN_USERNAME
- ADMIN_PASSWORD

## Testing

```bash
cd backend
pytest -q
```

Unit tests included for:

- Face recognition embedding averaging and threshold behavior
- Attendance cooldown and successful marking

## Troubleshooting

If backend startup fails with:

- `ImportError: email-validator is not installed`

Run:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

If login fails with browser CORS errors:

- Keep frontend on http://localhost:5173, or
- Set `CORS_ORIGINS` in `backend/.env` with comma-separated frontend origins.

Example:

```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:4173,http://127.0.0.1:4173
```

If browser webcam mode does not start:

- Ensure camera permission is granted in the browser.
- Use localhost or HTTPS (many browsers block camera access on insecure remote HTTP origins).
- Confirm no other app is exclusively locking the camera device.

If `pip install -r requirements.txt` fails around `insightface`, `onnxruntime`, `faiss-cpu`, or `torch`:

- Upgrade pip/setuptools/wheel.
- Recreate `.venv`.
- Retry on Python 3.11 if your platform wheel support for 3.12 is incomplete.

If the environment was created before dependency updates, rebuild it:

```bash
cd backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

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
- DELETE /api/attendance/{id}

WebSocket:

- WS /ws/process
