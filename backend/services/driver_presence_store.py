"""
SCALE-3A-1 — Driver presence Redis write foundation (no read path).
SCALE-3B-1 — Shadow compare after write (HGETALL vs expected DB tuple).

DRIVER_PRESENCE_REDIS=0 (default) → yazma kapalı.
DRIVER_PRESENCE_SHADOW=1 → shadow yazma (default kapalı).
Redis hata/miss → sessiz; DB source of truth kalır.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

from redis_cache import get_redis_client

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1
_COORD_TOLERANCE = 1e-4
_LAST_SEEN_TOLERANCE_SEC = 2.0

_shadow_log_last: dict[str, float] = {}
_SHADOW_LOG_THROTTLE_SEC = 300.0


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


def presence_redis_enabled() -> bool:
    """DRIVER_PRESENCE_REDIS=1 → presence yazma açık (default kapalı)."""
    return _env_bool("DRIVER_PRESENCE_REDIS", False)


def presence_shadow_enabled() -> bool:
    """DRIVER_PRESENCE_SHADOW=1 → shadow yazma (default kapalı)."""
    return _env_bool("DRIVER_PRESENCE_SHADOW", False)


def presence_write_enabled() -> bool:
    """Redis yazma: read path veya shadow açıkken."""
    return presence_redis_enabled() or presence_shadow_enabled()


def shadow_sample_rate() -> float:
    """DRIVER_PRESENCE_SHADOW_SAMPLE — actor-hash örnekleme oranı (default 0.01)."""
    return _env_float("DRIVER_PRESENCE_SHADOW_SAMPLE", 0.01)


def should_shadow_sample_driver(driver_id: Any) -> bool:
    """Actor-hash örnekleme — sürücü başına deterministik; istek başına random yok."""
    rate = shadow_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    did = normalize_driver_id(driver_id)
    if not did:
        return False
    bucket = int(hashlib.md5(did.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


def ttl_online_sec() -> int:
    """DRIVER_PRESENCE_TTL_ONLINE_SEC — online TTL (default 180)."""
    return _env_int("DRIVER_PRESENCE_TTL_ONLINE_SEC", 180)


def ttl_offline_sec() -> int:
    """DRIVER_PRESENCE_TTL_OFFLINE_SEC — offline tombstone TTL (default 30)."""
    return _env_int("DRIVER_PRESENCE_TTL_OFFLINE_SEC", 30)


def normalize_driver_id(driver_id: Any) -> str:
    return str(driver_id or "").strip().lower()


def _short_driver_id(driver_id: Any) -> str:
    s = str(driver_id or "").strip()
    if not s:
        return "n/a"
    if len(s) <= 12:
        return s
    return f"{s[:6]}…{s[-4:]}"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _presence_key(driver_id: str) -> str:
    return f"leylek:presence:driver:{driver_id}"


def _decode_redis_hash(raw: Any) -> dict[str, str]:
    if not raw or not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in raw.items():
        key = k.decode() if isinstance(k, bytes) else str(k)
        if v is None:
            out[key] = ""
        elif isinstance(v, bytes):
            out[key] = v.decode()
        else:
            out[key] = str(v)
    return out


def _redis_hgetall_presence(driver_id: str) -> Optional[dict[str, str]]:
    """Shadow-only HGETALL; production read/dispatch path değil."""
    try:
        r = get_redis_client()
        if r is None:
            return None
        raw = r.hgetall(_presence_key(driver_id))
        if not raw:
            return None
        return _decode_redis_hash(raw)
    except Exception:
        return None


def _parse_coord(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coords_close(a: Any, b: Any, *, tol: float = _COORD_TOLERANCE) -> bool:
    fa = _parse_coord(a)
    fb = _parse_coord(b)
    if fa is None and fb is None:
        return True
    if fa is None or fb is None:
        return False
    return abs(fa - fb) <= tol


def _parse_iso_ts(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        text = str(value).strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text).timestamp()
    except (TypeError, ValueError):
        return None


def _last_seen_close(
    a: Any,
    b: Any,
    *,
    tol_sec: float = _LAST_SEEN_TOLERANCE_SEC,
) -> bool:
    ta = _parse_iso_ts(a)
    tb = _parse_iso_ts(b)
    if ta is None and tb is None:
        return True
    if ta is None or tb is None:
        return str(a or "") == str(b or "")
    return abs(ta - tb) <= tol_sec


def _redis_online_bool(raw: Any) -> bool:
    return str(raw or "").strip() in ("1", "true", "True", "yes", "on")


def _extract_db_presence_tuple(
    driver_id: str,
    *,
    driver_online: bool,
    last_seen: str,
    latitude: Optional[float],
    longitude: Optional[float],
    vehicle_kind: Optional[str],
    socket_id: Optional[str],
    socket_id_relevant: bool = True,
) -> dict[str, Any]:
    return {
        "driver_id": driver_id,
        "driver_online": driver_online,
        "last_seen": last_seen,
        "latitude": latitude,
        "longitude": longitude,
        "vehicle_kind": str(vehicle_kind or ""),
        "socket_id": str(socket_id or ""),
        "socket_id_relevant": socket_id_relevant,
    }


def _extract_redis_presence_tuple(raw: dict[str, str]) -> dict[str, Any]:
    return {
        "driver_id": normalize_driver_id(raw.get("driver_id")),
        "driver_online": _redis_online_bool(raw.get("driver_online")),
        "last_seen": str(raw.get("last_seen") or ""),
        "latitude": _parse_coord(raw.get("latitude")),
        "longitude": _parse_coord(raw.get("longitude")),
        "vehicle_kind": str(raw.get("vehicle_kind") or ""),
        "socket_id": str(raw.get("socket_id") or ""),
    }


def _shadow_log_throttled(code: str, driver_id: Any, **extra: Any) -> None:
    did = _short_driver_id(driver_id)
    key = f"{code}:{normalize_driver_id(driver_id)}"
    now = time.monotonic()
    last = _shadow_log_last.get(key, 0.0)
    if now - last < _SHADOW_LOG_THROTTLE_SEC:
        return
    _shadow_log_last[key] = now
    parts = " ".join(f"{k}={v}" for k, v in extra.items() if v is not None)
    if parts:
        logger.info("%s driver_id=%s %s", code, did, parts)
    else:
        logger.info("%s driver_id=%s", code, did)


def _shadow_compare_and_log(
    driver_id: Any,
    *,
    operation: str,
    expected: Optional[dict[str, Any]] = None,
    expect_missing: bool = False,
) -> None:
    """Yazma sonrası HGETALL ile beklenen DB tuple karşılaştırması; hata yutulur."""
    try:
        if not presence_shadow_enabled():
            return

        did = normalize_driver_id(driver_id)
        if not did or not should_shadow_sample_driver(did):
            return

        redis_raw = _redis_hgetall_presence(did)

        if expect_missing:
            if redis_raw is None:
                logger.debug(
                    "DRIVER_PRESENCE_SHADOW_AGREE driver_id=%s op=%s reason=missing",
                    _short_driver_id(did),
                    operation,
                )
                return
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_STALE",
                did,
                op=operation,
                redis_online=redis_raw.get("driver_online"),
            )
            return

        if redis_raw is None:
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_MISS",
                did,
                op=operation,
                side="redis",
            )
            return

        if expected is None:
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_ERROR",
                did,
                op=operation,
                reason="missing_expected",
            )
            return

        redis_tuple = _extract_redis_presence_tuple(redis_raw)

        if expected.get("driver_online") != redis_tuple.get("driver_online"):
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_STATUS_DIVERGE",
                did,
                op=operation,
                field="driver_online",
                db=expected.get("driver_online"),
                redis=redis_tuple.get("driver_online"),
            )
            return

        if not _coords_close(expected.get("latitude"), redis_tuple.get("latitude")) or not _coords_close(
            expected.get("longitude"), redis_tuple.get("longitude")
        ):
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_LOCATION_DIVERGE",
                did,
                op=operation,
                db_lat=expected.get("latitude"),
                db_lng=expected.get("longitude"),
                redis_lat=redis_tuple.get("latitude"),
                redis_lng=redis_tuple.get("longitude"),
            )
            return

        if not _last_seen_close(expected.get("last_seen"), redis_tuple.get("last_seen")):
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_STATUS_DIVERGE",
                did,
                op=operation,
                field="last_seen",
                db=expected.get("last_seen"),
                redis=redis_tuple.get("last_seen"),
            )
            return

        db_vk = str(expected.get("vehicle_kind") or "")
        redis_vk = str(redis_tuple.get("vehicle_kind") or "")
        if db_vk != redis_vk:
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_VEHICLE_DIVERGE",
                did,
                op=operation,
                db=db_vk or "n/a",
                redis=redis_vk or "n/a",
            )
            return

        if expected.get("socket_id_relevant", True):
            db_sid = str(expected.get("socket_id") or "")
            redis_sid = str(redis_tuple.get("socket_id") or "")
            if db_sid != redis_sid:
                _shadow_log_throttled(
                    "DRIVER_PRESENCE_SHADOW_STATUS_DIVERGE",
                    did,
                    op=operation,
                    field="socket_id",
                    db=db_sid or "n/a",
                    redis=redis_sid or "n/a",
                )
                return

        logger.debug(
            "DRIVER_PRESENCE_SHADOW_AGREE driver_id=%s op=%s online=%s",
            _short_driver_id(did),
            operation,
            expected.get("driver_online"),
        )
    except Exception:
        try:
            _shadow_log_throttled(
                "DRIVER_PRESENCE_SHADOW_ERROR",
                driver_id,
                op=operation,
                reason="exception",
            )
        except Exception:
            pass


def upsert_driver_presence(
    driver_id: Any,
    *,
    driver_online: bool,
    last_seen: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    vehicle_kind: Optional[str] = None,
    socket_id: Optional[str] = None,
    reason: str = "",
) -> None:
    """HSET + EXPIRE; tüm Redis hataları yutulur."""
    if not presence_write_enabled():
        return
    did = normalize_driver_id(driver_id)
    if not did:
        return
    try:
        now_iso = _utc_now_iso()
        last_seen_written = str(last_seen or now_iso)
        fields = {
            "driver_id": did,
            "driver_online": "1" if driver_online else "0",
            "last_seen": last_seen_written,
            "latitude": str(latitude) if latitude is not None else "",
            "longitude": str(longitude) if longitude is not None else "",
            "vehicle_kind": str(vehicle_kind or ""),
            "socket_id": str(socket_id or ""),
            "updated_at": now_iso,
            "schema_version": str(SCHEMA_VERSION),
        }
        ttl = ttl_online_sec() if driver_online else ttl_offline_sec()

        r = get_redis_client()
        if r is None:
            return
        key = _presence_key(did)
        r.hset(key, mapping=fields)
        r.expire(key, max(1, int(ttl)))

        logger.info(
            "DRIVER_PRESENCE_UPSERT driver_id=%s online=%s ttl_s=%s reason=%s",
            _short_driver_id(did),
            driver_online,
            ttl,
            str(reason or "").strip() or "n/a",
        )

        _shadow_compare_and_log(
            did,
            operation="upsert",
            expected=_extract_db_presence_tuple(
                did,
                driver_online=driver_online,
                last_seen=last_seen_written,
                latitude=latitude,
                longitude=longitude,
                vehicle_kind=vehicle_kind,
                socket_id=socket_id,
                socket_id_relevant=True,
            ),
        )
    except Exception:
        pass


def clear_socket_id(driver_id: Any, reason: str = "") -> None:
    """Yalnızca socket_id alanını temizler; driver_online değişmez."""
    if not presence_write_enabled():
        return
    did = normalize_driver_id(driver_id)
    if not did:
        return
    try:
        r = get_redis_client()
        if r is None:
            return
        key = _presence_key(did)
        if not r.exists(key):
            return
        r.hset(key, mapping={"socket_id": "", "updated_at": _utc_now_iso()})
        logger.info(
            "DRIVER_PRESENCE_SOCKET_CLEAR driver_id=%s reason=%s",
            _short_driver_id(did),
            str(reason or "").strip() or "n/a",
        )

        redis_raw = _redis_hgetall_presence(did)
        expected = None
        if redis_raw is not None:
            redis_tuple = _extract_redis_presence_tuple(redis_raw)
            expected = _extract_db_presence_tuple(
                did,
                driver_online=bool(redis_tuple.get("driver_online")),
                last_seen=str(redis_tuple.get("last_seen") or ""),
                latitude=redis_tuple.get("latitude"),
                longitude=redis_tuple.get("longitude"),
                vehicle_kind=str(redis_tuple.get("vehicle_kind") or ""),
                socket_id="",
                socket_id_relevant=True,
            )
        _shadow_compare_and_log(
            did,
            operation="clear_socket",
            expected=expected,
        )
    except Exception:
        pass


def clear_driver_presence(driver_id: Any, reason: str = "") -> None:
    """DEL presence key; tüm Redis hataları yutulur."""
    if not presence_write_enabled():
        return
    did = normalize_driver_id(driver_id)
    if not did:
        return
    try:
        r = get_redis_client()
        if r is None:
            return
        r.delete(_presence_key(did))
        logger.info(
            "DRIVER_PRESENCE_CLEAR driver_id=%s reason=%s",
            _short_driver_id(did),
            str(reason or "").strip() or "n/a",
        )

        _shadow_compare_and_log(
            did,
            operation="clear",
            expect_missing=True,
        )
    except Exception:
        pass


def upsert_driver_presence_from_user_row(
    driver_id: Any,
    row: dict[str, Any],
    reason: str = "",
) -> None:
    """users satırından presence alanlarını çıkarıp upsert eder."""
    if not presence_write_enabled():
        return
    if not isinstance(row, dict):
        return

    driver_online = bool(row.get("driver_online"))
    latitude = row.get("latitude")
    longitude = row.get("longitude")
    last_seen = row.get("last_location_update") or row.get("last_seen")

    vehicle_kind: Optional[str] = None
    driver_details = row.get("driver_details")
    if isinstance(driver_details, dict):
        raw_vk = driver_details.get("vehicle_kind")
        if raw_vk is not None:
            vehicle_kind = str(raw_vk)

    socket_id = row.get("socket_id")
    if socket_id is not None:
        socket_id = str(socket_id)

    upsert_driver_presence(
        driver_id,
        driver_online=driver_online,
        last_seen=str(last_seen) if last_seen is not None else None,
        latitude=float(latitude) if latitude is not None else None,
        longitude=float(longitude) if longitude is not None else None,
        vehicle_kind=vehicle_kind,
        socket_id=socket_id,
        reason=reason,
    )
