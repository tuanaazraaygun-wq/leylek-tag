"""
Faz 1 — Redis önbellek yardımcısı (route + places).

REDIS_CACHE=0 → yalnız bellek; API/yanıt formatı değişmez.
Redis bağlanamazsa sessizce bellek kullanılır (çift yazım ile yedek).
Şifre/URL: REDIS_URL veya REDIS_HOST + REDIS_PORT + REDIS_PASSWORD (.env).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

# namespace -> key -> value (JSON-serializable dict/list/primitive)
_MEMORY: dict[str, dict[str, Any]] = {}

_redis_client: Any = None
_redis_init_done = False


def redis_cache_enabled() -> bool:
    """REDIS_CACHE=0|false|off|no → tamamen devre dışı (yalnız bellek)."""
    return os.getenv("REDIS_CACHE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def _redis_key(namespace: str, key: str) -> str:
    return f"leylek:{namespace}:{key}"


def _get_redis() -> Any:
    """Tek deneme ile client; hata → None (bellek fallback)."""
    global _redis_client, _redis_init_done
    if not redis_cache_enabled():
        return None
    if _redis_init_done:
        return _redis_client
    _redis_init_done = True
    try:
        import redis  # requirements.txt — redis paketi

        # Kimlik bilgisi yalnız ortam değişkeninden — repoda şifre yok
        url = (os.environ.get("REDIS_URL") or "").strip()
        if url:
            client = redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
            )
        else:
            host = (os.environ.get("REDIS_HOST") or "127.0.0.1").strip()
            port = int((os.environ.get("REDIS_PORT") or "6379").strip())
            password = (os.environ.get("REDIS_PASSWORD") or "").strip() or None
            db = int((os.getenv("REDIS_DB") or "0").strip())
            client = redis.Redis(
                host=host,
                port=port,
                password=password,
                db=db,
                decode_responses=True,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
            )
        client.ping()
        _redis_client = client
        logger.info("[redis_cache] Redis bağlantısı OK (Faz 1 cache)")
    except Exception as exc:
        logger.debug("[redis_cache] Redis kullanılamıyor, bellek fallback: %s", exc)
        _redis_client = None
    return _redis_client


def cache_get(namespace: str, key: str) -> Optional[Any]:
    """
    Önce Redis (TTL Redis'te), miss/hata → bellek.
    Dönüş: namespace'e yazılan JSON-değer veya None.
    """
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(_redis_key(namespace, key))
            if raw:
                return json.loads(raw)
        except Exception:
            pass  # Sessizce belleğe düş

    return _MEMORY.get(namespace, {}).get(key)


def cache_set(namespace: str, key: str, value: Any, ttl_seconds: float) -> None:
    """Redis (setex) + bellek — Redis kapalı/hatalıysa yalnız bellek."""
    ns_mem = _MEMORY.setdefault(namespace, {})
    ns_mem[key] = value

    r = _get_redis()
    if r is None:
        return
    try:
        ttl = max(1, int(ttl_seconds))
        r.setex(
            _redis_key(namespace, key),
            ttl,
            json.dumps(value, default=str, ensure_ascii=False),
        )
    except Exception:
        pass  # Bellek zaten yazıldı


def cache_delete(namespace: str, key: str) -> None:
    """Invalidate — Redis + bellek."""
    try:
        _MEMORY.get(namespace, {}).pop(key, None)
    except Exception:
        pass
    r = _get_redis()
    if r is None:
        return
    try:
        r.delete(_redis_key(namespace, key))
    except Exception:
        pass


def memory_entry_count(namespace: str) -> int:
    """İstatistik: bellek fallback giriş sayısı."""
    return len(_MEMORY.get(namespace, {}))


def trim_memory_namespace(namespace: str, max_entries: int, trim_count: int) -> None:
    """Bellek taşmasını önle (Redis TTL belleği temizlemez)."""
    ns = _MEMORY.get(namespace)
    if not ns or len(ns) <= max_entries:
        return
    for k in list(ns.keys())[:trim_count]:
        ns.pop(k, None)
