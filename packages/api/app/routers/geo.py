from __future__ import annotations

import time
from typing import Optional

import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api/geo", tags=["geo"])

# Simple in-memory LRU-style cache: ip -> (result, timestamp)
# Holds up to 10_000 entries; entries expire after 24 h.
_GEO_CACHE: dict[str, tuple[Optional[dict], float]] = {}
_CACHE_TTL = 86400  # 24 hours
_CACHE_MAX = 10_000


def _cache_get(ip: str) -> tuple[bool, Optional[dict]]:
    entry = _GEO_CACHE.get(ip)
    if entry is None:
        return False, None
    result, ts = entry
    if time.monotonic() - ts > _CACHE_TTL:
        del _GEO_CACHE[ip]
        return False, None
    return True, result


def _cache_set(ip: str, result: Optional[dict]) -> None:
    # Evict oldest entry if at capacity
    if len(_GEO_CACHE) >= _CACHE_MAX:
        oldest_key = next(iter(_GEO_CACHE))
        del _GEO_CACHE[oldest_key]
    _GEO_CACHE[ip] = (result, time.monotonic())


async def get_ip_location(ip: str) -> Optional[dict]:
    """
    Resolve IP to lat/lng/city/country.
    Uses ip-api.com free tier: 45 req/min, no API key.
    Results are cached in memory for 24 h (up to 10 k entries).
    """
    if not ip or ip in ("127.0.0.1", "localhost", "::1"):
        return None

    hit, cached = _cache_get(ip)
    if hit:
        return cached

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "lat,lon,city,country,countryCode,status"},
            )
            data = r.json()
    except Exception:
        _cache_set(ip, None)
        return None

    if data.get("status") != "success":
        _cache_set(ip, None)
        return None

    result = {
        "lat": data["lat"],
        "lng": data["lon"],
        "city": data.get("city", ""),
        "country": data.get("country", ""),
        "country_code": data.get("countryCode", ""),
    }
    _cache_set(ip, result)
    return result


@router.get("/resolve/{ip}")
async def resolve_ip(ip: str) -> dict:
    """Resolve a public IP address to geographic coordinates."""
    result = await get_ip_location(ip)
    if not result:
        return {"error": "Could not resolve IP"}
    return result
