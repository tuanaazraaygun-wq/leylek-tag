"""
Internal Enterprise KYC document access redeem-and-stream API (Phase D7-B2B).

GET /api/internal/enterprise/kyc/document-access/{grant_id}/stream

Auth: Authorization Bearer <KAREKOD_ENTERPRISE_KYC_REVIEW_TOKEN> only.
Actor and request-id headers are mandatory after auth (request-id is never auto-generated).
{grant_id} is the opaque access-grant token from issuance — not the database UUID.
"""
from __future__ import annotations

import logging
import os
from typing import Annotated, Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from postgrest.exceptions import APIError as PostgrestAPIError

from contracts.enterprise_kyc_document_access_contract import (
    kyc_document_access_contract_contains_forbidden_keys,
)
from services.enterprise_kyc_read_auth import (
    sanitize_kyc_audit_header,
    sanitize_required_kyc_actor_header,
    require_enterprise_kyc_review_service,
)
from services.kyc_application_safe_detail_service import NO_STORE_HEADERS
from services.kyc_document_access_grant_service import KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV
from services.kyc_document_access_redeem_service import KycDocumentAccessRedeemCommand
from services.kyc_document_access_stream_service import (
    KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE,
    KYC_DOCUMENT_ACCESS_STREAM_CONTENT_TYPE,
    stream_kyc_document_access_grant,
)

logger = logging.getLogger("server")

router = APIRouter(
    prefix="/internal/enterprise/kyc",
    tags=["internal-enterprise-kyc"],
)

STAGE_RESOLVE_SUPABASE = "resolve_supabase"
STAGE_LOAD_BINDING_SECRET = "load_binding_secret"
STAGE_RESOLVE_ALLOWED_HOSTS = "resolve_allowed_hosts"
STAGE_STREAM = "stream"
STAGE_MAP_OUTCOME = "map_outcome"


def _short_log(value: str) -> str:
    if len(value) <= 16:
        return value
    return value[:16]


def _error_response(*, error: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": error},
        headers=NO_STORE_HEADERS,
    )


def _envelope_response(payload: dict[str, Any], *, status_code: int = 200) -> JSONResponse:
    if kyc_document_access_contract_contains_forbidden_keys(payload):
        return _error_response(error="upstream_unavailable", status_code=503)
    return JSONResponse(content=payload, status_code=status_code, headers=NO_STORE_HEADERS)


def _unavailable_envelope(reason_code: str) -> JSONResponse:
    return _envelope_response(
        {
            "success": True,
            "result": {
                "availability": "unavailable",
                "reason_code": reason_code,
            },
        },
        status_code=200,
    )


def _parse_required_stream_audit_headers(
    *,
    actor_id: Optional[str],
    request_id: Optional[str],
) -> dict[str, str]:
    """Actor and request-id both required; request-id is never server-generated."""
    actor = sanitize_required_kyc_actor_header(actor_id)
    if request_id is None or not str(request_id).strip():
        logger.info("enterprise_kyc_document_access_stream: invalid_request_id_metadata")
        raise HTTPException(status_code=400, detail="invalid_audit_metadata")
    sanitized_request_id = sanitize_kyc_audit_header(request_id, field="request_id")
    if sanitized_request_id is None:
        raise HTTPException(status_code=400, detail="invalid_audit_metadata")
    return {"actor_id": actor, "request_id": sanitized_request_id}


def _resolve_stream_supabase_client() -> Any | None:
    from supabase_client import get_supabase

    try:
        return get_supabase()
    except Exception:
        return None


def _supabase_public_host() -> Optional[str]:
    raw = (os.getenv("SUPABASE_URL") or "").strip()
    if not raw:
        return None
    try:
        host = urlparse(raw).hostname
    except Exception:
        return None
    if not host:
        return None
    return host.lower()


def _load_binding_secret_key() -> tuple[bytes | None, str | None]:
    raw = (os.getenv(KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV) or "").strip()
    if not raw:
        return None, "missing"
    encoded = raw.encode("utf-8")
    if len(encoded) < 32:
        return None, "short"
    return encoded, None


def _log_route_failure(
    *,
    event: str,
    failure_stage: str,
    exc: BaseException | None,
    service_identity: str,
    audit: dict[str, str],
) -> None:
    logger.warning(
        "enterprise_kyc_document_access_stream: %s identity=%s actor=%s request_id=%s "
        "failure_stage=%s exception_class=%s",
        event,
        service_identity,
        _short_log(audit["actor_id"]),
        _short_log(audit["request_id"]),
        failure_stage,
        type(exc).__name__ if exc is not None else "None",
    )


