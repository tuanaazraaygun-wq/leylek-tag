"""
Shared PII-safe KYC queue read helpers (production lineage graft).

Auth is intentionally NOT here — callers own authorization.
SELECT-only mapping for pending KYC rows; never serialize raw PII / URLs.

Data source on this branch:
  - product_db: Supabase SELECT (production / default)

Staging fixture path is intentionally omitted from the production lineage graft.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Literal, Optional

logger = logging.getLogger("server")

QUEUE_SAFE_DEFAULT_LIMIT = 50
QUEUE_SAFE_MAX_LIMIT = 50
NO_STORE_HEADERS = {"Cache-Control": "no-store"}

KycQueueDataSource = Literal["product_db"]
DATA_SOURCE_PRODUCT_DB: KycQueueDataSource = "product_db"

# Document URL keys may exist in DB JSON; never serialized into response.
_LICENSE_URL_KEYS = ("license_photo_url",)
_VEHICLE_URL_KEYS = ("vehicle_photo_url", "motorcycle_photo_url")
_SELFIE_URL_KEYS = ("selfie_url",)


def mask_kyc_display_name(raw_name: Any) -> str:
    """Deterministic display mask. Empty → Unknown."""
    if raw_name is None:
        return "Unknown"
    name = str(raw_name).strip()
    if not name:
        return "Unknown"
    parts = [p for p in re.split(r"\s+", name) if p]
    if not parts:
        return "Unknown"
    out: list[str] = []
    for part in parts:
        first = part[0]
        out.append(f"{first.upper()}***")
    return " ".join(out)


def _nonempty_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _has_url_presence(dd: dict[str, Any], keys: tuple[str, ...]) -> bool:
    for key in keys:
        if _nonempty_str(dd.get(key)):
            return True
    return False


def _canonical_vehicle_type(dd: dict[str, Any]) -> str:
    raw = (
        _nonempty_str(dd.get("pending_vehicle_kind"))
        or _nonempty_str(dd.get("kyc_vehicle_kind"))
        or _nonempty_str(dd.get("vehicle_kind"))
        or ""
    ).lower()
    if raw in ("car", "automobile"):
        return "car"
    if raw in ("motorcycle", "motor", "scooter"):
        return "motorcycle"
    return "unknown"


def _resolve_city(dd: dict[str, Any]) -> Optional[str]:
    """City is not currently stored on KYC driver_details; keep null unless present."""
    return (
        _nonempty_str(dd.get("city"))
        or _nonempty_str(dd.get("city_name"))
        or _nonempty_str(dd.get("registration_city"))
    )


def map_driver_row_to_queue_safe_item(
    user_id: str, name: Any, driver_details: Any
) -> Optional[dict[str, Any]]:
    """
    Map one users row to a PII-safe queue item.
    Returns None if not pending / unusable.
    """
    if not user_id or not str(user_id).strip():
        return None
    if not isinstance(driver_details, dict):
        return None
    status = (_nonempty_str(driver_details.get("kyc_status")) or "").lower()
    if status != "pending":
        return None

    submitted = _nonempty_str(driver_details.get("kyc_submitted_at"))

    return {
        "id": str(user_id).strip(),
        "masked_name": mask_kyc_display_name(name),
        "city": _resolve_city(driver_details),
        "vehicle_type": _canonical_vehicle_type(driver_details),
        "submitted_at": submitted,
        "status": "pending",
        "documents": {
            "identity_present": _has_url_presence(driver_details, _LICENSE_URL_KEYS),
            "license_present": _has_url_presence(driver_details, _LICENSE_URL_KEYS),
            "vehicle_registration_present": _has_url_presence(driver_details, _VEHICLE_URL_KEYS),
            "selfie_present": _has_url_presence(driver_details, _SELFIE_URL_KEYS),
        },
    }


def _submitted_sort_key(item: dict[str, Any]) -> float:
    raw = item.get("submitted_at")
    if not raw:
        return 0.0
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return 0.0


def build_queue_safe_payload(rows: list[dict[str, Any]], *, limit: int) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for row in rows:
        uid = row.get("id")
        item = map_driver_row_to_queue_safe_item(
            str(uid) if uid is not None else "",
            row.get("name"),
            row.get("driver_details"),
        )
        if item:
            items.append(item)
    items.sort(key=_submitted_sort_key, reverse=True)
    limited = items[:limit]
    return {
        "success": True,
        "items": limited,
        "count": len(limited),
    }


def clamp_queue_safe_limit(raw: Any) -> int:
    try:
        n = int(raw)
    except (TypeError, ValueError):
        n = QUEUE_SAFE_DEFAULT_LIMIT
    return max(1, min(n, QUEUE_SAFE_MAX_LIMIT))


def select_kyc_queue_driver_rows(supabase_client: Any) -> list[dict[str, Any]]:
    """SELECT-only: id, name, driver_details — no phone column."""
    result = (
        supabase_client.table("users")
        .select("id, name, driver_details")
        .not_.is_("driver_details", "null")
        .execute()
    )
    return list(result.data or [])


def load_kyc_queue_safe_payload(*, supabase_client: Any, limit: int) -> dict[str, Any]:
    """
    Product DB path: SELECT pending KYC queue and return PII-safe payload.
    Raises on DB failure. Never mutates Product DB.
    """
    safe_limit = clamp_queue_safe_limit(limit)
    rows = select_kyc_queue_driver_rows(supabase_client)
    payload = build_queue_safe_payload(rows, limit=safe_limit)
    payload["source"] = DATA_SOURCE_PRODUCT_DB
    return payload
