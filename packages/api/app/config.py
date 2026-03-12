from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    @field_validator("database_url", mode="before")
    @classmethod
    def force_asyncpg(cls, v: str) -> str:
        # Railway provides postgres:// or postgresql://, both need +asyncpg for async engine
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # OpenAI
    openai_api_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Internal service comms
    internal_api_key: str = ""

    # CORS
    allowed_origins: str = "https://lrxradar.com,https://imprsn8.com,http://localhost:3000"

    # Sentry
    sentry_dsn: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
