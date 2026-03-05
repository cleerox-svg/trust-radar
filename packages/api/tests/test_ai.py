"""Tests for AI endpoints.

These tests mock the OpenAI client to avoid real API calls.
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.config import get_settings

settings = get_settings()
INTERNAL_KEY = settings.internal_api_key or "test-key"


def _make_openai_response(content: dict) -> MagicMock:
    msg = MagicMock()
    msg.content = json.dumps(content)
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


@pytest.mark.asyncio
async def test_enhance_bio(client: AsyncClient) -> None:
    mock_resp = _make_openai_response({
        "enhanced": "Senior Software Engineer with 10 years of full-stack experience.",
        "improvements": ["Added seniority level", "Quantified experience"],
    })

    with patch("app.services.ai.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)
        resp = await client.post(
            "/api/ai/enhance-bio",
            json={"text": "I am a software engineer with experience in many things.", "platform": "linkedin", "tone": "professional"},
            headers={"X-API-Key": INTERNAL_KEY},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "enhanced" in data["data"]
    assert "improvements" in data["data"]


@pytest.mark.asyncio
async def test_scan_insight(client: AsyncClient) -> None:
    mock_resp = _make_openai_response({
        "summary": "This URL appears safe.",
        "explanation": "High trust score with no detected issues.",
        "recommendations": ["No action required."],
    })

    with patch("app.services.ai.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)
        resp = await client.post(
            "/api/ai/scan-insight",
            json={"url": "https://example.com", "trust_score": 95, "risk_level": "safe", "flags": []},
            headers={"X-API-Key": INTERNAL_KEY},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "summary" in data["data"]
    assert "recommendations" in data["data"]


@pytest.mark.asyncio
async def test_impression_report(client: AsyncClient) -> None:
    mock_resp = _make_openai_response({
        "overall_score": 78,
        "trend": "improving",
        "key_strengths": ["Clear communication"],
        "priority_improvements": ["Add metrics"],
        "summary": "Strong profile overall.",
    })

    with patch("app.services.ai.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)
        resp = await client.post(
            "/api/ai/impression-report",
            json={"analyses": [{"score": 78, "type": "bio"}], "time_period_days": 30},
            headers={"X-API-Key": INTERNAL_KEY},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["overall_score"] == 78
    assert data["data"]["trend"] == "improving"


@pytest.mark.asyncio
async def test_enhance_bio_missing_key(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/ai/enhance-bio",
        json={"text": "I am a developer.", "platform": "general", "tone": "professional"},
    )
    assert resp.status_code in (403, 422)  # missing header or forbidden


@pytest.mark.asyncio
async def test_enhance_bio_invalid_key(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/ai/enhance-bio",
        json={"text": "I am a developer.", "platform": "general", "tone": "professional"},
        headers={"X-API-Key": "wrong-key"},
    )
    if settings.internal_api_key:
        assert resp.status_code == 403
