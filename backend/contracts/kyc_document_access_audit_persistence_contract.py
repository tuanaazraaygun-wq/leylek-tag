"""
Phase 5B2 — KYC document access audit persistence schema contract (constants only).

No Supabase, env reads, SQL execution, audit writes, or grant issuance.
RPCs and runtime writers belong to later phases.
"""
from __future__ import annotations

from typing import Final

from contracts.enterprise_kyc_document_access_contract import (
    KYC_DOCUMENT_ACCESS_DENIED_REASONS,
    KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS,
)

KYC_DOCUMENT_ACCESS_EVENTS_TABLE: Final = "kyc_document_access_events"

KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES: Final[tuple[str, ...]] = (
    "kyc.document.access_requested",
    "kyc.document.access_denied",
    "kyc.document.grant_issued",
    "kyc.document.redeemed",
    "kyc.document.view_failed",
    "kyc.document.grant_expired",
    "kyc.document.grant_revoked",
)

KYC_DOCUMENT_ACCESS_AUDIT_RESULTS: Final[tuple[str, ...]] = (
    "allowed",
    "denied",
    "viewed",
    "unavailable",
)

KYC_DOCUMENT_ACCESS_SOURCE_CHANNELS: Final[tuple[str, ...]] = (
    "enterprise_bff",
    "leylek_internal",
)

KYC_DOCUMENT_ACCESS_AUDIT_REASON_CODES: Final[tuple[str, ...]] = tuple(
    dict.fromkeys(
        (*KYC_DOCUMENT_ACCESS_DENIED_REASONS, *KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS)
    )
)

KYC_DOCUMENT_ACCESS_AUDIT_SCHEMA_READY: Final = False
KYC_DOCUMENT_ACCESS_APPEND_ONLY_READY: Final = False
KYC_DOCUMENT_ACCESS_AUDIT_RUNTIME_READY: Final = False

KYC_DOCUMENT_ACCESS_AUDIT_FORBIDDEN_PERSISTENCE_COLUMNS: Final[frozenset[str]] = frozenset(
    {
        "raw_grant_id",
        "grant_token",
        "raw_token",
        "access_token",
        "signed_url",
        "public_url",
        "document_url",
        "source_url",
        "provider_url",
        "redemption_url",
        "bucket",
        "bucket_name",
        "object_path",
        "storage_path",
        "storage_key",
        "file_path",
        "document_bytes",
        "raw_document",
        "authorization",
        "bearer",
        "jwt",
        "metadata",
        "payload",
        "raw_row",
        "driver_details",
        "full_name",
        "name",
        "phone",
        "plate",
        "email",
        "national_id",
        "ip_address",
        "raw_ip",
    }
)

__all__ = [
    "KYC_DOCUMENT_ACCESS_APPEND_ONLY_READY",
    "KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES",
    "KYC_DOCUMENT_ACCESS_AUDIT_FORBIDDEN_PERSISTENCE_COLUMNS",
    "KYC_DOCUMENT_ACCESS_AUDIT_REASON_CODES",
    "KYC_DOCUMENT_ACCESS_AUDIT_RESULTS",
    "KYC_DOCUMENT_ACCESS_AUDIT_RUNTIME_READY",
    "KYC_DOCUMENT_ACCESS_AUDIT_SCHEMA_READY",
    "KYC_DOCUMENT_ACCESS_EVENTS_TABLE",
    "KYC_DOCUMENT_ACCESS_SOURCE_CHANNELS",
]
