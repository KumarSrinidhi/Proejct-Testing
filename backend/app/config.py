from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Face Recognition Attendance System"
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./attendance.db"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    recognition_threshold: float = 0.6
    face_detection_threshold: float = 0.35
    attendance_cooldown_seconds: int = 300
    frame_process_interval: float = 1.0
    cuda_enabled: bool = True
    gpu_strict_mode: bool = True
    insightface_model: str = "buffalo_l"
    video_source_type: str = "file"
    video_source_path: str = ""
    auto_train_on_upload: bool = False
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 300
    admin_username: str = "admin"
    admin_password: str = "admin123"


@lru_cache
def get_settings() -> Settings:
    return Settings()
