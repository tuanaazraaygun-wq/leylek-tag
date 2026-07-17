"""
Phase 1 — Secure Enterprise KYC application detail wire contract (contract-only).

No routes, Supabase, URLs, DB access, or document bytes.
Future Product API snake_case mapping is documented inline below.

Queue note: queue-safe `identity_present` mirrors `license_photo_url` only.
This contract does not model identity as an independent reviewable document type.
"""

from __future__ import annotations

from typing import Final, Literal, TypeGuard

KycDocumentType = Literal["license", "vehicle_registration", "selfie"]
KYC_DOCUMENT_TYPES: Final[tuple[KycDocumentType, ...]] = (
    "license",
    "vehicle_registration",
    "selfie",
)

KycApplicationDetailStatus = Literal["pending", "needs_documents", "approved", "rejected"]
KYC_APPLICATION_DETAIL_STATUSES: Final[tuple[KycApplicationDetailStatus, ...]] = (
    "pending",
    "needs_documents",
    "approved",
    "rejected",
)

KycReviewDocumentMimeType = Literal["image/jpeg"]
KYC_REVIEW_DOCUMENT_MIME_TYPES: Final[tuple[KycReviewDocumentMimeType, ...]] = ("image/jpeg",)

KycDetailAvailability = Literal["ready", "denied", "not_found", "unavailable"]

KycDetailDeniedReason = Literal[
    "authentication_required",
    "allowlist_required",
    "permission_required",
]

KycDetailUnavailableReason = Literal[
    "source_unavailable",
    "invalid_source_data",
    "unsupported_status",
    "temporarily_unavailable",
]

KycDocumentAccessDeniedReason = Literal[
    "authentication_required",
    "allowlist_required",
    "permission_required",
    "document_not_reviewable",
]

KycDocumentAccessUnavailableReason = Literal[
    "document_missing",
    "document_unavailable",
    "invalid_document_type",
    "source_unavailable",
    "temporarily_unavailable",
]

KYC_REVIEW_REQUIRED_PERMISSION: Final = "kyc.review"

KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS: Final = 60
KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS: Final = 120

# Internal safe-detail route (Phase 2).
PREFERRED_INTERNAL_KYC_DETAIL_PATH = (
    "/api/internal/enterprise/kyc/applications/{application_id}/safe-detail"
)
PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_PATH = (
    "/api/internal/enterprise/kyc/document-access-safe"
)

ENTERPRISE_KYC_DETAIL_CONTRACT: Final[dict[str, object]] = {
    "implementation_ready": False,
    "document_access_ready": False,
    "decision_ready": False,
    "runtime_wired": True,
    "product_db_mutation": False,
    "signed_urls_allowed": False,
    "public_urls_on_wire": False,
    "detail_path": PREFERRED_INTERNAL_KYC_DETAIL_PATH,
    "document_access_path": PREFERRED_INTERNAL_KYC_DOCUMENT_ACCESS_PATH,
    "review_permission": KYC_REVIEW_REQUIRED_PERMISSION,
}

KYC_DOCUMENT_DISPLAY_LABELS: Final[dict[KycDocumentType, str]] = {
    "license": "Ehliyet",
    "vehicle_registration": "Araç ruhsatı",
    "selfie": "Selfie",
}

# Future snake_case wire fields (Phase 2 Product response):
# application_id, status, submitted_at, record_version, masked_name, city,
# vehicle_type, documents[].document_type, documents[].presence, documents[].review_state,
# documents[].required, documents[].allowed_mime_types, documents[].display_label

_KYC_DETAIL_FORBIDDEN_KEY_NORMALIZED: Final[frozenset[str]] = frozenset(
    {
        "url",
        "signedurl",
        "publicurl",
        "accessurl",
        "proxyurl",
        "previewurl",
        "downloadurl",
        "bucket",
        "bucketname",
        "objectpath",
        "storagepath",
        "filepath",
        "storagekey",
        "servicerole",
        "servicetoken",
        "authorization",
        "bearer",
        "jwt",
        "phone",
        "plate",
        "platenumber",
        "nationalid",
        "identitynumber",
        "rawrow",
        "metadata",
    }
)


def normalize_kyc_detail_contract_key(key: str) -> str:
    return key.replace("_", "").replace("-", "").lower()


def is_kyc_detail_forbidden_contract_key(key: str) -> bool:
    return normalize_kyc_detail_contract_key(key) in _KYC_DETAIL_FORBIDDEN_KEY_NORMALIZED


def kyc_detail_contract_contains_forbidden_keys(value: object) -> bool:
    if isinstance(value, dict):
        for key, nested in value.items():
            if is_kyc_detail_forbidden_contract_key(str(key)):
                return True
            if kyc_detail_contract_contains_forbidden_keys(nested):
                return True
        return False
    if isinstance(value, list):
        return any(kyc_detail_contract_contains_forbidden_keys(item) for item in value)
    return False


def is_kyc_document_type(value: object) -> TypeGuard[KycDocumentType]:
    return isinstance(value, str) and value in KYC_DOCUMENT_TYPES


def is_kyc_application_detail_status(value: object) -> TypeGuard[KycApplicationDetailStatus]:
    return isinstance(value, str) and value in KYC_APPLICATION_DETAIL_STATUSES


def is_kyc_review_document_mime_type(value: object) -> TypeGuard[KycReviewDocumentMimeType]:
    return value == "image/jpeg"


def unsupported_status_detail_result() -> dict[str, str]:
    return {"availability": "unavailable", "reason_code": "unsupported_status"}


def may_wire_enterprise_kyc_detail_contract() -> bool:
    return bool(ENTERPRISE_KYC_DETAIL_CONTRACT["runtime_wired"])
