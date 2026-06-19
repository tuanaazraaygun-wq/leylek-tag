"""
SCALE-3A-1 — Driver presence Redis write foundation (no read path).
SCALE-3B-1 — Shadow compare after write (HGETALL vs expected DB tuple).
SCALE-3B-2 — Dispatch cohort shadow (DB online_rows vs Redis HGETALL; read-only).
SCALE-3C-1 — Passenger driver-location read canary (HGETALL; GET endpoint only).
SCALE-4A-1 — Driver GEO Redis write foundation (no dispatch read path).
SCALE-4C-1 — Dispatch GEO read canary (GEORADIUS + HGETALL; DB verify in server).

DRIVER_PRESENCE_REDIS=0 (default) → yazma kapalı.
DRIVER_PRESENCE_SHADOW=1 → shadow yazma (default kapalı).
DRIVER_PRESENCE_COHORT_SHADOW=0 (default) → dispatch cohort shadow kapalı.
DRIVER_PRESENCE_READ_SAMPLE=0.0 (default) → read canary kapalı.
DRIVER_GEO_REDIS=0 (default) → GEO yazma kapalı.
DRIVER_GEO_SHADOW=0 (default) → GEO shadow kapalı.
DRIVER_GEO_DISPATCH_SHADOW=0 (default) → dispatch GEO cohort shadow kapalı.
DRIVER_GEO_READ=0 (default) → dispatch GEO read canary kapalı.
DRIVER_GEO_READ_SAMPLE=0.0 (default) → read canary örnekleme kapalı.
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
from services.operation_snapshot import _driver_is_allowed_for_trip_vehicle, haversine_km

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


def presence_read_enabled() -> bool:
    """DRIVER_PRESENCE_REDIS=1 → presence read path açık (default kapalı)."""
    return _env_bool("DRIVER_PRESENCE_REDIS", False)


def read_sample_rate() -> float:
    """DRIVER_PRESENCE_READ_SAMPLE — actor-hash read örnekleme oranı (default 0.0)."""
    return _env_float("DRIVER_PRESENCE_READ_SAMPLE", 0.0)


def should_read_sample_driver(driver_id: Any) -> bool:
    """Actor-hash örnekleme — read path için deterministik; istek başına random yok."""
    rate = read_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    did = normalize_driver_id(driver_id)
    if not did:
        return False
    bucket = int(hashlib.md5(did.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


def cohort_shadow_enabled() -> bool:
    """DRIVER_PRESENCE_COHORT_SHADOW=1 → dispatch cohort shadow (default kapalı)."""
    return _env_bool("DRIVER_PRESENCE_COHORT_SHADOW", False)


def cohort_shadow_sample_rate() -> float:
    """DRIVER_PRESENCE_COHORT_SHADOW_SAMPLE — istek/tag hash örnekleme (default 0.01)."""
    return _env_float("DRIVER_PRESENCE_COHORT_SHADOW_SAMPLE", 0.01)


def cohort_shadow_max_rows() -> int:
    """DRIVER_PRESENCE_COHORT_SHADOW_MAX_ROWS — cohort başına max satır (default 25)."""
    return _env_int("DRIVER_PRESENCE_COHORT_SHADOW_MAX_ROWS", 25)


def should_cohort_shadow_sample(sample_key: Any) -> bool:
    """İstek/tag-hash örnekleme — deterministik; should_shadow_sample_driver ile aynı desen."""
    rate = cohort_shadow_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    key = str(sample_key or "").strip()
    if not key:
        return False
    bucket = int(hashlib.md5(key.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


def geo_redis_enabled() -> bool:
    """DRIVER_GEO_REDIS=1 → GEO yazma açık (default kapalı)."""
    return _env_bool("DRIVER_GEO_REDIS", False)


def geo_shadow_enabled() -> bool:
    """DRIVER_GEO_SHADOW=1 → GEO shadow doğrulama (default kapalı)."""
    return _env_bool("DRIVER_GEO_SHADOW", False)


def geo_write_enabled() -> bool:
    """GEO yazma: redis veya shadow açıkken."""
    return geo_redis_enabled() or geo_shadow_enabled()


def geo_write_sample_rate() -> float:
    """DRIVER_GEO_WRITE_SAMPLE — actor-hash GEO yazma örnekleme (default 1.0)."""
    return _env_float("DRIVER_GEO_WRITE_SAMPLE", 1.0)


def should_geo_write_sample_driver(driver_id: Any) -> bool:
    """Actor-hash örnekleme — GEO yazma için deterministik."""
    rate = geo_write_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    did = normalize_driver_id(driver_id)
    if not did:
        return False
    bucket = int(hashlib.md5(did.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


def geo_shadow_sample_rate() -> float:
    """DRIVER_GEO_SHADOW_SAMPLE — actor-hash GEO shadow örnekleme (default 0.01)."""
    return _env_float("DRIVER_GEO_SHADOW_SAMPLE", 0.01)


def should_geo_shadow_sample_driver(driver_id: Any) -> bool:
    """Actor-hash örnekleme — GEO shadow için deterministik."""
    rate = geo_shadow_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    did = normalize_driver_id(driver_id)
    if not did:
        return False
    bucket = int(hashlib.md5(did.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


def geo_dispatch_shadow_enabled() -> bool:
    """DRIVER_GEO_DISPATCH_SHADOW=1 → dispatch GEO cohort shadow (default kapalı)."""
    return _env_bool("DRIVER_GEO_DISPATCH_SHADOW", False)


def geo_dispatch_shadow_sample_rate() -> float:
    """DRIVER_GEO_DISPATCH_SHADOW_SAMPLE — istek/tag hash örnekleme (default 0.01)."""
    return _env_float("DRIVER_GEO_DISPATCH_SHADOW_SAMPLE", 0.01)


def geo_dispatch_shadow_max_rows() -> int:
    """DRIVER_GEO_DISPATCH_SHADOW_MAX_ROWS — GEO cohort başına max satır (default 50)."""
    return _env_int("DRIVER_GEO_DISPATCH_SHADOW_MAX_ROWS", 50)


def should_geo_dispatch_shadow_sample(sample_key: Any) -> bool:
    """İstek/tag-hash örnekleme — deterministik; should_cohort_shadow_sample ile aynı desen."""
    rate = geo_dispatch_shadow_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    key = str(sample_key or "").strip()
    if not key:
        return False
    bucket = int(hashlib.md5(key.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


def geo_dispatch_read_enabled() -> bool:
    """DRIVER_GEO_READ=1 → dispatch GEO read canary (default kapalı)."""
    return _env_bool("DRIVER_GEO_READ", False)


def geo_dispatch_read_sample_rate() -> float:
    """DRIVER_GEO_READ_SAMPLE — istek/tag hash örnekleme (default 0.0)."""
    return _env_float("DRIVER_GEO_READ_SAMPLE", 0.0)


def should_geo_dispatch_read_sample(sample_key: Any) -> bool:
    """İstek/tag-hash örnekleme — deterministik; should_geo_dispatch_shadow_sample ile aynı desen."""
    rate = geo_dispatch_read_sample_rate()
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    key = str(sample_key or "").strip()
    if not key:
        return False
    bucket = int(hashlib.md5(key.encode()).hexdigest()[:8], 16) % 10000
    return bucket < int(rate * 10000)


def geo_dispatch_read_max_ids() -> int:
    """DRIVER_GEO_MAX_IDS — GEO read başına max aday (default 50)."""
    return _env_int("DRIVER_GEO_MAX_IDS", 50)


def geo_dispatch_read_pipeline_enabled() -> bool:
    """DRIVER_GEO_PIPELINE=1 → HGETALL pipeline (default açık)."""
    return _env_bool("DRIVER_GEO_PIPELINE", True)


def geo_dispatch_read_db_verify_batch() -> int:
    """DRIVER_GEO_DB_VERIFY_BATCH — DB verify IN batch boyutu (default 50)."""
    return _env_int("DRIVER_GEO_DB_VERIFY_BATCH", 50)


def geo_dispatch_read_empty_fallback_enabled() -> bool:
    """DRIVER_GEO_READ_EMPTY_FALLBACK=1 → boş verify sonrası SQL fallback (default açık)."""
    return _env_bool("DRIVER_GEO_READ_EMPTY_FALLBACK", True)


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


_GEO_KEY_ALL = "leylek:geo:driver:all"
_GEO_KEY_CAR = "leylek:geo:driver:car"
_GEO_KEY_MOTORCYCLE = "leylek:geo:driver:motorcycle"


def _geo_key_for_vehicle_kind(kind: str) -> str:
    if kind == "motorcycle":
        return _GEO_KEY_MOTORCYCLE
    return _GEO_KEY_CAR


def _effective_geo_vehicle_kind(raw: Any) -> str:
    vk = str(raw or "").strip().lower()
    if vk == "motorcycle":
        return "motorcycle"
    return "car"


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


def _coords_valid(lat: Optional[float], lng: Optional[float]) -> bool:
    if lat is None or lng is None:
        return False
    if lat < -90.0 or lat > 90.0:
        return False
    if lng < -180.0 or lng > 180.0:
        return False
    return True


def _is_presence_stale(last_seen: Any, *, driver_online: bool) -> bool:
    ts = _parse_iso_ts(last_seen)
    if ts is None:
        return True
    ttl = ttl_online_sec() if driver_online else ttl_offline_sec()
    return (time.time() - ts) > float(max(1, ttl))


def _redis_hgetall_presence(driver_id: str) -> Optional[dict[str, str]]:
    """HGETALL presence hash; shadow + read canary."""
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


def _redis_hgetall_presence_batch(driver_ids: list[str]) -> Optional[list[Optional[dict[str, str]]]]:
    """Pipeline HGETALL; hata → None."""
    try:
        r = get_redis_client()
        if r is None:
            return None
        if not driver_ids:
            return []
        pipe = r.pipeline()
        for did in driver_ids:
            pipe.hgetall(_presence_key(did))
        raw_results = pipe.execute()
        out: list[Optional[dict[str, str]]] = []
        for raw in raw_results or []:
            if not raw:
                out.append(None)
            else:
                out.append(_decode_redis_hash(raw))
        return out
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


def _read_log_throttled(code: str, driver_id: Any, **extra: Any) -> None:
    _shadow_log_throttled(code, driver_id, **extra)


def _validate_presence_for_read(raw: dict[str, str], driver_id: str) -> Optional[dict[str, Any]]:
    did = normalize_driver_id(driver_id)
    if str(raw.get("schema_version") or "") != str(SCHEMA_VERSION):
        return None
    if normalize_driver_id(raw.get("driver_id")) != did:
        return None

    driver_online_raw = raw.get("driver_online")
    if driver_online_raw is None or str(driver_online_raw).strip() == "":
        return None
    driver_online = _redis_online_bool(driver_online_raw)

    last_seen = str(raw.get("last_seen") or "")
    if not last_seen or _parse_iso_ts(last_seen) is None:
        return None
    if _is_presence_stale(last_seen, driver_online=driver_online):
        return None

    lat = _parse_coord(raw.get("latitude"))
    lng = _parse_coord(raw.get("longitude"))
    if not _coords_valid(lat, lng):
        return None

    return {
        "latitude": lat,
        "longitude": lng,
        "last_seen": last_seen,
        "driver_online": driver_online,
        "vehicle_kind": str(raw.get("vehicle_kind") or ""),
    }


def try_get_driver_presence_for_read(driver_id: Any) -> Optional[dict[str, Any]]:
    """Redis hit → sürücü presence okuma; miss/hata/stale → None."""
    if not presence_read_enabled():
        return None
    did = normalize_driver_id(driver_id)
    if not did or not should_read_sample_driver(did):
        return None
    try:
        redis_raw = _redis_hgetall_presence(did)
        if not redis_raw:
            _read_log_throttled("DRIVER_PRESENCE_READ_MISS", did)
            return None

        validated = _validate_presence_for_read(redis_raw, did)
        if validated is None:
            _read_log_throttled("DRIVER_PRESENCE_READ_INVALID", did)
            return None

        _read_log_throttled(
            "DRIVER_PRESENCE_READ_HIT",
            did,
            online=validated.get("driver_online"),
        )
        return validated
    except Exception:
        try:
            _read_log_throttled(
                "DRIVER_PRESENCE_READ_ERROR",
                did or driver_id,
                reason="exception",
            )
        except Exception:
            pass
        return None


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


def _extract_db_presence_from_dispatch_row(row: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Dispatch online_rows satırından presence tuple; socket_id karşılaştırılmaz."""
    if not isinstance(row, dict):
        return None
    did = normalize_driver_id(row.get("id"))
    if not did:
        return None

    lat: Optional[float] = None
    lng: Optional[float] = None
    try:
        if row.get("latitude") is not None:
            lat = float(row["latitude"])
    except (TypeError, ValueError):
        pass
    try:
        if row.get("longitude") is not None:
            lng = float(row["longitude"])
    except (TypeError, ValueError):
        pass

    last_seen_raw = row.get("last_location_update") or row.get("last_seen")
    last_seen = str(last_seen_raw) if last_seen_raw is not None else ""

    vehicle_kind: Optional[str] = None
    driver_details = row.get("driver_details")
    if isinstance(driver_details, dict):
        raw_vk = driver_details.get("vehicle_kind")
        if raw_vk is not None:
            vehicle_kind = str(raw_vk)

    return _extract_db_presence_tuple(
        did,
        driver_online=bool(row.get("driver_online")),
        last_seen=last_seen,
        latitude=lat,
        longitude=lng,
        vehicle_kind=vehicle_kind,
        socket_id=None,
        socket_id_relevant=False,
    )


