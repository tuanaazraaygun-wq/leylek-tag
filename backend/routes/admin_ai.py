"""
Admin operasyon AI — Bearer + admin telefon / is_admin.
POST /api/admin/ai/*
"""
from __future__ import annotations

import logging
import os
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from controllers.admin_ai_controller import (
    build_admin_insight_response,
    build_help_proxy_response,
    build_region_insight_response,
)
from services.ai_ops_service import fetch_ops_snapshot

logger = logging.getLogger("server")

router = APIRouter(prefix="/admin/ai", tags=["admin-ai"])

# Özellik kapalıysa 503
def _admin_ai_enabled() -> bool:
    return (os.getenv("ADMIN_AI_ENABLED") or "1").strip().lower() not in ("0", "false", "no")


def require_admin_user(
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> str:
    if not authorization or not str(authorization).strip():
        raise HTTPException(status_code=401, detail="Authorization header gerekli")
    parts = str(authorization).strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=401,
            detail="Authorization: Bearer <token> formatında olmalı",
        )
    import server as srv

    uid = srv.verify_access_token(parts[1].strip())
    if not uid:
        raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş oturum")
    sb = srv.supabase
    if not sb:
        raise HTTPException(status_code=503, detail="Servis hazır değil")
    try:
        row = sb.table("users").select("phone,is_admin").eq("id", uid).limit(1).execute()
        data = (row.data or [{}])[0]
        phone = data.get("phone") or ""
        is_adm = bool(data.get("is_admin"))
        ok = is_adm or srv._is_admin_phone(phone)
        if not ok:
            logger.info("admin_ai: yetkisiz uid=%s", uid[:8])
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("admin_ai: admin check error: %s", e)
        raise HTTPException(status_code=500, detail="Yetki kontrolü başarısız") from e
    return uid


class AdminSummaryBody(BaseModel):
    since_days: int = Field(default=7, ge=1, le=30)
    use_llm: bool = True


@router.post("/summary")
async def admin_ai_summary(
    body: AdminSummaryBody,
    _admin_uid: str = Depends(require_admin_user),
) -> dict[str, Any]:
    if not _admin_ai_enabled():
        raise HTTPException(status_code=503, detail="Admin AI devre dışı")
    snap = fetch_ops_snapshot(since_days=body.since_days)
    logger.info(
        "admin_ai summary: tags_window=%s dispatch_rows=%s inferences=%s",
        (snap.get("tags") or {}).get("total_in_window"),
        (snap.get("dispatch_queue") or {}).get("rows_in_window"),
        snap.get("inferences"),
    )
    return await build_admin_insight_response(snap, use_llm=body.use_llm)


class RegionInsightBody(BaseModel):
    city: Optional[str] = None
    region_hint: Optional[str] = None
    since_days: int = Field(default=7, ge=1, le=30)
    use_llm: bool = True


@router.post("/region-insight")
async def admin_ai_region_insight(
    body: RegionInsightBody,
    _admin_uid: str = Depends(require_admin_user),
) -> dict[str, Any]:
    if not _admin_ai_enabled():
        raise HTTPException(status_code=503, detail="Admin AI devre dışı")
    snap = fetch_ops_snapshot(since_days=body.since_days)
    logger.info(
        "admin_ai region-insight: city=%s hint=%s",
        body.city,
        body.region_hint,
    )
    return await build_region_insight_response(
        snap,
        city=body.city,
        region_hint=body.region_hint,
        use_llm=body.use_llm,
    )


class HelpSummaryBody(BaseModel):
    since_days: int = Field(default=7, ge=1, le=30)


@router.post("/driver-passenger-help-summary")
async def admin_ai_help_proxy(
    body: HelpSummaryBody,
    _admin_uid: str = Depends(require_admin_user),
) -> dict[str, Any]:
    if not _admin_ai_enabled():
        raise HTTPException(status_code=503, detail="Admin AI devre dışı")
    snap = fetch_ops_snapshot(since_days=body.since_days)
    logger.info("admin_ai help-summary: proxy only (no PII)")
    return await build_help_proxy_response(snap)
