from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/global")
async def global_stats(
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Returns aggregate scan stats for the Trust Radar homepage counter.
    Called by the frontend every 60 s to update the live badge.

    Query parameters:
      hours (int, default 24): time window to aggregate over
    """
    # Clamp to reasonable range
    hours = max(1, min(hours, 168))  # 1 h – 7 days

    result = await db.execute(
        text("""
            SELECT
                COUNT(*)                                            AS total_scans,
                COUNT(*) FILTER (WHERE trust_score < 40)           AS total_threats,
                COUNT(DISTINCT geo_country_code)
                    FILTER (WHERE geo_country_code IS NOT NULL)     AS unique_countries,
                MAX(created_at)                                     AS last_scan
            FROM scans
            WHERE created_at >= NOW() - (:hours * INTERVAL '1 hour')
        """),
        {"hours": hours},
    )
    row = result.fetchone()

    last_scan: datetime | None = row.last_scan if row else None

    return {
        "total_scans": int(row.total_scans) if row else 0,
        "total_threats": int(row.total_threats) if row else 0,
        "unique_countries": int(row.unique_countries) if row else 0,
        "last_scan": last_scan.isoformat() if last_scan else None,
        "period_hours": hours,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
