"""
Cluster observability foundation (SCALE-6A-1).

Yalnızca node kimliği ve feature flag; davranış değiştirmez.
"""

from __future__ import annotations

import os
import socket
from typing import Optional

_node_id: Optional[str] = None


def cluster_obs_enabled() -> bool:
    """CLUSTER_OBS_ENABLED=0|false|off|no → devre dışı (varsayılan kapalı)."""
    return os.getenv("CLUSTER_OBS_ENABLED", "0").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


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
