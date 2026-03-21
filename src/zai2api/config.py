from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(slots=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    log_level: str = os.getenv("LOG_LEVEL", "info")
    zai_base_url: str = os.getenv("ZAI_BASE_URL", "https://chat.z.ai")
    zai_jwt: str | None = os.getenv("ZAI_JWT")
    zai_session_token: str | None = os.getenv("ZAI_SESSION_TOKEN")
    default_model: str = os.getenv("DEFAULT_MODEL", "glm-5")
    request_timeout: float = float(os.getenv("REQUEST_TIMEOUT", "120"))


settings = Settings()
