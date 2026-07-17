"""
KYC document access grant issuance service adapter (Phase 5B4).

Prepares trusted server-side grant material and invokes the issue-grant RPC.
No HTTP routes, storage I/O, URL emission, token logging, or env secret reads.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Collection, Mapping, Optional

from contracts.enterprise_kyc_document_access_contract import (
    KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS,
    KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS,
    KYC_DOCUMENT_TYPES,
    clamp_kyc_document_access_ttl_seconds,
)
from contracts.kyc_document_access_rpc_contract import (
    KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES,
    KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES,
    KYC_DOCUMENT_ACCESS_ISSUE_RPC_NAME,
    KYC_DOCUMENT_ACCESS_ISSUE_RPC_OUTPUT_FIELDS,
    KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH,
    KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH,
)
from services.kyc_document_access_grant_token import (
    GeneratedKycDocumentAccessGrantToken,
    generate_kyc_document_access_grant_material,
    is_valid_kyc_document_access_grant_hash,
)
from services.kyc_document_access_source_binding import compute_kyc_document_source_binding_hash
from services.kyc_document_source_normalizer import (
    KycDocumentSourceNormalizationFailure,
    KycDocumentSourceNormalizationSuccess,
    normalize_kyc_document_source_reference,
)
from services.kyc_queue_safe_service import _canonical_vehicle_type, _nonempty_str

KYC_DOCUMENT_STORAGE_BUCKET = "vehicle-photos"
KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV = "KYC_DOCUMENT_SOURCE_BINDING_SECRET"

_LICENSE_SOURCE_KEY = "license_photo_url"
_CAR_REGISTRATION_SOURCE_KEY = "vehicle_photo_url"
_MOTORCYCLE_REGISTRATION_SOURCE_KEY = "motorcycle_photo_url"
_SELFIE_SOURCE_KEY = "selfie_url"

REVIEWABLE_KYC_STATUSES = frozenset({"pending", "needs_documents"})
REVIEW_REASONS = frozenset({"initial_review", "recheck"})
SOURCE_CHANNELS = frozenset({"enterprise_bff", "leylek_internal"})

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_USER_SELECT_COLUMNS = "id, updated_at, driver_details"


@dataclass(frozen=True, slots=True)
class KycDocumentAccessIssueGrantCommand:
    application_id: str
    document_type: str
    review_reason: str
    if_match_record_version: str
    request_id: str
    actor_admin_id: str
    source_channel: str = "leylek_internal"
    ttl_seconds: int = 90


@dataclass(frozen=True, slots=True)
class KycDocumentAccessIssueGrantRpcResult:
    outcome_code: str
    grant_id: str | None
    grant_reference_hash: str | None
    state: str | None
    issued_at: str | None
    expires_at: str | None
    ttl_seconds: int | None
    is_reused: bool
    access_grant_token: str | None = None


def _read_bounded(value: object, *, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed or len(trimmed) > max_length or _CONTROL_CHARS.search(trimmed):
        return None
    return trimmed


def _parse_application_id(value: object) -> str | None:
    raw = _read_bounded(str(value) if value is not None else "", max_length=64)
    if raw is None:
        return None
    try:
        return str(uuid.UUID(raw)).lower()
    except (ValueError, AttributeError, TypeError):
        return None


def _parse_record_version_timestamp(value: object) -> datetime | None:
    text = _read_bounded(str(value) if value is not None else "", max_length=128)
    if text is None:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _is_document_type(value: object) -> bool:
    return isinstance(value, str) and value in KYC_DOCUMENT_TYPES


def _registration_source_key(driver_details: Mapping[str, Any]) -> str | None:
    vehicle_type = _canonical_vehicle_type(dict(driver_details))
    if vehicle_type == "car":
        return _CAR_REGISTRATION_SOURCE_KEY
    if vehicle_type == "motorcycle":
        return _MOTORCYCLE_REGISTRATION_SOURCE_KEY
    return _CAR_REGISTRATION_SOURCE_KEY


def _resolve_document_source_reference(
    *,
    application_id: str,
    document_type: str,
    driver_details: Mapping[str, Any],
) -> str | None:
    if document_type == "license":
        key = _LICENSE_SOURCE_KEY
    elif document_type == "vehicle_registration":
        reg_key = _registration_source_key(driver_details)
        if reg_key is None:
            return None
        key = reg_key
    elif document_type == "selfie":
        key = _SELFIE_SOURCE_KEY
    else:
        return None
    value = driver_details.get(key)
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def build_kyc_document_access_issue_rpc_payload(
    *,
    grant_material: GeneratedKycDocumentAccessGrantToken,
    command: KycDocumentAccessIssueGrantCommand,
    source_binding_hash: str,
    application_record_version: datetime,
    ttl_seconds: int,
) -> dict[str, Any]:
    return {
        "p_grant_reference_hash": grant_material.grant_reference_hash,
        "p_token_version": grant_material.token_version,
        "p_application_id": command.application_id,
        "p_document_type": command.document_type,
        "p_actor_admin_id": command.actor_admin_id,
        "p_request_id": command.request_id,
        "p_review_reason": command.review_reason,
        "p_ttl_seconds": ttl_seconds,
        "p_source_binding_hash": source_binding_hash,
        "p_application_record_version": application_record_version.isoformat(),
        "p_source_channel": command.source_channel,
    }


def map_kyc_document_access_issue_rpc_row(row: Mapping[str, Any]) -> KycDocumentAccessIssueGrantRpcResult | None:
    if not isinstance(row, Mapping):
        return None
    outcome = row.get("outcome_code")
    if not isinstance(outcome, str) or outcome not in KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES:
        return None
    for key in row.keys():
        lowered = str(key).lower()
        if any(fragment in lowered for fragment in ("url", "bucket", "path", "token", "bytes")):
            if lowered not in {"grant_reference_hash", "outcome_code"}:
                return None
    grant_id = row.get("grant_id")
    grant_reference_hash = row.get("grant_reference_hash")
    state = row.get("state")
    issued_at = row.get("issued_at")
    expires_at = row.get("expires_at")
    ttl_seconds = row.get("ttl_seconds")
    is_reused = row.get("is_reused")
    if not isinstance(is_reused, bool):
        if outcome in ("issued", "duplicate_request"):
            return None
        is_reused = False
    if grant_reference_hash is not None and not is_valid_kyc_document_access_grant_hash(str(grant_reference_hash)):
        return None
    if ttl_seconds is not None and (
        not isinstance(ttl_seconds, int)
        or ttl_seconds < KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS
        or ttl_seconds > KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS
    ):
        return None
    return KycDocumentAccessIssueGrantRpcResult(
        outcome_code=outcome,
        grant_id=str(grant_id) if grant_id is not None else None,
        grant_reference_hash=str(grant_reference_hash) if grant_reference_hash is not None else None,
        state=str(state) if state is not None else None,
        issued_at=str(issued_at) if issued_at is not None else None,
        expires_at=str(expires_at) if expires_at is not None else None,
        ttl_seconds=int(ttl_seconds) if isinstance(ttl_seconds, int) else None,
        is_reused=is_reused,
        access_grant_token=None,
    )


def validate_kyc_document_access_issue_grant_command(
    command: KycDocumentAccessIssueGrantCommand,
) -> str | None:
    if _parse_application_id(command.application_id) is None:
        return "validation_failed"
    if not _is_document_type(command.document_type):
        return "validation_failed"
    if command.review_reason not in REVIEW_REASONS:
        return "validation_failed"
    if _parse_record_version_timestamp(command.if_match_record_version) is None:
        return "validation_failed"
    if _read_bounded(command.request_id, max_length=KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH) is None:
        return "validation_failed"
    if _read_bounded(command.actor_admin_id, max_length=KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH) is None:
        return "validation_failed"
    if command.source_channel not in SOURCE_CHANNELS:
        return "validation_failed"
    clamped = clamp_kyc_document_access_ttl_seconds(command.ttl_seconds)
    if clamped != command.ttl_seconds:
        return "validation_failed"
    return None


def issue_kyc_document_access_grant(
    *,
    supabase_client: Any,
    binding_secret_key: bytes,
    command: KycDocumentAccessIssueGrantCommand,
    allowed_public_hosts: Collection[str] | None = None,
) -> KycDocumentAccessIssueGrantRpcResult:
    validation_error = validate_kyc_document_access_issue_grant_command(command)
    if validation_error is not None:
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code=validation_error,
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    application_id = _parse_application_id(command.application_id)
    assert application_id is not None
    record_version = _parse_record_version_timestamp(command.if_match_record_version)
    assert record_version is not None
    ttl_seconds = clamp_kyc_document_access_ttl_seconds(command.ttl_seconds)

    user_result = (
        supabase_client.table("users")
        .select(_USER_SELECT_COLUMNS)
        .eq("id", application_id)
        .limit(1)
        .execute()
    )
    rows = getattr(user_result, "data", None) or []
    if not rows:
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code="application_not_found",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    row = rows[0]
    driver_details = row.get("driver_details")
    if not isinstance(driver_details, dict):
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code="unavailable",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    kyc_status = _nonempty_str(driver_details.get("kyc_status"))
    if kyc_status and kyc_status.lower() not in REVIEWABLE_KYC_STATUSES:
        outcome = "invalid_transition" if kyc_status.lower() in {"approved", "rejected", "none"} else "document_not_reviewable"
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code=outcome,
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    source_reference = _resolve_document_source_reference(
        application_id=application_id,
        document_type=command.document_type,
        driver_details=driver_details,
    )
    if source_reference is None:
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code="document_missing",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    normalized = normalize_kyc_document_source_reference(
        source_reference,
        application_id=application_id,
        allowed_public_hosts=allowed_public_hosts or [],
        allowed_bucket=KYC_DOCUMENT_STORAGE_BUCKET,
    )
    if isinstance(normalized, KycDocumentSourceNormalizationFailure):
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code="document_not_reviewable",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    assert isinstance(normalized, KycDocumentSourceNormalizationSuccess)
    source_binding_hash = compute_kyc_document_source_binding_hash(
        secret_key=binding_secret_key,
        application_id=application_id,
        document_type=command.document_type,
        normalized_bucket=normalized.normalized_bucket,
        normalized_object_path=normalized.normalized_object_path,
        application_record_version=command.if_match_record_version,
    )
    grant_material = generate_kyc_document_access_grant_material()
    rpc_payload = build_kyc_document_access_issue_rpc_payload(
        grant_material=grant_material,
        command=command,
        source_binding_hash=source_binding_hash,
        application_record_version=record_version,
        ttl_seconds=ttl_seconds,
    )
    if set(rpc_payload.keys()) != set(KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES):
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code="validation_failed",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    rpc_response = supabase_client.rpc(KYC_DOCUMENT_ACCESS_ISSUE_RPC_NAME, rpc_payload).execute()
    data = getattr(rpc_response, "data", None)
    if not data:
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code="unavailable",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    rpc_row = data[0] if isinstance(data, list) else data
    mapped = map_kyc_document_access_issue_rpc_row(rpc_row)
    if mapped is None:
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code="unavailable",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        )

    if mapped.outcome_code == "issued" and not mapped.is_reused:
        return KycDocumentAccessIssueGrantRpcResult(
            outcome_code=mapped.outcome_code,
            grant_id=mapped.grant_id,
            grant_reference_hash=mapped.grant_reference_hash,
            state=mapped.state,
            issued_at=mapped.issued_at,
            expires_at=mapped.expires_at,
            ttl_seconds=mapped.ttl_seconds,
            is_reused=mapped.is_reused,
            access_grant_token=grant_material.raw_token,
        )
    return mapped


__all__ = [
    "KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV",
    "KYC_DOCUMENT_STORAGE_BUCKET",
    "KycDocumentAccessIssueGrantCommand",
    "KycDocumentAccessIssueGrantRpcResult",
    "build_kyc_document_access_issue_rpc_payload",
    "issue_kyc_document_access_grant",
    "map_kyc_document_access_issue_rpc_row",
    "validate_kyc_document_access_issue_grant_command",
]
