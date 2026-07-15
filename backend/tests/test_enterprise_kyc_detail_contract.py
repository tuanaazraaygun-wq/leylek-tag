"""Phase 1 — Enterprise KYC detail contract tests (no DB, routes, or secrets)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import enterprise_kyc_detail_contract as detail  # noqa: E402


def test_document_type_allowlist_exact() -> None:
    assert detail.KYC_DOCUMENT_TYPES == ("license", "vehicle_registration", "selfie")
    assert detail.is_kyc_document_type("license")
    assert not detail.is_kyc_document_type("identity")


def test_mime_allowlist_exact() -> None:
    assert detail.KYC_REVIEW_DOCUMENT_MIME_TYPES == ("image/jpeg",)
    assert detail.is_kyc_review_document_mime_type("image/jpeg")
    assert not detail.is_kyc_review_document_mime_type("application/octet-stream")


def test_status_allowlist_and_unknown_fail_closed() -> None:
    assert detail.KYC_APPLICATION_DETAIL_STATUSES == (
        "pending",
        "needs_documents",
        "approved",
        "rejected",
    )
    assert not detail.is_kyc_application_detail_status("unknown")
    assert detail.unsupported_status_detail_result() == {
        "availability": "unavailable",
        "reason_code": "unsupported_status",
    }


def test_forbidden_exact_keys_without_redaction_false_positive() -> None:
    assert detail.is_kyc_detail_forbidden_contract_key("signedUrl")
    assert detail.is_kyc_detail_forbidden_contract_key("phone")
    assert not detail.is_kyc_detail_forbidden_contract_key("persistentDocumentUrlsExcluded")
    assert not detail.kyc_detail_contract_contains_forbidden_keys(
        {"persistentDocumentUrlsExcluded": True, "piiMinimized": True}
    )
    assert detail.kyc_detail_contract_contains_forbidden_keys({"url": "https://example.invalid"})


def test_runtime_wiring_enabled_for_detail_only() -> None:
    assert detail.ENTERPRISE_KYC_DETAIL_CONTRACT["runtime_wired"] is True
    assert detail.ENTERPRISE_KYC_DETAIL_CONTRACT["implementation_ready"] is False
    assert detail.ENTERPRISE_KYC_DETAIL_CONTRACT["document_access_ready"] is False
    assert detail.ENTERPRISE_KYC_DETAIL_CONTRACT["decision_ready"] is False
    assert detail.ENTERPRISE_KYC_DETAIL_CONTRACT["signed_urls_allowed"] is False
    assert detail.may_wire_enterprise_kyc_detail_contract() is True
    assert (
        detail.PREFERRED_INTERNAL_KYC_DETAIL_PATH
        == "/api/internal/enterprise/kyc/applications/{application_id}/safe-detail"
    )


def test_display_labels_deterministic() -> None:
    assert detail.KYC_DOCUMENT_DISPLAY_LABELS["license"] == "Ehliyet"
    assert detail.KYC_DOCUMENT_DISPLAY_LABELS["vehicle_registration"] == "Araç ruhsatı"
    assert detail.KYC_DOCUMENT_DISPLAY_LABELS["selfie"] == "Selfie"


def test_ttl_bounds() -> None:
    assert detail.KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS == 60
    assert detail.KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS == 120


@pytest.mark.parametrize(
    "key",
    [
        "url",
        "signedUrl",
        "storagePath",
        "objectPath",
        "serviceToken",
        "jwt",
    ],
)
def test_storage_and_url_keys_forbidden(key: str) -> None:
    assert detail.kyc_detail_contract_contains_forbidden_keys({key: "value"})
