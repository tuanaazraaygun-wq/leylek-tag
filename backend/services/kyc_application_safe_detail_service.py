"""
Enterprise KYC application safe-detail read (Phase 2).

SELECT-only Product DB mapping with explicit allowlist fields.
Never serializes raw driver_details, URLs, or full PII.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Literal, Optional

from contracts.enterprise_kyc_detail_contract import (
    KYC_DOCUMENT_DISPLAY_LABELS,
    KYC_DOCUMENT_TYPES,
    KYC_REVIEW_DOCUMENT_MIME_TYPES,
    KYC_REVIEW_REQUIRED_PERMISSION,
    is_kyc_application_detail_status,
    kyc_detail_contract_contains_forbidden_keys,
)
from services.kyc_queue_safe_service import (
    NO_STORE_HEADERS,
    _canonical_vehicle_type,
    _nonempty_str,
    mask_kyc_display_name,
)

logger = logging.getLogger("server")

DETAIL_SELECT_COLUMNS = "id, name, city, updated_at, driver_details"

_LICENSE_SOURCE_KEY = "license_photo_url"
_CAR_REGISTRATION_SOURCE_KEY = "vehicle_photo_url"
_MOTORCYCLE_REGISTRATION_SOURCE_KEY = "motorcycle_photo_url"
_SELFIE_SOURCE_KEY = "selfie_url"

DocumentPresence = Literal["present", "missing", "unavailable"]
DocumentReviewState = Literal["review_available", "not_reviewed", "unavailable"]


def _resolve_detail_city(driver_details: dict[str, Any], user_city: Any) -> Optional[str]:
    from_driver = (
        _nonempty_str(driver_details.get("city"))
        or _nonempty_str(driver_details.get("city_name"))
        or _nonempty_str(driver_details.get("registration_city"))
    )
    if from_driver:
        return from_driver
    return _nonempty_str(user_city)


def _url_presence(value: Any) -> DocumentPresence:
    if value is None:
        return "missing"
    if not isinstance(value, str):
        return "unavailable"
    return "present" if value.strip() else "missing"


def _review_state_from_presence(presence: DocumentPresence) -> DocumentReviewState:
    if presence == "present":
        return "review_available"
    if presence == "missing":
        return "not_reviewed"
    return "unavailable"


def _registration_source_key(vehicle_type: str) -> Optional[str]:
    if vehicle_type == "car":
        return _CAR_REGISTRATION_SOURCE_KEY
    if vehicle_type == "motorcycle":
        return _MOTORCYCLE_REGISTRATION_SOURCE_KEY
    return None


def _selfie_required(vehicle_type: str) -> bool:
    if vehicle_type == "car":
        return False
    if vehicle_type == "motorcycle":
        return True
    return True


def _license_required(_vehicle_type: str) -> bool:
    return True


def _registration_required(_vehicle_type: str) -> bool:
    return True


def _build_document_entry(
    document_type: str,
    *,
    driver_details: dict[str, Any],
    vehicle_type: str,
) -> dict[str, Any]:
    if document_type == "license":
        presence = _url_presence(driver_details.get(_LICENSE_SOURCE_KEY))
        required = _license_required(vehicle_type)
    elif document_type == "vehicle_registration":
        source_key = _registration_source_key(vehicle_type)
        if source_key is None:
            presence = "unavailable"
        else:
            presence = _url_presence(driver_details.get(source_key))
        required = _registration_required(vehicle_type)
    elif document_type == "selfie":
        presence = _url_presence(driver_details.get(_SELFIE_SOURCE_KEY))
        required = _selfie_required(vehicle_type)
    else:
        presence = "unavailable"
        required = True

    return {
        "document_type": document_type,
        "display_label": KYC_DOCUMENT_DISPLAY_LABELS[document_type],  # type: ignore[index]
        "presence": presence,
        "review_state": _review_state_from_presence(presence),
        "required": required,
        "allowed_mime_types": list(KYC_REVIEW_DOCUMENT_MIME_TYPES),
    }


def _build_documents(driver_details: dict[str, Any], vehicle_type: str) -> list[dict[str, Any]]:
    return [
        _build_document_entry(doc_type, driver_details=driver_details, vehicle_type=vehicle_type)
        for doc_type in KYC_DOCUMENT_TYPES
    ]


def _record_version_iso(updated_at: Any) -> Optional[str]:
    if updated_at is None:
        return None
    if isinstance(updated_at, str):
        return updated_at.strip() or None
    if isinstance(updated_at, datetime):
        return updated_at.isoformat()
    s = str(updated_at).strip()
    return s or None


def _invalid_source_result() -> dict[str, Any]:
    return {
        "success": True,
        "result": {
            "availability": "unavailable",
            "reason_code": "invalid_source_data",
        },
    }


def _unsupported_status_result() -> dict[str, Any]:
    return {
        "success": True,
        "result": {
            "availability": "unavailable",
            "reason_code": "unsupported_status",
        },
    }


def _not_found_result() -> dict[str, Any]:
    return {
        "success": True,
        "result": {
            "availability": "not_found",
            "reason_code": "application_not_found",
        },
    }


def _guard_forbidden_keys(payload: dict[str, Any]) -> dict[str, Any]:
    if kyc_detail_contract_contains_forbidden_keys(payload):
        logger.info("enterprise_kyc_review: forbidden_keys_detected")
        return _invalid_source_result()
    return payload


def map_user_row_to_safe_detail(row: dict[str, Any]) -> dict[str, Any]:
    """Map one users row to Phase 1 safe-detail business result (HTTP 200 body)."""
    user_id = row.get("id")
    if user_id is None or not str(user_id).strip():
        return _invalid_source_result()

    driver_details = row.get("driver_details")
    if not isinstance(driver_details, dict):
        return _invalid_source_result()

    status_raw = _nonempty_str(driver_details.get("kyc_status"))
    if not status_raw:
        return _unsupported_status_result()
    status = status_raw.lower()
    if not is_kyc_application_detail_status(status):
        return _unsupported_status_result()

    vehicle_type = _canonical_vehicle_type(driver_details)
    submitted_at = _nonempty_str(driver_details.get("kyc_submitted_at"))
    record_version = _record_version_iso(row.get("updated_at"))

    detail = {
        "application_id": str(user_id).strip(),
        "status": status,
        "submitted_at": submitted_at,
        "record_version": record_version,
        "applicant": {
            "masked_name": mask_kyc_display_name(row.get("name")),
            "city": _resolve_detail_city(driver_details, row.get("city")),
        },
        "vehicle": {
            "vehicle_type": vehicle_type,
        },
        "documents": _build_documents(driver_details, vehicle_type),
        "review": {
            "required_permission": KYC_REVIEW_REQUIRED_PERMISSION,
            "may_request_document_access": True,
            "may_decide": False,
        },
        "redaction": {
            "pii_minimized": True,
            "raw_document_locations_excluded": True,
            "persistent_document_urls_excluded": True,
            "product_database_rows_excluded": True,
            "service_credentials_excluded": True,
        },
    }

    payload = {
        "success": True,
        "result": {
            "availability": "ready",
            "detail": detail,
        },
    }
    return _guard_forbidden_keys(payload)


def build_safe_detail_result_for_row(row: Optional[dict[str, Any]]) -> dict[str, Any]:
    if row is None:
        return _not_found_result()
    return map_user_row_to_safe_detail(row)


def select_kyc_application_row_by_id(supabase_client: Any, application_id: str) -> Optional[dict[str, Any]]:
    """SELECT-only by application UUID; returns None when no row."""
    result = (
        supabase_client.table("users")
        .select(DETAIL_SELECT_COLUMNS)
        .eq("id", application_id)
        .limit(1)
        .execute()
    )
    rows = list(result.data or [])
    if not rows:
        return None
    return rows[0]


def load_kyc_application_safe_detail(
    *,
    supabase_client: Any,
    application_id: str,
) -> dict[str, Any]:
    row = select_kyc_application_row_by_id(supabase_client, application_id)
    return build_safe_detail_result_for_row(row)


__all__ = [
    "DETAIL_SELECT_COLUMNS",
    "NO_STORE_HEADERS",
    "build_safe_detail_result_for_row",
    "load_kyc_application_safe_detail",
    "map_user_row_to_safe_detail",
    "select_kyc_application_row_by_id",
]
