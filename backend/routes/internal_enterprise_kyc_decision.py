"""
Internal Enterprise KYC decision API (Phase D1).

POST /api/internal/enterprise/kyc/applications/{application_id}/decisions

Auth: Authorization Bearer <KAREKOD_ENTERPRISE_KYC_DECISION_TOKEN> only.
Actor header mandatory; Idempotency-Key mandatory.
No admin_phone, no browser session, no public access.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse

from services.enterprise_kyc_read_auth import (
    parse_detail_kyc_audit_headers,
    require_enterprise_kyc_decision_service,
)
from services.kyc_application_safe_detail_service import NO_STORE_HEADERS
from services.kyc_enterprise_decision_audit import append_kyc_decision_audit_event
from services.kyc_enterprise_decision_service import (
    KycEnterpriseDecisionError,
    execute_kyc_enterprise_decision,
    sanitize_idempotency_key,
)

logger = logging.getLogger("server")

router = APIRouter(
    prefix="/internal/enterprise/kyc",
    tags=["internal-enterprise-kyc"],
)


@router.post("/applications/{application_id}/decisions")
async def post_internal_enterprise_kyc_decision(
    application_id: UUID,
    request: Request,
    body: dict,
    service_identity: str = Depends(require_enterprise_kyc_decision_service),
    x_karekod_actor_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Actor-Id")
    ] = None,
    x_karekod_request_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Request-Id")
    ] = None,
    idempotency_key_header: Annotated[
        Optional[str], Header(alias="Idempotency-Key")
    ] = None,
) -> JSONResponse:
    if "admin_phone" in request.query_params:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "admin_phone_not_accepted"},
            headers=NO_STORE_HEADERS,
        )

    audit = parse_detail_kyc_audit_headers(
        actor_id=x_karekod_actor_id,
        request_id=x_karekod_request_id,
    )

    try:
        idempotency_key = sanitize_idempotency_key(idempotency_key_header)
    except KycEnterpriseDecisionError as exc:
        return JSONResponse(
            status_code=exc.http_status,
            content={"success": False, "error": exc.code},
            headers=NO_STORE_HEADERS,
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
        payload = execute_kyc_enterprise_decision(
            supabase_client=sb,
            application_id=canonical_application_id,
            actor_id=audit["actor_id"],
            request_id=audit["request_id"],
            service_identity=service_identity,
            idempotency_key=idempotency_key,
            body=body,
        )
        return JSONResponse(content=payload, headers=NO_STORE_HEADERS)
    except KycEnterpriseDecisionError as exc:
        return JSONResponse(
            status_code=exc.http_status,
            content={"success": False, "error": exc.code},
            headers=NO_STORE_HEADERS,
        )
    except Exception:
        append_kyc_decision_audit_event(
            {
                "event_type": "kyc.decision.failed",
                "actor_id": audit["actor_id"],
                "request_id": audit["request_id"],
                "application_id": canonical_application_id,
                "reason_code": "upstream_unavailable",
                "service_identity": service_identity,
            }
        )
        logger.warning(
            "enterprise_kyc_decision: upstream_error identity=%s request_id=%s application_id=%s",
            service_identity,
            audit["request_id"][:16],
            canonical_application_id[:8],
        )
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "upstream_unavailable"},
            headers=NO_STORE_HEADERS,
        )
