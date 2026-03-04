from typing import Literal

from pydantic import BaseModel, Field


class EnhanceBioRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=2000)
    platform: Literal["linkedin", "twitter", "github", "website", "general"] = "general"
    tone: Literal["professional", "casual", "creative"] = "professional"


class EnhanceBioResponse(BaseModel):
    original: str
    enhanced: str
    improvements: list[str]
    word_count_before: int
    word_count_after: int


class ScanInsightRequest(BaseModel):
    url: str
    trust_score: int
    risk_level: str
    flags: list[dict]


class ScanInsightResponse(BaseModel):
    summary: str
    explanation: str
    recommendations: list[str]


class ImpressionReportRequest(BaseModel):
    analyses: list[dict]
    time_period_days: int = 30


class ImpressionReportResponse(BaseModel):
    overall_score: int
    trend: Literal["improving", "declining", "stable"]
    key_strengths: list[str]
    priority_improvements: list[str]
    summary: str