def _cohort_shadow_compare_dispatch_row(row: dict[str, Any], *, reason: str = "") -> None:
    """Tek dispatch satırı HGETALL vs DB; hata yutulur."""
    try:
        expected = _extract_db_presence_from_dispatch_row(row)
        if expected is None:
            return

        did = expected["driver_id"]
        redis_raw = _redis_hgetall_presence(did)
        if redis_raw is None:
            _shadow_log_throttled(
                "DRIVER_PRESENCE_COHORT_SHADOW_MISS",
                did,
                dispatch_reason=reason,
            )
            return

        redis_tuple = _extract_redis_presence_tuple(redis_raw)

        if expected.get("driver_online") != redis_tuple.get("driver_online"):
            _shadow_log_throttled(
                "DRIVER_PRESENCE_COHORT_SHADOW_STATUS_DIVERGE",
                did,
                dispatch_reason=reason,
                field="driver_online",
                db=expected.get("driver_online"),
                redis=redis_tuple.get("driver_online"),
            )
            return

        if not _coords_close(expected.get("latitude"), redis_tuple.get("latitude")) or not _coords_close(
            expected.get("longitude"), redis_tuple.get("longitude")
        ):
            _shadow_log_throttled(
                "DRIVER_PRESENCE_COHORT_SHADOW_LOCATION_DIVERGE",
                did,
                dispatch_reason=reason,
                db_lat=expected.get("latitude"),
                db_lng=expected.get("longitude"),
                redis_lat=redis_tuple.get("latitude"),
                redis_lng=redis_tuple.get("longitude"),
            )
            return

        if not _last_seen_close(expected.get("last_seen"), redis_tuple.get("last_seen")):
            _shadow_log_throttled(
                "DRIVER_PRESENCE_COHORT_SHADOW_STATUS_DIVERGE",
                did,
                dispatch_reason=reason,
                field="last_seen",
                db=expected.get("last_seen"),
                redis=redis_tuple.get("last_seen"),
            )
            return

        db_vk = str(expected.get("vehicle_kind") or "")
        redis_vk = str(redis_tuple.get("vehicle_kind") or "")
        if db_vk != redis_vk:
            _shadow_log_throttled(
                "DRIVER_PRESENCE_COHORT_SHADOW_VEHICLE_DIVERGE",
                did,
                dispatch_reason=reason,
                db=db_vk or "n/a",
                redis=redis_vk or "n/a",
            )
            return

        if "is_active" in redis_raw:
            db_is_active = bool(row.get("is_active"))
            redis_is_active = _redis_online_bool(redis_raw.get("is_active"))
            if db_is_active != redis_is_active:
                _shadow_log_throttled(
                    "DRIVER_PRESENCE_COHORT_SHADOW_STATUS_DIVERGE",
                    did,
                    dispatch_reason=reason,
                    field="is_active",
                    db=db_is_active,
                    redis=redis_is_active,
                )
                return

        _shadow_log_throttled(
            "DRIVER_PRESENCE_COHORT_SHADOW_AGREE",
            did,
            dispatch_reason=reason,
            online=expected.get("driver_online"),
        )
    except Exception:
        try:
            did = normalize_driver_id(row.get("id") if isinstance(row, dict) else "")
            _shadow_log_throttled(
                "DRIVER_PRESENCE_COHORT_SHADOW_ERROR",
                did or "n/a",
                dispatch_reason=reason,
                err="row",
            )
        except Exception:
            pass


