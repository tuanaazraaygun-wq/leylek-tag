"""
Sequential Quick Match — service layer (P6-C1 read, P6-C2 create, P6-C3 decline/cancel/expire, P6-C4 accept).

Writes quick_match_requests / quick_match_invites; P6-C4 also inserts matched tags (match_channel=quick).
No offers, dispatch_queue, socket, or push.
"""

from __future__ import annotations

import logging
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

import tag_pricing as _tag_pricing

logger = logging.getLogger(__name__)

TABLE_QUICK_MATCH_REQUESTS = "quick_match_requests"
TABLE_QUICK_MATCH_INVITES = "quick_match_invites"

REQUEST_STATUS_SEQUENCING = "sequencing"
REQUEST_STATUS_MATCHED = "matched"
REQUEST_STATUS_EXHAUSTED = "exhausted"
REQUEST_STATUS_EXPIRED = "expired"
REQUEST_STATUS_CANCELLED = "cancelled"
INVITE_STATUS_PENDING = "pending_driver"
INVITE_STATUS_ACCEPTED = "accepted"
INVITE_STATUS_DECLINED = "declined"
INVITE_STATUS_EXPIRED = "expired"
INVITE_STATUS_CANCELLED = "cancelled"

TAG_TYPE_NORMAL = "normal"
MATCH_CHANNEL_QUICK = "quick"

QUICK_MATCH_MIN_TRIP_KM = 0.8
QUICK_MATCH_MAX_TRIP_KM = 20.0
QUICK_MATCH_MIN_AIR_KM_SAME_POINT = 0.8

_REQUEST_SELECT_COLS = (
    "id, status, attempt_count, expires_at, matched_tag_id, matched_at, "
    "cancelled_at, exhausted_at, expired_at, distance_km, distance_band, "
    "suggested_contribution_tl, offered_contribution_tl, vehicle_preference, "
    "pickup_label, dropoff_label, passenger_id"
)

_REQUEST_ADVANCE_SELECT_COLS = (
    "id, status, attempt_count, expires_at, passenger_id, pickup_lat, pickup_lng, "
    "vehicle_preference"
)

_REQUEST_ACCEPT_SELECT_COLS = (
    "id, status, expires_at, passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, "
    "pickup_label, dropoff_label, vehicle_preference, distance_km, matched_tag_id, matched_at, "
    "offered_contribution_tl, suggested_contribution_tl"
)

_INVITE_SELECT_COLS = "id, request_id, sequence_no, status, expires_at, driver_id"

_REQUEST_JOIN_COLS = "id, distance_band, offered_contribution_tl, pickup_label"

RouteTripMetricsFn = Callable[[float, float, float, float], Awaitable[Dict[str, Any]]]
FindEligibleDriversFn = Callable[..., Awaitable[List[dict]]]
PassengerBlockingTagFn = Callable[[str], bool]
DriverBusyFn = Callable[[str], bool]
TagsInsertFn = Callable[..., Any]
BuildSnapshotFn = Callable[[Any, str], Dict[str, Any]]
DriverProfileLoaderFn = Callable[[Any, str], Dict[str, Any]]


class QuickMatchValidationError(ValueError):
    """Payload / distance / contribution validation failed (HTTP 422)."""

    def __init__(
        self,
        detail: str,
        *,
        code: Optional[str] = None,
        suggested_contribution_tl: Optional[int] = None,
        max_contribution_tl: Optional[int] = None,
    ) -> None:
        self.detail = detail
        self.code = code
        self.suggested_contribution_tl = suggested_contribution_tl
        self.max_contribution_tl = max_contribution_tl
        super().__init__(detail)

    def as_http_detail(self) -> Any:
        if self.code:
            payload: Dict[str, Any] = {
                "code": self.code,
                "message": self.detail,
            }
            if self.suggested_contribution_tl is not None:
                payload["suggested_contribution_tl"] = self.suggested_contribution_tl
            if self.max_contribution_tl is not None:
                payload["max_contribution_tl"] = self.max_contribution_tl
            return payload
        return self.detail


class QuickMatchConflictError(Exception):
    """State conflict (HTTP 409)."""

    def __init__(self, detail: str, *, code: str = "conflict") -> None:
        self.detail = detail
        self.code = code
        super().__init__(detail)


