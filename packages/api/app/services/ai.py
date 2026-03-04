from openai import AsyncOpenAI

from app.config import get_settings
from app.schemas.ai import (
    EnhanceBioRequest,
    EnhanceBioResponse,
    ImpressionReportRequest,
    ImpressionReportResponse,
    ScanInsightRequest,
    ScanInsightResponse,
)

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = "gpt-4o-mini"


async def enhance_bio(req: EnhanceBioRequest) -> EnhanceBioResponse:
    platform_context = {
        "linkedin": "LinkedIn professional profile",
        "twitter": "Twitter/X bio (max 160 chars)",
        "github": "GitHub profile bio",
        "website": "personal website About page",
        "general": "general professional bio",
    }[req.platform]

    system = (
        f"You are an expert personal branding coach specializing in {platform_context}. "
        "Return ONLY a JSON object matching the schema, no markdown."
    )
    user_msg = (
        f"Enhance this bio for {platform_context} with a {req.tone} tone.\n\n"
        f"Original bio:\n{req.text}\n\n"
        "Return JSON: {enhanced: string, improvements: string[]}"
    )

    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    import json
    result = json.loads(resp.choices[0].message.content or "{}")

    return EnhanceBioResponse(
        original=req.text,
        enhanced=result.get("enhanced", req.text),
        improvements=result.get("improvements", []),
        word_count_before=len(req.text.split()),
        word_count_after=len(result.get("enhanced", req.text).split()),
    )


async def get_scan_insight(req: ScanInsightRequest) -> ScanInsightResponse:
    system = (
        "You are a cybersecurity expert explaining URL trust analysis results to non-technical users. "
        "Be clear, concise, and actionable. Return JSON only."
    )
    flags_str = "\n".join(f"- {f.get('type', '')}: {f.get('detail', '')}" for f in req.flags)
    user_msg = (
        f"URL: {req.url}\nTrust Score: {req.trust_score}/100\nRisk Level: {req.risk_level}\n"
        f"Flags:\n{flags_str or 'None'}\n\n"
        "Return JSON: {summary: string, explanation: string, recommendations: string[]}"
    )

    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    import json
    result = json.loads(resp.choices[0].message.content or "{}")

    return ScanInsightResponse(
        summary=result.get("summary", ""),
        explanation=result.get("explanation", ""),
        recommendations=result.get("recommendations", []),
    )


async def generate_impression_report(req: ImpressionReportRequest) -> ImpressionReportResponse:
    system = (
        "You are a personal brand strategist. Analyze impression data and provide actionable insights. "
        "Return JSON only."
    )
    user_msg = (
        f"Analyze {len(req.analyses)} impression analyses over {req.time_period_days} days.\n"
        f"Analyses data: {req.analyses[:10]}\n\n"
        "Return JSON: {overall_score: int, trend: 'improving'|'declining'|'stable', "
        "key_strengths: string[], priority_improvements: string[], summary: string}"
    )

    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
        response_format={"type": "json_object"},
        temperature=0.5,
    )

    import json
    result = json.loads(resp.choices[0].message.content or "{}")

    return ImpressionReportResponse(
        overall_score=int(result.get("overall_score", 50)),
        trend=result.get("trend", "stable"),
        key_strengths=result.get("key_strengths", []),
        priority_improvements=result.get("priority_improvements", []),
        summary=result.get("summary", ""),
    )
