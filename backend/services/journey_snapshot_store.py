"""
P1-B — Active journey Redis snapshot (read cache for active-tag endpoints).

JOURNEY_SNAPSHOT_REDIS=0 (default) → read path kapalı; Supabase yanıtı değişmez.
JOURNEY_SNAPSHOT_SHADOW=1 → populate sırasında Redis ile DB karşılaştırma (log only).
Redis hata/miss → sessiz miss; kullanıcıya yansımaz.
"""

from __future__ import annotations

import copy
import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

from redis_cache import get_redis_client

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1

PASSENGER_ACTIVE_STATUSES = frozenset(
    {"waiting", "pending", "offers_received", "matched", "in_progress"}
)
DRIVER_ACTIVE_STATUSES = frozenset({"matched", "in_progress"})


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return max(1, int(str(raw).strip()))
    except (TypeError, ValueError):
        return default


def _env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return max(0.0, min(1.0, float(str(raw).strip())))
    except (TypeError, ValueError):
        return default


def journey_snapshot_enabled() -> bool:
    """JOURNEY_SNAPSHOT_REDIS=1 → active-tag read cache açık (default kapalı)."""
    return _env_bool("JOURNEY_SNAPSHOT_REDIS", False)


def journey_snapshot_shadow_enabled() -> bool:
    """JOURNEY_SNAPSHOT_SHADOW=1 → populate sırasında shadow karşılaştırma (default kapalı)."""
    return _env_bool("JOURNEY_SNAPSHOT_SHADOW", False)


def shadow_sample_rate() -> float:
    """JOURNEY_SNAPSHOT_SHADOW_SAMPLE — actor-hash örnekleme oranı (default 0.01)."""
    return _env_float("JOURNEY_SNAPSHOT_SHADOW_SAMPLE", 0.01)


def journey_snapshot_write_enabled() -> bool:
    """Redis yazma: read path veya shadow açıkken."""
    return journey_snapshot_enabled() or journey_snapshot_shadow_enabled()


