"""
Hardened KYC queue-safe read API (Phase 3A).

GET /api/admin/kyc/queue-safe

Auth: Authorization Bearer <Leylek access JWT> + users.is_admin == true.
Does NOT accept admin_phone query / ADMIN_BACKEND_PHONE / phone allowlist gate.
Response is PII-safe (no phone, plate, raw name, document URLs).

Mapping/query helpers live in services.kyc_queue_safe_service (shared with Phase 3C).
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse

from services.kyc_queue_safe_service import (
    NO_STORE_HEADERS,
    QUEUE_SAFE_DEFAULT_LIMIT,
    build_queue_safe_payload,
    clamp_queue_safe_limit,
    load_kyc_queue_safe_payload,
    map_driver_row_to_queue_safe_item,
    mask_kyc_display_name,
)

# Re-exports for existing Phase 3A tests (stable import surface).
__all__ = [
    "router",
    "mask_kyc_display_name",
    "map_driver_row_to_queue_safe_item",
    "build_queue_safe_payload",
    "clamp_queue_safe_limit",
    "require_signed_admin_for_kyc_queue",
    "get_kyc_queue_safe",
]

logger = logging.getLogger("server")

router = APIRouter(prefix="/admin/kyc", tags=["admin-kyc-queue-safe"])

_NO_STORE = NO_STORE_HEADERS
_QUEUE_SAFE_DEFAULT_LIMIT = QUEUE_SAFE_DEFAULT_LIMIT


def require_signed_admin_for_kyc_queue(
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> str:
    """
    Signed Leylek access JWT + users.is_admin only.
    Phone allowlist / admin_phone query are deliberately NOT accepted.
    """
    if not authorization or not str(authorization).strip():
        raise HTTPException(status_code=401, detail="unauthorized")
    parts = str(authorization).strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="unauthorized")

    import server as srv

    uid = srv.verify_access_token(parts[1].strip())
    if not uid:
        raise HTTPException(status_code=401, detail="unauthorized")

    sb = srv.supabase
    if not sb:
        raise HTTPException(status_code=503, detail="service_unavailable")

    try:
        # Select least fields — never use phone for authorization here.
        row = (
            sb.table("users")
            .select("id,is_admin")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        data = (row.data or [None])[0] or {}
        if not bool(data.get("is_admin")):
            logger.info("kyc_queue_safe: forbidden uid_prefix=%s", str(uid)[:8])
            raise HTTPException(status_code=403, detail="forbidden")
    except HTTPException:
        raise
    except Exception:
        logger.warning("kyc_queue_safe: admin check failed uid_prefix=%s", str(uid)[:8])
        raise HTTPException(status_code=500, detail="auth_check_failed") from None

    return str(uid)


@router.get("/queue-safe")
async def get_kyc_queue_safe(
    request: Request,
    response: Response,
    limit: int = Query(default=_QUEUE_SAFE_DEFAULT_LIMIT),
    admin_uid: str = Depends(require_signed_admin_for_kyc_queue),
) -> JSONResponse:
    """
    Pending KYC queue, PII-safe DTO for Enterprise read wiring.
    Does not mutate Product DB. Does not accept admin_phone.
    """
    # Legacy phone-query identity must not be accepted on this surface.
    if "admin_phone" in request.query_params:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "admin_phone_not_accepted"},
            headers=_NO_STORE,
        )

    safe_limit = clamp_queue_safe_limit(limit)

    import server as srv

    sb = srv.supabase
    if not sb:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "service_unavailable"},
            headers=_NO_STORE,
        )

    try:
        payload = load_kyc_queue_safe_payload(supabase_client=sb, limit=safe_limit)
        logger.info(
            "kyc_queue_safe: ok actor_prefix=%s count=%s limit=%s",
            str(admin_uid)[:8],
            payload["count"],
            safe_limit,
        )
        return JSONResponse(content=payload, headers=_NO_STORE)
    except Exception:
        logger.warning(
            "kyc_queue_safe: db_error actor_prefix=%s",
            str(admin_uid)[:8],
        )
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "upstream_unavailable"},
            headers=_NO_STORE,
        )