def shadow_compare_dispatch_rows(
    rows: Any,
    *,
    reason: str = "",
    sample_key: Any = "",
    max_rows: Optional[int] = None,
) -> None:
    """Dispatch cohort shadow: DB online_rows vs Redis HGETALL; dispatch davranışını değiştirmez."""
    try:
        if not cohort_shadow_enabled():
            return
        if not should_cohort_shadow_sample(sample_key):
            return
        if not rows or not isinstance(rows, list):
            return

        cap = max_rows if max_rows is not None else cohort_shadow_max_rows()
        for row in rows[: max(0, cap)]:
            if isinstance(row, dict):
                _cohort_shadow_compare_dispatch_row(row, reason=reason)
    except Exception:
        try:
            _shadow_log_throttled(
                "DRIVER_PRESENCE_COHORT_SHADOW_ERROR",
                sample_key,
                dispatch_reason=reason,
                err="batch",
            )
        except Exception:
            pass


def _geo_dispatch_shadow_key(vehicle_filter: bool, passenger_vehicle_kind: Any) -> str:
    if not vehicle_filter:
        return _GEO_KEY_ALL
    return _geo_key_for_vehicle_kind(_effective_geo_vehicle_kind(passenger_vehicle_kind))


def _decode_geo_member(member: Any) -> str:
    if isinstance(member, bytes):
        return normalize_driver_id(member.decode())
    return normalize_driver_id(member)


def fetch_geo_dispatch_candidate_ids(
    pickup_lat: float,
    pickup_lng: float,
    radius_km: float,
    vehicle_filter: bool,
    passenger_vehicle_kind: Any,
    max_ids: int,
) -> Optional[list[str]]:
    """Redis GEORADIUS + presence doğrulama; hata → None, başarı → sıralı aday id listesi."""
    try:
        try:
            plat = float(pickup_lat)
            plng = float(pickup_lng)
            rk = max(0.001, float(radius_km))
        except (TypeError, ValueError):
            return None

        cap = max(1, int(max_ids))
        geo_key = _geo_dispatch_shadow_key(vehicle_filter, passenger_vehicle_kind)

        geo_raw = _redis_georadius_driver_ids(
            geo_key,
            pickup_lng=plng,
            pickup_lat=plat,
            radius_km=rk,
            max_rows=cap,
        )
        if geo_raw is None:
            return None

        ids = [normalize_driver_id(x) for x in (geo_raw or []) if x]
        ids = [x for x in ids if x][:cap]
        if not ids:
            return []

        if geo_dispatch_read_pipeline_enabled():
            presence_rows = _redis_hgetall_presence_batch(ids)
            if presence_rows is None:
                return None
        else:
            presence_rows = [_redis_hgetall_presence(did) for did in ids]

        candidates: list[str] = []
        for did, redis_raw in zip(ids, presence_rows):
            if not redis_raw:
                continue
            validated = _validate_presence_for_read(redis_raw, did)
            if validated is None:
                continue
            if not validated.get("driver_online"):
                continue
            candidates.append(did)

        return candidates
    except Exception:
        return None


def _redis_georadius_driver_ids(
    geo_key: str,
    *,
    pickup_lng: float,
    pickup_lat: float,
    radius_km: float,
    max_rows: int,
) -> Optional[list[str]]:
    """GEOSEARCH veya GEORADIUS ile üye listesi; hata → None."""
    try:
        r = get_redis_client()
        if r is None:
            return None
        count = max(1, int(max_rows))
        radius = max(0.001, float(radius_km))
        try:
            if hasattr(r, "geosearch"):
                raw = r.geosearch(
                    name=geo_key,
                    longitude=pickup_lng,
                    latitude=pickup_lat,
                    radius=radius,
                    unit="km",
                    count=count,
                    sort="ASC",
                )
                return [_decode_geo_member(m) for m in (raw or []) if m]
        except Exception:
            pass
        raw = r.georadius(
            geo_key,
            pickup_lng,
            pickup_lat,
            radius,
            unit="km",
            sort="ASC",
            count=count,
        )
        return [_decode_geo_member(m) for m in (raw or []) if m]
    except Exception:
        return None


def _build_db_geodesic_cohort(
    rows: list,
    *,
    pickup_lat: float,
    pickup_lng: float,
    radius_km: float,
    passenger_vehicle_kind: Any,
    vehicle_filter: bool,
) -> dict[str, dict[str, Any]]:
    """online_rows içinden haversine ≤ radius_km DB kohortu; dispatch filtrelemesi yapmaz."""
    out: dict[str, dict[str, Any]] = {}
    rk = max(0.001, float(radius_km))
    for row in rows:
        if not isinstance(row, dict):
            continue
        did = normalize_driver_id(row.get("id"))
        if not did:
            continue
        lat = _parse_coord(row.get("latitude"))
        lng = _parse_coord(row.get("longitude"))
        if not _coords_valid(lat, lng):
            continue
        try:
            dist = haversine_km(pickup_lat, pickup_lng, float(lat), float(lng))
        except (TypeError, ValueError):
            continue
        if dist > rk:
            continue
        if vehicle_filter and not _driver_is_allowed_for_trip_vehicle(row, passenger_vehicle_kind):
            continue
        out[did] = row
    return out


def _vehicle_kind_from_dispatch_row(row: dict[str, Any]) -> str:
    driver_details = row.get("driver_details")
    if isinstance(driver_details, dict):
        return _effective_geo_vehicle_kind(driver_details.get("vehicle_kind"))
    return "car"


def shadow_compare_dispatch_geo_cohort(
    rows: Any,
    *,
    pickup_lat: float,
    pickup_lng: float,
    radius_km: float,
    passenger_vehicle_kind: Any,
    vehicle_filter: bool,
    reason: str = "",
    sample_key: Any = "",
    max_rows: Optional[int] = None,
) -> None:
    """Dispatch GEO cohort shadow: DB haversine kohort vs Redis GEORADIUS; dispatch değiştirmez."""
    try:
        if not geo_dispatch_shadow_enabled():
            return
        if not should_geo_dispatch_shadow_sample(sample_key):
            return
        if not rows or not isinstance(rows, list):
            return

        try:
            plat = float(pickup_lat)
            plng = float(pickup_lng)
            rk = max(0.001, float(radius_km))
        except (TypeError, ValueError):
            return

        cap = max_rows if max_rows is not None else geo_dispatch_shadow_max_rows()
        geo_key = _geo_dispatch_shadow_key(vehicle_filter, passenger_vehicle_kind)

        db_cohort = _build_db_geodesic_cohort(
            rows,
            pickup_lat=plat,
            pickup_lng=plng,
            radius_km=rk,
            passenger_vehicle_kind=passenger_vehicle_kind,
            vehicle_filter=vehicle_filter,
        )
        db_ids = set(db_cohort.keys())

        geo_raw = _redis_georadius_driver_ids(
            geo_key,
            pickup_lng=plng,
            pickup_lat=plat,
            radius_km=rk,
            max_rows=cap,
        )
        if geo_raw is None:
            _shadow_log_throttled(
                "DRIVER_GEO_DISPATCH_SHADOW_ERROR",
                sample_key,
                dispatch_reason=reason,
                err="geo_query",
                geo_key=geo_key,
            )
            return

        geo_ids = {normalize_driver_id(x) for x in geo_raw if x}
        overlap = db_ids & geo_ids
        missing_in_geo = db_ids - geo_ids
        extra_in_geo = geo_ids - db_ids

        stale_count = 0
        kind_diverge_count = 0

        for did in overlap:
            row = db_cohort.get(did)
            if row is None:
                continue
            redis_raw = _redis_hgetall_presence(did)
            if redis_raw is None:
                stale_count += 1
                _shadow_log_throttled(
                    "DRIVER_GEO_DISPATCH_SHADOW_STALE",
                    did,
                    dispatch_reason=reason,
                    side="presence_missing",
                )
                continue
            driver_online = bool(row.get("driver_online"))
            last_seen = row.get("last_location_update") or row.get("last_seen")
            if _is_presence_stale(last_seen, driver_online=driver_online):
                stale_count += 1
                _shadow_log_throttled(
                    "DRIVER_GEO_DISPATCH_SHADOW_STALE",
                    did,
                    dispatch_reason=reason,
                    side="presence_stale",
                )
            db_kind = _vehicle_kind_from_dispatch_row(row)
            redis_kind = _effective_geo_vehicle_kind(redis_raw.get("vehicle_kind"))
            if db_kind != redis_kind:
                kind_diverge_count += 1
                _shadow_log_throttled(
                    "DRIVER_GEO_DISPATCH_SHADOW_KIND_DIVERGE",
                    did,
                    dispatch_reason=reason,
                    db=db_kind,
                    redis=redis_kind,
                )

        for did in sorted(missing_in_geo)[:cap]:
            _shadow_log_throttled(
                "DRIVER_GEO_DISPATCH_SHADOW_MISS",
                did,
                dispatch_reason=reason,
                side="geo",
            )

        for did in sorted(extra_in_geo)[:cap]:
            _shadow_log_throttled(
                "DRIVER_GEO_DISPATCH_SHADOW_EXTRA",
                did,
                dispatch_reason=reason,
                side="geo",
            )

        agree = (
            len(db_ids) == len(geo_ids)
            and not missing_in_geo
            and not extra_in_geo
            and stale_count == 0
            and kind_diverge_count == 0
        )

        logger.info(
            "DRIVER_GEO_DISPATCH_SHADOW_SUMMARY dispatch_reason=%s geo_key=%s "
            "db_count=%s geo_count=%s overlap=%s missing_in_geo=%s extra_in_geo=%s "
            "stale=%s kind_diverge=%s radius_km=%.3f vehicle_filter=%s agree=%s",
            str(reason or "").strip() or "n/a",
            geo_key,
            len(db_ids),
            len(geo_ids),
            len(overlap),
            len(missing_in_geo),
            len(extra_in_geo),
            stale_count,
            kind_diverge_count,
            rk,
            vehicle_filter,
            agree,
        )

        if agree:
            _shadow_log_throttled(
                "DRIVER_GEO_DISPATCH_SHADOW_AGREE",
                sample_key,
                dispatch_reason=reason,
                geo_key=geo_key,
                db_count=len(db_ids),
            )
    except Exception:
        try:
            _shadow_log_throttled(
                "DRIVER_GEO_DISPATCH_SHADOW_ERROR",
                sample_key,
                dispatch_reason=reason,
                err="exception",
            )
        except Exception:
            pass


