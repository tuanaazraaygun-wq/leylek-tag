"""
Relationship Match Engine — Trusted Direct Match orchestrator skeleton (RME-3B).

Feature flags RME_ENABLED + TDM_ENABLED default OFF. When OFF, no DB writes.
Full create/accept orchestration deferred to RME-4+ (tag insert, socket, push).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from services.block_safety import assert_pair_not_blocked
from services.match_intent_guard import assert_passenger_no_active_match_intent
from services.rme_request_queries import (
    MATCH_MODULE_TRUSTED_DIRECT,
    RME_INVITE_STATUS_CANCELLED,
    RME_INVITE_STATUS_DECLINED,
    RME_INVITE_STATUS_PENDING,
    RME_REQUEST_STATUS_CANCELLED,
    RME_REQUEST_STATUS_DECLINED,
    RME_REQUEST_STATUS_PENDING,
    cancel_pending_invites_for_request,
    expire_pending_invite_if_needed,
    expire_pending_request_if_needed,
    get_pending_invite_for_responder,
    get_pending_relationship_match_request,
    load_invite_by_id,
    load_request_by_id,
    update_invite_status_terminal,
    update_request_status_terminal,
)

logger = logging.getLogger(__name__)

TABLE_RELATIONSHIP_MATCH_EVENTS = "relationship_match_events"

_ENV_RME_ENABLED = "RME_ENABLED"
_ENV_TDM_ENABLED = "TDM_ENABLED"


class RmeFeatureDisabledError(Exception):
    code = "feature_disabled"
    message = "Relationship Match Engine is not available."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmeNotFoundError(Exception):
    code = "not_found"
    message = "Kayıt bulunamadı."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmeExpiredError(Exception):
    code = "expired"
    message = "İstek veya davet süresi doldu."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmeInvalidStateError(Exception):
    code = "invalid_state"
    message = "Geçersiz durum."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmeValidationError(ValueError):
    code = "validation_error"
    message = "Geçersiz istek."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def is_rme_enabled() -> bool:
    return _env_flag(_ENV_RME_ENABLED)


def is_tdm_enabled() -> bool:
    return _env_flag(_ENV_TDM_ENABLED)


def is_trusted_direct_match_enabled() -> bool:
    return is_rme_enabled() and is_tdm_enabled()


def _require_rme_tdm_enabled() -> None:
    if not is_trusted_direct_match_enabled():
        raise RmeFeatureDisabledError()


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _norm_user_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _norm_id(value: Any) -> str:
    return str(value or "").strip()


def _validate_create_payload(payload: Dict[str, Any]) -> None:
    required = (
        "responder_id",
        "relationship_connection_id",
        "pickup_lat",
        "pickup_lng",
        "dropoff_lat",
        "dropoff_lng",
        "offered_contribution_tl",
        "vehicle_preference",
    )
    missing = [key for key in required if payload.get(key) in (None, "")]
    if missing:
        raise RmeValidationError(f"Eksik alanlar: {', '.join(missing)}")


def _insert_audit_event(
    supabase,
    *,
    request_id: str,
    match_module: str,
    event_type: str,
    actor_id: Optional[str] = None,
    invite_id: Optional[str] = None,
    payload_json: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Append-only audit insert. Caller must ensure RME/TDM flags are ON.
    """
    rid = _norm_id(request_id)
    if not rid:
        return

    row: Dict[str, Any] = {
        "request_id": rid,
        "match_module": str(match_module or MATCH_MODULE_TRUSTED_DIRECT).strip().lower(),
        "event_type": str(event_type or "").strip(),
        "payload_json": payload_json or {},
    }
    actor_norm = _norm_user_id(actor_id)
    if actor_norm:
        row["actor_id"] = actor_norm
    invite_norm = _norm_id(invite_id)
    if invite_norm:
        row["invite_id"] = invite_norm

    supabase.table(TABLE_RELATIONSHIP_MATCH_EVENTS).insert(row).execute()


def _lazy_expire_request_row(supabase, request_row: dict) -> dict:
    if expire_pending_request_if_needed(supabase, request_row):
        refreshed = load_request_by_id(supabase, str(request_row.get("id") or ""))
        return refreshed or {**request_row, "status": "expired"}
    return request_row


