"""
Sequential Quick Match — P6-C1 service layer (read-only).

SELECT only; no INSERT/UPDATE/DELETE on quick_match_* or tags.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

TABLE_QUICK_MATCH_REQUESTS = "quick_match_requests"
TABLE_QUICK_MATCH_INVITES = "quick_match_invites"

REQUEST_STATUS_SEQUENCING = "sequencing"
INVITE_STATUS_PENDING = "pending_driver"

_REQUEST_SELECT_COLS = (
    "id, status, attempt_count, expires_at, matched_tag_id, matched_at, "
    "cancelled_at, exhausted_at, expired_at, distance_km, distance_band, "
    "suggested_contribution_tl, offered_contribution_tl, vehicle_preference, "
    "pickup_label, dropoff_label, passenger_id"
)

_INVITE_SELECT_COLS = "id, request_id, sequence_no, status, expires_at, driver_id"

_REQUEST_JOIN_COLS = "id, distance_band, offered_contribution_tl, pickup_label"


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)).strip().replace(",", "."))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        return default


def get_quick_match_radius_km() -> float:
    return _env_float("QUICK_MATCH_RADIUS_KM", 3.0)


def get_quick_match_request_ttl_seconds() -> int:
    return _env_int("QUICK_MATCH_REQUEST_TTL_SECONDS", 180)


def get_quick_match_invite_timeout_seconds() -> int:
    return _env_int("QUICK_MATCH_INVITE_TIMEOUT_SECONDS", 18)


def get_quick_match_max_attempts() -> int:
    return _env_int("QUICK_MATCH_MAX_ATTEMPTS", 8)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _norm_actor_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _parse_iso(dt_raw: Any) -> Optional[datetime]:
    if dt_raw is None or str(dt_raw).strip() == "":
        return None
    try:
        dt = datetime.fromisoformat(str(dt_raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError):
        return None


def _is_expired(expires_at: Any, *, now: Optional[datetime] = None) -> bool:
    exp_dt = _parse_iso(expires_at)
    if exp_dt is None:
        return False
    ref = now if now is not None else _utcnow()
    return exp_dt <= ref


def _effective_request_status(row: dict) -> str:
    st = str(row.get("status") or "").strip().lower()
    if st == REQUEST_STATUS_SEQUENCING and _is_expired(row.get("expires_at")):
        return "expired"
    return st


def _effective_invite_status(row: dict) -> str:
    st = str(row.get("status") or "").strip().lower()
    if st == INVITE_STATUS_PENDING and _is_expired(row.get("expires_at")):
        return "expired"
    return st


def _public_current_invite_summary(invite_row: Optional[dict]) -> Optional[Dict[str, Any]]:
    if not invite_row:
        return None
    return {
        "sequence_no": invite_row.get("sequence_no"),
        "status": _effective_invite_status(invite_row),
        "expires_at": invite_row.get("expires_at"),
    }


def _public_request_payload(row: dict, current_invite: Optional[dict] = None) -> Dict[str, Any]:
    return {
        "request_id": str(row.get("id") or ""),
        "status": _effective_request_status(row),
        "attempt_count": row.get("attempt_count"),
        "expires_at": row.get("expires_at"),
        "matched_tag_id": row.get("matched_tag_id"),
        "matched_at": row.get("matched_at"),
        "cancelled_at": row.get("cancelled_at"),
        "exhausted_at": row.get("exhausted_at"),
        "expired_at": row.get("expired_at"),
        "distance_km": row.get("distance_km"),
        "distance_band": row.get("distance_band"),
        "suggested_contribution_tl": row.get("suggested_contribution_tl"),
        "offered_contribution_tl": row.get("offered_contribution_tl"),
        "vehicle_preference": row.get("vehicle_preference"),
        "pickup_label": row.get("pickup_label"),
        "dropoff_label": row.get("dropoff_label"),
        "current_invite": _public_current_invite_summary(current_invite),
    }


def _public_invite_payload(invite_row: dict, request_row: dict) -> Dict[str, Any]:
    expires_at = invite_row.get("expires_at")
    exp_dt = _parse_iso(expires_at)
    expires_in = max(0, int((exp_dt - _utcnow()).total_seconds())) if exp_dt else 0
    return {
        "invite_id": str(invite_row.get("id") or ""),
        "request_id": str(invite_row.get("request_id") or ""),
        "sequence_no": invite_row.get("sequence_no"),
        "status": _effective_invite_status(invite_row),
        "distance_band": request_row.get("distance_band"),
        "offered_contribution_tl": request_row.get("offered_contribution_tl"),
        "pickup_label": request_row.get("pickup_label"),
        "expires_at": expires_at,
        "invite_expires_in_sec": expires_in,
    }


def _fetch_pending_invite_for_request(supabase, request_id: str) -> Optional[dict]:
    res = (
        supabase.table(TABLE_QUICK_MATCH_INVITES)
        .select(_INVITE_SELECT_COLS)
        .eq("request_id", request_id)
        .eq("status", INVITE_STATUS_PENDING)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def get_quick_match_request_status(
    supabase,
    actor_id: str,
    request_id: str,
) -> Optional[Dict[str, Any]]:
    """Passenger-owned request status (PII-safe). None if not found or not owner."""
    actor = _norm_actor_id(actor_id)
    rid = str(request_id or "").strip()
    if not rid:
        return None
    try:
        res = (
            supabase.table(TABLE_QUICK_MATCH_REQUESTS)
            .select(_REQUEST_SELECT_COLS)
            .eq("id", rid)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("quick_match_request_status select request_id=%s err=%s", rid[:36], exc)
        raise
    if not res.data:
        return None
    row = res.data[0]
    if _norm_actor_id(row.get("passenger_id")) != actor:
        return None
    pending = _fetch_pending_invite_for_request(supabase, rid)
    return _public_request_payload(row, pending)


def get_active_quick_match_request(
    supabase,
    actor_id: str,
) -> Optional[Dict[str, Any]]:
    """Active sequencing request for passenger (PII-safe). None if none."""
    actor = _norm_actor_id(actor_id)
    try:
        res = (
            supabase.table(TABLE_QUICK_MATCH_REQUESTS)
            .select(_REQUEST_SELECT_COLS)
            .eq("passenger_id", actor)
            .eq("status", REQUEST_STATUS_SEQUENCING)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("quick_match_request_active select actor=%s err=%s", actor[:36], exc)
        raise
    if not res.data:
        return None
    row = res.data[0]
    rid = str(row.get("id") or "")
    pending = _fetch_pending_invite_for_request(supabase, rid) if rid else None
    return _public_request_payload(row, pending)


def get_current_quick_match_invite(
    supabase,
    actor_id: str,
) -> Optional[Dict[str, Any]]:
    """Current pending_driver invite for driver (PII-safe). None if none."""
    actor = _norm_actor_id(actor_id)
    try:
        res = (
            supabase.table(TABLE_QUICK_MATCH_INVITES)
            .select(_INVITE_SELECT_COLS)
            .eq("driver_id", actor)
            .eq("status", INVITE_STATUS_PENDING)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("quick_match_invite_current select actor=%s err=%s", actor[:36], exc)
        raise
    if not res.data:
        return None
    invite = res.data[0]
    req_id = str(invite.get("request_id") or "").strip()
    if not req_id:
        return None
    try:
        req_res = (
            supabase.table(TABLE_QUICK_MATCH_REQUESTS)
            .select(_REQUEST_JOIN_COLS)
            .eq("id", req_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("quick_match_invite_current select request_id=%s err=%s", req_id[:36], exc)
        raise
    if not req_res.data:
        return None
    return _public_invite_payload(invite, req_res.data[0])
