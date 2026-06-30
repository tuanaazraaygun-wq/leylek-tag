"""
RME relationship_match_requests / invites — query and terminal update helpers.

Read helpers used by match_intent_guard and TDM orchestrator.
Write helpers are invoked only when RME_ENABLED + TDM_ENABLED (orchestrator guard).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

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

RME_DECLINE_REASON_DRIVER = "driver_declined"
RME_DECLINE_REASON_RESPONDER = "responder_declined"

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

_REQUEST_LATEST_PASSENGER_SELECT = (
    "id, match_module, requester_id, responder_id, status, expires_at, "
    "matched_tag_id, matched_at, responded_at, cancelled_at, created_at, updated_at"
)

_REQUEST_PUBLIC_SELECT = (
    "id, status, pickup_label, dropoff_label, distance_km, distance_band, "
    "offered_contribution_tl, vehicle_preference, created_at"
)

_INVITE_SELECT = (
    "id, request_id, responder_id, status, expires_at, responded_at, "
    "decline_reason, created_at, updated_at"
)

TDM_MIN_TRIP_KM = 0.8
TDM_MAX_TRIP_KM = 20.0


def _env_int(name: str, default: int) -> int:
    import os

    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def get_tdm_request_ttl_seconds() -> int:
    return _env_int("TDM_REQUEST_TTL_SECONDS", 180)


def get_tdm_invite_ttl_seconds() -> int:
    return _env_int("TDM_INVITE_TTL_SECONDS", 180)


def _is_unique_violation(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "duplicate key" in msg or "unique constraint" in msg or "23505" in msg


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


def get_latest_relationship_match_request_for_requester(
    supabase,
    requester_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> Optional[Dict[str, Any]]:
    """Most recent relationship_match_requests row for requester + module (any status)."""
    requester_norm = _norm_user_id(requester_id)
    module_norm = _norm_module(match_module)
    if not requester_norm:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .select(_REQUEST_LATEST_PASSENGER_SELECT)
        .eq("requester_id", requester_norm)
        .eq("match_module", module_norm)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


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


def load_request_public_by_id(supabase, request_id: str) -> Optional[Dict[str, Any]]:
    """Load PII-safe request summary for driver current-invite card (no coords/ids)."""
    rid = _norm_id(request_id)
    if not rid:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .select(_REQUEST_PUBLIC_SELECT)
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


def get_pending_invite_for_request(
    supabase,
    request_id: str,
) -> Optional[Dict[str, Any]]:
    """Return pending_responder invite for a request, if any."""
    rid = _norm_id(request_id)
    if not rid:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES)
        .select(_INVITE_SELECT)
        .eq("request_id", rid)
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


def load_request_by_idempotency_key(
    supabase,
    requester_id: str,
    idempotency_key: str,
) -> Optional[Dict[str, Any]]:
    """Load relationship_match_requests row by requester + idempotency key."""
    requester_norm = _norm_user_id(requester_id)
    key = str(idempotency_key or "").strip()
    if not requester_norm or not key:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .select(_REQUEST_SELECT)
        .eq("requester_id", requester_norm)
        .eq("idempotency_key", key)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def expire_stale_pending_for_requester(
    supabase,
    requester_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> List[str]:
    """
    Lazy-expire all pending_responder requests for requester + module past TTL.
    Returns list of expired request ids.
    """
    requester_norm = _norm_user_id(requester_id)
    module_norm = _norm_module(match_module)
    if not requester_norm:
        return []

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .select("id, status, expires_at")
        .eq("requester_id", requester_norm)
        .eq("match_module", module_norm)
        .eq("status", RME_REQUEST_STATUS_PENDING)
        .execute()
    )
    expired_ids: List[str] = []
    for row in result.data or []:
        if isinstance(row, dict) and expire_pending_request_if_needed(supabase, row):
            rid = _norm_id(row.get("id"))
            if rid:
                expired_ids.append(rid)
    return expired_ids


def expire_stale_pending_invites_for_responder(
    supabase,
    responder_id: str,
) -> List[str]:
    """Lazy-expire pending invites for responder past TTL. Returns expired invite ids."""
    responder_norm = _norm_user_id(responder_id)
    if not responder_norm:
        return []

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES)
        .select(_INVITE_SELECT)
        .eq("responder_id", responder_norm)
        .eq("status", RME_INVITE_STATUS_PENDING)
        .execute()
    )
    expired_ids: List[str] = []
    for row in result.data or []:
        if isinstance(row, dict) and expire_pending_invite_if_needed(supabase, row):
            iid = _norm_id(row.get("id"))
            if iid:
                expired_ids.append(iid)
    return expired_ids


def insert_relationship_match_request(
    supabase,
    row: Dict[str, Any],
) -> Dict[str, Any]:
    """Insert relationship_match_requests; returns inserted row."""
    result = supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS).insert(row).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("relationship_match_requests insert returned empty data")
    inserted = rows[0]
    if not isinstance(inserted, dict):
        raise RuntimeError("relationship_match_requests insert returned invalid row")
    return inserted


def insert_relationship_match_invite(
    supabase,
    row: Dict[str, Any],
) -> Dict[str, Any]:
    """Insert relationship_match_invites; returns inserted row."""
    result = supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES).insert(row).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("relationship_match_invites insert returned empty data")
    inserted = rows[0]
    if not isinstance(inserted, dict):
        raise RuntimeError("relationship_match_invites insert returned invalid row")
    return inserted


def get_latest_invite_for_request(
    supabase,
    request_id: str,
) -> Optional[Dict[str, Any]]:
    """Return the most recent invite for a request (any status)."""
    rid = _norm_id(request_id)
    if not rid:
        return None

    pending = get_pending_invite_for_request(supabase, rid)
    if pending:
        return pending

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES)
        .select(_INVITE_SELECT)
        .eq("request_id", rid)
        .order("created_at", desc=True)
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
    Expire a pending_responder request past TTL; cancel pending invites.
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


def _expire_parent_request_if_pending(
    supabase,
    request_id: str,
) -> None:
    """Mark parent request expired when still pending_responder (TDM single-invite cascade)."""
    rid = _norm_id(request_id)
    if not rid:
        return
    now_iso = _utcnow_iso()
    supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS).update(
        {
            "status": RME_REQUEST_STATUS_EXPIRED,
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("id", rid).eq("status", RME_REQUEST_STATUS_PENDING).execute()


def expire_pending_invite_if_needed(supabase, invite_row: dict) -> bool:
    """
    Expire a pending_responder invite past TTL; cascade parent request to expired.
    Returns True if the invite row was expired.
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

    request_id = _norm_id(invite_row.get("request_id"))
    if request_id:
        _expire_parent_request_if_pending(supabase, request_id)
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
    _ = result  # Sync client may not return updated rows without PostgREST select
    refreshed = load_request_by_id(supabase, rid)
    if not refreshed:
        return False
    return str(refreshed.get("status") or "").strip().lower() == to_norm


