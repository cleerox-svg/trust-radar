"""Initial tables

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE user_plan AS ENUM ('free', 'pro', 'enterprise');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            email VARCHAR(320) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            plan user_plan NOT NULL DEFAULT 'free',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_requests (
            id UUID PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            service VARCHAR(50) NOT NULL,
            request_type VARCHAR(100) NOT NULL,
            prompt_tokens INTEGER NOT NULL DEFAULT 0,
            completion_tokens INTEGER NOT NULL DEFAULT 0,
            model VARCHAR(100) NOT NULL,
            cost_usd FLOAT NOT NULL DEFAULT 0.0,
            result_summary TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_requests_user_id ON ai_requests (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_requests")
    op.execute("DROP TABLE IF EXISTS users")
    op.execute("DROP TYPE IF EXISTS user_plan")