def _geo_clear_driver(driver_id: Any, reason: str = "") -> None:
    """ZREM from all GEO keys; hata yutulur."""
    try:
        did = normalize_driver_id(driver_id)
        if not did:
            return
        r = get_redis_client()
        if r is None:
            return
        for key in (_GEO_KEY_ALL, _GEO_KEY_CAR, _GEO_KEY_MOTORCYCLE):
            r.zrem(key, did)
    except Exception:
        pass


def _geo_upsert_driver(
    driver_id: Any,
    *,
    online: bool,
    latitude: Optional[float],
    longitude: Optional[float],
    vehicle_kind: Optional[str],
    reason: str = "",
) -> None:
    """GEOADD / ZREM driver GEO keys; hata yutulur."""
    try:
        if not geo_write_enabled():
            return
        did = normalize_driver_id(driver_id)
        if not did or not should_geo_write_sample_driver(did):
            return

        r = get_redis_client()
        if r is None:
            return

        effective_kind = _effective_geo_vehicle_kind(vehicle_kind)

        if not online or not _coords_valid(latitude, longitude):
            _geo_clear_driver(did, reason=reason)
            return

        old_kind: Optional[str] = None
        try:
            presence_raw = _redis_hgetall_presence(did)
            if presence_raw:
                old_kind = _effective_geo_vehicle_kind(presence_raw.get("vehicle_kind"))
        except Exception:
            pass

        if old_kind is not None and old_kind != effective_kind:
            r.zrem(_geo_key_for_vehicle_kind(old_kind), did)

        lng = float(longitude)  # type: ignore[arg-type]
        lat = float(latitude)  # type: ignore[arg-type]

        r.geoadd(_GEO_KEY_ALL, (lng, lat, did))
        kind_key = _geo_key_for_vehicle_kind(effective_kind)
        r.geoadd(kind_key, (lng, lat, did))

        opposite_key = (
            _GEO_KEY_CAR if effective_kind == "motorcycle" else _GEO_KEY_MOTORCYCLE
        )
        r.zrem(opposite_key, did)

        _geo_shadow_compare(
            did,
            expected_lat=lat,
            expected_lng=lng,
            effective_kind=effective_kind,
            reason=reason,
        )
    except Exception:
        pass


