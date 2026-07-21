"""
Phase 5B3a — KYC document access RPC wire contract (constants only).

Future PostgreSQL RPC names, outcome codes, and input/output field markers.
No Supabase, env reads, SQL execution, or runtime wiring.
"""
from __future__ import annotations

from typing import Final

from contracts.enterprise_kyc_document_access_contract import (
    KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS,
    KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS,
)

KYC_DOCUMENT_ACCESS_ISSUE_RPC_NAME: Final = "kyc_document_access_issue_grant"
KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME: Final = "kyc_document_access_redeem_grant"

KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES: Final[tuple[str, ...]] = (
    "issued",
    "duplicate_request",
    "request_conflict",
    "invalid_input",
    "application_not_found",
    "record_version_stale",
    "document_not_reviewable",
    "document_missing",
    "audit_unavailable",
    "rate_limited",
)

# rate_limited is reserved for service/API guard only; the issue-grant RPC must not emit it.

# duplicate_request is metadata-only duplicate prevention for an existing grant row.
# It does not recover or re-emit the original raw grant token.

KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES: Final[tuple[str, ...]] = (
    "redeemed",
    "not_found_or_unauthorized",
    "grant_expired",
    "grant_redeemed",
    "grant_revoked",
    "invalid_input",
    "audit_unavailable",
)

# not_found_or_unauthorized combines missing grants and actor mismatch to avoid existence disclosure.

KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH: Final = 128
KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH: Final = 128
KYC_DOCUMENT_ACCESS_RPC_GRANT_REFERENCE_HASH_MAX_LENGTH: Final = 128
KYC_DOCUMENT_ACCESS_RPC_SOURCE_BINDING_HASH_MAX_LENGTH: Final = 128
KYC_DOCUMENT_ACCESS_RPC_TOKEN_VERSION_MIN: Final = 1
KYC_DOCUMENT_ACCESS_RPC_TTL_MIN_SECONDS: Final = KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS
KYC_DOCUMENT_ACCESS_RPC_TTL_MAX_SECONDS: Final = KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS

KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES: Final[tuple[str, ...]] = (
    "p_grant_reference_hash",
    "p_token_version",
    "p_application_id",
    "p_document_type",
    "p_actor_admin_id",
    "p_request_id",
    "p_review_reason",
    "p_ttl_seconds",
    "p_source_binding_hash",
    "p_application_record_version",
    "p_source_channel",
)

KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES: Final[tuple[str, ...]] = (
    "p_grant_reference_hash",
    "p_actor_admin_id",
    "p_request_id",
    "p_source_channel",
    "p_observed_source_binding_hash",
    "p_observed_application_record_version",
)

KYC_DOCUMENT_ACCESS_ISSUE_RPC_OUTPUT_FIELDS: Final[tuple[str, ...]] = (
    "outcome_code",
    "grant_id",
    "grant_reference_hash",
    "state",
    "issued_at",
    "expires_at",
    "ttl_seconds",
    "is_reused",
)

KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS: Final[tuple[str, ...]] = (
    "outcome_code",
    "grant_id",
    "application_id",
    "document_type",
    "state",
    "redeemed_at",
    "source_binding_hash",
    "application_record_version",
)

KYC_DOCUMENT_ACCESS_RPC_CONTRACT_READY: Final = False
KYC_DOCUMENT_ACCESS_ISSUE_RPC_READY: Final = True
KYC_DOCUMENT_ACCESS_REDEEM_RPC_READY: Final = False
KYC_DOCUMENT_ACCESS_RPC_ADAPTER_READY: Final = True
KYC_DOCUMENT_ACCESS_GRANT_RUNTIME_READY: Final = False

__all__ = [
    "KYC_DOCUMENT_ACCESS_GRANT_RUNTIME_READY",
    "KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES",
    "KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES",
    "KYC_DOCUMENT_ACCESS_ISSUE_RPC_NAME",
    "KYC_DOCUMENT_ACCESS_ISSUE_RPC_OUTPUT_FIELDS",
    "KYC_DOCUMENT_ACCESS_ISSUE_RPC_READY",
    "KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES",
    "KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES",
    "KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME",
    "KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS",
    "KYC_DOCUMENT_ACCESS_REDEEM_RPC_READY",
    "KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH",
    "KYC_DOCUMENT_ACCESS_RPC_ADAPTER_READY",
    "KYC_DOCUMENT_ACCESS_RPC_CONTRACT_READY",
    "KYC_DOCUMENT_ACCESS_RPC_GRANT_REFERENCE_HASH_MAX_LENGTH",
    "KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH",
    "KYC_DOCUMENT_ACCESS_RPC_SOURCE_BINDING_HASH_MAX_LENGTH",
    "KYC_DOCUMENT_ACCESS_RPC_TOKEN_VERSION_MIN",
    "KYC_DOCUMENT_ACCESS_RPC_TTL_MAX_SECONDS",
    "KYC_DOCUMENT_ACCESS_RPC_TTL_MIN_SECONDS",
]
