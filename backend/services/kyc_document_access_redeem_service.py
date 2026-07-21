"""
KYC document access grant redemption service adapter (Phase D7-B2B).

Validates opaque grant tokens, derives observed binding/OCC server-side,
and invokes kyc_document_access_redeem_grant. No HTTP routes, URL emission,
token logging, or storage I/O.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Collection, Mapping

from contracts.enterprise_kyc_document_access_contract import KYC_DOCUMENT_TYPES
from contracts.kyc_document_access_rpc_contract import (
    KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES,
    KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES,
    KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME,
    KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS,
    KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH,
    KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH,
)
from services.kyc_document_access_grant_service import (
    KYC_DOCUMENT_STORAGE_BUCKET,
)
from services.kyc_document_access_grant_token import (
    hash_kyc_document_access_grant_token,
    is_valid_kyc_document_access_grant_hash,
    is_valid_kyc_document_access_grant_token,
)
from services.kyc_document_access_source_binding import compute_kyc_document_source_binding_hash
from services.kyc_document_source_normalizer import (
    KycDocumentSourceNormalizationFailure,
    KycDocumentSourceNormalizationSuccess,
    normalize_kyc_document_source_reference,
)
from services.kyc_queue_safe_service import _canonical_vehicle_type, _nonempty_str

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_USER_SELECT_COLUMNS = "id, updated_at, driver_details"
_GRANT_LOOKUP_COLUMNS = "application_id, document_type"
_LICENSE_SOURCE_KEY = "license_photo_url"
_CAR_REGISTRATION_SOURCE_KEY = "vehicle_photo_url"
_MOTORCYCLE_REGISTRATION_SOURCE_KEY = "motorcycle_photo_url"
_SELFIE_SOURCE_KEY = "selfie_url"
_SOURCE_CHANNELS = frozenset({"enterprise_bff", "leylek_internal"})

# Contract-valid placeholders used only when grant metadata cannot be resolved.
# RPC collapses unknown grants to not_found_or_unauthorized before binding compare.
_DUMMY_BINDING_HASH = "0" * 64
_DUMMY_RECORD_VERSION = datetime(1970, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True, slots=True)
class KycDocumentAccessRedeemCommand:
    access_grant_token: str
    actor_admin_id: str
    request_id: str
    source_channel: str = "enterprise_bff"


@dataclass(frozen=True, slots=True)
class KycDocumentAccessResolvedObject:
    """Server-internal storage locator — never serialize to wire JSON."""

    bucket: str
    object_path: str
    content_type: str = "image/jpeg"


@dataclass(frozen=True, slots=True)
class KycDocumentAccessRedeemResult:
    outcome_code: str
    grant_id: str | None = None
    application_id: str | None = None
    document_type: str | None = None
    state: str | None = None
    redeemed_at: str | None = None
    application_record_version: str | None = None
    resolved_object: KycDocumentAccessResolvedObject | None = None


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


def _record_version_iso(updated_at: object) -> str | None:
    if updated_at is None:
        return None
    if isinstance(updated_at, datetime):
        return updated_at.isoformat()
    if isinstance(updated_at, str):
        return updated_at.strip() or None
    text = str(updated_at).strip()
    return text or None


def _registration_source_key(driver_details: Mapping[str, Any]) -> str | None:
    vehicle_type = _canonical_vehicle_type(dict(driver_details))
    if vehicle_type == "car":
        return _CAR_REGISTRATION_SOURCE_KEY
    if vehicle_type == "motorcycle":
        return _MOTORCYCLE_REGISTRATION_SOURCE_KEY
    return _CAR_REGISTRATION_SOURCE_KEY


def _resolve_document_source_reference(
    *,
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


def validate_kyc_document_access_redeem_command(
    command: KycDocumentAccessRedeemCommand,
) -> str | None:
    if not is_valid_kyc_document_access_grant_token(command.access_grant_token):
        return "invalid_input"
    if _read_bounded(command.actor_admin_id, max_length=KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH) is None:
        return "invalid_input"
    if _read_bounded(command.request_id, max_length=KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH) is None:
        return "invalid_input"
    if command.source_channel not in _SOURCE_CHANNELS:
        return "invalid_input"
    return None


def build_kyc_document_access_redeem_rpc_payload(
    *,
    grant_reference_hash: str,
    actor_admin_id: str,
    request_id: str,
    source_channel: str,
    observed_source_binding_hash: str,
    observed_application_record_version: datetime,
) -> dict[str, Any]:
    return {
        "p_grant_reference_hash": grant_reference_hash,
        "p_actor_admin_id": actor_admin_id,
        "p_request_id": request_id,
        "p_source_channel": source_channel,
        "p_observed_source_binding_hash": observed_source_binding_hash,
        "p_observed_application_record_version": observed_application_record_version.isoformat(),
    }


def map_kyc_document_access_redeem_rpc_row(
    row: Mapping[str, Any],
) -> KycDocumentAccessRedeemResult | None:
    if not isinstance(row, Mapping):
        return None
    outcome = row.get("outcome_code")
    if not isinstance(outcome, str) or outcome not in KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES:
        return None
    for key in row.keys():
        lowered = str(key).lower()
        if any(fragment in lowered for fragment in ("url", "bucket", "path", "token", "bytes")):
            return None
    unexpected = set(str(k) for k in row.keys()) - set(KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS)
    if unexpected:
        return None
    grant_id = row.get("grant_id")
    application_id = row.get("application_id")
    document_type = row.get("document_type")
    state = row.get("state")
    redeemed_at = row.get("redeemed_at")
    application_record_version = row.get("application_record_version")
    source_binding_hash = row.get("source_binding_hash")
    if source_binding_hash is not None and not isinstance(source_binding_hash, str):
        return None
    if document_type is not None and document_type not in KYC_DOCUMENT_TYPES:
        return None
    return KycDocumentAccessRedeemResult(
        outcome_code=outcome,
        grant_id=str(grant_id) if grant_id is not None else None,
        application_id=str(application_id).lower() if application_id is not None else None,
        document_type=str(document_type) if document_type is not None else None,
        state=str(state) if state is not None else None,
        redeemed_at=str(redeemed_at) if redeemed_at is not None else None,
        application_record_version=(
            str(application_record_version) if application_record_version is not None else None
        ),
    )


def _lookup_grant_metadata(
    supabase_client: Any,
    *,
    grant_reference_hash: str,
) -> tuple[str, str] | None:
    result = (
        supabase_client.table("kyc_document_access_grants")
        .select(_GRANT_LOOKUP_COLUMNS)
        .eq("grant_reference_hash", grant_reference_hash)
        .limit(1)
        .execute()
    )
    rows = getattr(result, "data", None) or []
    if not rows:
        return None
    row = rows[0]
    application_id = _parse_application_id(row.get("application_id"))
    document_type = row.get("document_type")
    if application_id is None or document_type not in KYC_DOCUMENT_TYPES:
        return None
    return application_id, str(document_type)


def _load_user_row(supabase_client: Any, application_id: str) -> Mapping[str, Any] | None:
    result = (
        supabase_client.table("users")
        .select(_USER_SELECT_COLUMNS)
        .eq("id", application_id)
        .limit(1)
        .execute()
    )
    rows = getattr(result, "data", None) or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, Mapping) else None


def resolve_kyc_document_access_object(
    *,
    supabase_client: Any,
    binding_secret_key: bytes,
    application_id: str,
    document_type: str,
    allowed_public_hosts: Collection[str] | None = None,
) -> tuple[KycDocumentAccessResolvedObject | None, str | None, datetime | None]:
    """
    Resolve live source → normalized object + binding inputs.

    Returns (resolved_object, binding_hash, record_version_dt).
    Any failure returns (None, None, None) without leaking locators.
    """
    app_id = _parse_application_id(application_id)
    if app_id is None or document_type not in KYC_DOCUMENT_TYPES:
        return None, None, None

    row = _load_user_row(supabase_client, app_id)
    if row is None:
        return None, None, None

    record_version_text = _record_version_iso(row.get("updated_at"))
    record_version_dt = _parse_record_version_timestamp(record_version_text)
    if record_version_text is None or record_version_dt is None:
        return None, None, None

    driver_details = row.get("driver_details")
    if not isinstance(driver_details, dict):
        return None, None, None

    source_reference = _resolve_document_source_reference(
        document_type=document_type,
        driver_details=driver_details,
    )
    if source_reference is None:
        return None, None, None

    normalized = normalize_kyc_document_source_reference(
        source_reference,
        application_id=app_id,
        allowed_public_hosts=allowed_public_hosts or [],
        allowed_bucket=KYC_DOCUMENT_STORAGE_BUCKET,
    )
    if isinstance(normalized, KycDocumentSourceNormalizationFailure):
        return None, None, None
    assert isinstance(normalized, KycDocumentSourceNormalizationSuccess)

    try:
        binding_hash = compute_kyc_document_source_binding_hash(
            secret_key=binding_secret_key,
            application_id=app_id,
            document_type=document_type,
            normalized_bucket=normalized.normalized_bucket,
            normalized_object_path=normalized.normalized_object_path,
            application_record_version=record_version_text,
        )
    except ValueError:
        return None, None, None

    return (
        KycDocumentAccessResolvedObject(
            bucket=normalized.normalized_bucket,
            object_path=normalized.normalized_object_path,
            content_type="image/jpeg",
        ),
        binding_hash,
        record_version_dt,
    )


def redeem_kyc_document_access_grant(
    *,
    supabase_client: Any,
    binding_secret_key: bytes,
    command: KycDocumentAccessRedeemCommand,
    allowed_public_hosts: Collection[str] | None = None,
) -> KycDocumentAccessRedeemResult:
    validation_error = validate_kyc_document_access_redeem_command(command)
    if validation_error is not None:
        return KycDocumentAccessRedeemResult(outcome_code=validation_error)

    try:
        grant_reference_hash = hash_kyc_document_access_grant_token(command.access_grant_token)
    except ValueError:
        return KycDocumentAccessRedeemResult(outcome_code="invalid_input")
    if not is_valid_kyc_document_access_grant_hash(grant_reference_hash):
        return KycDocumentAccessRedeemResult(outcome_code="invalid_input")

    actor_admin_id = _read_bounded(
        command.actor_admin_id, max_length=KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH
    )
    request_id = _read_bounded(
        command.request_id, max_length=KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH
    )
    assert actor_admin_id is not None and request_id is not None

    observed_binding = _DUMMY_BINDING_HASH
    observed_version = _DUMMY_RECORD_VERSION
    pre_resolved: KycDocumentAccessResolvedObject | None = None

    metadata = _lookup_grant_metadata(
        supabase_client, grant_reference_hash=grant_reference_hash
    )
    if metadata is not None:
        application_id, document_type = metadata
        resolved, binding_hash, version_dt = resolve_kyc_document_access_object(
            supabase_client=supabase_client,
            binding_secret_key=binding_secret_key,
            application_id=application_id,
            document_type=document_type,
            allowed_public_hosts=allowed_public_hosts,
        )
        if binding_hash is not None and version_dt is not None:
            observed_binding = binding_hash
            observed_version = version_dt
            pre_resolved = resolved

    rpc_payload = build_kyc_document_access_redeem_rpc_payload(
        grant_reference_hash=grant_reference_hash,
        actor_admin_id=actor_admin_id,
        request_id=request_id,
        source_channel=command.source_channel,
        observed_source_binding_hash=observed_binding,
        observed_application_record_version=observed_version,
    )
    if set(rpc_payload.keys()) != set(KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES):
        return KycDocumentAccessRedeemResult(outcome_code="invalid_input")

    rpc_response = supabase_client.rpc(KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME, rpc_payload).execute()
    data = getattr(rpc_response, "data", None)
    if not data:
        return KycDocumentAccessRedeemResult(outcome_code="audit_unavailable")

    rpc_row = data[0] if isinstance(data, list) else data
    mapped = map_kyc_document_access_redeem_rpc_row(rpc_row)
    if mapped is None:
        return KycDocumentAccessRedeemResult(outcome_code="audit_unavailable")

    if mapped.outcome_code != "redeemed":
        return mapped

    # Prefer post-redeem re-resolution from RPC metadata; fall back to pre-resolved locator.
    resolved_object = pre_resolved
    if mapped.application_id and mapped.document_type:
        post_resolved, _, _ = resolve_kyc_document_access_object(
            supabase_client=supabase_client,
            binding_secret_key=binding_secret_key,
            application_id=mapped.application_id,
            document_type=mapped.document_type,
            allowed_public_hosts=allowed_public_hosts,
        )
        if post_resolved is not None:
            resolved_object = post_resolved

    return KycDocumentAccessRedeemResult(
        outcome_code=mapped.outcome_code,
        grant_id=mapped.grant_id,
        application_id=mapped.application_id,
        document_type=mapped.document_type,
        state=mapped.state,
        redeemed_at=mapped.redeemed_at,
        application_record_version=mapped.application_record_version,
        resolved_object=resolved_object,
    )


__all__ = [
    "KycDocumentAccessRedeemCommand",
    "KycDocumentAccessRedeemResult",
    "KycDocumentAccessResolvedObject",
    "build_kyc_document_access_redeem_rpc_payload",
    "map_kyc_document_access_redeem_rpc_row",
    "redeem_kyc_document_access_grant",
    "resolve_kyc_document_access_object",
    "validate_kyc_document_access_redeem_command",
]
