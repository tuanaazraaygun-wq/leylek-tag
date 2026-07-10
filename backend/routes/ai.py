"""
POST /api/ai/chat — server.py içinde fastapi_app (boş gövde = sağlık; mesajlı = Leylek Zeka).
POST /api/ai/leylekzeka — bu modül (OpenAI / fallback / answer_engine).
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from api_session_jwt import verify_access_token_optional
from controllers.ai_controller import (
    RateLimitedError,
    get_leylek_zeka_reply,
    enforce_rate_limit,
)
from services.operation_snapshot import (
    build_driver_demand_snapshot_sync,
    build_passenger_availability_snapshot_sync,
    infer_snapshot_role_from_client_context,
    is_operation_snapshot_ai_enabled,
    snapshot_to_llm_context,
)
from services.leylek_zeka.verified_context import (
    VERIFIED_CONTEXT_SOURCE_VERSION,
    build_verified_context,
    fetch_user_verified_account_row_sync,
    guest_verified_context,
    verified_context_to_public_dict,
)
from services.trip_lifecycle_support_context import (
    build_support_context_trip_payload,
    fetch_active_tag_minimal_sync,
    resolve_user_id_for_tags_sync,
    utc_now_iso_z,
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
    guideMode: bool | None = None
    stageLabel: str | None = None
    intentScope: str | None = None
    operationAwareness: bool | None = None
    knownSignals: list[str] | None = None
    safeAdviceOnly: bool | None = None
    voiceMode: bool | None = None
    inputMode: str | None = None


class LeylekZekaRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    history: list[LeylekZekaHistoryItem] | None = None
    context: LeylekZekaClientContext | None = None


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

    # Opsiyonel Bearer: varsa minimal aktif tag + verified account context (PII yok).
    # Yoksa veya hata: guest verified context; frontend ipuçları otorite değildir.
    try:
        auth_hdr = request.headers.get("authorization") or request.headers.get("Authorization")
        token_uid: str | None = None
        if auth_hdr and str(auth_hdr).strip():
            parts = str(auth_hdr).strip().split(None, 1)
            if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
                token_uid = verify_access_token_optional(parts[1].strip())
        if ctx_dict is None:
            ctx_dict = {}
        else:
            ctx_dict = dict(ctx_dict)

        if token_uid:
            gen_at = utc_now_iso_z()

            def _load_tag() -> dict[str, Any] | None:
                return fetch_active_tag_minimal_sync(token_uid)

            def _load_account() -> dict[str, Any] | None:
                return fetch_user_verified_account_row_sync(token_uid)

            tag_min = await asyncio.to_thread(_load_tag)
            user_row = await asyncio.to_thread(_load_account)
            support_payload = build_support_context_trip_payload(tag_min, generated_at=gen_at)
            ctx_dict["support_context"] = support_payload

            trip_part = support_payload.get("trip") if isinstance(support_payload, dict) else None
            verified = build_verified_context(
                authenticated=True,
                user_row=user_row,
                trip_payload=trip_part if isinstance(trip_part, dict) else None,
                source_version=str(support_payload.get("schema_version") or "")
                or VERIFIED_CONTEXT_SOURCE_VERSION,
            )
            ctx_dict["verified_context"] = verified_context_to_public_dict(verified)

            if is_operation_snapshot_ai_enabled():
                try:
                    snap_role = infer_snapshot_role_from_client_context(ctx_dict)
                    if snap_role:
                        resolved_uid = resolve_user_id_for_tags_sync(token_uid)
                        if resolved_uid:

                            def _load_operation_context() -> dict[str, Any]:
                                if snap_role == "driver":
                                    raw = build_driver_demand_snapshot_sync(
                                        resolved_uid, 20.0
                                    )
                                    return snapshot_to_llm_context(raw, "driver_demand")
                                tag_id_inner = None
                                if tag_min and tag_min.get("id"):
                                    tag_id_inner = str(tag_min["id"]).strip()
                                raw = build_passenger_availability_snapshot_sync(
                                    resolved_uid, 20.0, tag_id_inner
                                )
                                return snapshot_to_llm_context(
                                    raw, "passenger_availability"
                                )

                            op_ctx = await asyncio.to_thread(_load_operation_context)
                            sc = dict(ctx_dict.get("support_context") or support_payload)
                            sc["operation"] = op_ctx
                            ctx_dict["support_context"] = sc
                except Exception:
                    logger.warning(
                        "Leylek Zeka support_context operation atlandı",
                        exc_info=True,
                    )
        else:
            ctx_dict["verified_context"] = verified_context_to_public_dict(
                guest_verified_context()
            )
    except Exception:
        logger.warning("Leylek Zeka support_context trip atlandı", exc_info=True)
        try:
            if ctx_dict is None:
                ctx_dict = {}
            else:
                ctx_dict = dict(ctx_dict)
            if "verified_context" not in ctx_dict:
                ctx_dict["verified_context"] = verified_context_to_public_dict(
                    guest_verified_context()
                )
        except Exception:
            pass

    try:
        reply, source, engine_meta, contract = await get_leylek_zeka_reply(
            user_message=body.message,
            history=hist,
            context=ctx_dict,
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
        # Additive grounded-response contract (backward-compatible)
        "grounded": contract["grounded"],
        "confidence": contract["confidence"],
        "category": contract["category"],
        "source_version": contract["source_version"],
        "requires_support": contract["requires_support"],
        "suggested_route": contract["suggested_route"],
        "blocked_claim_reason": contract["blocked_claim_reason"],
        "live_state_used": contract["live_state_used"],
        "account_context_used": contract["account_context_used"],
        "safety_level": contract["safety_level"],
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
