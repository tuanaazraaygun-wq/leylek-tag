"""
Phase 5B1 — KYC document access grant persistence schema contract (constants only).

No Supabase, env reads, SQL execution, token generation, hashing, or record creation.
Audit table, RPCs, and runtime wiring belong to later phases.
"""
from __future__ import annotations

from typing import Final

KYC_DOCUMENT_ACCESS_GRANTS_TABLE: Final = "kyc_document_access_grants"

KYC_DOCUMENT_ACCESS_GRANT_STATES: Final[tuple[str, ...]] = (
    "issued",
    "redeemed",
    "expired",
    "revoked",
)

KYC_DOCUMENT_ACCESS_DOCUMENT_TYPES: Final[tuple[str, ...]] = (
    "license",
    "vehicle_registration",
    "selfie",
)

KYC_DOCUMENT_ACCESS_REVIEW_REASONS: Final[tuple[str, ...]] = (
    "initial_review",
    "recheck",
)

KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS: Final = 60
KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS: Final = 120

KYC_DOCUMENT_ACCESS_SCHEMA_READY: Final = False
KYC_DOCUMENT_ACCESS_AUDIT_READY: Final = False
KYC_DOCUMENT_ACCESS_RPC_READY: Final = False
KYC_DOCUMENT_ACCESS_RUNTIME_READY: Final = False

KYC_DOCUMENT_ACCESS_FORBIDDEN_PERSISTENCE_COLUMNS: Final[frozenset[str]] = frozenset(
    {
        "grant_token",
        "raw_token",
        "access_token",
        "signed_url",
        "public_url",
        "document_url",
        "source_url",
        "bucket",
        "bucket_name",
        "object_path",
        "storage_path",
        "file_path",
        "document_bytes",
        "raw_document",
        "driver_details",
        "metadata",
        "full_name",
        "phone",
        "plate",
        "national_id",
        "email",
    }
)

__all__ = [
    "KYC_DOCUMENT_ACCESS_AUDIT_READY",
    "KYC_DOCUMENT_ACCESS_DOCUMENT_TYPES",
    "KYC_DOCUMENT_ACCESS_FORBIDDEN_PERSISTENCE_COLUMNS",
    "KYC_DOCUMENT_ACCESS_GRANTS_TABLE",
    "KYC_DOCUMENT_ACCESS_GRANT_STATES",
    "KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS",
    "KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS",
    "KYC_DOCUMENT_ACCESS_REVIEW_REASONS",
    "KYC_DOCUMENT_ACCESS_RPC_READY",
    "KYC_DOCUMENT_ACCESS_RUNTIME_READY",
    "KYC_DOCUMENT_ACCESS_SCHEMA_READY",
]
