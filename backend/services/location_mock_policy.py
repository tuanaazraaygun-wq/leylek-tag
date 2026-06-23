"""
Mock location policy — static allowlist, O(1) phone check.
No DB/Redis; used at location write boundaries only.
"""

from __future__ import annotations

from fastapi import HTTPException

MOCK_LOCATION_BLOCKED = "MOCK_LOCATION_BLOCKED"
MOCK_LOCATION_BLOCKED_MESSAGE = (
    "Sahte konum uygulaması tespit edildi. Güvenlik nedeniyle gerçek konumla devam edin."
)

MOCK_LOCATION_ALLOWED_PHONES_10 = frozenset(
    {
        "5326497412",
        "5354169632",
        "5321111111",
        "5322222222",
    }
)


def normalize_phone_10_for_mock_policy(phone: str) -> str:
    """+90 / 90 / 0 / 10 hane → 5XXXXXXXXX"""
    if not phone:
        return ""
    digits = "".join(c for c in str(phone) if c.isdigit())
    if digits.startswith("90") and len(digits) >= 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def is_mock_location_allowed_phone(phone: str) -> bool:
    return normalize_phone_10_for_mock_policy(phone) in MOCK_LOCATION_ALLOWED_PHONES_10


def parse_is_mock_location_flag(value) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    return s in ("1", "true", "yes", "on")


def mock_location_blocked_detail() -> dict:
    return {
        "success": False,
        "error_code": MOCK_LOCATION_BLOCKED,
        "message": MOCK_LOCATION_BLOCKED_MESSAGE,
    }


def reject_mock_location_if_forbidden(phone: str | None, is_mock_location: bool) -> None:
    if not is_mock_location:
        return
    if is_mock_location_allowed_phone(phone or ""):
        return
    raise HTTPException(status_code=403, detail=mock_location_blocked_detail())
