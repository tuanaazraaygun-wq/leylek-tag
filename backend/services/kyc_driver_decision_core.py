"""
Shared KYC driver approve/reject domain mutations (Phase D1).

Pure driver_details mutations — mirrors server.py admin KYC rules without I/O.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Literal, Optional


def canonical_vehicle_kind(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    s = str(value).strip().lower()
    if s == "car":
        return "car"
    if s in ("motorcycle", "motor", "moto"):
        return "motorcycle"
    return None


def driver_details_as_dict(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw.strip())
            if isinstance(parsed, dict):
                return dict(parsed)
        except Exception:
            pass
    return {}


def normalize_kyc_vehicle_kinds_list(raw: Any) -> list[str]:
    out: list[str] = []
    parsed: Any = raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw.strip())
        except Exception:
            parsed = None
    seq = parsed if isinstance(parsed, list) else raw if isinstance(raw, list) else None
    if isinstance(seq, list):
        for item in seq:
            kind = canonical_vehicle_kind(item)
            if kind and kind not in out:
                out.append(kind)
    return out


def pending_vehicle_kind_from_details(dd: dict[str, Any]) -> Optional[str]:
    return canonical_vehicle_kind(dd.get("pending_vehicle_kind")) or canonical_vehicle_kind(
        dd.get("kyc_vehicle_kind")
    )


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def driver_active_until_iso(days: int = 60) -> str:
    return (datetime.utcnow() + timedelta(days=days)).isoformat()


def apply_kyc_approve_mutation(driver_details: dict[str, Any]) -> dict[str, Any]:
    """Apply approve mutation; raises ValueError when vehicle kind missing."""
    dd = dict(driver_details)
    if dd.get("kyc_status") != "pending":
        raise ValueError("not_pending")

    kind_to_add = pending_vehicle_kind_from_details(dd)
    if kind_to_add is None:
        raise ValueError("vehicle_kind_missing")

    avk = normalize_kyc_vehicle_kinds_list(dd.get("approved_vehicle_kinds"))
    if kind_to_add not in avk:
        avk.append(kind_to_add)
    avk = normalize_kyc_vehicle_kinds_list(avk)

    dd["approved_vehicle_kinds"] = avk
    dd.pop("pending_vehicle_kind", None)
    dd["kyc_status"] = "approved"
    dd["is_verified"] = True
    dd["kyc_approved_at"] = utc_now_iso()
    return dd


def apply_kyc_reject_mutation(
    driver_details: dict[str, Any],
    *,
    reason_text: str,
    reason_code: str,
) -> tuple[dict[str, Any], Literal["approved", "rejected"]]:
    """Apply reject mutation; preserves prior approved_vehicle_kinds when present."""
    dd = dict(driver_details)
    if dd.get("kyc_status") != "pending":
        raise ValueError("not_pending")

    approved_remain = normalize_kyc_vehicle_kinds_list(dd.get("approved_vehicle_kinds"))
    dd.pop("pending_vehicle_kind", None)
    dd["kyc_rejection_reason"] = reason_text.strip()
    dd["kyc_rejection_reason_code"] = reason_code.strip()
    dd["kyc_rejected_at"] = utc_now_iso()

    if approved_remain:
        dd["kyc_status"] = "approved"
        dd["is_verified"] = True
        dd["approved_vehicle_kinds"] = approved_remain
        return dd, "approved"

    dd["kyc_status"] = "rejected"
    dd["is_verified"] = False
    return dd, "rejected"
