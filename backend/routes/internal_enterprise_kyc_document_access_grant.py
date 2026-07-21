"""
Internal Enterprise KYC document access grant issuance API (Phase D6).

POST /api/internal/enterprise/kyc/applications/{application_id}/documents/{document_type}/access-grants

Auth: Authorization Bearer <KAREKOD_ENTERPRISE_KYC_REVIEW_TOKEN> only.
Actor header mandatory after auth; request ID sanitized or server-generated.
"""
from __future__ import annotations

import logging
import os
from typing import Annotated, Any, Optional
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError as PostgrestAPIError

from contracts.enterprise_kyc_detail_contract import (
    KYC_DOCUMENT_DISPLAY_LABELS,
    KYC_DOCUMENT_TYPES,
    KYC_REVIEW_DOCUMENT_MIME_TYPES,
)
from contracts.enterprise_kyc_document_access_contract import (
    kyc_document_access_contract_contains_forbidden_keys,
)
from services.enterprise_kyc_read_auth import (
    parse_detail_kyc_audit_headers,
    require_enterprise_kyc_review_service,
)
from services.kyc_application_safe_detail_service import (
    NO_STORE_HEADERS,
    _record_version_iso,
    select_kyc_application_row_by_id,
)
from services.kyc_document_access_grant_service import (
    KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV,
    KycDocumentAccessIssueGrantCommand,
    KycDocumentAccessIssueGrantRpcResult,
    issue_kyc_document_access_grant,
)

logger = logging.getLogger("server")

router = APIRouter(
    prefix="/internal/enterprise/kyc",
    tags=["internal-enterprise-kyc"],
)

_GRANT_ROUTE_TTL_SECONDS = 90
_REVIEW_REASONS = frozenset({"initial_review", "recheck"})

STAGE_RESOLVE_SUPABASE = "resolve_supabase"
STAGE_LOAD_BINDING_SECRET = "load_binding_secret"
STAGE_RESOLVE_ALLOWED_HOSTS = "resolve_allowed_hosts"
STAGE_SELECT_APPLICATION = "select_application"
STAGE_DERIVE_RECORD_VERSION = "derive_record_version"
STAGE_ISSUE_GRANT = "issue_grant"
STAGE_MAP_OUTCOME = "map_outcome"
STAGE_BUILD_RESPONSE = "build_response"


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


def _resolve_grant_route_supabase_client() -> Any | None:
    """Resolve the shared Supabase DB client (requires prior server startup init)."""
    from supabase_client import get_supabase

    try:
        return get_supabase()
    except Exception:
        return None


def _log_route_failure(
    *,
    event: str,
    failure_stage: str,
    exc: BaseException | None,
    service_identity: str,
    audit: dict[str, str],
    application_id: str,
    document_type: str,
) -> None:
    logger.warning(
        "enterprise_kyc_document_access: %s identity=%s actor=%s request_id=%s "
        "application_id=%s document_type=%s failure_stage=%s exception_class=%s",
        event,
        service_identity,
        _short_log(audit["actor_id"]),
        _short_log(audit["request_id"]),
        application_id[:8],
        document_type,
        failure_stage,
        type(exc).__name__ if exc is not None else "None",
    )


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


def _parse_document_type(raw: str) -> str | None:
    value = str(raw or "").strip().lower()
    if value in KYC_DOCUMENT_TYPES:
        return value
    return None


def _parse_grant_request_body(body: object) -> tuple[str | None, str | None]:
    if not isinstance(body, dict):
        return None, "invalid_request"
    if set(body.keys()) != {"review_reason"}:
        return None, "invalid_request"
    review_reason = body.get("review_reason")
    if review_reason not in _REVIEW_REASONS:
        return None, "invalid_review_reason"
    return str(review_reason), None


