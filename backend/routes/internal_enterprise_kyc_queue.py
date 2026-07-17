"""
Internal Enterprise KYC queue-safe read API (Phase 3C/3E).

GET /api/internal/enterprise/kyc/queue-safe

Auth: Authorization Bearer <KAREKOD_ENTERPRISE_KYC_READ_TOKEN> only.
Data: product_db (default) OR staging-only fixture when gated.
No Leylek admin JWT fallback, no Supabase Auth fallback, no admin_phone.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.responses import JSONResponse

from services.enterprise_kyc_read_auth import (
    parse_optional_kyc_audit_headers,
    require_enterprise_kyc_read_service,
)
from services.kyc_queue_fixture_gate import (
    fixture_mode_denial_reason,
    is_fixture_data_mode_requested,
    is_staging_fixture_mode_allowed,
)
from services.kyc_queue_safe_service import (
    DATA_SOURCE_FIXTURE,
    DATA_SOURCE_PRODUCT_DB,
    NO_STORE_HEADERS,
    QUEUE_SAFE_DEFAULT_LIMIT,
    clamp_queue_safe_limit,
    load_kyc_queue_safe_payload,
    load_kyc_queue_safe_payload_from_fixture,
)

logger = logging.getLogger("server")

router = APIRouter(
    prefix="/internal/enterprise/kyc",
    tags=["internal-enterprise-kyc"],
)


@router.get("/queue-safe")
async def get_internal_enterprise_kyc_queue_safe(
    request: Request,
    response: Response,
    limit: int = Query(default=QUEUE_SAFE_DEFAULT_LIMIT),
    service_identity: str = Depends(require_enterprise_kyc_read_service),
    x_karekod_actor_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Actor-Id")
    ] = None,
    x_karekod_request_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Request-Id")
    ] = None,
) -> JSONResponse:
    """
    Server-to-server pending KYC queue (PII-safe).
    Actor headers are optional audit metadata only.
    Fixture never bypasses service-token auth.
    """
    if "admin_phone" in request.query_params:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "admin_phone_not_accepted"},
            headers=NO_STORE_HEADERS,
        )

    audit = parse_optional_kyc_audit_headers(
        actor_id=x_karekod_actor_id,
        request_id=x_karekod_request_id,
    )

    safe_limit = clamp_queue_safe_limit(limit)

    if is_fixture_data_mode_requested():
        denial = fixture_mode_denial_reason()
        if denial is not None:
            logger.warning(
                "enterprise_kyc_read: fixture_denied reason=%s identity=%s",
                denial,
                service_identity,
            )
            return JSONResponse(
                status_code=503,
                content={"success": False, "error": denial},
                headers=NO_STORE_HEADERS,
            )
        if not is_staging_fixture_mode_allowed():
            return JSONResponse(
                status_code=503,
                content={"success": False, "error": "fixture_mode_denied"},
                headers=NO_STORE_HEADERS,
            )
        try:
            payload = load_kyc_queue_safe_payload_from_fixture(limit=safe_limit)
            logger.info(
                "enterprise_kyc_read: ok identity=%s source=%s actor=%s "
                "request_id=%s count=%s limit=%s",
                service_identity,
                DATA_SOURCE_FIXTURE,
                (audit["actor_id"] or "-")[:16],
                (audit["request_id"] or "-")[:16],
                payload["count"],
                safe_limit,
            )
            return JSONResponse(content=payload, headers=NO_STORE_HEADERS)
        except Exception:
            logger.warning(
                "enterprise_kyc_read: fixture_error identity=%s request_id=%s",
                service_identity,
                (audit["request_id"] or "-")[:16],
            )
            return JSONResponse(
                status_code=503,
                content={"success": False, "error": "upstream_unavailable"},
                headers=NO_STORE_HEADERS,
            )

    # Default / product_db — unchanged from Phase 3C.
    import server as srv

    sb = srv.supabase
    if not sb:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "service_unavailable"},
            headers=NO_STORE_HEADERS,
        )

    try:
        payload = load_kyc_queue_safe_payload(supabase_client=sb, limit=safe_limit)
        logger.info(
            "enterprise_kyc_read: ok identity=%s source=%s actor=%s "
            "request_id=%s count=%s limit=%s",
            service_identity,
            DATA_SOURCE_PRODUCT_DB,
            (audit["actor_id"] or "-")[:16],
            (audit["request_id"] or "-")[:16],
            payload["count"],
            safe_limit,
        )
        return JSONResponse(content=payload, headers=NO_STORE_HEADERS)
    except Exception:
        logger.warning(
            "enterprise_kyc_read: db_error identity=%s request_id=%s",
            service_identity,
            (audit["request_id"] or "-")[:16],
        )
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "upstream_unavailable"},
            headers=NO_STORE_HEADERS,
        )
