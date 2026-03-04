from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

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
    allowed_origins: str = "https://lrx-radar.com,https://imprsn8.com,http://localhost:3000"

    # Sentry
    sentry_dsn: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
