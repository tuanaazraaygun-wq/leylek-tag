"""
RME Trusted Direct Match — trusted_connections validation for direct match create.

Read-only on trusted_connections / users. Raises domain exceptions for orchestrator.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple

TABLE_TRUSTED_CONNECTIONS = "trusted_connections"
TABLE_USERS = "users"


class RmeConnectionNotActiveError(Exception):
    code = "connection_not_active"
    message = "Güven ağı bağlantısı aktif değil."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmeTrustedFieldError(ValueError):
    code = "validation_error"
    message = "Geçersiz istek."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


_CONNECTION_SELECT = (
    "id, initiator_id, counterparty_id, initiator_role, counterparty_role, status"
)


def _norm_user_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _norm_id(value: Any) -> str:
    return str(value or "").strip()


def _actor_role_and_counterparty(
    actor_id: str,
    row: dict,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Return (actor_role, counterparty_id, counterparty_role) or Nones if not participant."""
    actor = _norm_user_id(actor_id)
    ini = _norm_user_id(row.get("initiator_id"))
    cp = _norm_user_id(row.get("counterparty_id"))
    if actor == ini:
        return (
            str(row.get("initiator_role") or "").strip().lower() or None,
            cp or None,
            str(row.get("counterparty_role") or "").strip().lower() or None,
        )
    if actor == cp:
        return (
            str(row.get("counterparty_role") or "").strip().lower() or None,
            ini or None,
            str(row.get("initiator_role") or "").strip().lower() or None,
        )
    return (None, None, None)


def load_trusted_connection_by_id(supabase, connection_id: str) -> Optional[Dict[str, Any]]:
    cid = _norm_id(connection_id)
    if not cid:
        return None
    result = (
        supabase.table(TABLE_TRUSTED_CONNECTIONS)
        .select(_CONNECTION_SELECT)
        .eq("id", cid)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def _user_account_is_eligible(row: Optional[dict]) -> bool:
    if not row or not isinstance(row, dict):
        return False
    if row.get("is_active") is False:
        return False
    if row.get("is_deleted") is True:
        return False
    deleted_at = row.get("deleted_at")
    if deleted_at is not None and str(deleted_at).strip() != "":
        return False
    if row.get("is_banned") is True:
        return False
    return True


def _driver_vehicle_kind(user_row: dict) -> str:
    details = user_row.get("driver_details")
    if isinstance(details, str):
        try:
            details = json.loads(details)
        except (TypeError, ValueError, json.JSONDecodeError):
            details = {}
    if not isinstance(details, dict):
        details = {}
    raw = (
        details.get("vehicle_type")
        or details.get("vehicle_kind")
        or details.get("vehicle")
        or "car"
    )
    v = str(raw or "car").strip().lower()
    if v in ("motorcycle", "motor", "moto", "scooter"):
        return "motorcycle"
    return "car"


def assert_responder_eligible(supabase, responder_id: str) -> None:
    uid = _norm_user_id(responder_id)
    if not uid:
        raise RmeTrustedFieldError("Geçersiz sürücü kimliği.")
    result = (
        supabase.table(TABLE_USERS)
        .select("id, is_active, is_deleted, deleted_at, is_banned")
        .eq("id", uid)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows or not _user_account_is_eligible(rows[0]):
        raise RmeTrustedFieldError("Karşı taraf şu an kullanılamıyor.")


def assert_vehicle_preference_compatible(
    supabase,
    responder_id: str,
    vehicle_preference: str,
) -> None:
    uid = _norm_user_id(responder_id)
    pref = str(vehicle_preference or "car").strip().lower()
    if pref not in ("car", "motorcycle"):
        raise RmeTrustedFieldError("Geçersiz araç tercihi.")

    result = (
        supabase.table(TABLE_USERS)
        .select("id, driver_details")
        .eq("id", uid)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise RmeTrustedFieldError("Sürücü bulunamadı.")
    driver_kind = _driver_vehicle_kind(rows[0])
    if pref == "motorcycle" and driver_kind != "motorcycle":
        raise RmeTrustedFieldError("Seçilen sürücü motosiklet yolculuğu için uygun değil.")
    if pref == "car" and driver_kind == "motorcycle":
        raise RmeTrustedFieldError("Seçilen sürücü araç tercihiyle uyumlu değil.")


def assert_active_trusted_connection_for_direct_match(
    supabase,
    *,
    requester_id: str,
    responder_id: str,
    relationship_connection_id: str,
) -> Dict[str, Any]:
    """
    Verify active trusted_connections row binds requester (passenger) to responder (driver).
    """
    requester = _norm_user_id(requester_id)
    responder = _norm_user_id(responder_id)
    conn_id = _norm_id(relationship_connection_id)
    if not requester or not responder or not conn_id:
        raise RmeConnectionNotActiveError()

    row = load_trusted_connection_by_id(supabase, conn_id)
    if not row:
        raise RmeConnectionNotActiveError()

    status = str(row.get("status") or "").strip().lower()
    if status != "active":
        raise RmeConnectionNotActiveError()

    actor_role, counterparty_id, counterparty_role = _actor_role_and_counterparty(
        requester, row
    )
    if not actor_role or not counterparty_id:
        raise RmeConnectionNotActiveError()
    if counterparty_id != responder:
        raise RmeConnectionNotActiveError()
    if actor_role != "passenger":
        raise RmeTrustedFieldError("Yalnızca yolcu doğrudan eşleşme isteği gönderebilir.")
    if str(counterparty_role or "").strip().lower() != "driver":
        raise RmeConnectionNotActiveError()

    return row
