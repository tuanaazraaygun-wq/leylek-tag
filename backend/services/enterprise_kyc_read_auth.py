"""
Enterprise KYC queue read — scoped service-token auth (Phase 3C).

Env name only: KAREKOD_ENTERPRISE_KYC_READ_TOKEN (never commit values).
Actor / request-id headers are audit metadata only — not authorization proof.
"""
from __future__ import annotations

import logging
import os
import re
import secrets
from typing import Annotated, Optional

from fastapi import Header, HTTPException

logger = logging.getLogger("server")

ENTERPRISE_KYC_READ_TOKEN_ENV = "KAREKOD_ENTERPRISE_KYC_READ_TOKEN"
ENTERPRISE_KYC_REVIEW_TOKEN_ENV = "KAREKOD_ENTERPRISE_KYC_REVIEW_TOKEN"
ENTERPRISE_KYC_DECISION_TOKEN_ENV = "KAREKOD_ENTERPRISE_KYC_DECISION_TOKEN"
SERVICE_IDENTITY = "karekod_enterprise_kyc_read"
REVIEW_SERVICE_IDENTITY = "karekod_enterprise_kyc_review"
DECISION_SERVICE_IDENTITY = "karekod_enterprise_kyc_decision"

_ACTOR_HEADER = "X-Karekod-Actor-Id"
_REQUEST_ID_HEADER = "X-Karekod-Request-Id"
_MAX_AUDIT_HEADER_LEN = 128
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def configured_enterprise_kyc_read_token() -> Optional[str]:
    value = (os.getenv(ENTERPRISE_KYC_READ_TOKEN_ENV) or "").strip()
    return value or None


def configured_enterprise_kyc_review_token() -> Optional[str]:
    value = (os.getenv(ENTERPRISE_KYC_REVIEW_TOKEN_ENV) or "").strip()
    return value or None


def configured_enterprise_kyc_decision_token() -> Optional[str]:
    value = (os.getenv(ENTERPRISE_KYC_DECISION_TOKEN_ENV) or "").strip()
    return value or None


def service_tokens_equal(presented: str, expected: str) -> bool:
    """Constant-time compare; unequal lengths → False without raising."""
    a = presented.encode("utf-8")
    b = expected.encode("utf-8")
    if len(a) != len(b):
        secrets.compare_digest(b, b)
        return False
    return secrets.compare_digest(a, b)


def sanitize_kyc_audit_header(raw: Optional[str], *, field: str) -> Optional[str]:
    """
    Optional audit metadata. Rejects control characters / overlong values.
    Never treats the value as auth proof.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if _CONTROL_CHARS.search(s) or len(s) > _MAX_AUDIT_HEADER_LEN:
        logger.info("enterprise_kyc_read: invalid_%s_metadata", field)
        raise HTTPException(status_code=400, detail="invalid_audit_metadata")
    return s


def parse_optional_kyc_audit_headers(
    *,
    actor_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> dict[str, Optional[str]]:
    return {
        "actor_id": sanitize_kyc_audit_header(actor_id, field="actor"),
        "request_id": sanitize_kyc_audit_header(request_id, field="request_id"),
    }


def _generate_kyc_request_id() -> str:
    import uuid

    return f"kycd-{uuid.uuid4().hex[:24]}"


def sanitize_required_kyc_actor_header(raw: Optional[str]) -> str:
    """Mandatory actor audit context after successful service authentication."""
    actor = sanitize_kyc_audit_header(raw, field="actor")
    if actor is None:
        logger.info("enterprise_kyc_review: invalid_actor_metadata")
        raise HTTPException(status_code=400, detail="invalid_audit_metadata")
    return actor


def parse_detail_kyc_audit_headers(
    *,
    actor_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> dict[str, str]:
    """
    Detail-route audit headers: actor required; request ID sanitized or server-generated.
    Call only after review service authentication succeeds.
    """
    actor = sanitize_required_kyc_actor_header(actor_id)
    if request_id is None or not str(request_id).strip():
        resolved_request_id = _generate_kyc_request_id()
    else:
        sanitized = sanitize_kyc_audit_header(request_id, field="request_id")
        if sanitized is None:
            raise HTTPException(status_code=400, detail="invalid_audit_metadata")
        resolved_request_id = sanitized
    return {"actor_id": actor, "request_id": resolved_request_id}


def require_enterprise_kyc_read_service(
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> str:
    """
    Fail-closed scoped service auth for Enterprise → Leylek KYC queue read.

    Missing env → 503 service_auth_disabled (no comparison).
    Missing/malformed Bearer → 401.
    Wrong token → 403.
    Returns SERVICE_IDENTITY on success (never returns the token).
    """
    expected = configured_enterprise_kyc_read_token()
    if expected is None:
        logger.warning("enterprise_kyc_read: service_auth_disabled env_missing=1")
        raise HTTPException(status_code=503, detail="service_auth_disabled")

    if not authorization or not str(authorization).strip():
        raise HTTPException(status_code=401, detail="unauthorized")

    parts = str(authorization).strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="unauthorized")

    presented = parts[1].strip()
    if not presented:
        raise HTTPException(status_code=401, detail="unauthorized")

    if not service_tokens_equal(presented, expected):
        logger.info("enterprise_kyc_read: forbidden")
        raise HTTPException(status_code=403, detail="forbidden")

    return SERVICE_IDENTITY


def require_enterprise_kyc_review_service(
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> str:
    """
    Fail-closed scoped service auth for Enterprise → Leylek KYC detail review.

    Uses dedicated KAREKOD_ENTERPRISE_KYC_REVIEW_TOKEN only (no queue-read fallback).
    """
    expected = configured_enterprise_kyc_review_token()
    if expected is None:
        logger.warning("enterprise_kyc_review: service_auth_disabled env_missing=1")
        raise HTTPException(status_code=503, detail="service_auth_disabled")

    if not authorization or not str(authorization).strip():
        raise HTTPException(status_code=401, detail="unauthorized")

    parts = str(authorization).strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="unauthorized")

    presented = parts[1].strip()
    if not presented:
        raise HTTPException(status_code=401, detail="unauthorized")

    if not service_tokens_equal(presented, expected):
        logger.info("enterprise_kyc_review: forbidden")
        raise HTTPException(status_code=403, detail="forbidden")

    return REVIEW_SERVICE_IDENTITY


def require_enterprise_kyc_decision_service(
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> str:
    """
    Fail-closed scoped service auth for Enterprise → Leylek KYC approve/reject.

    Uses dedicated KAREKOD_ENTERPRISE_KYC_DECISION_TOKEN only.
    """
    expected = configured_enterprise_kyc_decision_token()
    if expected is None:
        logger.warning("enterprise_kyc_decision: service_auth_disabled env_missing=1")
        raise HTTPException(status_code=503, detail="service_auth_disabled")

    if not authorization or not str(authorization).strip():
        raise HTTPException(status_code=401, detail="unauthorized")

    parts = str(authorization).strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="unauthorized")

    presented = parts[1].strip()
    if not presented:
        raise HTTPException(status_code=401, detail="unauthorized")

    if not service_tokens_equal(presented, expected):
        logger.info("enterprise_kyc_decision: forbidden")
        raise HTTPException(status_code=403, detail="forbidden")

    return DECISION_SERVICE_IDENTITY