def _map_stream_outcome_to_response(
    *, outcome_code: str, content: bytes | None, content_type: str | None
) -> Response:
    if outcome_code == "redeemed":
        if content is None:
            return _error_response(error="upstream_unavailable", status_code=503)
        headers = dict(NO_STORE_HEADERS)
        return Response(
            content=content,
            status_code=200,
            media_type=content_type or KYC_DOCUMENT_ACCESS_STREAM_CONTENT_TYPE,
            headers=headers,
        )

    if outcome_code == "not_found_or_unauthorized":
        return _unavailable_envelope("document_unavailable")

    if outcome_code == "grant_expired":
        return _unavailable_envelope("grant_expired")

    if outcome_code == "grant_redeemed":
        return _unavailable_envelope("grant_redeemed")

    if outcome_code == "grant_revoked":
        return _unavailable_envelope("grant_revoked")

    if outcome_code == "invalid_input":
        return _error_response(error="invalid_request", status_code=422)

    if outcome_code == "audit_unavailable":
        return _error_response(error="audit_unavailable", status_code=503)

    if outcome_code == KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE:
        return _error_response(error="upstream_unavailable", status_code=503)

    return _error_response(error="upstream_unavailable", status_code=503)


@router.get("/document-access/{grant_id}/stream")
async def get_internal_enterprise_kyc_document_access_stream(
    grant_id: str,
    request: Request,
    service_identity: str = Depends(require_enterprise_kyc_review_service),
    x_karekod_actor_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Actor-Id")
    ] = None,
    x_karekod_request_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Request-Id")
    ] = None,
) -> Response:
    if "admin_phone" in request.query_params:
        return _error_response(error="admin_phone_not_accepted", status_code=400)

    audit = _parse_required_stream_audit_headers(
        actor_id=x_karekod_actor_id,
        request_id=x_karekod_request_id,
    )

    failure_stage = STAGE_RESOLVE_SUPABASE
    sb = _resolve_stream_supabase_client()
    if not sb:
        _log_route_failure(
            event="dependency_unavailable",
            failure_stage=failure_stage,
            exc=None,
            service_identity=service_identity,
            audit=audit,
        )
        return _error_response(error="upstream_unavailable", status_code=503)

    failure_stage = STAGE_LOAD_BINDING_SECRET
    binding_secret_key, binding_error = _load_binding_secret_key()
    if binding_secret_key is None:
        logger.warning(
            "enterprise_kyc_document_access_stream: binding_secret_unavailable identity=%s reason=%s",
            service_identity,
            binding_error or "missing",
        )
        _log_route_failure(
            event="dependency_unavailable",
            failure_stage=failure_stage,
            exc=None,
            service_identity=service_identity,
            audit=audit,
        )
        return _error_response(error="upstream_unavailable", status_code=503)

    failure_stage = STAGE_RESOLVE_ALLOWED_HOSTS
    public_host = _supabase_public_host()
    allowed_public_hosts = [public_host] if public_host else []

    command = KycDocumentAccessRedeemCommand(
        access_grant_token=grant_id,
        actor_admin_id=audit["actor_id"],
        request_id=audit["request_id"],
        source_channel="enterprise_bff",
    )

    try:
        failure_stage = STAGE_STREAM
        stream_result = stream_kyc_document_access_grant(
            supabase_client=sb,
            binding_secret_key=binding_secret_key,
            command=command,
            allowed_public_hosts=allowed_public_hosts,
        )

        failure_stage = STAGE_MAP_OUTCOME
        response = _map_stream_outcome_to_response(
            outcome_code=stream_result.outcome_code,
            content=stream_result.content,
            content_type=stream_result.content_type,
        )
        logger.info(
            "enterprise_kyc_document_access_stream: outcome identity=%s actor=%s request_id=%s "
            "outcome=%s status=%s",
            service_identity,
            _short_log(audit["actor_id"]),
            _short_log(audit["request_id"]),
            stream_result.outcome_code,
            response.status_code,
        )
        return response
    except PostgrestAPIError as exc:
        _log_route_failure(
            event="upstream_error",
            failure_stage=failure_stage,
            exc=exc,
            service_identity=service_identity,
            audit=audit,
        )
        return _error_response(error="upstream_unavailable", status_code=503)
    except Exception as exc:
        _log_route_failure(
            event="upstream_error",
            failure_stage=failure_stage,
            exc=exc,
            service_identity=service_identity,
            audit=audit,
        )
        return _error_response(error="upstream_unavailable", status_code=503)