class QuickMatchNotFoundError(Exception):
    """Resource not found or wrong owner (HTTP 404)."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


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


def get_quick_match_max_eta_min() -> int:
    return _env_int("QUICK_MATCH_MAX_ETA_MIN", 10)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _utcnow_iso() -> str:
    return _utcnow().replace(microsecond=0).isoformat()


def _norm_actor_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _short_id(value: Any) -> str:
    s = str(value or "").strip()
    return s[:8] if s else "-"


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r_earth = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return r_earth * 2 * math.asin(math.sqrt(a))


def _is_unique_violation(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "23505" in msg or "duplicate key" in msg or "unique constraint" in msg


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


def _validate_lat_lng(lat: Any, lng: Any, *, label: str) -> Tuple[float, float]:
    try:
        la = float(lat)
        lo = float(lng)
    except (TypeError, ValueError):
        raise QuickMatchValidationError(f"{label} koordinatları geçersiz") from None
    if not math.isfinite(la) or not math.isfinite(lo):
        raise QuickMatchValidationError(f"{label} koordinatları geçersiz")
    if la < -90 or la > 90 or lo < -180 or lo > 180:
        raise QuickMatchValidationError(f"{label} koordinatları geçersiz")
    return la, lo


def _canonical_vehicle_preference(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    v = str(raw).strip().lower()
    if not v:
        return None
    if v in ("car", "motorcycle"):
        return v
    raise QuickMatchValidationError("vehicle_preference car veya motorcycle olmalı")


def _quick_match_distance_band(distance_km: float) -> str:
    km = float(distance_km)
    if km <= 5.0:
        return "0_5"
    if km <= 10.0:
        return "5_10"
    return "10_20"


def _quick_match_vehicle_kind(raw: Any) -> str:
    v = _canonical_vehicle_preference(raw)
    return v if v is not None else "car"


def _compute_unified_contribution_bounds(
    *,
    distance_km: float,
    duration_min: int,
    traffic_ratio: float,
    vehicle_kind: str,
    peak: bool,
) -> Tuple[int, int]:
    """Normal Match /price/calculate suggested_price; QM max = suggested * 2."""
    trip_distance_km = max(1.0, float(distance_km))
    estimated_minutes = max(5, int(duration_min))
    peak_multiplier = 1.10 if peak else 1.0
    vk = _quick_match_vehicle_kind(vehicle_kind)
    traffic_multiplier = _tag_pricing.traffic_multiplier_from_ratio(float(traffic_ratio or 1.0))
    suggested, _, _, _ = _tag_pricing.compute_tag_ride_price(
        city_key=_tag_pricing.DEFAULT_TAG_PRICING_CITY,
        vehicle_kind=vk,
        distance_km=trip_distance_km,
        estimated_minutes=estimated_minutes,
        peak_multiplier=peak_multiplier,
        traffic_multiplier=traffic_multiplier,
    )
    return suggested, suggested * 2


def _parse_positive_contribution_tl(raw: Any) -> Optional[int]:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        if isinstance(raw, float):
            if not math.isfinite(raw) or not raw.is_integer():
                return None
            val = int(raw)
        else:
            val = int(raw)
    except (TypeError, ValueError):
        try:
            f = float(raw)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(f) or f != int(f):
            return None
        val = int(f)
    if val <= 0:
        return None
    return val


def _matched_tag_contribution_tl(request_row: dict) -> Optional[int]:
    """QM accept tag price — offered first, then suggested fallback."""
    offered = _parse_positive_contribution_tl(request_row.get("offered_contribution_tl"))
    if offered is not None:
        return offered
    return _parse_positive_contribution_tl(request_row.get("suggested_contribution_tl"))


async def _quick_match_trip_metrics(
    route_trip_metrics_fn: RouteTripMetricsFn,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
) -> Dict[str, Any]:
    return await route_trip_metrics_fn(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)


def _validate_offered_contribution_tl(
    raw: Any,
    *,
    suggested_contribution_tl: int,
    max_contribution_tl: int,
) -> int:
    offered = _parse_positive_contribution_tl(raw)
    if offered is None:
        raise QuickMatchValidationError(
            "Geçersiz katkı payı",
            code="invalid_contribution",
            suggested_contribution_tl=suggested_contribution_tl,
            max_contribution_tl=max_contribution_tl,
        )
    if offered < suggested_contribution_tl:
        raise QuickMatchValidationError(
            f"Önerilen katkı payı ₺{suggested_contribution_tl}. Daha düşük teklif gönderilemez.",
            code="contribution_too_low",
            suggested_contribution_tl=suggested_contribution_tl,
            max_contribution_tl=max_contribution_tl,
        )
    if offered > max_contribution_tl:
        raise QuickMatchValidationError(
            f"Katkı payı en fazla ₺{max_contribution_tl} olabilir",
            code="contribution_too_high",
            suggested_contribution_tl=suggested_contribution_tl,
            max_contribution_tl=max_contribution_tl,
        )
    return offered


def _quick_match_validate_request_payload(
    payload: dict,
    *,
    distance_km: float,
    suggested_contribution_tl: int,
    max_contribution_tl: int,
) -> Dict[str, Any]:
    pickup_lat, pickup_lng = _validate_lat_lng(
        payload.get("pickup_lat"), payload.get("pickup_lng"), label="Alış"
    )
    dropoff_lat, dropoff_lng = _validate_lat_lng(
        payload.get("dropoff_lat"), payload.get("dropoff_lng"), label="Varış"
    )
    pickup_label = str(payload.get("pickup_label") or "").strip()
    dropoff_label = str(payload.get("dropoff_label") or "").strip()
    if not pickup_label:
        raise QuickMatchValidationError("pickup_label gerekli")
    if not dropoff_label:
        raise QuickMatchValidationError("dropoff_label gerekli")

    air_km = _haversine_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
    if air_km < QUICK_MATCH_MIN_AIR_KM_SAME_POINT:
        raise QuickMatchValidationError("Alış ve varış noktası çok yakın")

    trip_km = float(distance_km)
    if trip_km <= QUICK_MATCH_MIN_TRIP_KM:
        raise QuickMatchValidationError("Yolculuk mesafesi çok kısa")
    if trip_km > QUICK_MATCH_MAX_TRIP_KM:
        raise QuickMatchValidationError("Quick Match en fazla 20 km mesafede kullanılabilir")

    offered = _validate_offered_contribution_tl(
        payload.get("offered_contribution_tl"),
        suggested_contribution_tl=suggested_contribution_tl,
        max_contribution_tl=max_contribution_tl,
    )

    vehicle_preference = _canonical_vehicle_preference(payload.get("vehicle_preference"))

    return {
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "pickup_label": pickup_label,
        "dropoff_lat": dropoff_lat,
        "dropoff_lng": dropoff_lng,
        "dropoff_label": dropoff_label,
        "offered_contribution_tl": offered,
        "vehicle_preference": vehicle_preference,
        "distance_km": round(trip_km, 2),
    }


def _effective_request_status(row: dict) -> str:
    st = str(row.get("status") or "").strip().lower()
    if st == REQUEST_STATUS_SEQUENCING and _is_expired(row.get("expires_at")):
        return REQUEST_STATUS_EXPIRED
    return st


def _effective_invite_status(row: dict) -> str:
    st = str(row.get("status") or "").strip().lower()
    if st == INVITE_STATUS_PENDING and _is_expired(row.get("expires_at")):
        return INVITE_STATUS_EXPIRED
    return st


def _public_current_invite_summary(invite_row: Optional[dict]) -> Optional[Dict[str, Any]]:
    if not invite_row:
        return None
    return {
        "sequence_no": invite_row.get("sequence_no"),
        "status": _effective_invite_status(invite_row),
        "expires_at": invite_row.get("expires_at"),
    }


def _public_create_invite_summary(invite_row: Optional[dict]) -> Optional[Dict[str, Any]]:
    if not invite_row:
        return None
    return {
        "sequence_no": invite_row.get("sequence_no"),
        "status": str(invite_row.get("status") or INVITE_STATUS_PENDING),
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


def _load_request_row(supabase, request_id: str) -> Optional[dict]:
    res = (
        supabase.table(TABLE_QUICK_MATCH_REQUESTS)
        .select(_REQUEST_SELECT_COLS)
        .eq("id", request_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _load_request_row_for_advance(supabase, request_id: str) -> Optional[dict]:
    res = (
        supabase.table(TABLE_QUICK_MATCH_REQUESTS)
        .select(_REQUEST_ADVANCE_SELECT_COLS)
        .eq("id", request_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _load_request_row_for_accept(supabase, request_id: str) -> Optional[dict]:
    rid = str(request_id or "").strip()
    if not rid:
        return None
    res = (
        supabase.table(TABLE_QUICK_MATCH_REQUESTS)
        .select(_REQUEST_ACCEPT_SELECT_COLS)
        .eq("id", rid)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _load_invite_row(supabase, invite_id: str) -> Optional[dict]:
    iid = str(invite_id or "").strip()
    if not iid:
        return None
    res = (
        supabase.table(TABLE_QUICK_MATCH_INVITES)
        .select(_INVITE_SELECT_COLS)
        .eq("id", iid)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _quick_match_attempted_driver_ids(supabase, request_id: str) -> List[str]:
    res = (
        supabase.table(TABLE_QUICK_MATCH_INVITES)
        .select("driver_id")
        .eq("request_id", request_id)
        .execute()
    )
    out: List[str] = []
    for row in res.data or []:
        did = _norm_actor_id(row.get("driver_id"))
        if did:
            out.append(did)
    return out


def _cancel_pending_invite_for_request(
    supabase,
    request_id: str,
    *,
    decline_reason: str,
) -> None:
    now_iso = _utcnow_iso()
    supabase.table(TABLE_QUICK_MATCH_INVITES).update(
        {
            "status": INVITE_STATUS_CANCELLED,
            "decline_reason": decline_reason,
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("request_id", request_id).eq("status", INVITE_STATUS_PENDING).execute()


def _expire_request_if_needed(supabase, request_row: dict) -> bool:
    """Expire sequencing request past TTL; cancel pending invite. Returns True if expired."""
    status = str(request_row.get("status") or "").strip().lower()
    if status != REQUEST_STATUS_SEQUENCING:
        return False
    if not _is_expired(request_row.get("expires_at")):
        return False

    rid = str(request_row.get("id") or "").strip()
    if not rid:
        return False

    now_iso = _utcnow_iso()
    supabase.table(TABLE_QUICK_MATCH_REQUESTS).update(
        {
            "status": REQUEST_STATUS_EXPIRED,
            "expired_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("id", rid).eq("status", REQUEST_STATUS_SEQUENCING).execute()
    _cancel_pending_invite_for_request(
        supabase, rid, decline_reason="system_cancelled"
    )
    return True


def _expire_pending_invite_if_needed(supabase, invite_row: dict) -> bool:
    """Expire pending_driver invite past TTL. Returns True if expired."""
    status = str(invite_row.get("status") or "").strip().lower()
    if status != INVITE_STATUS_PENDING:
        return False
    if not _is_expired(invite_row.get("expires_at")):
        return False

    iid = str(invite_row.get("id") or "").strip()
    if not iid:
        return False

    now_iso = _utcnow_iso()
    supabase.table(TABLE_QUICK_MATCH_INVITES).update(
        {
            "status": INVITE_STATUS_EXPIRED,
            "decline_reason": "timeout",
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("id", iid).eq("status", INVITE_STATUS_PENDING).execute()
    return True


def _expire_stale_pending_invites_for_request(supabase, request_id: str) -> bool:
    pending = _fetch_pending_invite_for_request(supabase, request_id)
    if not pending:
        return False
    return _expire_pending_invite_if_needed(supabase, pending)


def _expire_stale_sequencing_for_passenger(supabase, passenger_id: str) -> None:
    actor = _norm_actor_id(passenger_id)
    res = (
        supabase.table(TABLE_QUICK_MATCH_REQUESTS)
        .select("id, status, expires_at")
        .eq("passenger_id", actor)
        .eq("status", REQUEST_STATUS_SEQUENCING)
        .execute()
    )
    for row in res.data or []:
        _expire_request_if_needed(supabase, row)


async def _maybe_advance_after_invite_expire(
    supabase,
    request_id: str,
    *,
    find_eligible_drivers_fn: FindEligibleDriversFn,
    driver_busy_fn: DriverBusyFn,
) -> None:
    req = _load_request_row_for_advance(supabase, request_id)
    if not req:
        return
    if str(req.get("status") or "").strip().lower() != REQUEST_STATUS_SEQUENCING:
        return
    if _is_expired(req.get("expires_at")):
        _expire_request_if_needed(supabase, req)
        return
    await _advance_quick_match_request(
        supabase,
        request_id,
        find_eligible_drivers_fn=find_eligible_drivers_fn,
        driver_busy_fn=driver_busy_fn,
    )


async def _quick_match_pick_next_driver(
    request_row: dict,
    *,
    attempted_driver_ids: List[str],
    find_eligible_drivers_fn: FindEligibleDriversFn,
    driver_busy_fn: DriverBusyFn,
) -> Optional[dict]:
    request_id = str(request_row.get("id") or "").strip()
    passenger_id = _norm_actor_id(request_row.get("passenger_id"))
    exclude_ids = list(attempted_driver_ids)
    if passenger_id and passenger_id not in exclude_ids:
        exclude_ids.append(passenger_id)

    vehicle_pref = request_row.get("vehicle_preference") or "car"
    pickup_lat = float(request_row.get("pickup_lat") or 0)
    pickup_lng = float(request_row.get("pickup_lng") or 0)
    exclude_count = len(exclude_ids)

    eligible = await find_eligible_drivers_fn(
        pickup_lat,
        pickup_lng,
        exclude_ids=exclude_ids,
        passenger_vehicle_kind=vehicle_pref,
        vehicle_filter=True,
        tag_id=None,
    )
    eligible_count = len(eligible)
    busy_skipped_count = 0
    max_eta_min = get_quick_match_max_eta_min()
    for candidate in eligible:
        driver_id = _norm_actor_id(candidate.get("driver_id"))
        if not driver_id:
            continue
        if driver_busy_fn(driver_id):
            busy_skipped_count += 1
            continue
        pickup_eta_min = candidate.get("duration_min")
        logger.info(
            "quick_match_pick_driver request_id=%s pickup=(%.5f,%.5f) vehicle_pref=%s "
            "exclude_count=%d eligible=%d busy_skipped=%d selected_driver=%s "
            "pickup_eta_min=%s duration_min=%s max_eta_min=%d",
            _short_id(request_id),
            pickup_lat,
            pickup_lng,
            vehicle_pref,
            exclude_count,
            eligible_count,
            busy_skipped_count,
            _short_id(driver_id),
            pickup_eta_min,
            pickup_eta_min,
            max_eta_min,
        )
        return candidate
    logger.warning(
        "quick_match_pick_driver_none request_id=%s pickup=(%.5f,%.5f) vehicle_pref=%s "
        "exclude_count=%d eligible=%d busy_skipped=%d max_eta_min=%d "
        "reason=no_eligible_or_all_busy",
        _short_id(request_id),
        pickup_lat,
        pickup_lng,
        vehicle_pref,
        exclude_count,
        eligible_count,
        busy_skipped_count,
        max_eta_min,
    )
    return None


def _guard_active_sequencing_request(supabase, passenger_id: str) -> None:
    actor = _norm_actor_id(passenger_id)
    res = (
        supabase.table(TABLE_QUICK_MATCH_REQUESTS)
        .select("id")
        .eq("passenger_id", actor)
        .eq("status", REQUEST_STATUS_SEQUENCING)
        .limit(1)
        .execute()
    )
    if res.data:
        raise QuickMatchConflictError(
            "Aktif Quick Match isteğiniz zaten var",
            code="active_quick_request_exists",
        )


def _public_accept_invite_summary(invite_row: dict) -> Dict[str, Any]:
    return {
        "sequence_no": invite_row.get("sequence_no"),
        "status": INVITE_STATUS_ACCEPTED,
        "expires_at": invite_row.get("expires_at"),
    }


def _public_accept_tag_payload(tag_row: dict) -> Dict[str, Any]:
    return {
        "tag_id": str(tag_row.get("id") or ""),
        "status": str(tag_row.get("status") or ""),
        "match_channel": str(tag_row.get("match_channel") or ""),
    }


def _accept_response(
    supabase,
    request_id: str,
    invite_row: dict,
    tag_row: dict,
) -> Dict[str, Any]:
    final_row = _load_request_row(supabase, request_id)
    if not final_row:
        raise RuntimeError("quick_match request missing after accept")
    return {
        "request": _public_request_payload(final_row, None),
        "tag": _public_accept_tag_payload(tag_row),
        "invite": _public_accept_invite_summary(invite_row),
    }


def _supersede_other_pending_invites(
    supabase,
    request_id: str,
    *,
    except_invite_id: str,
) -> None:
    now_iso = _utcnow_iso()
    supabase.table(TABLE_QUICK_MATCH_INVITES).update(
        {
            "status": INVITE_STATUS_CANCELLED,
            "decline_reason": "superseded",
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("request_id", request_id).eq("status", INVITE_STATUS_PENDING).neq(
        "id", except_invite_id
    ).execute()


def _action_response(
    supabase,
    request_id: str,
    invite_row: Optional[dict],
) -> Dict[str, Any]:
    final_row = _load_request_row(supabase, request_id)
    if not final_row:
        raise RuntimeError("quick_match request missing after action")
    pending = invite_row if invite_row else _fetch_pending_invite_for_request(
        supabase, request_id
    )
    return {
        "request": _public_request_payload(final_row, pending),
        "invite": _public_create_invite_summary(invite_row),
    }


async def _advance_quick_match_request(
    supabase,
    request_id: str,
    *,
    find_eligible_drivers_fn: FindEligibleDriversFn,
    driver_busy_fn: DriverBusyFn,
) -> Optional[dict]:
    """Advance sequential invite round. Returns invite row dict or None if exhausted."""
    rid = str(request_id or "").strip()
    if not rid:
        return None

    request_row = _load_request_row_for_advance(supabase, rid)
    if not request_row:
        return None

    full_row = _load_request_row(supabase, rid)
    if full_row and _expire_request_if_needed(supabase, full_row):
        return None

    request_row = _load_request_row_for_advance(supabase, rid)
    if not request_row:
        return None

    status = str(request_row.get("status") or "").strip().lower()
    if status != REQUEST_STATUS_SEQUENCING:
        return _fetch_pending_invite_for_request(supabase, rid)

    _expire_stale_pending_invites_for_request(supabase, rid)

    pending = _fetch_pending_invite_for_request(supabase, rid)
    if pending and not _is_expired(pending.get("expires_at")):
        return pending

    attempt_count = int(request_row.get("attempt_count") or 0)
    vehicle_pref = request_row.get("vehicle_preference") or "car"
    pickup_lat = float(request_row.get("pickup_lat") or 0)
    pickup_lng = float(request_row.get("pickup_lng") or 0)
    if attempt_count >= get_quick_match_max_attempts():
        logger.warning(
            "quick_match_exhausted request_id=%s reason=max_attempts attempt_count=%d "
            "pickup=(%.5f,%.5f) vehicle_pref=%s",
            _short_id(rid),
            attempt_count,
            pickup_lat,
            pickup_lng,
            vehicle_pref,
        )
        now_iso = _utcnow_iso()
        supabase.table(TABLE_QUICK_MATCH_REQUESTS).update(
            {
                "status": REQUEST_STATUS_EXHAUSTED,
                "exhausted_at": now_iso,
                "updated_at": now_iso,
            }
        ).eq("id", rid).eq("status", REQUEST_STATUS_SEQUENCING).execute()
        return None

    attempted_ids = _quick_match_attempted_driver_ids(supabase, rid)
    candidate = await _quick_match_pick_next_driver(
        request_row,
        attempted_driver_ids=attempted_ids,
        find_eligible_drivers_fn=find_eligible_drivers_fn,
        driver_busy_fn=driver_busy_fn,
    )
    if not candidate:
        logger.warning(
            "quick_match_exhausted request_id=%s reason=no_candidate attempt_count=%d "
            "pickup=(%.5f,%.5f) vehicle_pref=%s",
            _short_id(rid),
            attempt_count,
            pickup_lat,
            pickup_lng,
            vehicle_pref,
        )
        now_iso = _utcnow_iso()
        supabase.table(TABLE_QUICK_MATCH_REQUESTS).update(
            {
                "status": REQUEST_STATUS_EXHAUSTED,
                "exhausted_at": now_iso,
                "updated_at": now_iso,
            }
        ).eq("id", rid).eq("status", REQUEST_STATUS_SEQUENCING).execute()
        return None

    sequence_no = attempt_count + 1
    invite_expires = (
        _utcnow() + timedelta(seconds=get_quick_match_invite_timeout_seconds())
    ).replace(microsecond=0).isoformat()
    invite_insert = {
        "request_id": rid,
        "driver_id": _norm_actor_id(candidate.get("driver_id")),
        "status": INVITE_STATUS_PENDING,
        "sequence_no": sequence_no,
        "driver_distance_km": candidate.get("distance_km"),
        "expires_at": invite_expires,
    }
    try:
        ins = supabase.table(TABLE_QUICK_MATCH_INVITES).insert(invite_insert).execute()
    except Exception as exc:
        if _is_unique_violation(exc):
            logger.warning(
                "quick_match invite insert unique conflict request_id=%s err=%s",
                rid[:36],
                exc,
            )
            return _fetch_pending_invite_for_request(supabase, rid)
        raise

    if not ins.data:
        raise RuntimeError("quick_match invite insert returned empty data")

    now_iso = _utcnow_iso()
    supabase.table(TABLE_QUICK_MATCH_REQUESTS).update(
        {
            "attempt_count": sequence_no,
            "updated_at": now_iso,
        }
    ).eq("id", rid).eq("status", REQUEST_STATUS_SEQUENCING).execute()

    return ins.data[0]


async def create_quick_match_request(
    supabase,
    actor_id: str,
    payload: dict,
    *,
    find_eligible_drivers_fn: FindEligibleDriversFn,
    passenger_blocking_tag_fn: PassengerBlockingTagFn,
    driver_busy_fn: DriverBusyFn,
    route_trip_metrics_fn: RouteTripMetricsFn,
) -> Dict[str, Any]:
    """Create quick match request and run first sequential advance. PII-safe response."""
    actor = _norm_actor_id(actor_id)
    if not actor:
        raise QuickMatchValidationError("Geçersiz kullanıcı")

    if passenger_blocking_tag_fn(actor):
        raise QuickMatchConflictError(
            "Devam eden bir yolculuğunuz var",
            code="active_normal_tag_exists",
        )

    _expire_stale_sequencing_for_passenger(supabase, actor)
    _guard_active_sequencing_request(supabase, actor)

    pickup_lat, pickup_lng = _validate_lat_lng(
        payload.get("pickup_lat"), payload.get("pickup_lng"), label="Alış"
    )
    dropoff_lat, dropoff_lng = _validate_lat_lng(
        payload.get("dropoff_lat"), payload.get("dropoff_lng"), label="Varış"
    )
    trip_metrics = await _quick_match_trip_metrics(
        route_trip_metrics_fn, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng
    )
    distance_km = float(trip_metrics.get("distance_km") or 0.0)
    vehicle_kind = _quick_match_vehicle_kind(payload.get("vehicle_preference"))
    suggested, max_contribution = _compute_unified_contribution_bounds(
        distance_km=distance_km,
        duration_min=int(trip_metrics.get("duration_min") or 5),
        traffic_ratio=float(trip_metrics.get("traffic_ratio") or 1.0),
        vehicle_kind=vehicle_kind,
        peak=bool(trip_metrics.get("peak")),
    )
    distance_band = _quick_match_distance_band(distance_km)
    validated = _quick_match_validate_request_payload(
        payload,
        distance_km=distance_km,
        suggested_contribution_tl=suggested,
        max_contribution_tl=max_contribution,
    )

    request_expires = (
        _utcnow() + timedelta(seconds=get_quick_match_request_ttl_seconds())
    ).replace(microsecond=0).isoformat()

    insert_row = {
        "passenger_id": actor,
        "status": REQUEST_STATUS_SEQUENCING,
        "pickup_lat": validated["pickup_lat"],
        "pickup_lng": validated["pickup_lng"],
        "pickup_label": validated["pickup_label"],
        "dropoff_lat": validated["dropoff_lat"],
        "dropoff_lng": validated["dropoff_lng"],
        "dropoff_label": validated["dropoff_label"],
        "distance_km": validated["distance_km"],
        "distance_band": distance_band,
        "suggested_contribution_tl": suggested,
        "offered_contribution_tl": validated["offered_contribution_tl"],
        "vehicle_preference": validated["vehicle_preference"],
        "attempt_count": 0,
        "expires_at": request_expires,
    }

    try:
        ins = supabase.table(TABLE_QUICK_MATCH_REQUESTS).insert(insert_row).execute()
    except Exception as exc:
        if _is_unique_violation(exc):
            raise QuickMatchConflictError(
                "Aktif Quick Match isteğiniz zaten var",
                code="active_quick_request_exists",
            ) from exc
        raise

    if not ins.data:
        raise RuntimeError("quick_match request insert returned empty data")

    request_id = str(ins.data[0].get("id") or "")
    logger.info(
        "quick_match_create request_id=%s passenger=%s pickup=(%.5f,%.5f) dropoff=(%.5f,%.5f) "
        "vehicle_pref=%s distance_km=%s offered=%s suggested=%s",
        _short_id(request_id),
        _short_id(actor),
        validated["pickup_lat"],
        validated["pickup_lng"],
        validated["dropoff_lat"],
        validated["dropoff_lng"],
        validated.get("vehicle_preference") or "car",
        validated["distance_km"],
        validated["offered_contribution_tl"],
        suggested,
    )
    invite_row = await _advance_quick_match_request(
        supabase,
        request_id,
        find_eligible_drivers_fn=find_eligible_drivers_fn,
        driver_busy_fn=driver_busy_fn,
    )

    return _action_response(supabase, request_id, invite_row)


async def decline_quick_match_invite(
    supabase,
    actor_id: str,
    invite_id: str,
    *,
    find_eligible_drivers_fn: FindEligibleDriversFn,
    driver_busy_fn: DriverBusyFn,
) -> Dict[str, Any]:
    """Driver declines invite; re-advance if request still sequencing."""
    actor = _norm_actor_id(actor_id)
    invite = _load_invite_row(supabase, invite_id)
    if not invite or _norm_actor_id(invite.get("driver_id")) != actor:
        raise QuickMatchNotFoundError("Quick Match daveti bulunamadı")

    request_id = str(invite.get("request_id") or "").strip()
    request_row = _load_request_row(supabase, request_id)
    if not request_row:
        raise QuickMatchNotFoundError("Quick Match daveti bulunamadı")

    if _expire_request_if_needed(supabase, request_row):
        raise QuickMatchConflictError(
            "Quick Match isteği artık aktif değil",
            code="request_not_sequencing",
        )

    status = str(request_row.get("status") or "").strip().lower()
    if status != REQUEST_STATUS_SEQUENCING:
        raise QuickMatchConflictError(
            "Quick Match isteği artık aktif değil",
            code="request_not_sequencing",
        )

    invite_status = str(invite.get("status") or "").strip().lower()
    if invite_status != INVITE_STATUS_PENDING:
        raise QuickMatchConflictError(
            "Davet artık bekleyen durumda değil",
            code="invite_not_pending",
        )

    now_iso = _utcnow_iso()
    if _is_expired(invite.get("expires_at")):
        upd = (
            supabase.table(TABLE_QUICK_MATCH_INVITES)
            .update(
                {
                    "status": INVITE_STATUS_EXPIRED,
                    "decline_reason": "timeout",
                    "responded_at": now_iso,
                    "updated_at": now_iso,
                }
            )
            .eq("id", invite_id)
            .eq("driver_id", actor)
            .eq("status", INVITE_STATUS_PENDING)
            .execute()
        )
    else:
        upd = (
            supabase.table(TABLE_QUICK_MATCH_INVITES)
            .update(
                {
                    "status": INVITE_STATUS_DECLINED,
                    "decline_reason": "driver_declined",
                    "responded_at": now_iso,
                    "updated_at": now_iso,
                }
            )
            .eq("id", invite_id)
            .eq("driver_id", actor)
            .eq("status", INVITE_STATUS_PENDING)
            .execute()
        )

    if not upd.data:
        refreshed = _load_invite_row(supabase, invite_id)
        if refreshed and str(refreshed.get("status")) != INVITE_STATUS_PENDING:
            raise QuickMatchConflictError(
                "Davet artık bekleyen durumda değil",
                code="invite_not_pending",
            )
        raise QuickMatchNotFoundError("Quick Match daveti bulunamadı")

    invite_row = await _advance_quick_match_request(
        supabase,
        request_id,
        find_eligible_drivers_fn=find_eligible_drivers_fn,
        driver_busy_fn=driver_busy_fn,
    )
    return _action_response(supabase, request_id, invite_row)


def accept_quick_match_invite(
    supabase,
    actor_id: str,
    invite_id: str,
    *,
    tags_insert_fn: TagsInsertFn,
    driver_busy_checker_fn: DriverBusyFn,
    passenger_busy_checker_fn: PassengerBlockingTagFn,
    driver_profile_loader_fn: Optional[DriverProfileLoaderFn] = None,
    build_snapshot_fn: Optional[BuildSnapshotFn] = None,
) -> Dict[str, Any]:
    """Driver accepts invite; creates matched tag (match_channel=quick). PII-safe response."""
    actor = _norm_actor_id(actor_id)
    iid = str(invite_id or "").strip()
    if not iid:
        raise QuickMatchNotFoundError("Quick Match daveti bulunamadı")

    invite = _load_invite_row(supabase, iid)
    if not invite or _norm_actor_id(invite.get("driver_id")) != actor:
        raise QuickMatchNotFoundError("Quick Match daveti bulunamadı")

    request_id = str(invite.get("request_id") or "").strip()
    request_row = _load_request_row_for_accept(supabase, request_id)
    if not request_row:
        raise QuickMatchNotFoundError("Quick Match daveti bulunamadı")

    if _expire_request_if_needed(supabase, request_row):
        raise QuickMatchConflictError(
            "Quick Match isteği artık aktif değil",
            code="request_not_sequencing",
        )

    request_row = _load_request_row_for_accept(supabase, request_id) or request_row
    if _is_expired(request_row.get("expires_at")):
        _expire_request_if_needed(supabase, request_row)
        raise QuickMatchConflictError(
            "Quick Match isteği artık aktif değil",
            code="request_not_sequencing",
        )

    invite_status = str(invite.get("status") or "").strip().lower()
    if invite_status == INVITE_STATUS_ACCEPTED:
        req_status = str(request_row.get("status") or "").strip().lower()
        matched_tag_id = str(request_row.get("matched_tag_id") or "").strip()
        if req_status == REQUEST_STATUS_MATCHED and matched_tag_id:
            tag_res = (
                supabase.table("tags")
                .select("id, status, match_channel")
                .eq("id", matched_tag_id)
                .limit(1)
                .execute()
            )
            if tag_res.data:
                return _accept_response(supabase, request_id, invite, tag_res.data[0])

    if _is_expired(invite.get("expires_at")):
        _expire_pending_invite_if_needed(supabase, invite)
        raise QuickMatchConflictError(
            "Quick Match daveti süresi doldu",
            code="invite_expired",
        )

    if invite_status != INVITE_STATUS_PENDING:
        raise QuickMatchConflictError(
            "Davet artık bekleyen durumda değil",
            code="invite_not_pending",
        )

    req_status = str(request_row.get("status") or "").strip().lower()
    if req_status != REQUEST_STATUS_SEQUENCING:
        raise QuickMatchConflictError(
            "Quick Match isteği artık aktif değil",
            code="request_not_sequencing",
        )

    if driver_busy_checker_fn(actor):
        raise QuickMatchConflictError(
            "Sürücü başka bir yolculukta",
            code="driver_busy",
        )

    passenger_id = _norm_actor_id(request_row.get("passenger_id"))
    if passenger_busy_checker_fn(passenger_id):
        raise QuickMatchConflictError(
            "Yolcu başka bir yolculukta",
            code="passenger_busy",
        )

    now_iso = _utcnow_iso()
    invite_upd = (
        supabase.table(TABLE_QUICK_MATCH_INVITES)
        .update(
            {
                "status": INVITE_STATUS_ACCEPTED,
                "responded_at": now_iso,
                "updated_at": now_iso,
            }
        )
        .eq("id", iid)
        .eq("driver_id", actor)
        .eq("status", INVITE_STATUS_PENDING)
        .execute()
    )
    if not invite_upd.data:
        refreshed = _load_invite_row(supabase, iid)
        if refreshed and str(refreshed.get("status") or "") == INVITE_STATUS_ACCEPTED:
            req_after = _load_request_row_for_accept(supabase, request_id)
            tag_id_after = str((req_after or {}).get("matched_tag_id") or "").strip()
            if tag_id_after:
                tag_res = (
                    supabase.table("tags")
                    .select("id, status, match_channel")
                    .eq("id", tag_id_after)
                    .limit(1)
                    .execute()
                )
                if tag_res.data:
                    return _accept_response(
                        supabase, request_id, refreshed, tag_res.data[0]
                    )
        raise QuickMatchConflictError(
            "Davet artık bekleyen durumda değil",
            code="invite_not_pending",
        )

    accepted_invite = invite_upd.data[0]

    vehicle_pref = request_row.get("vehicle_preference") or "car"
    tag_row: Dict[str, Any] = {
        "type": TAG_TYPE_NORMAL,
        "match_channel": MATCH_CHANNEL_QUICK,
        "status": "matched",
        "passenger_id": passenger_id,
        "driver_id": actor,
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

    if tag_row.get("match_channel") != MATCH_CHANNEL_QUICK:
        raise RuntimeError("quick_match tag insert: match_channel must be 'quick'")

    matched_contribution_tl = _matched_tag_contribution_tl(request_row)
    if matched_contribution_tl is not None:
        tag_row["final_price"] = matched_contribution_tl
        tag_row["offered_price"] = matched_contribution_tl
    else:
        logger.warning(
            "quick_match accept missing valid contribution request_id=%s offered=%r suggested=%r",
            request_id[:36],
            request_row.get("offered_contribution_tl"),
            request_row.get("suggested_contribution_tl"),
        )

    if driver_profile_loader_fn:
        profile = driver_profile_loader_fn(supabase, actor) or {}
        driver_name = profile.get("driver_name") or profile.get("name")
        if driver_name:
            tag_row["driver_name"] = driver_name

    try:
        pr = (
            supabase.table("users")
            .select("name")
            .eq("id", passenger_id)
            .limit(1)
            .execute()
        )
        if pr.data and pr.data[0].get("name"):
            tag_row["passenger_name"] = pr.data[0]["name"]
    except Exception as name_exc:
        logger.warning("quick_match accept passenger_name load err=%s", name_exc)

    if build_snapshot_fn:
        tag_row.update(build_snapshot_fn(supabase, actor))

    tag_ins = tags_insert_fn(supabase, tag_row, source="quick_match_accept")
    if not tag_ins.data:
        raise RuntimeError("quick_match tag insert returned empty data")

    tag_created = tag_ins.data[0]
    tag_id = str(tag_created.get("id") or "").strip()
    if not tag_id:
        raise RuntimeError("quick_match tag insert missing id")

    req_upd = (
        supabase.table(TABLE_QUICK_MATCH_REQUESTS)
        .update(
            {
                "status": REQUEST_STATUS_MATCHED,
                "matched_at": now_iso,
                "matched_tag_id": tag_id,
                "updated_at": now_iso,
            }
        )
        .eq("id", request_id)
        .eq("status", REQUEST_STATUS_SEQUENCING)
        .execute()
    )
    if not req_upd.data:
        logger.error(
            "quick_match accept request update failed request_id=%s tag_id=%s",
            request_id[:36],
            tag_id[:36],
        )
        raise RuntimeError("quick_match request update after tag insert failed")

    _supersede_other_pending_invites(
        supabase, request_id, except_invite_id=iid
    )

    return _accept_response(supabase, request_id, accepted_invite, tag_created)


async def cancel_quick_match_request(
    supabase,
    actor_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """Passenger cancels sequencing request; no re-advance."""
    actor = _norm_actor_id(actor_id)
    rid = str(request_id or "").strip()
    if not rid:
        raise QuickMatchNotFoundError("Quick Match isteği bulunamadı")

    request_row = _load_request_row(supabase, rid)
    if not request_row or _norm_actor_id(request_row.get("passenger_id")) != actor:
        raise QuickMatchNotFoundError("Quick Match isteği bulunamadı")

    if _expire_request_if_needed(supabase, request_row):
        raise QuickMatchConflictError(
            "Quick Match isteği artık aktif değil",
            code="request_not_sequencing",
        )

    status = str(request_row.get("status") or "").strip().lower()
    if status != REQUEST_STATUS_SEQUENCING:
        raise QuickMatchConflictError(
            "Quick Match isteği artık aktif değil",
            code="request_not_sequencing",
        )

    now_iso = _utcnow_iso()
    supabase.table(TABLE_QUICK_MATCH_REQUESTS).update(
        {
            "status": REQUEST_STATUS_CANCELLED,
            "cancelled_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("id", rid).eq("status", REQUEST_STATUS_SEQUENCING).execute()

    _cancel_pending_invite_for_request(
        supabase, rid, decline_reason="passenger_cancelled"
    )

    final_row = _load_request_row(supabase, rid)
    if not final_row:
        raise RuntimeError("quick_match request missing after cancel")

    return {
        "request": _public_request_payload(final_row, None),
        "invite": None,
    }


async def get_quick_match_request_status(
    supabase,
    actor_id: str,
    request_id: str,
    *,
    find_eligible_drivers_fn: FindEligibleDriversFn,
    driver_busy_fn: DriverBusyFn,
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

    if _expire_request_if_needed(supabase, row):
        row = _load_request_row(supabase, rid) or row
    elif str(row.get("status") or "").strip().lower() == REQUEST_STATUS_SEQUENCING:
        if _expire_stale_pending_invites_for_request(supabase, rid):
            await _maybe_advance_after_invite_expire(
                supabase,
                rid,
                find_eligible_drivers_fn=find_eligible_drivers_fn,
                driver_busy_fn=driver_busy_fn,
            )
            row = _load_request_row(supabase, rid) or row

    pending = _fetch_pending_invite_for_request(supabase, rid)
    return _public_request_payload(row, pending)


async def get_active_quick_match_request(
    supabase,
    actor_id: str,
    *,
    find_eligible_drivers_fn: FindEligibleDriversFn,
    driver_busy_fn: DriverBusyFn,
) -> Optional[Dict[str, Any]]:
    """Active sequencing request for passenger (PII-safe). None if none."""
    actor = _norm_actor_id(actor_id)
    _expire_stale_sequencing_for_passenger(supabase, actor)
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

    if _expire_request_if_needed(supabase, row):
        return None

    if _expire_stale_pending_invites_for_request(supabase, rid):
        await _maybe_advance_after_invite_expire(
            supabase,
            rid,
            find_eligible_drivers_fn=find_eligible_drivers_fn,
            driver_busy_fn=driver_busy_fn,
        )
        row = _load_request_row(supabase, rid)
        if not row or str(row.get("status") or "").strip().lower() != REQUEST_STATUS_SEQUENCING:
            return _public_request_payload(row, None) if row else None

    pending = _fetch_pending_invite_for_request(supabase, rid) if rid else None
    return _public_request_payload(row, pending)


async def get_current_quick_match_invite(
    supabase,
    actor_id: str,
    *,
    find_eligible_drivers_fn: FindEligibleDriversFn,
    driver_busy_fn: DriverBusyFn,
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

    request_row = _load_request_row(supabase, req_id)
    if request_row and _expire_request_if_needed(supabase, request_row):
        return None

    if _expire_pending_invite_if_needed(supabase, invite):
        await _maybe_advance_after_invite_expire(
            supabase,
            req_id,
            find_eligible_drivers_fn=find_eligible_drivers_fn,
            driver_busy_fn=driver_busy_fn,
        )
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
