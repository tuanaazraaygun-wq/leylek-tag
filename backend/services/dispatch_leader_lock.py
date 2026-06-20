"""
SCALE-6C-1 — Dispatch leader lock read-only observability.

DISPATCH_LEADER_LOCK_ENABLED=0 (default) → no enforcement (future phases).
Read-only GET on leylek:dispatch:leader; no SET / EXPIRE / DEL / acquire.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from redis_cache import get_redis_client
from services import cluster_observability

LEADER_KEY = "leylek:dispatch:leader"


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def dispatch_leader_lock_enabled() -> bool:
    """DISPATCH_LEADER_LOCK_ENABLED=1 → future enforcement (default kapalı)."""
    return _env_bool("DISPATCH_LEADER_LOCK_ENABLED", False)


def dispatch_leader_lock_shadow_enabled() -> bool:
    """DISPATCH_LEADER_LOCK_SHADOW=1 → future shadow acquire (default kapalı)."""
    return _env_bool("DISPATCH_LEADER_LOCK_SHADOW", False)


def dispatch_leader_log_heartbeat_enabled() -> bool:
    """DISPATCH_LEADER_LOG_HEARTBEAT=1 → leader alanları cluster_obs logunda."""
    return _env_bool("DISPATCH_LEADER_LOG_HEARTBEAT", False)


def dispatch_leader_ttl_sec() -> int:
    """DISPATCH_LEADER_TTL_SEC — varsayılan 30, aralık [10, 120]."""
    raw = os.getenv("DISPATCH_LEADER_TTL_SEC", "30").strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 30
    return max(10, min(120, value))


def dispatch_leader_renew_sec() -> int:
    """DISPATCH_LEADER_RENEW_SEC — varsayılan 10, aralık [3, ttl/2]."""
    ttl = dispatch_leader_ttl_sec()
    max_renew = max(3, ttl // 2)
    raw = os.getenv("DISPATCH_LEADER_RENEW_SEC", "10").strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 10
    return max(3, min(max_renew, value))


def read_leader_holder() -> Optional[str]:
    """Redis GET only; hata veya miss → None."""
    try:
        client = get_redis_client()
        if client is None:
            return None
        raw = client.get(LEADER_KEY)
        if raw is None:
            return None
        holder = str(raw).strip()
        return holder if holder else None
    except Exception:
        return None


def leader_lock_status_snapshot() -> dict[str, Any]:
    """Read-only leader lock durumu; Redis yazma veya acquire yok."""
    node_id = cluster_observability.get_node_id()
    ttl_sec = dispatch_leader_ttl_sec()
    renew_sec = dispatch_leader_renew_sec()
    enabled = dispatch_leader_lock_enabled()
    shadow_enabled = dispatch_leader_lock_shadow_enabled()
    redis_available = False
    error: Optional[str] = None
    holder: Optional[str] = None

    try:
        client = get_redis_client()
        redis_available = client is not None
        if client is not None:
            try:
                raw = client.get(LEADER_KEY)
                if raw is not None:
                    s = str(raw).strip()
                    holder = s if s else None
            except Exception as exc:
                error = type(exc).__name__
        else:
            error = "redis_unavailable"
    except Exception as exc:
        error = type(exc).__name__

    is_leader = bool(holder and holder == node_id)

    return {
        "enabled": enabled,
        "shadow_enabled": shadow_enabled,
        "node_id": node_id,
        "leader_key": LEADER_KEY,
        "holder": holder,
        "is_leader": is_leader,
        "ttl_sec": ttl_sec,
        "renew_sec": renew_sec,
        "redis_available": redis_available,
        "error": error,
    }
