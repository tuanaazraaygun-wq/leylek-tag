"""
Socket.IO Redis adapter foundation (SCALE-5B / SCALE-6B-1 / SCALE-6B-2 / SCALE-6B-3 / SCALE-6B-4).

SOCKETIO_REDIS_ADAPTER=0 → yalnız bellek; varsayılan davranış değişmez.
SOCKET_CLUSTER_MODE=memory (varsayılan) → adapter açık olsa bile Redis denenmez.
Her iki flag açıkken Redis URL/dependency eksikse uyarı + bellek modu (crash yok).
Readiness özeti bağlantı/ping yapmaz (shadow dry-run).
SCALE-6B-4: runtime topology — repo backend_socket_app, legacy leylek-socket ayrı.
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


def socket_cluster_mode_env() -> str:
    """SOCKET_CLUSTER_MODE — varsayılan memory; redis/cluster → redis."""
    raw = (os.getenv("SOCKET_CLUSTER_MODE") or "memory").strip().lower()
    if raw in ("redis", "cluster"):
        return "redis"
    return "memory"


def socketio_redis_channel() -> str:
    return (os.getenv("SOCKETIO_REDIS_CHANNEL") or "leylek-socketio").strip()


def socketio_runtime_role() -> str:
    """Bu süreç: repo backend server:socket_app (api.leylektag.com/socket.io/)."""
    return "backend_socket_app"


def socketio_manages_legacy_socket() -> bool:
    """socket.leylektag.com:8765 leylek-socket bu süreçte yönetilmez."""
    return False


def socketio_primary_path() -> str:
    return "/socket.io"


def redis_url_configured() -> bool:
    """True when SOCKET_REDIS_URL, REDIS_URL veya REDIS_HOST açıkça ayarlı."""
    if (os.environ.get("SOCKET_REDIS_URL") or "").strip():
        return True
    if (os.environ.get("REDIS_URL") or "").strip():
        return True
    if (os.environ.get("REDIS_HOST") or "").strip():
        return True
    return False


def socketio_redis_config_summary() -> dict:
    """Read-only Redis adapter config özeti; bağlantı/ping yok."""
    summary = {
        "cluster_mode": socket_cluster_mode_env(),
        "adapter_enabled": socketio_redis_adapter_enabled(),
        "channel": socketio_redis_channel(),
        "redis_url_configured": redis_url_configured(),
        "runtime_role": socketio_runtime_role(),
        "primary_socket_path": socketio_primary_path(),
        "manages_legacy_socket": socketio_manages_legacy_socket(),
    }
    summary.update(socketio_redis_adapter_readiness())
    return summary


def socketio_redis_adapter_readiness() -> dict:
    """Shadow dry-run readiness; flags kapalıysa Redis import/connect yok."""
    adapter_requested = socketio_redis_adapter_enabled()
    cluster_mode = socket_cluster_mode_env()
    redis_mode_requested = cluster_mode == "redis"
    url_ok = redis_url_configured()

    dep_available = False
    dep_reason = ""
    if adapter_requested and redis_mode_requested:
        dep_ok, dep_reason = _redis_adapter_dependency_ok()
        dep_available = dep_ok

    if not adapter_requested:
        disabled_reason = "adapter_not_requested"
    elif not redis_mode_requested:
        disabled_reason = f"cluster_mode_{cluster_mode}"
    elif not dep_available:
        disabled_reason = dep_reason or "redis_dependency_unavailable"
    elif not url_ok:
        disabled_reason = "redis_url_not_configured"
    else:
        disabled_reason = ""

    adapter_ready = (
        adapter_requested
        and redis_mode_requested
        and url_ok
        and dep_available
    )

    return {
        "adapter_requested": adapter_requested,
        "redis_mode_requested": redis_mode_requested,
        "redis_url_configured": url_ok,
        "redis_dependency_available": dep_available,
        "adapter_ready": adapter_ready,
        "adapter_disabled_reason": disabled_reason,
    }


def _redis_adapter_dependency_ok() -> tuple[bool, str]:
    """redis paketi ve AsyncRedisManager kullanılabilirliği."""
    try:
        import redis  # noqa: F401
    except ImportError as exc:
        return False, f"redis package missing: {exc}"
    try:
        import socketio as _socketio
    except ImportError as exc:
        return False, f"socketio import failed: {exc}"
    if not hasattr(_socketio, "AsyncRedisManager"):
        return False, "socketio.AsyncRedisManager unavailable"
    return True, ""


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
    _cluster_mode_label = "memory"
    if not socketio_redis_adapter_enabled():
        return None
    if socket_cluster_mode_env() != "redis":
        logger.info(
            "[socketio_cluster] shadow prep: SOCKET_CLUSTER_MODE=%s, Redis adapter skipped",
            socket_cluster_mode_env(),
        )
        return None
    dep_ok, dep_reason = _redis_adapter_dependency_ok()
    if not dep_ok:
        logger.warning(
            "[socketio_cluster] Redis adapter dependency guard: %s; bellek modu",
            dep_reason,
        )
        return None
    if not redis_url_configured():
        logger.warning(
            "[socketio_cluster] Redis adapter config guard: redis_url not configured "
            "(set SOCKET_REDIS_URL, REDIS_URL or REDIS_HOST); bellek modu",
        )
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