def ensure_request_declined_terminal(
    supabase,
    request_id: str,
    *,
    decline_reason: str = RME_DECLINE_REASON_DRIVER,
) -> bool:
    """
    Repair/idempotent: pending_responder → declined.
    Returns True when request is declined after call (updated or already terminal).
    """
    rid = _norm_id(request_id)
    if not rid:
        return False

    row = load_request_by_id(supabase, rid)
    if not row:
        return False

    status = str(row.get("status") or "").strip().lower()
    if status == RME_REQUEST_STATUS_DECLINED:
        return True
    if status != RME_REQUEST_STATUS_PENDING:
        return False

    now_iso = _utcnow_iso()
    updated = update_request_status_terminal(
        supabase,
        rid,
        from_status=RME_REQUEST_STATUS_PENDING,
        to_status=RME_REQUEST_STATUS_DECLINED,
        extra_fields={
            "decline_reason": decline_reason,
            "responded_at": now_iso,
        },
    )
    if updated:
        return True

    refreshed = load_request_by_id(supabase, rid)
    return str(refreshed.get("status") or "").strip().lower() == RME_REQUEST_STATUS_DECLINED if refreshed else False


ORPHAN_TAG_LOOKBACK_SECONDS = 120


def load_tag_for_accept_replay(supabase, tag_id: str) -> Optional[Dict[str, Any]]:
    """Minimal tag row for accept idempotent replay."""
    tid = _norm_id(tag_id)
    if not tid:
        return None

    result = (
        supabase.table("tags")
        .select("id, status, match_channel")
        .eq("id", tid)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def find_orphan_matched_tag_for_accept(
    supabase,
    *,
    requester_id: str,
    responder_id: str,
    lookback_seconds: int = ORPHAN_TAG_LOOKBACK_SECONDS,
) -> Optional[Dict[str, Any]]:
    """
    Half-accept recovery: invite accepted, request still pending, tag insert succeeded
    but request update failed — locate recent matched trusted tag for the pair.
    """
    requester_norm = _norm_user_id(requester_id)
    responder_norm = _norm_user_id(responder_id)
    if not requester_norm or not responder_norm:
        return None

    since = (
        datetime.now(timezone.utc) - timedelta(seconds=max(30, lookback_seconds))
    ).replace(microsecond=0).isoformat()

    result = (
        supabase.table("tags")
        .select("id, status, match_channel, matched_at")
        .eq("type", "normal")
        .eq("match_channel", "trusted")
        .eq("status", "matched")
        .eq("passenger_id", requester_norm)
        .eq("driver_id", responder_norm)
        .gte("matched_at", since)
        .order("matched_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def accept_invite_optimistic(
    supabase,
    invite_id: str,
    responder_id: str,
    *,
    responded_at: str,
) -> Optional[Dict[str, Any]]:
    """Optimistic pending_responder → accepted for a single responder invite."""
    iid = _norm_id(invite_id)
    responder_norm = _norm_user_id(responder_id)
    if not iid or not responder_norm:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_INVITES)
        .update(
            {
                "status": RME_INVITE_STATUS_ACCEPTED,
                "responded_at": responded_at,
                "updated_at": responded_at,
            }
        )
        .eq("id", iid)
        .eq("responder_id", responder_norm)
        .eq("status", RME_INVITE_STATUS_PENDING)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def update_request_accept_with_matched_tag(
    supabase,
    request_id: str,
    matched_tag_id: str,
    *,
    matched_at: str,
    responded_at: str,
) -> bool:
    """Optimistic pending_responder → accepted with matched_tag_id anchor."""
    return update_request_status_terminal(
        supabase,
        request_id,
        from_status=RME_REQUEST_STATUS_PENDING,
        to_status=RME_REQUEST_STATUS_ACCEPTED,
        extra_fields={
            "matched_tag_id": matched_tag_id,
            "matched_at": matched_at,
            "responded_at": responded_at,
        },
    )


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
    _ = result
    refreshed = load_invite_by_id(supabase, iid)
    if not refreshed:
        return False
    return str(refreshed.get("status") or "").strip().lower() == to_norm
