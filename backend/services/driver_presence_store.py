"""
SCALE-3A-1 — Driver presence Redis write foundation (no read path).

DRIVER_PRESENCE_REDIS=0 (default) → yazma kapalı.
DRIVER_PRESENCE_SHADOW=1 → shadow yazma (default kapalı).
Redis hata/miss → sessiz; DB source of truth kalır.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from redis_cache import get_redis_client

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1


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


def presence_redis_enabled() -> bool:
    """DRIVER_PRESENCE_REDIS=1 → presence yazma açık (default kapalı)."""
    return _env_bool("DRIVER_PRESENCE_REDIS", False)


def presence_shadow_enabled() -> bool:
    """DRIVER_PRESENCE_SHADOW=1 → shadow yazma (default kapalı)."""
    return _env_bool("DRIVER_PRESENCE_SHADOW", False)


def presence_write_enabled() -> bool:
    """Redis yazma: read path veya shadow açıkken."""
    return presence_redis_enabled() or presence_shadow_enabled()


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
        fields = {
            "driver_id": did,
            "driver_online": "1" if driver_online else "0",
            "last_seen": str(last_seen or now_iso),
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
