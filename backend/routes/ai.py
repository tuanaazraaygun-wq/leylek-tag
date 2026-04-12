"""
POST /api/ai/chat — server.py içinde fastapi_app (boş gövde = sağlık; mesajlı = Leylek Zeka).
POST /api/ai/leylekzeka — bu modül (OpenAI / fallback / answer_engine).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from controllers.ai_controller import (
    RateLimitedError,
    get_leylek_zeka_reply,
    enforce_rate_limit,
)

logger = logging.getLogger("server")

router = APIRouter(prefix="/ai", tags=["ai"])

# Default help mode (env-driven). Keeps endpoint stable even if controller doesn't define it.
USER_HELP_MODE = os.getenv("USER_HELP_MODE", "assistant")


class LeylekZekaHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
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

    try:
        reply, source, engine_meta = await get_leylek_zeka_reply(
            user_message=body.message,
            history=hist,
            context=ctx_dict,
            is_admin=body.is_admin,
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
    return out


@router.post("/leylekzeka")
async def leylek_zeka_endpoint(body: LeylekZekaRequest, request: Request) -> dict[str, Any]:
    """
    Eski yol POST /api/ai/leylekzeka — Gövde: LeylekZekaRequest.
    """
    return await run_leylek_zeka_chat(body, request)
