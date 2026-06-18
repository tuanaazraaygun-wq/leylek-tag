"""
Relationship Match Engine — Trusted Direct Match orchestrator (RME-3C + RME-4B accept).

Feature flags RME_ENABLED + TDM_ENABLED default OFF. When OFF, no DB writes.
Socket/push deferred to post-commit server delegate (optional).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

from services.block_safety import assert_pair_not_blocked
from services.match_intent_guard import ActiveMatchIntentError, assert_passenger_no_active_match_intent
from services.quick_match import (
    QuickMatchValidationError,
    _compute_unified_contribution_bounds,
    _haversine_km,
    _is_unique_violation,
    _matched_tag_contribution_tl,
    _quick_match_distance_band,
    _quick_match_trip_metrics,
    _quick_match_vehicle_kind,
    _validate_lat_lng,
    _validate_offered_contribution_tl,
)
from services.rme_request_queries import (
    MATCH_MODULE_TRUSTED_DIRECT,
    RME_INVITE_STATUS_ACCEPTED,
    RME_INVITE_STATUS_PENDING,
    RME_REQUEST_STATUS_ACCEPTED,
    RME_REQUEST_STATUS_CANCELLED,
    RME_REQUEST_STATUS_DECLINED,
    RME_REQUEST_STATUS_PENDING,
    TDM_MAX_TRIP_KM,
    TDM_MIN_TRIP_KM,
    accept_invite_optimistic,
    cancel_pending_invites_for_request,
    expire_pending_invite_if_needed,
    expire_pending_request_if_needed,
    expire_stale_pending_for_requester,
    expire_stale_pending_invites_for_responder,
    find_orphan_matched_tag_for_accept,
    get_latest_invite_for_request,
    get_pending_invite_for_responder,
    get_pending_relationship_match_request,
    get_tdm_invite_ttl_seconds,
    get_tdm_request_ttl_seconds,
    insert_relationship_match_invite,
    insert_relationship_match_request,
    load_invite_by_id,
    load_request_by_id,
    load_request_by_idempotency_key,
    load_tag_for_accept_replay,
    update_invite_status_terminal,
    update_request_accept_with_matched_tag,
    update_request_status_terminal,
)
from services.rme_trusted_connection import (
    RmeConnectionNotActiveError,
    RmeTrustedFieldError,
    assert_active_trusted_connection_for_direct_match,
    assert_responder_eligible,
    assert_vehicle_preference_compatible,
)

logger = logging.getLogger(__name__)

TABLE_RELATIONSHIP_MATCH_EVENTS = "relationship_match_events"

_ENV_RME_ENABLED = "RME_ENABLED"
_ENV_TDM_ENABLED = "TDM_ENABLED"

RouteTripMetricsFn = Callable[[float, float, float, float], Awaitable[Dict[str, Any]]]
DriverBusyFn = Callable[[str], bool]
PassengerBlockingTagFn = Callable[[str], bool]
TagsInsertFn = Callable[..., Any]
BuildSnapshotFn = Callable[[Any, str], Dict[str, Any]]

TAG_TYPE_NORMAL = "normal"
MATCH_CHANNEL_TRUSTED = "trusted"

_COORD_DECIMALS = 5


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


class RmeIdempotencyConflictError(Exception):
    code = "idempotency_conflict"
    message = "Aynı idempotency anahtarı farklı istekle kullanılamaz."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmeDriverBusyError(Exception):
    code = "driver_busy"
    message = "Sürücü şu an müsait değil."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmePassengerBusyError(Exception):
    code = "passenger_busy"
    message = "Yolcu başka bir yolculukta."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


class RmeDriverInvitePendingError(Exception):
    code = "driver_invite_pending"
    message = "Sürücünün bekleyen bir daveti var."

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


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _utcnow_iso() -> str:
    return _utcnow().replace(microsecond=0).isoformat()


def _norm_user_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _norm_id(value: Any) -> str:
    return str(value or "").strip()


def _round_coord(value: float) -> float:
    return round(float(value), _COORD_DECIMALS)


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


def _normalize_label(raw: Any, *, max_len: int = 200) -> Optional[str]:
    text = str(raw or "").strip()
    if not text:
        return None
    if len(text) > max_len:
        raise RmeValidationError(f"Etiket en fazla {max_len} karakter olabilir.")
    return text


async def _validate_tdm_trip_fields(
    payload: Dict[str, Any],
    *,
    route_trip_metrics_fn: RouteTripMetricsFn,
) -> Dict[str, Any]:
    try:
        pickup_lat, pickup_lng = _validate_lat_lng(
            payload.get("pickup_lat"), payload.get("pickup_lng"), label="Alış"
        )
        dropoff_lat, dropoff_lng = _validate_lat_lng(
            payload.get("dropoff_lat"), payload.get("dropoff_lng"), label="Varış"
        )
    except QuickMatchValidationError as exc:
        raise RmeValidationError(str(exc)) from exc

    pickup_label = _normalize_label(payload.get("pickup_label"))
    dropoff_label = _normalize_label(payload.get("dropoff_label"))

    air_km = _haversine_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
    if air_km < 0.8:
        raise RmeValidationError("Alış ve varış noktası çok yakın")

    trip_metrics = await _quick_match_trip_metrics(
        route_trip_metrics_fn,
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng,
    )
    distance_km = float(trip_metrics.get("distance_km") or 0.0)
    if distance_km <= TDM_MIN_TRIP_KM:
        raise RmeValidationError("Yolculuk mesafesi çok kısa")
    if distance_km > TDM_MAX_TRIP_KM:
        raise RmeValidationError("Trusted Direct en fazla 20 km mesafede kullanılabilir")

    vehicle_kind = _quick_match_vehicle_kind(payload.get("vehicle_preference"))
    if vehicle_kind not in ("car", "motorcycle"):
        raise RmeValidationError("Geçersiz araç tercihi.")

    suggested, max_contribution = _compute_unified_contribution_bounds(
        distance_km=distance_km,
        duration_min=int(trip_metrics.get("duration_min") or 5),
        traffic_ratio=float(trip_metrics.get("traffic_ratio") or 1.0),
        vehicle_kind=vehicle_kind,
        peak=bool(trip_metrics.get("peak")),
    )

    try:
        offered = _validate_offered_contribution_tl(
            payload.get("offered_contribution_tl"),
            suggested_contribution_tl=suggested,
            max_contribution_tl=max_contribution,
        )
    except QuickMatchValidationError as exc:
        raise RmeValidationError(str(exc)) from exc

    return {
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "pickup_label": pickup_label,
        "dropoff_lat": dropoff_lat,
        "dropoff_lng": dropoff_lng,
        "dropoff_label": dropoff_label,
        "distance_km": round(distance_km, 2),
        "distance_band": _quick_match_distance_band(distance_km),
        "suggested_contribution_tl": suggested,
        "offered_contribution_tl": offered,
        "vehicle_preference": vehicle_kind,
    }


def _idempotency_semantic_key(
    *,
    responder_id: str,
    relationship_connection_id: str,
    validated: Dict[str, Any],
) -> Tuple[Any, ...]:
    return (
        _norm_user_id(responder_id),
        _norm_id(relationship_connection_id),
        _round_coord(validated["pickup_lat"]),
        _round_coord(validated["pickup_lng"]),
        _round_coord(validated["dropoff_lat"]),
        _round_coord(validated["dropoff_lng"]),
        validated.get("pickup_label"),
        validated.get("dropoff_label"),
        int(validated["offered_contribution_tl"]),
        str(validated["vehicle_preference"]),
    )


def _existing_idempotency_semantic_key(row: dict) -> Tuple[Any, ...]:
    return (
        _norm_user_id(row.get("responder_id")),
        _norm_id(row.get("relationship_connection_id")),
        _round_coord(row.get("pickup_lat") or 0),
        _round_coord(row.get("pickup_lng") or 0),
        _round_coord(row.get("dropoff_lat") or 0),
        _round_coord(row.get("dropoff_lng") or 0),
        row.get("pickup_label"),
        row.get("dropoff_label"),
        int(row.get("offered_contribution_tl") or 0),
        str(row.get("vehicle_preference") or ""),
    )


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


def _audit_request_expired(
    supabase,
    request_row: dict,
    *,
    reason: str = "ttl",
) -> None:
    rid = _norm_id(request_row.get("id"))
    if not rid:
        return
    _insert_audit_event(
        supabase,
        request_id=rid,
        match_module=str(request_row.get("match_module") or MATCH_MODULE_TRUSTED_DIRECT),
        event_type="request_expired",
        payload_json={"reason": reason},
    )


def _audit_invite_expired(
    supabase,
    invite_row: dict,
    request_row: Optional[dict],
    *,
    reason: str = "ttl",
) -> None:
    request_id = _norm_id((request_row or {}).get("id") or invite_row.get("request_id"))
    if not request_id:
        return
    _insert_audit_event(
        supabase,
        request_id=request_id,
        invite_id=str(invite_row.get("id") or ""),
        match_module=str((request_row or {}).get("match_module") or MATCH_MODULE_TRUSTED_DIRECT),
        event_type="invite_expired",
        payload_json={"reason": reason},
    )


def _lazy_expire_request_row(supabase, request_row: dict) -> dict:
    if expire_pending_request_if_needed(supabase, request_row):
        _audit_request_expired(supabase, request_row)
        refreshed = load_request_by_id(supabase, str(request_row.get("id") or ""))
        return refreshed or {**request_row, "status": "expired"}
    return request_row


def _lazy_expire_invite_row(supabase, invite_row: dict) -> dict:
    if expire_pending_invite_if_needed(supabase, invite_row):
        request_id = _norm_id(invite_row.get("request_id"))
        request_row = load_request_by_id(supabase, request_id) if request_id else None
        _audit_invite_expired(supabase, invite_row, request_row)
        if request_row and str(request_row.get("status") or "").lower() == "expired":
            _audit_request_expired(supabase, request_row, reason="invite_ttl")
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


def _public_accept_tag_payload(tag_row: dict) -> Dict[str, Any]:
    return {
        "id": str(tag_row.get("id") or ""),
        "status": str(tag_row.get("status") or ""),
        "match_channel": str(tag_row.get("match_channel") or ""),
    }


def _public_accept_request_payload(request_row: dict) -> Dict[str, Any]:
    return {
        "id": str(request_row.get("id") or ""),
        "status": str(request_row.get("status") or ""),
        "matched_tag_id": request_row.get("matched_tag_id"),
        "matched_at": request_row.get("matched_at"),
    }


def _public_accept_invite_payload(invite_row: dict) -> Dict[str, Any]:
    return {
        "id": str(invite_row.get("id") or ""),
        "status": str(invite_row.get("status") or RME_INVITE_STATUS_ACCEPTED),
        "responded_at": invite_row.get("responded_at"),
    }


def _accept_response(
    invite_row: dict,
    request_row: dict,
    tag_row: dict,
) -> Dict[str, Any]:
    return {
        "tag": _public_accept_tag_payload(tag_row),
        "request": _public_accept_request_payload(request_row),
        "invite": _public_accept_invite_payload(invite_row),
    }


def _try_full_accept_replay(
    supabase,
    invite_row: dict,
    request_row: dict,
) -> Optional[Dict[str, Any]]:
    invite_status = str(invite_row.get("status") or "").strip().lower()
    if invite_status != RME_INVITE_STATUS_ACCEPTED:
        return None

    req_status = str(request_row.get("status") or "").strip().lower()
    matched_tag_id = _norm_id(request_row.get("matched_tag_id"))
    if req_status != RME_REQUEST_STATUS_ACCEPTED or not matched_tag_id:
        return None

    tag_row = load_tag_for_accept_replay(supabase, matched_tag_id)
    if not tag_row:
        return None

    return _accept_response(invite_row, request_row, tag_row)


def _try_half_accept_orphan_recovery(
    supabase,
    invite_row: dict,
    request_row: dict,
    *,
    requester_id: str,
    responder_id: str,
) -> Optional[Dict[str, Any]]:
    invite_status = str(invite_row.get("status") or "").strip().lower()
    if invite_status != RME_INVITE_STATUS_ACCEPTED:
        return None

    req_status = str(request_row.get("status") or "").strip().lower()
    if req_status != RME_REQUEST_STATUS_PENDING:
        return None
    if _norm_id(request_row.get("matched_tag_id")):
        return None

    orphan_tag = find_orphan_matched_tag_for_accept(
        supabase,
        requester_id=requester_id,
        responder_id=responder_id,
    )
    if not orphan_tag:
        return None

    tag_id = _norm_id(orphan_tag.get("id"))
    if not tag_id:
        return None

    request_id = _norm_id(request_row.get("id"))
    matched_at = str(orphan_tag.get("matched_at") or _utcnow_iso())
    responded_at = str(invite_row.get("responded_at") or matched_at)

    updated = update_request_accept_with_matched_tag(
        supabase,
        request_id,
        tag_id,
        matched_at=matched_at,
        responded_at=responded_at,
    )
    if not updated:
        refreshed = load_request_by_id(supabase, request_id)
        if refreshed:
            replay = _try_full_accept_replay(supabase, invite_row, refreshed)
            if replay:
                return replay
        return None

    logger.info(
        "tdm_accept orphan_recovery request_id=%s invite_id=%s tag_id=%s",
        request_id[:36] if request_id else "",
        str(invite_row.get("id") or "")[:36],
        tag_id[:36],
    )

    refreshed_request = load_request_by_id(supabase, request_id) or {
        **request_row,
        "status": RME_REQUEST_STATUS_ACCEPTED,
        "matched_tag_id": tag_id,
        "matched_at": matched_at,
    }
    return _accept_response(invite_row, refreshed_request, orphan_tag)


def _audit_accept_success(
    supabase,
    *,
    request_id: str,
    invite_id: str,
    match_module: str,
    actor_id: str,
    matched_tag_id: str,
) -> None:
    module = str(match_module or MATCH_MODULE_TRUSTED_DIRECT)
    tag_id_short = matched_tag_id[:36] if matched_tag_id else ""
    _insert_audit_event(
        supabase,
        request_id=request_id,
        invite_id=invite_id,
        match_module=module,
        event_type="invite_accepted",
        actor_id=actor_id,
        payload_json={"matched_tag_id": tag_id_short},
    )
    _insert_audit_event(
        supabase,
        request_id=request_id,
        invite_id=invite_id,
        match_module=module,
        event_type="request_accepted",
        actor_id=actor_id,
        payload_json={"matched_tag_id": tag_id_short},
    )
    _insert_audit_event(
        supabase,
        request_id=request_id,
        invite_id=invite_id,
        match_module=module,
        event_type="matched_tag_created",
        actor_id=actor_id,
        payload_json={"matched_tag_id": tag_id_short},
    )


def _build_create_replay_response(
    supabase,
    request_row: dict,
) -> Dict[str, Any]:
    request_id = _norm_id(request_row.get("id"))
    invite_row = (
        get_latest_invite_for_request(supabase, request_id) if request_id else None
    )
    return {
        "request": request_row,
        "invite": invite_row,
        "idempotent_replay": True,
    }


def _assert_driver_available_for_create(
    supabase,
    responder_id: str,
    *,
    driver_busy_fn: DriverBusyFn,
) -> None:
    expire_stale_pending_invites_for_responder(supabase, responder_id)
    if driver_busy_fn(responder_id):
        raise RmeDriverBusyError()
    pending_invite = get_pending_invite_for_responder(supabase, responder_id)
    if pending_invite:
        pending_invite = _lazy_expire_invite_row(supabase, pending_invite)
        if str(pending_invite.get("status") or "").lower() == RME_INVITE_STATUS_PENDING:
            raise RmeDriverInvitePendingError()


async def create_request(
    supabase,
    requester_id: str,
    payload: Dict[str, Any],
    *,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
    route_trip_metrics_fn: RouteTripMetricsFn,
    driver_busy_fn: DriverBusyFn,
) -> Dict[str, Any]:
    """Trusted Direct create — request + single invite + audit."""
    _require_rme_tdm_enabled()
    _validate_create_payload(payload)

    requester_norm = _norm_user_id(requester_id)
    responder_norm = _norm_user_id(payload.get("responder_id"))
    connection_id = _norm_id(payload.get("relationship_connection_id"))
    if not requester_norm or not responder_norm:
        raise RmeValidationError("Geçersiz kullanıcı kimliği.")
    if requester_norm == responder_norm:
        raise RmeValidationError("Kendinize istek gönderemezsiniz.")

    for expired_id in expire_stale_pending_for_requester(
        supabase, requester_norm, match_module=match_module
    ):
        expired_row = load_request_by_id(supabase, expired_id)
        if expired_row:
            _audit_request_expired(supabase, expired_row)

    idempotency_key = str(payload.get("idempotency_key") or "").strip() or None
    validated = await _validate_tdm_trip_fields(
        payload,
        route_trip_metrics_fn=route_trip_metrics_fn,
    )

    if idempotency_key:
        existing = load_request_by_idempotency_key(
            supabase, requester_norm, idempotency_key
        )
        if existing:
            existing = _lazy_expire_request_row(supabase, existing)
            expected = _idempotency_semantic_key(
                responder_id=responder_norm,
                relationship_connection_id=connection_id,
                validated=validated,
            )
            actual = _existing_idempotency_semantic_key(existing)
            if expected != actual:
                raise RmeIdempotencyConflictError()
            return _build_create_replay_response(supabase, existing)

    assert_passenger_no_active_match_intent(
        supabase,
        requester_norm,
        match_module=match_module,
    )
    assert_pair_not_blocked(supabase, requester_norm, responder_norm)

    try:
        assert_active_trusted_connection_for_direct_match(
            supabase,
            requester_id=requester_norm,
            responder_id=responder_norm,
            relationship_connection_id=connection_id,
        )
    except RmeTrustedFieldError as exc:
        raise RmeValidationError(str(exc)) from exc

    assert_responder_eligible(supabase, responder_norm)
    assert_vehicle_preference_compatible(
        supabase,
        responder_norm,
        validated["vehicle_preference"],
    )
    _assert_driver_available_for_create(
        supabase,
        responder_norm,
        driver_busy_fn=driver_busy_fn,
    )

    now = _utcnow()
    request_expires = (
        now + timedelta(seconds=get_tdm_request_ttl_seconds())
    ).replace(microsecond=0).isoformat()
    invite_expires = (
        now + timedelta(seconds=get_tdm_invite_ttl_seconds())
    ).replace(microsecond=0).isoformat()

    insert_request = {
        "match_module": match_module,
        "relationship_type": "trusted",
        "requester_id": requester_norm,
        "responder_id": responder_norm,
        "relationship_connection_id": connection_id,
        "vehicle_preference": validated["vehicle_preference"],
        "pickup_lat": validated["pickup_lat"],
        "pickup_lng": validated["pickup_lng"],
        "pickup_label": validated["pickup_label"],
        "dropoff_lat": validated["dropoff_lat"],
        "dropoff_lng": validated["dropoff_lng"],
        "dropoff_label": validated["dropoff_label"],
        "distance_km": validated["distance_km"],
        "distance_band": validated["distance_band"],
        "suggested_contribution_tl": validated["suggested_contribution_tl"],
        "offered_contribution_tl": validated["offered_contribution_tl"],
        "status": RME_REQUEST_STATUS_PENDING,
        "expires_at": request_expires,
        "idempotency_key": idempotency_key,
    }

    try:
        request_row = insert_relationship_match_request(supabase, insert_request)
    except Exception as exc:
        if _is_unique_violation(exc):
            if idempotency_key:
                replay = load_request_by_idempotency_key(
                    supabase, requester_norm, idempotency_key
                )
                if replay:
                    return _build_create_replay_response(supabase, replay)
            raise ActiveMatchIntentError() from exc
        raise

    request_id = _norm_id(request_row.get("id"))
    invite_insert = {
        "request_id": request_id,
        "responder_id": responder_norm,
        "status": RME_INVITE_STATUS_PENDING,
        "expires_at": invite_expires,
    }

    try:
        invite_row = insert_relationship_match_invite(supabase, invite_insert)
    except Exception as exc:
        logger.error(
            "tdm_create invite_insert_failed request_id=%s err=%s",
            request_id[:36] if request_id else "",
            exc,
        )
        if request_id:
            update_request_status_terminal(
                supabase,
                request_id,
                from_status=RME_REQUEST_STATUS_PENDING,
                to_status=RME_REQUEST_STATUS_CANCELLED,
                extra_fields={
                    "cancel_reason": "system_error",
                    "cancelled_at": _utcnow_iso(),
                    "responded_at": _utcnow_iso(),
                },
            )
        raise

    _insert_audit_event(
        supabase,
        request_id=request_id,
        match_module=match_module,
        event_type="request_created",
        actor_id=requester_norm,
        payload_json={
            "responder_id": responder_norm,
            "relationship_connection_id": connection_id,
        },
    )
    _insert_audit_event(
        supabase,
        request_id=request_id,
        invite_id=str(invite_row.get("id") or ""),
        match_module=match_module,
        event_type="invite_created",
        actor_id=requester_norm,
        payload_json={"responder_id": responder_norm},
    )

    return {
        "request": load_request_by_id(supabase, request_id) or request_row,
        "invite": invite_row,
    }


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

    requester_norm = _norm_user_id(request_row.get("requester_id"))
    assert_pair_not_blocked(supabase, requester_norm, responder_norm)

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
        refreshed_invite = load_invite_by_id(supabase, iid)
        if refreshed_invite and str(refreshed_invite.get("status") or "").lower() == "declined":
            invite_row = refreshed_invite
        else:
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
        refreshed_request = load_request_by_id(supabase, request_id)
        if refreshed_request and str(refreshed_request.get("status") or "").lower() == "declined":
            request_row = refreshed_request
        else:
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
    *,
    tags_insert_fn: TagsInsertFn,
    driver_busy_checker_fn: DriverBusyFn,
    passenger_busy_checker_fn: PassengerBlockingTagFn,
    build_snapshot_fn: Optional[BuildSnapshotFn] = None,
) -> Dict[str, Any]:
    """Driver accepts Trusted Direct invite; creates matched tag (match_channel=trusted)."""
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

    request_id = _norm_id(invite_row.get("request_id"))
    request_row = load_request_by_id(supabase, request_id) if request_id else None
    if not request_row:
        raise RmeNotFoundError()

    request_row = _lazy_expire_request_row(supabase, request_row)
    requester_norm = _norm_user_id(request_row.get("requester_id"))
    match_module = str(request_row.get("match_module") or MATCH_MODULE_TRUSTED_DIRECT)

    full_replay = _try_full_accept_replay(supabase, invite_row, request_row)
    if full_replay:
        return full_replay

    half_replay = _try_half_accept_orphan_recovery(
        supabase,
        invite_row,
        request_row,
        requester_id=requester_norm,
        responder_id=responder_norm,
    )
    if half_replay:
        return half_replay

    _assert_invite_pending_or_raise(invite_row)
    _assert_request_pending_or_raise(request_row)

    assert_pair_not_blocked(supabase, requester_norm, responder_norm)

    connection_id = _norm_id(request_row.get("relationship_connection_id"))
    try:
        assert_active_trusted_connection_for_direct_match(
            supabase,
            requester_id=requester_norm,
            responder_id=responder_norm,
            relationship_connection_id=connection_id,
        )
    except RmeTrustedFieldError as exc:
        raise RmeValidationError(str(exc)) from exc

    if driver_busy_checker_fn(responder_norm):
        raise RmeDriverBusyError()

    if passenger_busy_checker_fn(requester_norm):
        raise RmePassengerBusyError()

    now_iso = _utcnow_iso()
    accepted_invite = accept_invite_optimistic(
        supabase,
        iid,
        responder_norm,
        responded_at=now_iso,
    )
    if not accepted_invite:
        refreshed_invite = load_invite_by_id(supabase, iid)
        if refreshed_invite:
            refreshed_request = load_request_by_id(supabase, request_id) or request_row
            race_replay = _try_full_accept_replay(
                supabase, refreshed_invite, refreshed_request
            )
            if race_replay:
                return race_replay
            half_race = _try_half_accept_orphan_recovery(
                supabase,
                refreshed_invite,
                refreshed_request,
                requester_id=requester_norm,
                responder_id=responder_norm,
            )
            if half_race:
                return half_race
        raise RmeInvalidStateError()

    invite_row = accepted_invite
    vehicle_pref = request_row.get("vehicle_preference") or "car"
    tag_row: Dict[str, Any] = {
        "type": TAG_TYPE_NORMAL,
        "match_channel": MATCH_CHANNEL_TRUSTED,
        "status": "matched",
        "passenger_id": requester_norm,
        "driver_id": responder_norm,
        "pickup_lat": request_row.get("pickup_lat"),
        "pickup_lng": request_row.get("pickup_lng"),
        "dropoff_lat": request_row.get("dropoff_lat"),
        "dropoff_lng": request_row.get("dropoff_lng"),
        "pickup_location": request_row.get("pickup_label"),
        "dropoff_location": request_row.get("dropoff_label"),
        "passenger_preferred_vehicle": vehicle_pref,
        "distance_km": request_row.get("distance_km"),
        "matched_at": now_iso,
    }

    if tag_row.get("match_channel") != MATCH_CHANNEL_TRUSTED:
        raise RuntimeError("trusted_direct tag insert: match_channel must be 'trusted'")

    matched_contribution_tl = _matched_tag_contribution_tl(request_row)
    if matched_contribution_tl is not None:
        tag_row["final_price"] = matched_contribution_tl
        tag_row["offered_price"] = matched_contribution_tl
    else:
        offered = request_row.get("offered_contribution_tl")
        if offered is not None:
            tag_row["final_price"] = offered
            tag_row["offered_price"] = offered
        else:
            logger.warning(
                "tdm_accept missing valid contribution request_id=%s offered=%r suggested=%r",
                request_id[:36] if request_id else "",
                request_row.get("offered_contribution_tl"),
                request_row.get("suggested_contribution_tl"),
            )

    if build_snapshot_fn:
        tag_row.update(build_snapshot_fn(supabase, responder_norm))

    tag_ins = tags_insert_fn(supabase, tag_row, source="trusted_direct_accept")
    if not tag_ins.data:
        logger.error(
            "tdm_accept tag_insert_empty request_id=%s invite_id=%s",
            request_id[:36] if request_id else "",
            iid[:36],
        )
        raise RuntimeError("trusted_direct tag insert returned empty data")

    tag_created = tag_ins.data[0]
    tag_id = _norm_id(tag_created.get("id"))
    if not tag_id:
        logger.error(
            "tdm_accept tag_insert_missing_id request_id=%s invite_id=%s",
            request_id[:36] if request_id else "",
            iid[:36],
        )
        raise RuntimeError("trusted_direct tag insert missing id")

    req_updated = update_request_accept_with_matched_tag(
        supabase,
        request_id,
        tag_id,
        matched_at=now_iso,
        responded_at=now_iso,
    )
    if not req_updated:
        logger.error(
            "tdm_accept request_update_failed orphan_tag=true request_id=%s invite_id=%s tag_id=%s",
            request_id[:36] if request_id else "",
            iid[:36],
            tag_id[:36],
        )
        raise RuntimeError("trusted_direct request update after tag insert failed")

    _audit_accept_success(
        supabase,
        request_id=request_id,
        invite_id=iid,
        match_module=match_module,
        actor_id=responder_norm,
        matched_tag_id=tag_id,
    )

    final_request = load_request_by_id(supabase, request_id) or {
        **request_row,
        "status": RME_REQUEST_STATUS_ACCEPTED,
        "matched_tag_id": tag_id,
        "matched_at": now_iso,
    }
    return _accept_response(invite_row, final_request, tag_created)


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

    for expired_id in expire_stale_pending_for_requester(
        supabase, requester_norm, match_module=match_module
    ):
        expired_row = load_request_by_id(supabase, expired_id)
        if expired_row:
            _audit_request_expired(supabase, expired_row)

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

    expire_stale_pending_invites_for_responder(supabase, responder_norm)

    invite_row = get_pending_invite_for_responder(supabase, responder_norm)
    if not invite_row:
        return None

    invite_row = _lazy_expire_invite_row(supabase, invite_row)
    status = str(invite_row.get("status") or "").strip().lower()
    if status != RME_INVITE_STATUS_PENDING:
        return None
    return invite_row
