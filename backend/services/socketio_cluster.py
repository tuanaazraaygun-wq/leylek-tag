"""
Socket.IO Redis adapter foundation (SCALE-5B).

SOCKETIO_REDIS_ADAPTER=0 → yalnız bellek; varsayılan davranış değişmez.
Redis bağlanamazsa sessizce bellek moduna düşer (manager None).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)

_cluster_mode_label = "memory"


def socketio_redis_adapter_enabled() -> bool:
    """SOCKETIO_REDIS_ADAPTER=0|false|off|no → devre dışı (varsayılan bellek)."""
    return os.getenv("SOCKETIO_REDIS_ADAPTER", "0").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def socketio_redis_channel() -> str:
    return (os.getenv("SOCKETIO_REDIS_CHANNEL") or "leylek-socketio").strip()


def _build_redis_url() -> str:
    url = (os.environ.get("SOCKET_REDIS_URL") or "").strip()
    if url:
        return url
    url = (os.environ.get("REDIS_URL") or "").strip()
    if url:
        return url
    host = (os.environ.get("REDIS_HOST") or "127.0.0.1").strip()
    port = int((os.environ.get("REDIS_PORT") or "6379").strip())
    password = (os.environ.get("REDIS_PASSWORD") or "").strip() or None
    db = int((os.getenv("REDIS_DB") or "0").strip())
    if password:
        return f"redis://:{quote_plus(password)}@{host}:{port}/{db}"
    return f"redis://{host}:{port}/{db}"


def build_socketio_client_manager() -> Optional[Any]:
    """AsyncRedisManager veya None; hata durumunda asla raise etmez."""
    global _cluster_mode_label
    if not socketio_redis_adapter_enabled():
        _cluster_mode_label = "memory"
        return None
    try:
        import socketio as _socketio

        redis_url = _build_redis_url()
        channel = socketio_redis_channel()
        manager = _socketio.AsyncRedisManager(redis_url, channel=channel)
        _cluster_mode_label = "redis"
        logger.info("[socketio_cluster] AsyncRedisManager OK channel=%s", channel)
        return manager
    except Exception as exc:
        logger.warning(
            "[socketio_cluster] Redis adapter başlatılamadı, bellek modu: %s",
            exc,
        )
        _cluster_mode_label = "memory"
        return None


def socketio_cluster_mode_label() -> str:
    """redis — manager aktif; aksi halde memory."""
    return _cluster_mode_label