def should_shadow_sample_user(user_id: Any) -> bool:
    """Actor-hash örnekleme — kullanıcı başına deterministik; istek başına random yok."""
    rate = shadow_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    uid = _normalize_user_id(user_id)
    if not uid:
        return False
    bucket = int(hashlib.md5(uid.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


_shadow_log_last: dict[str, float] = {}
_SHADOW_LOG_THROTTLE_SEC = 300.0


def _normalize_user_id(user_id: Any) -> str:
    return str(user_id or "").strip().lower()


def _uid_eq(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return False
    return _normalize_user_id(a) == _normalize_user_id(b)


def _short_tag_id(tag_id: Any) -> str:
    s = str(tag_id or "").strip()
    if not s:
        return "n/a"
    if len(s) <= 12:
        return s
    return f"{s[:6]}…{s[-4:]}"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _snapshot_key(tag_id: str) -> str:
    return f"leylek:journey:snapshot:{tag_id}"


def _user_active_key(user_id: str) -> str:
    return f"leylek:journey:user_active:{_normalize_user_id(user_id)}"


def _ttl_for_status(status: str, *, was_cancelled_grace: bool) -> int:
    if was_cancelled_grace:
        return _env_int("JOURNEY_SNAPSHOT_TTL_TERMINAL_SEC", 12)
    st = str(status or "").strip().lower()
    if st in ("matched", "in_progress"):
        return min(30, max(20, _env_int("JOURNEY_SNAPSHOT_TTL_ACTIVE_SEC", 25)))
    if st in PASSENGER_ACTIVE_STATUSES:
        return _env_int("JOURNEY_SNAPSHOT_TTL_WAITING_SEC", 60)
    return _env_int("JOURNEY_SNAPSHOT_TTL_TERMINAL_SEC", 12)


def _redis_get(key: str) -> Optional[str]:
    r = get_redis_client()
    if r is None:
        return None
    try:
        return r.get(key)
    except Exception:
        return None


def _redis_setex(key: str, ttl: int, payload: str) -> None:
    r = get_redis_client()
    if r is None:
        return
    try:
        r.setex(key, max(1, int(ttl)), payload)
    except Exception:
        pass


def _redis_delete(key: str) -> None:
    r = get_redis_client()
    if r is None:
        return
    try:
        r.delete(key)
    except Exception:
        pass


def _get_user_active(user_id: str) -> Optional[dict[str, Any]]:
    raw = _redis_get(_user_active_key(user_id))
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _set_user_active(
    user_id: str,
    tag_id: str,
    status: str,
    role_hint: str,
    ttl: int,
) -> None:
    uid = _normalize_user_id(user_id)
    if not uid or not tag_id:
        return
    body = {
        "tag_id": str(tag_id).strip(),
        "status": str(status or "").strip().lower(),
        "role_hint": role_hint,
        "updated_at": _utc_now_iso(),
    }
    _redis_setex(_user_active_key(uid), ttl, json.dumps(body, default=str, ensure_ascii=False))


def clear_user_active(user_id: str) -> None:
    uid = _normalize_user_id(user_id)
    if not uid:
        return
    _redis_delete(_user_active_key(uid))


def invalidate_journey_snapshot(
    tag_id: Optional[str] = None,
    passenger_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    reason: str = "",
) -> None:
    try:
        tid = str(tag_id or "").strip()
        pid = _normalize_user_id(passenger_id) if passenger_id else ""
        did = _normalize_user_id(driver_id) if driver_id else ""

        if tid:
            _redis_delete(_snapshot_key(tid))
        if pid:
            clear_user_active(pid)
        if did:
            clear_user_active(did)

        logger.info(
            "JOURNEY_SNAPSHOT_INVALIDATE tag_id=%s passenger_id=%s driver_id=%s reason=%s",
            _short_tag_id(tid) if tid else "n/a",
            pid or "n/a",
            did or "n/a",
            str(reason or "").strip() or "n/a",
        )
    except Exception:
        pass


def _get_snapshot(tag_id: str) -> Optional[dict[str, Any]]:
    raw = _redis_get(_snapshot_key(tag_id))
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _set_snapshot(tag_id: str, snap: dict[str, Any], ttl: int) -> None:
    tid = str(tag_id or "").strip()
    if not tid:
        return
    _redis_setex(
        _snapshot_key(tid),
        ttl,
        json.dumps(snap, default=str, ensure_ascii=False),
    )


def _log_hit(role: str, tag_id: str, status: str) -> None:
    logger.info(
        "JOURNEY_SNAPSHOT_HIT role=%s tag_id=%s status=%s",
        role,
        _short_tag_id(tag_id),
        status,
    )


def _log_miss(role: str, reason: str, tag_id: Optional[str] = None) -> None:
    logger.debug(
        "JOURNEY_SNAPSHOT_MISS role=%s reason=%s tag_id=%s",
        role,
        reason,
        _short_tag_id(tag_id) if tag_id else "n/a",
    )


def _log_populate(role: str, tag_id: str, status: str, ttl: int) -> None:
    logger.info(
        "JOURNEY_SNAPSHOT_POPULATE role=%s tag_id=%s status=%s ttl_s=%s",
        role,
        _short_tag_id(tag_id),
        status,
        ttl,
    )


def _load_snapshot_for_user(
    resolved_user_id: str,
    *,
    role: str,
) -> Optional[tuple[dict[str, Any], dict[str, Any]]]:
    """(pointer, snapshot) veya None."""
    uid = _normalize_user_id(resolved_user_id)
    if not uid:
        _log_miss(role, "empty_user_id")
        return None

    pointer = _get_user_active(uid)
    if not pointer:
        _log_miss(role, "no_pointer")
        return None

    tag_id = str(pointer.get("tag_id") or "").strip()
    if not tag_id:
        clear_user_active(uid)
        _log_miss(role, "empty_pointer_tag_id")
        return None

    snap = _get_snapshot(tag_id)
    if not snap:
        clear_user_active(uid)
        _log_miss(role, "snapshot_missing", tag_id)
        return None

    if snap.get("schema_version") != SCHEMA_VERSION:
        _log_miss(role, "schema_mismatch", tag_id)
        return None

    if str(snap.get("tag_id") or "").strip() != tag_id:
        clear_user_active(uid)
        _log_miss(role, "pointer_snapshot_tag_mismatch", tag_id)
        return None

    ptr_status = str(pointer.get("status") or "").strip().lower()
    snap_status = str(snap.get("status") or "").strip().lower()
    if ptr_status and snap_status and ptr_status != snap_status:
        _log_miss(role, "pointer_status_mismatch", tag_id)
        return None

    return pointer, snap


def _load_snapshot_for_shadow(
    resolved_user_id: str,
    *,
    role: str,
) -> Optional[tuple[dict[str, Any], dict[str, Any]]]:
    """Shadow read — read-enable gate yok; miss logları yok."""
    try:
        uid = _normalize_user_id(resolved_user_id)
        if not uid:
            return None

        pointer = _get_user_active(uid)
        if not pointer:
            return None

        tag_id = str(pointer.get("tag_id") or "").strip()
        if not tag_id:
            return None

        snap = _get_snapshot(tag_id)
        if not snap:
            return None

        if snap.get("schema_version") != SCHEMA_VERSION:
            return None

        if str(snap.get("tag_id") or "").strip() != tag_id:
            return None

        return pointer, snap
    except Exception:
        return None


def _nested_status(tag: Any, field: str) -> Optional[str]:
    if not isinstance(tag, dict):
        return None
    nested = tag.get(field)
    if not isinstance(nested, dict):
        return None
    raw = nested.get("status")
    if raw is None:
        return None
    out = str(raw).strip().lower()
    return out if out else None


def _extract_compare_tuple(
    role: str,
    response: dict[str, Any],
    *,
    resolved_user_id: str = "",
) -> Optional[dict[str, Any]]:
    tag = response.get("tag")
    if tag is None:
        return {
            "tag_id": None,
            "passenger_id": None,
            "driver_id": None,
            "status": None,
            "end_request_status": None,
            "transfer_payment_status": None,
            "was_cancelled_grace": False,
        }
    if not isinstance(tag, dict):
        return None

    tag_id = str(tag.get("id") or "").strip() or None
    status = str(tag.get("status") or "").strip().lower() or None
    passenger_id = (
        _normalize_user_id(tag.get("passenger_id")) if tag.get("passenger_id") else None
    )
    driver_id = _normalize_user_id(tag.get("driver_id")) if tag.get("driver_id") else None
    uid = _normalize_user_id(resolved_user_id)
    if role == "passenger" and uid and not passenger_id:
        passenger_id = uid
    if role == "driver" and uid and not driver_id:
        driver_id = uid

    was_cancelled_grace = bool(response.get("was_cancelled")) and status == "cancelled"

    return {
        "tag_id": tag_id,
        "passenger_id": passenger_id,
        "driver_id": driver_id,
        "status": status,
        "end_request_status": _nested_status(tag, "end_request"),
        "transfer_payment_status": _nested_status(tag, "transfer_payment"),
        "was_cancelled_grace": was_cancelled_grace,
    }


def _extract_compare_tuple_from_snap(snap: dict[str, Any]) -> dict[str, Any]:
    tag_id = str(snap.get("tag_id") or "").strip() or None
    status = str(snap.get("status") or "").strip().lower() or None
    passenger_id = (
        _normalize_user_id(snap.get("passenger_id")) if snap.get("passenger_id") else None
    )
    driver_id = _normalize_user_id(snap.get("driver_id")) if snap.get("driver_id") else None
    was_cancelled_grace = bool(snap.get("was_cancelled_grace"))

    end_request_status: Optional[str] = None
    transfer_payment_status: Optional[str] = None
    resp = snap.get("passenger_response")
    if not isinstance(resp, dict):
        resp = snap.get("driver_response")
    if isinstance(resp, dict):
        end_request_status = _nested_status(resp.get("tag"), "end_request")
        transfer_payment_status = _nested_status(resp.get("tag"), "transfer_payment")

    return {
        "tag_id": tag_id,
        "passenger_id": passenger_id,
        "driver_id": driver_id,
        "status": status,
        "end_request_status": end_request_status,
        "transfer_payment_status": transfer_payment_status,
        "was_cancelled_grace": was_cancelled_grace,
    }


def _shadow_log_throttled(code: str, role: str, tag_id: Any, **extra: Any) -> None:
    tid = _short_tag_id(tag_id)
    key = f"{code}:{role}:{tid}"
    now = time.monotonic()
    last = _shadow_log_last.get(key, 0.0)
    if now - last < _SHADOW_LOG_THROTTLE_SEC:
        return
    _shadow_log_last[key] = now
    parts = " ".join(f"{k}={v}" for k, v in extra.items() if v is not None)
    if parts:
        logger.info("%s role=%s tag_id=%s %s", code, role, tid, parts)
    else:
        logger.info("%s role=%s tag_id=%s", code, role, tid)


def _shadow_compare_and_log(role: str, resolved_user_id: str, db_response: dict[str, Any]) -> None:
    """DB yanıtını mevcut Redis snapshot ile karşılaştır; hata yutulur."""
    try:
        if not journey_snapshot_shadow_enabled():
            return

        uid = _normalize_user_id(resolved_user_id)
        if not uid or not should_shadow_sample_user(uid):
            return

        db_tuple = _extract_compare_tuple(role, db_response, resolved_user_id=uid)
        if db_tuple is None:
            _shadow_log_throttled("JOURNEY_SNAPSHOT_SHADOW_ERROR", role, "n/a", reason="extract_db")
            return

        loaded = _load_snapshot_for_shadow(uid, role=role)
        db_tag_id = db_tuple.get("tag_id")

        if loaded is None:
            if db_tag_id:
                _shadow_log_throttled("JOURNEY_SNAPSHOT_SHADOW_MISS", role, db_tag_id, side="redis")
            else:
                logger.debug(
                    "JOURNEY_SNAPSHOT_SHADOW_AGREE role=%s tag_id=n/a reason=both_empty",
                    role,
                )
            return

        _, snap = loaded
        redis_tuple = _extract_compare_tuple_from_snap(snap)
        redis_tag_id = redis_tuple.get("tag_id")

        if not db_tag_id and redis_tag_id:
            _shadow_log_throttled(
                "JOURNEY_SNAPSHOT_SHADOW_STALE",
                role,
                redis_tag_id,
                redis_status=redis_tuple.get("status"),
            )
            return

        if db_tag_id and not redis_tag_id:
            _shadow_log_throttled("JOURNEY_SNAPSHOT_SHADOW_MISS", role, db_tag_id, side="redis_tag")
            return

        id_fields = ("tag_id", "passenger_id", "driver_id")
        if any(db_tuple.get(f) != redis_tuple.get(f) for f in id_fields):
            _shadow_log_throttled(
                "JOURNEY_SNAPSHOT_SHADOW_ID_DIVERGE",
                role,
                db_tag_id or redis_tag_id,
                db_tag_id=db_tuple.get("tag_id"),
                redis_tag_id=redis_tuple.get("tag_id"),
                db_passenger_id=db_tuple.get("passenger_id"),
                redis_passenger_id=redis_tuple.get("passenger_id"),
                db_driver_id=db_tuple.get("driver_id"),
                redis_driver_id=redis_tuple.get("driver_id"),
            )
            return

        if db_tuple.get("status") != redis_tuple.get("status"):
            _shadow_log_throttled(
                "JOURNEY_SNAPSHOT_SHADOW_STATUS_DIVERGE",
                role,
                db_tag_id or redis_tag_id,
                field="status",
                db=db_tuple.get("status"),
                redis=redis_tuple.get("status"),
            )
            return

        for field in ("end_request_status", "transfer_payment_status", "was_cancelled_grace"):
            db_val = db_tuple.get(field)
            redis_val = redis_tuple.get(field)
            if db_val is None and redis_val is None:
                continue
            if db_val != redis_val:
                _shadow_log_throttled(
                    "JOURNEY_SNAPSHOT_SHADOW_STATUS_DIVERGE",
                    role,
                    db_tag_id or redis_tag_id,
                    field=field,
                    db=db_val,
                    redis=redis_val,
                )
                return

        logger.debug(
            "JOURNEY_SNAPSHOT_SHADOW_AGREE role=%s tag_id=%s status=%s",
            role,
            _short_tag_id(db_tag_id),
            db_tuple.get("status"),
        )
    except Exception:
        try:
            _shadow_log_throttled("JOURNEY_SNAPSHOT_SHADOW_ERROR", role, "n/a", reason="exception")
        except Exception:
            pass


def try_get_passenger_active_tag(resolved_user_id: str) -> Optional[dict[str, Any]]:
    """Redis hit → yolcu active-tag yanıtı; miss/hata → None."""
    if not journey_snapshot_enabled():
        return None
    try:
        loaded = _load_snapshot_for_user(resolved_user_id, role="passenger")
        if not loaded:
            return None
        _, snap = loaded
        uid = _normalize_user_id(resolved_user_id)

        if not _uid_eq(snap.get("passenger_id"), uid):
            _log_miss("passenger", "passenger_id_mismatch", snap.get("tag_id"))
            return None

        status = str(snap.get("status") or "").strip().lower()
        was_grace = bool(snap.get("was_cancelled_grace"))

        if was_grace:
            if status != "cancelled":
                _log_miss("passenger", "invalid_cancelled_grace", snap.get("tag_id"))
                return None
        elif status not in PASSENGER_ACTIVE_STATUSES:
            _log_miss("passenger", "status_not_active", snap.get("tag_id"))
            return None

        resp = snap.get("passenger_response")
        if not isinstance(resp, dict):
            _log_miss("passenger", "no_passenger_response", snap.get("tag_id"))
            return None

        tag = resp.get("tag")
        if tag is None:
            if resp.get("success") is True:
                _log_hit("passenger", snap.get("tag_id", ""), "null")
                return copy.deepcopy(resp)
            _log_miss("passenger", "invalid_null_response", snap.get("tag_id"))
            return None

        if not isinstance(tag, dict):
            _log_miss("passenger", "invalid_tag_shape", snap.get("tag_id"))
            return None

        tag_st = str(tag.get("status") or "").strip().lower()
        if was_grace:
            if tag_st != "cancelled" or resp.get("was_cancelled") is not True:
                _log_miss("passenger", "cancelled_shape_mismatch", snap.get("tag_id"))
                return None
        elif tag_st not in PASSENGER_ACTIVE_STATUSES:
            _log_miss("passenger", "tag_status_not_active", snap.get("tag_id"))
            return None

        _log_hit("passenger", snap.get("tag_id", ""), tag_st)
        return copy.deepcopy(resp)
    except Exception:
        _log_miss("passenger", "exception")
        return None


def try_get_driver_active_tag(resolved_user_id: str) -> Optional[dict[str, Any]]:
    """Redis hit → sürücü active-tag/active-trip yanıtı; miss/hata → None."""
    if not journey_snapshot_enabled():
        return None
    try:
        loaded = _load_snapshot_for_user(resolved_user_id, role="driver")
        if not loaded:
            return None
        _, snap = loaded
        uid = _normalize_user_id(resolved_user_id)

        driver_id = snap.get("driver_id")
        if not driver_id:
            _log_miss("driver", "no_driver_id", snap.get("tag_id"))
            return None
        if not _uid_eq(driver_id, uid):
            _log_miss("driver", "driver_id_mismatch", snap.get("tag_id"))
            return None

        status = str(snap.get("status") or "").strip().lower()
        was_grace = bool(snap.get("was_cancelled_grace"))

        if was_grace:
            if status != "cancelled":
                _log_miss("driver", "invalid_cancelled_grace", snap.get("tag_id"))
                return None
        elif status not in DRIVER_ACTIVE_STATUSES:
            _log_miss("driver", "status_not_active", snap.get("tag_id"))
            return None

        resp = snap.get("driver_response")
        if not isinstance(resp, dict):
            _log_miss("driver", "no_driver_response", snap.get("tag_id"))
            return None

        tag_data = resp.get("tag")
        trip_data = resp.get("trip")
        if tag_data is None and trip_data is None:
            if resp.get("success") is True:
                _log_hit("driver", snap.get("tag_id", ""), "null")
                return copy.deepcopy(resp)
            _log_miss("driver", "invalid_null_response", snap.get("tag_id"))
            return None

        effective = tag_data if isinstance(tag_data, dict) else trip_data
        if not isinstance(effective, dict):
            _log_miss("driver", "invalid_tag_shape", snap.get("tag_id"))
            return None

        tag_st = str(effective.get("status") or "").strip().lower()
        if was_grace:
            if tag_st != "cancelled" or resp.get("was_cancelled") is not True:
                _log_miss("driver", "cancelled_shape_mismatch", snap.get("tag_id"))
                return None
        elif tag_st not in DRIVER_ACTIVE_STATUSES:
            _log_miss("driver", "tag_status_not_active", snap.get("tag_id"))
            return None

        if trip_data is not tag_data and isinstance(trip_data, dict) and isinstance(tag_data, dict):
            if trip_data != tag_data:
                _log_miss("driver", "trip_tag_mismatch", snap.get("tag_id"))
                return None

        _log_hit("driver", snap.get("tag_id", ""), tag_st)
        return copy.deepcopy(resp)
    except Exception:
        _log_miss("driver", "exception")
        return None


def populate_from_passenger_path(resolved_user_id: str, response: dict[str, Any]) -> None:
    """Supabase yolcu active-tag yanıtından snapshot populate (hata yutulur)."""
    if not journey_snapshot_write_enabled():
        return
    try:
        uid = _normalize_user_id(resolved_user_id)
        if not uid:
            return

        _shadow_compare_and_log("passenger", uid, response)

        tag = response.get("tag")
        if tag is None:
            clear_user_active(uid)
            return
        if not isinstance(tag, dict):
            return

        tag_id = str(tag.get("id") or "").strip()
        if not tag_id:
            return

        status = str(tag.get("status") or "").strip().lower()
        was_cancelled = bool(response.get("was_cancelled")) and status == "cancelled"
        ttl = _ttl_for_status(status, was_cancelled_grace=was_cancelled)

        snap = _get_snapshot(tag_id) or {}
        driver_id = tag.get("driver_id")
        snap.update(
            {
                "schema_version": SCHEMA_VERSION,
                "tag_id": tag_id,
                "status": status,
                "passenger_id": uid,
                "driver_id": _normalize_user_id(driver_id) if driver_id else snap.get("driver_id"),
                "cached_at": _utc_now_iso(),
                "was_cancelled_grace": was_cancelled,
                "passenger_response": copy.deepcopy(response),
            }
        )
        _set_snapshot(tag_id, snap, ttl)
        _set_user_active(uid, tag_id, status, "passenger", ttl)
        if driver_id and status in DRIVER_ACTIVE_STATUSES:
            _set_user_active(str(driver_id), tag_id, status, "driver", ttl)

        _log_populate("passenger", tag_id, status, ttl)
    except Exception:
        pass


def populate_from_driver_path(resolved_user_id: str, response: dict[str, Any]) -> None:
    """Supabase sürücü active-trip yanıtından snapshot populate (hata yutulur)."""
    if not journey_snapshot_write_enabled():
        return
    try:
        uid = _normalize_user_id(resolved_user_id)
        if not uid:
            return

        _shadow_compare_and_log("driver", uid, response)

        tag_data = response.get("tag")
        if tag_data is None:
            clear_user_active(uid)
            return
        if not isinstance(tag_data, dict):
            return

        tag_id = str(tag_data.get("id") or "").strip()
        if not tag_id:
            return

        status = str(tag_data.get("status") or "").strip().lower()
        was_cancelled = bool(response.get("was_cancelled")) and status == "cancelled"
        ttl = _ttl_for_status(status, was_cancelled_grace=was_cancelled)

        passenger_id = tag_data.get("passenger_id")
        snap = _get_snapshot(tag_id) or {}
        snap.update(
            {
                "schema_version": SCHEMA_VERSION,
                "tag_id": tag_id,
                "status": status,
                "driver_id": uid,
                "passenger_id": (
                    _normalize_user_id(passenger_id) if passenger_id else snap.get("passenger_id")
                ),
                "cached_at": _utc_now_iso(),
                "was_cancelled_grace": was_cancelled,
                "driver_response": copy.deepcopy(response),
            }
        )
        _set_snapshot(tag_id, snap, ttl)
        _set_user_active(uid, tag_id, status, "driver", ttl)
        if passenger_id and status in DRIVER_ACTIVE_STATUSES:
            _set_user_active(str(passenger_id), tag_id, status, "passenger", ttl)

        _log_populate("driver", tag_id, status, ttl)
    except Exception:
        pass