def _build_ready_grant_payload(
    *,
    result: KycDocumentAccessIssueGrantRpcResult,
    application_id: str,
    document_type: str,
) -> dict[str, Any] | None:
    if not result.access_grant_token:
        return None
    if result.issued_at is None or result.expires_at is None or result.ttl_seconds is None:
        return None
    return {
        "success": True,
        "result": {
            "availability": "ready",
            "grant": {
                "access_grant_id": result.access_grant_token,
                "application_id": application_id,
                "document_type": document_type,
                "display_label": KYC_DOCUMENT_DISPLAY_LABELS[document_type],  # type: ignore[index]
                "requested_at": result.issued_at,
                "expires_at": result.expires_at,
                "ttl_seconds": result.ttl_seconds,
                "status": "active",
                "access_mode": "inline_preview",
                "allowed_mime_types": list(KYC_REVIEW_DOCUMENT_MIME_TYPES),
            },
        },
    }


def _map_service_outcome_to_response(
    *,
    result: KycDocumentAccessIssueGrantRpcResult,
    application_id: str,
    document_type: str,
) -> JSONResponse:
    outcome = result.outcome_code

    if outcome == "issued":
        payload = _build_ready_grant_payload(
            result=result,
            application_id=application_id,
            document_type=document_type,
        )
        if payload is None:
            logger.warning(
                "enterprise_kyc_document_access: build_response_failed application_id=%s document_type=%s",
                application_id[:8],
                document_type,
            )
            return _error_response(error="upstream_unavailable", status_code=503)
        return _envelope_response(payload, status_code=200)

    if outcome in ("duplicate_request", "request_conflict"):
        return _error_response(error="request_conflict", status_code=409)

    if outcome == "record_version_stale":
        return _error_response(error="record_version_stale", status_code=409)

    if outcome == "application_not_found":
        return _envelope_response(
            {
                "success": True,
                "result": {
                    "availability": "not_found",
                    "reason_code": "application_not_found",
                },
            },
            status_code=200,
        )

    if outcome == "document_missing":
        return _envelope_response(
            {
                "success": True,
                "result": {
                    "availability": "unavailable",
                    "reason_code": "document_missing",
                },
            },
            status_code=200,
        )

    if outcome == "document_not_reviewable":
        return _envelope_response(
            {
                "success": True,
                "result": {
                    "availability": "unavailable",
                    "reason_code": "document_not_reviewable",
                },
            },
            status_code=200,
        )

    if outcome == "invalid_input":
        return _error_response(error="invalid_request", status_code=422)

    if outcome == "audit_unavailable":
        return _error_response(error="audit_unavailable", status_code=503)

    if outcome == "rate_limited":
        return _envelope_response(
            {
                "success": True,
                "result": {
                    "availability": "denied",
                    "reason_code": "rate_limited",
                },
            },
            status_code=200,
        )

    logger.warning(
        "enterprise_kyc_document_access: unknown_outcome application_id=%s document_type=%s outcome=%s",
        application_id[:8],
        document_type,
        outcome,
    )
    return _error_response(error="upstream_unavailable", status_code=503)


