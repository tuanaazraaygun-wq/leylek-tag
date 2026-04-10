"""
Admin — Answer Engine (read-only).
GET /api/admin/answer-engine/coverage — katalog özeti
GET /api/admin/answer-engine/telemetry — süreç içi sayaçlar + telemetri bayrağı
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from routes.admin_ai import require_admin_user
from services.answer_engine.coverage import get_coverage_payload
from services.answer_engine.telemetry import get_answer_engine_telemetry_admin_summary

router = APIRouter(prefix="/admin/answer-engine", tags=["admin-answer-engine"])


@router.get("/coverage")
async def answer_engine_coverage(
    _admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    """Tanımlı intent listesi; katalog `services.answer_engine.catalog` ile senkron."""
    return get_coverage_payload()


@router.get("/telemetry")
async def answer_engine_telemetry(
    _admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    """Answer Engine süreç içi sayaçlar + telemetri ortam bayrağı (salt okunur)."""
    return get_answer_engine_telemetry_admin_summary()
