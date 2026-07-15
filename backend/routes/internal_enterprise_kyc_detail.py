"""
Internal Enterprise KYC application safe-detail read API (Phase 2).

GET /api/internal/enterprise/kyc/applications/{application_id}/safe-detail

Auth: Authorization Bearer <KAREKOD_ENTERPRISE_KYC_REVIEW_TOKEN> only.
Actor header mandatory after auth; request ID sanitized or server-generated.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse

from services.enterprise_kyc_read_auth import (
    parse_detail_kyc_audit_headers,
    require_enterprise_kyc_review_service,
)
from services.kyc_application_safe_detail_service import (
    NO_STORE_HEADERS,
    load_kyc_application_safe_detail,
)

logger = logging.getLogger("server")

router = APIRouter(
    prefix="/internal/enterprise/kyc",
    tags=["internal-enterprise-kyc"],
)


@router.get("/applications/{application_id}/safe-detail")
async def get_internal_enterprise_kyc_application_safe_detail(
    application_id: UUID,
    service_identity: str = Depends(require_enterprise_kyc_review_service),
    x_karekod_actor_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Actor-Id")
    ] = None,
    x_karekod_request_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Request-Id")
    ] = None,
) -> JSONResponse:
    audit = parse_detail_kyc_audit_headers(
        actor_id=x_karekod_actor_id,
        request_id=x_karekod_request_id,
    )
    canonical_application_id = str(application_id).lower()

    import server as srv

    sb = srv.supabase
    if not sb:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "upstream_unavailable"},
            headers=NO_STORE_HEADERS,
        )

    try:
        payload = load_kyc_application_safe_detail(
            supabase_client=sb,
            application_id=canonical_application_id,
        )
        availability = (payload.get("result") or {}).get("availability", "-")
        reason_code = (payload.get("result") or {}).get("reason_code", "-")
        logger.info(
            "enterprise_kyc_review: ok identity=%s actor=%s request_id=%s "
            "application_id=%s availability=%s reason_code=%s",
            service_identity,
            audit["actor_id"][:16],
            audit["request_id"][:16],
            canonical_application_id[:8],
            availability,
            reason_code,
        )
        return JSONResponse(content=payload, headers=NO_STORE_HEADERS)
    except Exception:
        logger.warning(
            "enterprise_kyc_review: upstream_error identity=%s request_id=%s "
            "application_id=%s",
            service_identity,
            audit["request_id"][:16],
            canonical_application_id[:8],
        )
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "upstream_unavailable"},
            headers=NO_STORE_HEADERS,
        )