def _lazy_expire_invite_row(supabase, invite_row: dict) -> dict:
    if expire_pending_invite_if_needed(supabase, invite_row):
        refreshed = load_invite_by_id(supabase, str(invite_row.get("id") or ""))
        return refreshed or {**invite_row, "status": "expired"}
    return invite_row


def _assert_request_pending_or_raise(request_row: dict) -> None:
    status = str(request_row.get("status") or "").strip().lower()
    if status == "expired":
        raise RmeExpiredError()
    if status != RME_REQUEST_STATUS_PENDING:
        raise RmeInvalidStateError()


def _assert_invite_pending_or_raise(invite_row: dict) -> None:
    status = str(invite_row.get("status") or "").strip().lower()
    if status == "expired":
        raise RmeExpiredError()
    if status != RME_INVITE_STATUS_PENDING:
        raise RmeInvalidStateError()


def create_request(
    supabase,
    requester_id: str,
    payload: Dict[str, Any],
    *,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> Dict[str, Any]:
    """
    Trusted Direct create skeleton — validates guards; insert deferred to RME-4.
    """
    _require_rme_tdm_enabled()
    _validate_create_payload(payload)

    requester_norm = _norm_user_id(requester_id)
    responder_norm = _norm_user_id(payload.get("responder_id"))
    if not requester_norm or not responder_norm:
        raise RmeValidationError("Geçersiz kullanıcı kimliği.")
    if requester_norm == responder_norm:
        raise RmeValidationError("Kendinize istek gönderemezsiniz.")

    assert_passenger_no_active_match_intent(
        supabase,
        requester_norm,
        match_module=match_module,
    )
    assert_pair_not_blocked(supabase, requester_norm, responder_norm)

    raise RmeInvalidStateError(
        "Trusted Direct create orchestration is not yet available (RME-4)."
    )


def cancel_request(
    supabase,
    requester_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """Passenger cancels a pending Trusted Direct request."""
    _require_rme_tdm_enabled()

    requester_norm = _norm_user_id(requester_id)
    rid = _norm_id(request_id)
    if not requester_norm or not rid:
        raise RmeNotFoundError()

    request_row = load_request_by_id(supabase, rid)
    if not request_row:
        raise RmeNotFoundError()
    if _norm_user_id(request_row.get("requester_id")) != requester_norm:
        raise RmeNotFoundError()

    request_row = _lazy_expire_request_row(supabase, request_row)
    _assert_request_pending_or_raise(request_row)

    now_iso = _utcnow_iso()
    updated = update_request_status_terminal(
        supabase,
        rid,
        from_status=RME_REQUEST_STATUS_PENDING,
        to_status=RME_REQUEST_STATUS_CANCELLED,
        extra_fields={
            "cancel_reason": "passenger_cancelled",
            "cancelled_at": now_iso,
            "responded_at": now_iso,
        },
    )
    if not updated:
        refreshed = load_request_by_id(supabase, rid)
        if refreshed:
            refreshed = _lazy_expire_request_row(supabase, refreshed)
            _assert_request_pending_or_raise(refreshed)
        raise RmeInvalidStateError()

    cancel_pending_invites_for_request(
        supabase,
        rid,
        decline_reason="passenger_cancelled",
    )
    _insert_audit_event(
        supabase,
        request_id=rid,
        match_module=str(request_row.get("match_module") or MATCH_MODULE_TRUSTED_DIRECT),
        event_type="request_cancelled",
        actor_id=requester_norm,
        payload_json={"cancel_reason": "passenger_cancelled"},
    )

    refreshed = load_request_by_id(supabase, rid)
    return {"request": refreshed}


def decline_invite(
    supabase,
    responder_id: str,
    invite_id: str,
) -> Dict[str, Any]:
    """Driver declines a pending Trusted Direct invite."""
    _require_rme_tdm_enabled()

    responder_norm = _norm_user_id(responder_id)
    iid = _norm_id(invite_id)
    if not responder_norm or not iid:
        raise RmeNotFoundError()

    invite_row = load_invite_by_id(supabase, iid)
    if not invite_row:
        raise RmeNotFoundError()
    if _norm_user_id(invite_row.get("responder_id")) != responder_norm:
        raise RmeNotFoundError()

    invite_row = _lazy_expire_invite_row(supabase, invite_row)
    _assert_invite_pending_or_raise(invite_row)

    request_id = _norm_id(invite_row.get("request_id"))
    request_row = load_request_by_id(supabase, request_id) if request_id else None
    if not request_row:
        raise RmeNotFoundError()

    request_row = _lazy_expire_request_row(supabase, request_row)
    _assert_request_pending_or_raise(request_row)

    now_iso = _utcnow_iso()
    invite_updated = update_invite_status_terminal(
        supabase,
        iid,
        from_status=RME_INVITE_STATUS_PENDING,
        to_status=RME_INVITE_STATUS_DECLINED,
        extra_fields={
            "decline_reason": "driver_declined",
            "responded_at": now_iso,
        },
    )
    if not invite_updated:
        raise RmeInvalidStateError()

    request_updated = update_request_status_terminal(
        supabase,
        request_id,
        from_status=RME_REQUEST_STATUS_PENDING,
        to_status=RME_REQUEST_STATUS_DECLINED,
        extra_fields={
            "decline_reason": "driver_declined",
            "responded_at": now_iso,
        },
    )
    if not request_updated:
        raise RmeInvalidStateError()

    _insert_audit_event(
        supabase,
        request_id=request_id,
        invite_id=iid,
        match_module=str(request_row.get("match_module") or MATCH_MODULE_TRUSTED_DIRECT),
        event_type="invite_declined",
        actor_id=responder_norm,
        payload_json={"decline_reason": "driver_declined"},
    )

    return {
        "invite": load_invite_by_id(supabase, iid),
        "request": load_request_by_id(supabase, request_id),
    }


def accept_invite(
    supabase,
    responder_id: str,
    invite_id: str,
) -> Dict[str, Any]:
    """
    Driver accept skeleton — validation only; tag insert deferred to RME-4.
    """
    _require_rme_tdm_enabled()

    responder_norm = _norm_user_id(responder_id)
    iid = _norm_id(invite_id)
    if not responder_norm or not iid:
        raise RmeNotFoundError()

    invite_row = load_invite_by_id(supabase, iid)
    if not invite_row:
        raise RmeNotFoundError()
    if _norm_user_id(invite_row.get("responder_id")) != responder_norm:
        raise RmeNotFoundError()

    invite_row = _lazy_expire_invite_row(supabase, invite_row)
    _assert_invite_pending_or_raise(invite_row)

    request_id = _norm_id(invite_row.get("request_id"))
    request_row = load_request_by_id(supabase, request_id) if request_id else None
    if not request_row:
        raise RmeNotFoundError()

    request_row = _lazy_expire_request_row(supabase, request_row)
    _assert_request_pending_or_raise(request_row)

    requester_norm = _norm_user_id(request_row.get("requester_id"))
    assert_pair_not_blocked(supabase, requester_norm, responder_norm)

    raise RmeInvalidStateError(
        "Trusted Direct accept orchestration is not yet available (RME-4)."
    )


def get_active_request(
    supabase,
    requester_id: str,
    *,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> Optional[Dict[str, Any]]:
    """Return passenger's pending Trusted Direct request (read-only + lazy expire)."""
    _require_rme_tdm_enabled()

    requester_norm = _norm_user_id(requester_id)
    if not requester_norm:
        return None

    request_row = get_pending_relationship_match_request(
        supabase,
        requester_norm,
        match_module=match_module,
    )
    if not request_row:
        return None

    request_row = _lazy_expire_request_row(supabase, request_row)
    status = str(request_row.get("status") or "").strip().lower()
    if status != RME_REQUEST_STATUS_PENDING:
        return None
    return request_row


def get_current_invite(
    supabase,
    responder_id: str,
) -> Optional[Dict[str, Any]]:
    """Return driver's pending Trusted Direct invite (read-only + lazy expire)."""
    _require_rme_tdm_enabled()

    responder_norm = _norm_user_id(responder_id)
    if not responder_norm:
        return None

    invite_row = get_pending_invite_for_responder(supabase, responder_norm)
    if not invite_row:
        return None

    invite_row = _lazy_expire_invite_row(supabase, invite_row)
    status = str(invite_row.get("status") or "").strip().lower()
    if status != RME_INVITE_STATUS_PENDING:
        return None
    return invite_row