def _geo_shadow_compare(
    driver_id: Any,
    *,
    expected_lat: float,
    expected_lng: float,
    effective_kind: str,
    reason: str = "",
) -> None:
    """Yazma sonrası GEOPOS doğrulama; hata yutulur."""
    try:
        if not geo_shadow_enabled():
            return
        did = normalize_driver_id(driver_id)
        if not did or not should_geo_shadow_sample_driver(did):
            return

        r = get_redis_client()
        if r is None:
            return

        all_pos = r.geopos(_GEO_KEY_ALL, did)
        if not all_pos or all_pos[0] is None:
            _shadow_log_throttled(
                "DRIVER_GEO_SHADOW_MISS",
                did,
                reason=str(reason or "").strip() or "n/a",
                key="all",
            )
            return

        redis_lng, redis_lat = all_pos[0]
        if not _coords_close(redis_lat, expected_lat) or not _coords_close(
            redis_lng, expected_lng
        ):
            _shadow_log_throttled(
                "DRIVER_GEO_SHADOW_LOCATION_DIVERGE",
                did,
                reason=str(reason or "").strip() or "n/a",
                expected_lat=expected_lat,
                expected_lng=expected_lng,
                redis_lat=redis_lat,
                redis_lng=redis_lng,
            )
            return

        kind_key = _geo_key_for_vehicle_kind(effective_kind)
        kind_pos = r.geopos(kind_key, did)
        if not kind_pos or kind_pos[0] is None:
            _shadow_log_throttled(
                "DRIVER_GEO_SHADOW_KIND_DIVERGE",
                did,
                reason=str(reason or "").strip() or "n/a",
                expected_kind=effective_kind,
                side="kind_missing",
            )
            return

        opposite_key = (
            _GEO_KEY_CAR if effective_kind == "motorcycle" else _GEO_KEY_MOTORCYCLE
        )
        try:
            opposite_score = r.zscore(opposite_key, did)
            if opposite_score is not None:
                _shadow_log_throttled(
                    "DRIVER_GEO_SHADOW_KIND_DIVERGE",
                    did,
                    reason=str(reason or "").strip() or "n/a",
                    expected_kind=effective_kind,
                    side="opposite_present",
                )
                return
        except Exception:
            pass

        logger.debug(
            "DRIVER_GEO_SHADOW_AGREE driver_id=%s kind=%s reason=%s",
            _short_driver_id(did),
            effective_kind,
            str(reason or "").strip() or "n/a",
        )
    except Exception:
        try:
            _shadow_log_throttled(
                "DRIVER_GEO_SHADOW_ERROR",
                driver_id,
                reason=str(reason or "").strip() or "n/a",
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
    if not presence_write_enabled() and not geo_write_enabled():
        return
    did = normalize_driver_id(driver_id)
    if not did:
        return
    try:
        if presence_write_enabled():
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
            if r is not None:
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

        _geo_upsert_driver(
            did,
            online=driver_online,
            latitude=latitude,
            longitude=longitude,
            vehicle_kind=vehicle_kind,
            reason=reason,
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
    if not presence_write_enabled() and not geo_write_enabled():
        return
    did = normalize_driver_id(driver_id)
    if not did:
        return
    try:
        if presence_write_enabled():
            r = get_redis_client()
            if r is not None:
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

        _geo_clear_driver(did, reason=reason)
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
