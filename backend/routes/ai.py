"""
POST /api/ai/chat — server.py içinde fastapi_app (boş gövde = sağlık; mesajlı = Leylek Zeka).
POST /api/ai/leylekzeka — bu modül (OpenAI / fallback / answer_engine).
POST /api/ai/approve-learning — onaylı canlı öğrenme → KB insert (yalnızca gerçek admin).
"""
from __future__ import annotations

import logging
import os
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from controllers.ai_controller import (
    RateLimitedError,
    get_leylek_zeka_reply,
    enforce_rate_limit,
)
from routes.admin_ai import require_admin_user
from services import leylek_zeka_kb_service as kb
from services.leylek_zeka_entry_service import insert_kb_faq

logger = logging.getLogger("server")

router = APIRouter(prefix="/ai", tags=["ai"])

# Default help mode (env-driven). Keeps endpoint stable even if controller doesn't define it.
USER_HELP_MODE = os.getenv("USER_HELP_MODE", "assistant")


class LeylekZekaHistoryItem(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str = Field(default="", max_length=8000)


class LeylekZekaClientContext(BaseModel):
    """Opsiyonel bağlam — geriye dönük uyumlu; alanların çoğu boş olabilir."""

    model_config = ConfigDict(extra="ignore")

    screen: str | None = None
    role: str | None = None
    city: str | None = None
    vehicleType: str | None = Field(None, description="motor|car vb.")
    hasActiveOffer: bool | None = None
    isWaitingMatch: bool | None = None
    isDriver: bool | None = None
    isPassenger: bool | None = None
    flowHint: str | None = None


class LeylekZekaRequest(BaseModel):
    message: str = Field(default="", max_length=8000)
    history: list[LeylekZekaHistoryItem] | None = None
    context: LeylekZekaClientContext | None = None
    is_admin: bool = False


class ApproveLearningBody(BaseModel):
    question: str = Field(..., max_length=8000)
    answer: str = Field(..., max_length=12000)


def _leylek_admin_uid_from_request(request: Request) -> str | None:
    """
    Authorization: Bearer access_token ile admin doğrulama.
    Header yoksa None. Geçersiz token → 401. Geçerli ama admin değilse None.
    """
    auth = (request.headers.get("Authorization") or request.headers.get("authorization") or "").strip()
    if not auth:
        return None
    parts = auth.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=401,
            detail="Authorization: Bearer <token> formatında olmalı",
        )
    token = parts[1].strip()
    import server as srv

    uid = srv.verify_access_token(token)
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
        return uid if ok else None
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("leylek ai admin resolve: %s", e)
        raise HTTPException(status_code=500, detail="Yetki kontrolü başarısız") from e


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host
    return "unknown"


async def run_leylek_zeka_chat(body: LeylekZekaRequest, request: Request) -> dict[str, Any]:
    """
    POST /api/ai/chat (fastapi_app) ve POST /api/ai/leylekzeka ortak mantık.
    Yanıt: { ok, success, reply, source, mode, ... }.
    """
    key = _client_key(request)
    try:
        await enforce_rate_limit(key)
    except RateLimitedError:
        raise HTTPException(
            status_code=429,
            detail="Çok sık istek. Lütfen birkaç saniye bekleyin.",
        )

    hist = [h.model_dump() for h in (body.history or [])]
    ctx_dict = body.context.model_dump(exclude_none=True) if body.context else None

    admin_authenticated = bool(_leylek_admin_uid_from_request(request))

    try:
        reply, source, engine_meta, extra = await get_leylek_zeka_reply(
            user_message=body.message,
            history=hist,
            context=ctx_dict,
            admin_authenticated=admin_authenticated,
        )
    except Exception as e:
        logger.exception("Leylek Zeka beklenmeyen hata: %s", e)
        raise HTTPException(status_code=500, detail="Bir hata oluştu.") from e

    out: dict[str, Any] = {
        "ok": True,
        "success": True,
        "reply": reply,
        "source": source,
        "mode": USER_HELP_MODE,
    }
    if engine_meta is not None:
        out["intent_id"] = engine_meta["intent_id"]
        out["deterministic"] = engine_meta["deterministic"]
    if extra:
        out.update(extra)
    return out


@router.post("/leylekzeka")
async def leylek_zeka_endpoint(body: LeylekZekaRequest, request: Request) -> dict[str, Any]:
    """
    Eski yol POST /api/ai/leylekzeka — Gövde: LeylekZekaRequest.
    """
    return await run_leylek_zeka_chat(body, request)


@router.post("/approve-learning")
async def approve_learning_endpoint(
    body: ApproveLearningBody,
    _admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    """Onaylı FAQ → leylek_zeka_kb_entry (body yalnızca question/answer)."""
    q = (body.question or "").strip()
    a = (body.answer or "").strip()
    if not q or not a:
        raise HTTPException(status_code=422, detail="question ve answer dolu olmalı")
    cleaned = kb.validate_body("faq", {"question": q, "answer": a})
    row = insert_kb_faq(cleaned["question"], cleaned["answer"])
    if row is None:
        raise HTTPException(status_code=503, detail="KB kaydı oluşturulamadı")
    return {
        "ok": True,
        "success": True,
        "message": "Bunu kayda geçirdim patron.",
        "entry_id": row.get("id"),
    }
