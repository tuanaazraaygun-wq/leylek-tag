"""
Phase 5A — Enterprise KYC document access wire contract mirror (contract-only).

No routes, Supabase, env reads, grant issuance, audit persistence, or URLs on wire.
"""
from __future__ import annotations

from typing import Final, Literal, TypeGuard

from contracts.enterprise_kyc_detail_contract import (
    KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS,
    KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS,
    KYC_DOCUMENT_TYPES,
    KYC_REVIEW_DOCUMENT_MIME_TYPES,
    KYC_REVIEW_REQUIRED_PERMISSION,
    is_kyc_detail_forbidden_contract_key,
    kyc_detail_contract_contains_forbidden_keys,
)

KycDocumentAccessMode = Literal["inline_preview"]
KYC_DOCUMENT_ACCESS_MODE: Final = "inline_preview"

KycDocumentAccessGrantState = Literal["issued", "redeemed", "expired", "revoked"]
KYC_DOCUMENT_ACCESS_GRANT_STATES: Final[tuple[KycDocumentAccessGrantState, ...]] = (
    "issued",
    "redeemed",
    "expired",
    "revoked",
)

KycDocumentAccessDeniedReason = Literal[
    "authentication_required",
    "allowlist_required",
    "permission_required",
    "document_not_reviewable",
    "audit_unavailable",
    "rate_limited",
]

KYC_DOCUMENT_ACCESS_DENIED_REASONS: Final[tuple[KycDocumentAccessDeniedReason, ...]] = (
    "authentication_required",
    "allowlist_required",
    "permission_required",
    "document_not_reviewable",
    "audit_unavailable",
    "rate_limited",
)

KycDocumentAccessUnavailableReason = Literal[
    "application_not_found",
    "document_missing",
    "document_unavailable",
    "invalid_document_type",
    "invalid_source_reference",
    "unsupported_mime_type",
    "source_unavailable",
    "grant_expired",
    "grant_redeemed",
    "grant_revoked",
    "temporarily_unavailable",
]

KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS: Final[tuple[KycDocumentAccessUnavailableReason, ...]] = (
    "application_not_found",
    "document_missing",
    "document_unavailable",
    "invalid_document_type",
    "invalid_source_reference",
    "unsupported_mime_type",
    "source_unavailable",
    "grant_expired",
    "grant_redeemed",
    "grant_revoked",
    "temporarily_unavailable",
)

KycDocumentAccessAuditEventType = Literal[
    "kyc.document.access_requested",
    "kyc.document.access_denied",
    "kyc.document.grant_issued",
    "kyc.document.redeemed",
    "kyc.document.view_failed",
    "kyc.document.grant_expired",
    "kyc.document.grant_revoked",
]

KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES: Final[tuple[KycDocumentAccessAuditEventType, ...]] = (
    "kyc.document.access_requested",
    "kyc.document.access_denied",
    "kyc.document.grant_issued",
    "kyc.document.redeemed",
    "kyc.document.view_failed",
    "kyc.document.grant_expired",
    "kyc.document.grant_revoked",
)

PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_GRANT_PATH = (
    "/api/internal/enterprise/kyc/applications/{application_id}/documents/{document_type}/access-grants"
)
PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_STREAM_PATH = (
    "/api/internal/enterprise/kyc/document-access/{grant_id}/stream"
)

ENTERPRISE_KYC_DOCUMENT_ACCESS_CONTRACT: Final[dict[str, object]] = {
    "grant_issuance_ready": False,
    "grant_redemption_ready": False,
    "streaming_ready": False,
    "audit_persistence_ready": False,
    "ui_preview_ready": False,
    "runtime_wired": False,
    "review_permission": KYC_REVIEW_REQUIRED_PERMISSION,
    "access_mode": KYC_DOCUMENT_ACCESS_MODE,
    "grant_path": PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_GRANT_PATH,
    "stream_path": PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_STREAM_PATH,
    "signed_urls_allowed": False,
    "public_urls_on_wire": False,
}

