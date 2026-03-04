from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import get_settings
from app.schemas.ai import (
    EnhanceBioRequest,
    EnhanceBioResponse,
    ImpressionReportRequest,
    ImpressionReportResponse,
    ScanInsightRequest,
    ScanInsightResponse,
)
from app.schemas.common import ApiResponse
from app.services import ai as ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])
settings = get_settings()


async def verify_internal_key(x_api_key: str = Header(..., alias="X-API-Key")) -> None:
    if settings.internal_api_key and x_api_key != settings.internal_api_key:
        raise HTTPException(status_code=403, detail="Invalid internal API key")


@router.post("/enhance-bio", response_model=ApiResponse[EnhanceBioResponse])
async def enhance_bio(
    req: EnhanceBioRequest,
    _: None = Depends(verify_internal_key),
) -> ApiResponse[EnhanceBioResponse]:
    result = await ai_service.enhance_bio(req)
    return ApiResponse(success=True, data=result)


@router.post("/scan-insight", response_model=ApiResponse[ScanInsightResponse])
async def scan_insight(
    req: ScanInsightRequest,
    _: None = Depends(verify_internal_key),
) -> ApiResponse[ScanInsightResponse]:
    result = await ai_service.get_scan_insight(req)
    return ApiResponse(success=True, data=result)


@router.post("/impression-report", response_model=ApiResponse[ImpressionReportResponse])
async def impression_report(
    req: ImpressionReportRequest,
    _: None = Depends(verify_internal_key),
) -> ApiResponse[ImpressionReportResponse]:
    result = await ai_service.generate_impression_report(req)
    return ApiResponse(success=True, data=result)
