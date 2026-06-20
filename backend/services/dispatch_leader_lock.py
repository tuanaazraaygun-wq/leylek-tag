"""
SCALE-6C-1 / SCALE-6C-2 — Dispatch leader lock observability + shadow acquire.

DISPATCH_LEADER_LOCK_ENABLED=0 (default) → no dispatch enforcement.
DISPATCH_LEADER_LOCK_SHADOW=0 (default) → no Redis SET/EXPIRE/DEL.
DISPATCH_LEADER_LOCK_SHADOW=1 → shadow loop: SET NX EX + renew if holder; no dispatch gate.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from redis_cache import get_redis_client
from services import cluster_observability

LEADER_KEY = "leylek:dispatch:leader"

_RENEW_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], ARGV[2])
else
  return 0
end
"""

_RELEASE_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
"""


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def dispatch_leader_lock_enabled() -> bool:
    """DISPATCH_LEADER_LOCK_ENABLED=1 → future enforcement (default kapalı)."""
    return _env_bool("DISPATCH_LEADER_LOCK_ENABLED", False)


def dispatch_leader_lock_shadow_enabled() -> bool:
    """DISPATCH_LEADER_LOCK_SHADOW=1 → shadow acquire loop (default kapalı)."""
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


def _node_id() -> str:
    return cluster_observability.get_node_id()


def _base_result(**extra: Any) -> dict[str, Any]:
    ttl_sec = dispatch_leader_ttl_sec()
    out: dict[str, Any] = {
        "node_id": _node_id(),
        "leader_key": LEADER_KEY,
        "holder": None,
        "is_leader": False,
        "ttl_sec": ttl_sec,
        "renew_sec": dispatch_leader_renew_sec(),
        "redis_available": False,
        "error": None,
        "shadow_enabled": dispatch_leader_lock_shadow_enabled(),
    }
    out.update(extra)
    return out


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


def try_acquire_shadow_leader() -> dict[str, Any]:
    """SET key node_id NX EX ttl — yalnız DISPATCH_LEADER_LOCK_SHADOW=1."""
    node_id = _node_id()
    ttl_sec = dispatch_leader_ttl_sec()
    if not dispatch_leader_lock_shadow_enabled():
        holder = read_leader_holder()
        return _base_result(
            ok=False,
            acquired=False,
            reason="shadow_disabled",
            holder=holder,
            is_leader=bool(holder and holder == node_id),
        )

    try:
        client = get_redis_client()
        if client is None:
            return _base_result(
                ok=False,
                acquired=False,
                error="redis_unavailable",
            )
        acquired = bool(client.set(LEADER_KEY, node_id, nx=True, ex=ttl_sec))
        holder = read_leader_holder()
        return _base_result(
            ok=True,
            acquired=acquired,
            holder=holder,
            is_leader=bool(holder and holder == node_id),
            redis_available=True,
        )
    except Exception as exc:
        return _base_result(
            ok=False,
            acquired=False,
            error=type(exc).__name__,
        )


def renew_shadow_leader() -> dict[str, Any]:
    """EXPIRE yalnızca GET key == node_id ise (Lua); başka holder varsa dokunma."""
    node_id = _node_id()
    ttl_sec = dispatch_leader_ttl_sec()
    if not dispatch_leader_lock_shadow_enabled():
        holder = read_leader_holder()
        return _base_result(
            ok=False,
            renewed=False,
            reason="shadow_disabled",
            holder=holder,
            is_leader=bool(holder and holder == node_id),
        )

    try:
        client = get_redis_client()
        if client is None:
            return _base_result(
                ok=False,
                renewed=False,
                error="redis_unavailable",
            )
        result = client.eval(_RENEW_LUA, 1, LEADER_KEY, node_id, ttl_sec)
        renewed = int(result or 0) == 1
        holder = read_leader_holder()
        return _base_result(
            ok=True,
            renewed=renewed,
            holder=holder,
            is_leader=bool(holder and holder == node_id),
            redis_available=True,
        )
    except Exception as exc:
        return _base_result(
            ok=False,
            renewed=False,
            error=type(exc).__name__,
        )


def release_shadow_leader() -> dict[str, Any]:
    """DEL yalnızca GET key == node_id ise (Lua); shadow kapalıysa yazma yok."""
    node_id = _node_id()
    if not dispatch_leader_lock_shadow_enabled():
        holder = read_leader_holder()
        return _base_result(
            ok=False,
            released=False,
            reason="shadow_disabled",
            holder=holder,
            is_leader=bool(holder and holder == node_id),
        )

    try:
        client = get_redis_client()
        if client is None:
            return _base_result(
                ok=False,
                released=False,
                error="redis_unavailable",
            )
        result = client.eval(_RELEASE_LUA, 1, LEADER_KEY, node_id)
        released = int(result or 0) == 1
        holder = read_leader_holder()
        return _base_result(
            ok=True,
            released=released,
            holder=holder,
            is_leader=bool(holder and holder == node_id),
            redis_available=True,
        )
    except Exception as exc:
        return _base_result(
            ok=False,
            released=False,
            error=type(exc).__name__,
        )


def leader_shadow_tick() -> dict[str, Any]:
    """
    Shadow tick: holder yoksa acquire; bu node holder ise renew; aksi halde salt okuma.
    DISPATCH_LEADER_LOCK_SHADOW=0 → yazma yok.
    """
    node_id = _node_id()
    ttl_sec = dispatch_leader_ttl_sec()
    shadow_loop_enabled = dispatch_leader_lock_shadow_enabled()

    if not shadow_loop_enabled:
        snap = leader_lock_status_snapshot()
        return {
            **snap,
            "acquired": False,
            "renewed": False,
            "shadow_loop_enabled": False,
        }

    acquired = False
    renewed = False
    error: Optional[str] = None

    try:
        holder = read_leader_holder()
        if holder is None:
            acq = try_acquire_shadow_leader()
            acquired = bool(acq.get("acquired"))
            error = acq.get("error")
            holder = acq.get("holder")
            if holder is None:
                holder = read_leader_holder()
        elif holder == node_id:
            ren = renew_shadow_leader()
            renewed = bool(ren.get("renewed"))
            error = ren.get("error")
            holder = ren.get("holder") or read_leader_holder() or node_id
        else:
            error = None
    except Exception as exc:
        error = type(exc).__name__
        holder = read_leader_holder()

    is_leader = bool(holder and holder == node_id)
    redis_available = False
    try:
        redis_available = get_redis_client() is not None
    except Exception:
        redis_available = False

    return {
        "enabled": dispatch_leader_lock_enabled(),
        "shadow_enabled": True,
        "shadow_loop_enabled": True,
        "node_id": node_id,
        "leader_key": LEADER_KEY,
        "holder": holder,
        "is_leader": is_leader,
        "ttl_sec": ttl_sec,
        "renew_sec": dispatch_leader_renew_sec(),
        "redis_available": redis_available,
        "error": error,
        "acquired": acquired,
        "renewed": renewed,
    }


def leader_lock_status_snapshot() -> dict[str, Any]:
    """Leader lock durumu (read-only GET); shadow loop bayrağı dahil."""
    node_id = _node_id()
    ttl_sec = dispatch_leader_ttl_sec()
    renew_sec = dispatch_leader_renew_sec()
    enabled = dispatch_leader_lock_enabled()
    shadow_enabled = dispatch_leader_lock_shadow_enabled()
    shadow_loop_enabled = shadow_enabled
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
        "shadow_loop_enabled": shadow_loop_enabled,
        "node_id": node_id,
        "leader_key": LEADER_KEY,
        "holder": holder,
        "is_leader": is_leader,
        "ttl_sec": ttl_sec,
        "renew_sec": renew_sec,
        "redis_available": redis_available,
        "error": error,
    }