_KYC_DOCUMENT_ACCESS_FORBIDDEN_KEY_NORMALIZED: Final[frozenset[str]] = frozenset(
    {
        "url",
        "signedurl",
        "publicurl",
        "accessurl",
        "redemptionurl",
        "proxyurl",
        "previewurl",
        "downloadurl",
        "providerurl",
        "documentbytes",
        "bucket",
        "bucketname",
        "objectpath",
        "storagepath",
        "storagekey",
        "servicetoken",
        "authorization",
        "bearer",
        "jwt",
        "metadata",
    }
)


def is_kyc_document_access_forbidden_contract_key(key: str) -> bool:
    if is_kyc_detail_forbidden_contract_key(key):
        return True
    normalized = key.replace("_", "").replace("-", "").lower()
    return normalized in _KYC_DOCUMENT_ACCESS_FORBIDDEN_KEY_NORMALIZED


def kyc_document_access_contract_contains_forbidden_keys(value: object) -> bool:
    if isinstance(value, dict):
        for key, nested in value.items():
            if is_kyc_document_access_forbidden_contract_key(str(key)):
                return True
            if kyc_document_access_contract_contains_forbidden_keys(nested):
                return True
        return False
    if isinstance(value, list):
        return any(kyc_document_access_contract_contains_forbidden_keys(item) for item in value)
    return False


def clamp_kyc_document_access_ttl_seconds(ttl_seconds: float | int) -> int:
    if not isinstance(ttl_seconds, (int, float)) or ttl_seconds <= 0:
        return KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS
    return min(
        KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS,
        max(KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS, int(ttl_seconds)),
    )


def is_kyc_document_access_mode(value: object) -> TypeGuard[KycDocumentAccessMode]:
    return value == "inline_preview"


def is_kyc_document_access_grant_state(value: object) -> TypeGuard[KycDocumentAccessGrantState]:
    return isinstance(value, str) and value in KYC_DOCUMENT_ACCESS_GRANT_STATES


def is_kyc_document_access_denied_reason(value: object) -> TypeGuard[KycDocumentAccessDeniedReason]:
    return isinstance(value, str) and value in KYC_DOCUMENT_ACCESS_DENIED_REASONS


def is_kyc_document_access_unavailable_reason(
    value: object,
) -> TypeGuard[KycDocumentAccessUnavailableReason]:
    return isinstance(value, str) and value in KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS


def document_access_runtime_ready() -> bool:
    contract = ENTERPRISE_KYC_DOCUMENT_ACCESS_CONTRACT
    return bool(
        contract["grant_issuance_ready"]
        and contract["grant_redemption_ready"]
        and contract["streaming_ready"]
        and contract["audit_persistence_ready"]
        and contract["ui_preview_ready"]
        and contract["runtime_wired"]
    )


__all__ = [
    "ENTERPRISE_KYC_DOCUMENT_ACCESS_CONTRACT",
    "KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES",
    "KYC_DOCUMENT_ACCESS_DENIED_REASONS",
    "KYC_DOCUMENT_ACCESS_GRANT_STATES",
    "KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS",
    "KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS",
    "KYC_DOCUMENT_ACCESS_MODE",
    "KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS",
    "KYC_DOCUMENT_TYPES",
    "KYC_REVIEW_DOCUMENT_MIME_TYPES",
    "PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_GRANT_PATH",
    "PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_STREAM_PATH",
    "clamp_kyc_document_access_ttl_seconds",
    "document_access_runtime_ready",
    "is_kyc_document_access_denied_reason",
    "is_kyc_document_access_forbidden_contract_key",
    "is_kyc_document_access_grant_state",
    "is_kyc_document_access_mode",
    "is_kyc_document_access_unavailable_reason",
    "kyc_document_access_contract_contains_forbidden_keys",
]
