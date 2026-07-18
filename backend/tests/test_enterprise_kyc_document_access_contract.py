"""Phase 5A — Enterprise KYC document access contract mirror tests."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import enterprise_kyc_document_access_contract as access  # noqa: E402


def test_access_mode_inline_preview_only() -> None:
    assert access.KYC_DOCUMENT_ACCESS_MODE == "inline_preview"
    assert access.is_kyc_document_access_mode("inline_preview")
    assert not access.is_kyc_document_access_mode("download")


def test_grant_lifecycle_closed() -> None:
    assert access.KYC_DOCUMENT_ACCESS_GRANT_STATES == (
        "issued",
        "redeemed",
        "expired",
        "revoked",
    )
    assert access.is_kyc_document_access_grant_state("issued")
    assert not access.is_kyc_document_access_grant_state("requested")


def test_ttl_bounds_and_clamp() -> None:
    assert access.KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS == 60
    assert access.KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS == 120
    assert access.clamp_kyc_document_access_ttl_seconds(30) == 60
    assert access.clamp_kyc_document_access_ttl_seconds(90) == 90
    assert access.clamp_kyc_document_access_ttl_seconds(999) == 120


def test_denied_reasons_closed() -> None:
    assert "audit_unavailable" in access.KYC_DOCUMENT_ACCESS_DENIED_REASONS
    assert "rate_limited" in access.KYC_DOCUMENT_ACCESS_DENIED_REASONS
    assert access.is_kyc_document_access_denied_reason("audit_unavailable")
    assert not access.is_kyc_document_access_denied_reason("open")


def test_unavailable_reasons_closed() -> None:
    assert "invalid_source_reference" in access.KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS
    assert "grant_expired" in access.KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS
    assert "grant_redeemed" in access.KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS
    assert "grant_revoked" in access.KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS
    assert access.is_kyc_document_access_unavailable_reason("grant_redeemed")
    assert not access.is_kyc_document_access_unavailable_reason("bad")


def test_runtime_flags_remain_false() -> None:
    contract = access.ENTERPRISE_KYC_DOCUMENT_ACCESS_CONTRACT
    assert contract["grant_issuance_ready"] is False
    assert contract["grant_redemption_ready"] is False
    assert contract["streaming_ready"] is False
    assert contract["audit_persistence_ready"] is False
    assert contract["ui_preview_ready"] is False
    assert contract["runtime_wired"] is False
    assert contract["signed_urls_allowed"] is False
    assert access.document_access_runtime_ready() is False


def test_future_route_markers() -> None:
    assert (
        access.PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_GRANT_PATH
        == "/api/internal/enterprise/kyc/applications/{application_id}/documents/{document_type}/access-grants"
    )
    assert (
        access.PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_STREAM_PATH
        == "/api/internal/enterprise/kyc/document-access/{grant_id}/stream"
    )


def test_forbidden_keys_without_redaction_false_positive() -> None:
    assert access.is_kyc_document_access_forbidden_contract_key("providerUrl")
    assert access.is_kyc_document_access_forbidden_contract_key("documentBytes")
    assert not access.is_kyc_document_access_forbidden_contract_key("persistentDocumentUrlsExcluded")
    assert access.kyc_document_access_contract_contains_forbidden_keys({"redemptionUrl": "https://x"})
    assert not access.kyc_document_access_contract_contains_forbidden_keys(
        {"persistentDocumentUrlsExcluded": True}
    )


def test_audit_event_names_closed() -> None:
    assert "kyc.document.grant_issued" in access.KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES
    assert "kyc.document.grant_revoked" in access.KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES
