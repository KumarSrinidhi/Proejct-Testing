from functools import lru_cache
from pydantic import Field, AliasChoices, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Security Notes:
    - SECRET_KEY: Must be changed in production. Do not expose in logs.
    - DATABASE_URL: Should use strong credentials stored in environment variables.
    - DEBUG: Must be False in production to prevent sensitive data leakage in logs.
    - CORS_ALLOWED_ORIGINS: Specify exact origins instead of using wildcards.
    """

    model_config: SettingsConfigDict = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Application config
    app_name: str = "Face Recognition Attendance System"
    environment: str = "development"
    debug: bool = False
    timezone: str = "Asia/Kolkata"  # India Standard Time (IST, UTC+5:30)

    # Database (use environment variables for credentials in production)
    database_url: str = "sqlite+aiosqlite:///./attendance.db"

    # Security (CRITICAL: Change in production and never expose in logs)
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Recognition settings
    recognition_threshold: float = 0.6
    face_detection_threshold: float = 0.35
    attendance_window_seconds: int = Field(
        default=300,
        validation_alias=AliasChoices(
            "ATTENDANCE_WINDOW_SECONDS", "ATTENDANCE_COOLDOWN_SECONDS"
        ),
    )
    frame_process_interval: float = 0.0

    # GPU settings
    cuda_enabled: bool = True
    gpu_strict_mode: bool = False
    insightface_model: str = "buffalo_l"

    # Video settings
    video_source_type: str = "file"
    video_source_path: str = ""
    rtsp_open_timeout_seconds: float = 8.0
    rtsp_read_timeout_seconds: float = 8.0
    rtsp_read_failure_threshold: int = 5
    rtsp_reconnect_attempts: int = 5
    rtsp_reconnect_base_delay_seconds: float = 1.0
    rtsp_reconnect_max_delay_seconds: float = 10.0
    rtsp_capture_buffer_size: int = 3
    # Ingestion worker tuning
    worker_count: int = 2
    frame_queue_size: int = 8
    batch_inference: bool = True
    rtsp_ffmpeg_capture_options: str = (
        "rtsp_transport;tcp|stimeout;8000000|max_delay;500000"
    )
    stream_preview_width: int = 960
    stream_preview_jpeg_quality: int = 70
    auto_train_on_upload: bool = False

    # Rate limiting
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 300

    # CORS settings (specify exact origins, not wildcards)
    cors_origins: str = Field(default="", alias="CORS_ALLOWED_ORIGINS")
    cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    # Admin credentials (change in production)
    admin_username: str = "admin"
    admin_password: str = ""

    # Upload limits
    max_image_upload_bytes: int = (
        15 * 1024 * 1024
    )  # 15 MB — supports high-res camera photos
    max_video_upload_bytes: int = 100 * 1024 * 1024
    max_ws_frame_bytes: int = 2 * 1024 * 1024
    min_training_image_width: int = 64
    min_training_image_height: int = 64
    min_training_image_sharpness: float = 20.0  # Relaxed — real-world photos pass
    undetected_face_retention_days: int = 7
    undetected_face_capture_cooldown_seconds: int = 15

    # HR Integration — set HR_WEBHOOK_URL in .env to enable automatic push export.
    # Leave empty to disable.
    hr_webhook_url: str = Field(default="", alias="HR_WEBHOOK_URL")


    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() in ("production", "prod")

    @property
    def attendance_cooldown_seconds(self) -> int:
        """Backward-compatible alias for the attendance window duration."""
        return self.attendance_window_seconds

    @property
    def timezone_name(self) -> str:
        """Get configured timezone name (default: Asia/Kolkata for India)."""
        return self.timezone

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.is_production and self.secret_key == "change-me-in-production":
            raise ValueError("SECRET_KEY must be changed in production")
        return self


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
