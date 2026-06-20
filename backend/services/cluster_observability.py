"""
Cluster observability foundation (SCALE-6A-1 / SCALE-6A-2).

Yalnızca node kimliği, feature flag ve read-only snapshot; davranış değiştirmez.
"""

from __future__ import annotations

import os
import socket
import time
from typing import Any, Optional

from services import socketio_cluster

_node_id: Optional[str] = None
_startup_mono: Optional[float] = None


def cluster_obs_enabled() -> bool:
    """CLUSTER_OBS_ENABLED=0|false|off|no → devre dışı (varsayılan kapalı)."""
    return os.getenv("CLUSTER_OBS_ENABLED", "0").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def cluster_obs_heartbeat_sec() -> int:
    """CLUSTER_OBS_HEARTBEAT_SEC — varsayılan 30, aralık [5, 300]."""
    raw = os.getenv("CLUSTER_OBS_HEARTBEAT_SEC", "30").strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 30
    return max(5, min(300, value))


def resolve_node_id() -> str:
    """Node kimliğini bir kez çözümler ve modül önbelleğine yazar."""
    global _node_id
    if _node_id is not None:
        return _node_id

    explicit = (os.getenv("CLUSTER_NODE_ID") or "").strip()
    if explicit:
        _node_id = explicit
        return _node_id

    hostname_env = (os.getenv("HOSTNAME") or "").strip()
    if hostname_env:
        _node_id = hostname_env
        return _node_id

    _node_id = f"{socket.gethostname()}-{os.getpid()}"
    return _node_id


def get_node_id() -> str:
    """Önbelleğe alınmış node kimliğini döner."""
    return resolve_node_id()


def record_startup_mono() -> None:
    """Sunucu başlangıç anını monotonic olarak kaydeder (uptime için)."""
    global _startup_mono
    _startup_mono = time.monotonic()


def collect_cluster_snapshot(
    *,
    socket_id_to_user: dict,
    connected_users: dict,
    socket_sid_to_keys: dict,
    rolling_dispatch_index: dict,
    rolling_dispatch_tasks: dict,
    dispatch_queues: dict,
    active_dispatch_tasks: dict,
    startup_mono: float | None = None,
) -> dict[str, Any]:
    """Read-only cluster snapshot; Redis ping yok (SCALE-6A-3)."""
    mono = startup_mono if startup_mono is not None else _startup_mono
    uptime_s = time.monotonic() - mono if mono is not None else 0.0

    return {
        "node_id": get_node_id(),
        "enabled": cluster_obs_enabled(),
        "socketio_mode": socketio_cluster.socketio_cluster_mode_label(),
        "cluster_mode_configured": socketio_cluster.socket_cluster_mode_env(),
        "adapter_enabled": socketio_cluster.socketio_redis_adapter_enabled(),
        "channel": socketio_cluster.socketio_redis_channel(),
        "socket_unique_sids": len(socket_id_to_user),
        "connected_user_keys": len(connected_users),
        "socket_sid_to_keys_entries": len(socket_sid_to_keys),
        "rolling_dispatch_active_tags": len(rolling_dispatch_index),
        "rolling_dispatch_pending_timers": len(rolling_dispatch_tasks),
        "dispatch_queue_tags": len(dispatch_queues),
        "active_dispatch_task_keys": len(active_dispatch_tasks),
        "uptime_s": uptime_s,
    }
