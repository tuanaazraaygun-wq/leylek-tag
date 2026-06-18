"""
RME relationship_match_requests / invites — query and terminal update helpers.

Read helpers used by match_intent_guard and TDM orchestrator.
Write helpers are invoked only when RME_ENABLED + TDM_ENABLED (orchestrator guard).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

TABLE_RELATIONSHIP_MATCH_REQUESTS = "relationship_match_requests"
TABLE_RELATIONSHIP_MATCH_INVITES = "relationship_match_invites"

RME_REQUEST_STATUS_PENDING = "pending_responder"
RME_REQUEST_STATUS_ACCEPTED = "accepted"
RME_REQUEST_STATUS_DECLINED = "declined"
RME_REQUEST_STATUS_EXPIRED = "expired"
RME_REQUEST_STATUS_CANCELLED = "cancelled"

RME_INVITE_STATUS_PENDING = "pending_responder"
RME_INVITE_STATUS_ACCEPTED = "accepted"
RME_INVITE_STATUS_DECLINED = "declined"
RME_INVITE_STATUS_EXPIRED = "expired"
RME_INVITE_STATUS_CANCELLED = "cancelled"

MATCH_MODULE_TRUSTED_DIRECT = "trusted_direct"

_REQUEST_SELECT = (
    "id, match_module, relationship_type, requester_id, responder_id, "
    "relationship_connection_id, status, expires_at, created_at, updated_at, "
    "vehicle_preference, pickup_lat, pickup_lng, pickup_label, "
    "dropoff_lat, dropoff_lng, dropoff_label, distance_km, distance_band, "
    "suggested_contribution_tl, offered_contribution_tl, matched_tag_id, "
    "decline_reason, cancel_reason, responded_at, cancelled_at, matched_at, "
    "idempotency_key"
)

_PENDING_REQUEST_SELECT = (
    "id, match_module, relationship_type, requester_id, responder_id, "
    "relationship_connection_id, status, expires_at, created_at, updated_at"
)

_INVITE_SELECT = (
    "id, request_id, responder_id, status, expires_at, responded_at, "
    "decline_reason, created_at, updated_at"
)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _norm_user_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _norm_module(value: Any) -> str:
    return str(value or MATCH_MODULE_TRUSTED_DIRECT).strip().lower()


def _norm_id(value: Any) -> str:
    return str(value or "").strip()


def _parse_expires_at(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _is_expired(expires_at: Any) -> bool:
    parsed = _parse_expires_at(expires_at)
    if parsed is None:
        return False
    return datetime.now(timezone.utc) >= parsed


def get_pending_relationship_match_request(
    supabase,
    requester_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> Optional[Dict[str, Any]]:
    """
    Return the active pending_responder request for requester + module, or None.
    """
    requester_norm = _norm_user_id(requester_id)
    module_norm = _norm_module(match_module)
    if not requester_norm:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .select(_PENDING_REQUEST_SELECT)
        .eq("requester_id", requester_norm)
        .eq("match_module", module_norm)
        .eq("status", RME_REQUEST_STATUS_PENDING)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def has_pending_relationship_match_request(
    supabase,
    requester_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> bool:
    """True if requester has a pending_responder RME request for the module."""
    return get_pending_relationship_match_request(
        supabase,
        requester_id,
        match_module=match_module,
    ) is not None


def load_request_by_id(supabase, request_id: str) -> Optional[Dict[str, Any]]:
    """Load a relationship_match_requests row by primary key."""
    rid = _norm_id(request_id)
    if not rid:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .select(_REQUEST_SELECT)
        .eq("id", rid)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def load_invite_by_id(supabase, invite_id: str) -> Optional[Dict[str, Any]]:
    """Load a relationship_match_invites row by primary key."""
    iid = _norm_id(invite_id)
    if not iid:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES)
        .select(_INVITE_SELECT)
        .eq("id", iid)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def get_pending_invite_for_responder(
    supabase,
    responder_id: str,
) -> Optional[Dict[str, Any]]:
    """Return the driver's pending_responder invite, if any."""
    responder_norm = _norm_user_id(responder_id)
    if not responder_norm:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES)
        .select(_INVITE_SELECT)
        .eq("responder_id", responder_norm)
        .eq("status", RME_INVITE_STATUS_PENDING)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def cancel_pending_invites_for_request(
    supabase,
    request_id: str,
    *,
    decline_reason: str = "system_cancelled",
) -> None:
    """Mark all pending_responder invites for a request as cancelled."""
    rid = _norm_id(request_id)
    if not rid:
        return

    now_iso = _utcnow_iso()
    supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES).update(
        {
            "status": RME_INVITE_STATUS_CANCELLED,
            "decline_reason": decline_reason,
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("request_id", rid).eq("status", RME_INVITE_STATUS_PENDING).execute()


def expire_pending_request_if_needed(supabase, request_row: dict) -> bool:
    """
    Expire a pending_responder request past TTL; cancel pending invite.
    Returns True if the row was expired.
    """
    status = str(request_row.get("status") or "").strip().lower()
    if status != RME_REQUEST_STATUS_PENDING:
        return False
    if not _is_expired(request_row.get("expires_at")):
        return False

    rid = _norm_id(request_row.get("id"))
    if not rid:
        return False

    now_iso = _utcnow_iso()
    supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS).update(
        {
            "status": RME_REQUEST_STATUS_EXPIRED,
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("id", rid).eq("status", RME_REQUEST_STATUS_PENDING).execute()
    cancel_pending_invites_for_request(
        supabase,
        rid,
        decline_reason="expired",
    )
    return True


def expire_pending_invite_if_needed(supabase, invite_row: dict) -> bool:
    """
    Expire a pending_responder invite past TTL.
    Returns True if the row was expired.
    """
    status = str(invite_row.get("status") or "").strip().lower()
    if status != RME_INVITE_STATUS_PENDING:
        return False
    if not _is_expired(invite_row.get("expires_at")):
        return False

    iid = _norm_id(invite_row.get("id"))
    if not iid:
        return False

    now_iso = _utcnow_iso()
    supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES).update(
        {
            "status": RME_INVITE_STATUS_EXPIRED,
            "decline_reason": "expired",
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("id", iid).eq("status", RME_INVITE_STATUS_PENDING).execute()
    return True


def update_request_status_terminal(
    supabase,
    request_id: str,
    *,
    from_status: str,
    to_status: str,
    extra_fields: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Optimistic terminal status update on relationship_match_requests.
    Returns True if a row was updated.
    """
    rid = _norm_id(request_id)
    from_norm = str(from_status or "").strip().lower()
    to_norm = str(to_status or "").strip().lower()
    if not rid or not from_norm or not to_norm:
        return False

    payload: Dict[str, Any] = {
        "status": to_norm,
        "updated_at": _utcnow_iso(),
    }
    if extra_fields:
        payload.update(extra_fields)

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .update(payload)
        .eq("id", rid)
        .eq("status", from_norm)
        .execute()
    )
    rows = result.data or []
    return bool(rows)


def update_invite_status_terminal(
    supabase,
    invite_id: str,
    *,
    from_status: str,
    to_status: str,
    extra_fields: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Optimistic terminal status update on relationship_match_invites.
    Returns True if a row was updated.
    """
    iid = _norm_id(invite_id)
    from_norm = str(from_status or "").strip().lower()
    to_norm = str(to_status or "").strip().lower()
    if not iid or not from_norm or not to_norm:
        return False

    payload: Dict[str, Any] = {
        "status": to_norm,
        "updated_at": _utcnow_iso(),
    }
    if extra_fields:
        payload.update(extra_fields)

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES)
        .update(payload)
        .eq("id", iid)
        .eq("status", from_norm)
        .execute()
    )
    rows = result.data or []
    return bool(rows)