@router.post("/applications/{application_id}/documents/{document_type}/access-grants")
async def post_internal_enterprise_kyc_document_access_grant(
    application_id: UUID,
    document_type: str,
    request: Request,
    body: dict,
    service_identity: str = Depends(require_enterprise_kyc_review_service),
    x_karekod_actor_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Actor-Id")
    ] = None,
    x_karekod_request_id: Annotated[
        Optional[str], Header(alias="X-Karekod-Request-Id")
    ] = None,
) -> JSONResponse:
    if "admin_phone" in request.query_params:
        return _error_response(error="admin_phone_not_accepted", status_code=400)

    audit = parse_detail_kyc_audit_headers(
        actor_id=x_karekod_actor_id,
        request_id=x_karekod_request_id,
    )

    canonical_application_id = str(application_id).lower()
    canonical_document_type = _parse_document_type(document_type)
    if canonical_document_type is None:
        return _error_response(error="invalid_document_type", status_code=422)

    review_reason, body_error = _parse_grant_request_body(body)
    if body_error == "invalid_review_reason":
        return _error_response(error="invalid_review_reason", status_code=422)
    if body_error is not None or review_reason is None:
        return _error_response(error="invalid_request", status_code=422)

    failure_stage = STAGE_RESOLVE_SUPABASE
    sb = _resolve_grant_route_supabase_client()
    if not sb:
        _log_route_failure(
            event="dependency_unavailable",
            failure_stage=failure_stage,
            exc=None,
            service_identity=service_identity,
            audit=audit,
            application_id=canonical_application_id,
            document_type=canonical_document_type,
        )
        return _error_response(error="upstream_unavailable", status_code=503)

    failure_stage = STAGE_LOAD_BINDING_SECRET
    binding_secret_key, binding_error = _load_binding_secret_key()
    if binding_secret_key is None:
        logger.warning(
            "enterprise_kyc_document_access: binding_secret_unavailable identity=%s reason=%s",
            service_identity,
            binding_error or "missing",
        )
        _log_route_failure(
            event="dependency_unavailable",
            failure_stage=failure_stage,
            exc=None,
            service_identity=service_identity,
            audit=audit,
            application_id=canonical_application_id,
            document_type=canonical_document_type,
        )
        return _error_response(error="upstream_unavailable", status_code=503)

    failure_stage = STAGE_RESOLVE_ALLOWED_HOSTS
    public_host = _supabase_public_host()
    allowed_public_hosts = [public_host] if public_host else []

    try:
        failure_stage = STAGE_SELECT_APPLICATION
        row = select_kyc_application_row_by_id(sb, canonical_application_id)
        if row is None:
            logger.info(
                "enterprise_kyc_document_access: not_found identity=%s actor=%s request_id=%s "
                "application_id=%s document_type=%s",
                service_identity,
                _short_log(audit["actor_id"]),
                _short_log(audit["request_id"]),
                canonical_application_id[:8],
                canonical_document_type,
            )
            return _envelope_response(
                {
                    "success": True,
                    "result": {
                        "availability": "not_found",
                        "reason_code": "application_not_found",
                    },
                },
                status_code=200,
            )

        failure_stage = STAGE_DERIVE_RECORD_VERSION
        record_version = _record_version_iso(row.get("updated_at"))
        if record_version is None:
            _log_route_failure(
                event="dependency_unavailable",
                failure_stage=failure_stage,
                exc=None,
                service_identity=service_identity,
                audit=audit,
                application_id=canonical_application_id,
                document_type=canonical_document_type,
            )
            return _error_response(error="upstream_unavailable", status_code=503)

        command = KycDocumentAccessIssueGrantCommand(
            application_id=canonical_application_id,
            document_type=canonical_document_type,
            review_reason=review_reason,
            if_match_record_version=record_version,
            request_id=audit["request_id"],
            actor_admin_id=audit["actor_id"],
            source_channel="enterprise_bff",
            ttl_seconds=_GRANT_ROUTE_TTL_SECONDS,
        )

        failure_stage = STAGE_ISSUE_GRANT
        result = issue_kyc_document_access_grant(
            supabase_client=sb,
            binding_secret_key=binding_secret_key,
            command=command,
            allowed_public_hosts=allowed_public_hosts,
        )

        failure_stage = STAGE_MAP_OUTCOME
        response = _map_service_outcome_to_response(
            result=result,
            application_id=canonical_application_id,
            document_type=canonical_document_type,
        )
        logger.info(
            "enterprise_kyc_document_access: outcome identity=%s actor=%s request_id=%s "
            "application_id=%s document_type=%s outcome=%s status=%s",
            service_identity,
            _short_log(audit["actor_id"]),
            _short_log(audit["request_id"]),
            canonical_application_id[:8],
            canonical_document_type,
            result.outcome_code,
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
            application_id=canonical_application_id,
            document_type=canonical_document_type,
        )
        return _error_response(error="upstream_unavailable", status_code=503)
    except Exception as exc:
        _log_route_failure(
            event="upstream_error",
            failure_stage=failure_stage,
            exc=exc,
            service_identity=service_identity,
            audit=audit,
            application_id=canonical_application_id,
            document_type=canonical_document_type,
        )
        return _error_response(error="upstream_unavailable", status_code=503)
