"""
TAG biniş QR token store — Redis primary, optional single-node memory fallback.

Multi-node: Redis zorunlu (BOARDING_QR_REDIS_REQUIRED=1, memory fallback kapalı).
Route cache çift yazım deseni kullanılmaz — Redis aktifken yalnızca Redis.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

from redis_cache import get_redis_client, redis_cache_enabled

logger = logging.getLogger(__name__)

# tag_id -> {"token": str, "expires": int}
_memory_tag_index: dict[str, dict[str, Any]] = {}
# token -> payload
_memory_tokens: dict[str, dict[str, Any]] = {}

_memory_fallback_logged = False


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def redis_required() -> bool:
    """Prod scale-out: BOARDING_QR_REDIS_REQUIRED=1 → Redis yoksa store kullanılamaz."""
    return _env_bool("BOARDING_QR_REDIS_REQUIRED", False)


def memory_fallback_enabled() -> bool:
    """Local/dev: Redis kapalıyken bellek fallback (multi-node için güvenli değil)."""
    return _env_bool("BOARDING_QR_MEMORY_FALLBACK", True)


def redis_enabled() -> bool:
    return redis_cache_enabled() and get_redis_client() is not None


def is_store_unavailable() -> bool:
    """Redis zorunlu ama erişilemiyor ve bellek fallback kapalı."""
    if not redis_required():
        return False
    if redis_enabled():
        return False
    return not memory_fallback_enabled()


def _token_prefix(token: str) -> str:
    t = str(token or "").strip()
    if len(t) <= 8:
        return t
    return f"{t[:8]}…"


def _uid_eq(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return False
    return str(a).strip().lower() == str(b).strip().lower()


def _redis_tag_key(tag_id: str) -> str:
    return f"leylek:boarding_qr:tag:{tag_id}"


def _redis_token_key(token: str) -> str:
    return f"leylek:boarding_qr:token:{token}"


def _log_memory_fallback_once() -> None:
    global _memory_fallback_logged
    if _memory_fallback_logged:
        return
    _memory_fallback_logged = True
    logger.warning(
        "[boarding_qr_store] Redis unavailable — memory fallback active (not safe for multi-node)"
    )


def _use_redis() -> bool:
    return redis_enabled()


def _use_memory() -> bool:
    if _use_redis():
        return False
    if not memory_fallback_enabled():
        return False
    _log_memory_fallback_once()
    return True


def _payload_expired(payload: dict[str, Any], now_ts: Optional[int] = None) -> bool:
    now = now_ts if now_ts is not None else int(time.time())
    expires_ts = int(float(payload.get("expires") or 0))
    return expires_ts <= now


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    out = dict(payload)
    if "timestamp" not in out and out.get("issued_at"):
        try:
            dt = datetime.fromisoformat(str(out["issued_at"]).replace("Z", "+00:00"))
            out["timestamp"] = int(dt.timestamp())
        except Exception:
            pass
    return out


def get_active_token_for_tag(
    tag_id: str,
    driver_id: str,
    passenger_id: str,
    min_remaining_seconds: int,
) -> tuple[Optional[str], Optional[dict[str, Any]]]:
    """
    Tag için aktif token arar; driver/passenger eşleşmesi ve min kalan TTL kontrolü.
    """
    if is_store_unavailable():
        return None, None

    tid = str(tag_id or "").strip()
    if not tid:
        return None, None

    now_ts = int(time.time())

    if _use_redis():
        r = get_redis_client()
        try:
            raw_tag = r.get(_redis_tag_key(tid))
            if not raw_tag:
                return None, None
            tag_idx = json.loads(raw_tag)
            token = str(tag_idx.get("token") or "").strip()
            if not token:
                return None, None
            raw_payload = r.get(_redis_token_key(token))
            if not raw_payload:
                return None, None
            payload = _normalize_payload(json.loads(raw_payload))
        except Exception as exc:
            logger.warning("[boarding_qr_store] Redis get_active_token_for_tag error: %s", exc)
            if not _use_memory():
                return None, None
            return _memory_get_active_token_for_tag(tid, driver_id, passenger_id, min_remaining_seconds, now_ts)

        if _payload_expired(payload, now_ts):
            delete_boarding_token(token)
            return None, None
        remaining = int(float(payload.get("expires") or 0)) - now_ts
        if remaining < min_remaining_seconds:
            return None, None
        if not _uid_eq(payload.get("driver_id"), driver_id):
            return None, None
        if not _uid_eq(payload.get("passenger_id"), passenger_id):
            return None, None
        logger.debug(
            "[boarding_qr_store] reuse hit source=redis tag_id=%s token_prefix=%s remaining_s=%s",
            tid,
            _token_prefix(token),
            remaining,
        )
        return token, payload

    if _use_memory():
        return _memory_get_active_token_for_tag(tid, driver_id, passenger_id, min_remaining_seconds, now_ts)

    return None, None


def _memory_get_active_token_for_tag(
    tag_id: str,
    driver_id: str,
    passenger_id: str,
    min_remaining_seconds: int,
    now_ts: int,
) -> tuple[Optional[str], Optional[dict[str, Any]]]:
    tag_idx = _memory_tag_index.get(tag_id)
    if not tag_idx:
        return None, None
    token = str(tag_idx.get("token") or "").strip()
    if not token:
        return None, None
    payload = _memory_tokens.get(token)
    if not payload:
        _memory_tag_index.pop(tag_id, None)
        return None, None
    payload = _normalize_payload(payload)
    if _payload_expired(payload, now_ts):
        delete_boarding_token(token)
        return None, None
    remaining = int(float(payload.get("expires") or 0)) - now_ts
    if remaining < min_remaining_seconds:
        return None, None
    if not _uid_eq(payload.get("driver_id"), driver_id):
        return None, None
    if not _uid_eq(payload.get("passenger_id"), passenger_id):
        return None, None
    logger.debug(
        "[boarding_qr_store] reuse hit source=memory tag_id=%s token_prefix=%s remaining_s=%s",
        tag_id,
        _token_prefix(token),
        remaining,
    )
    return token, payload


def put_boarding_token(token: str, payload: dict[str, Any], ttl_seconds: int) -> bool:
    """Token + tag index yazar. Redis aktifken yalnızca Redis."""
    if is_store_unavailable():
        return False

    tok = str(token or "").strip()
    tid = str(payload.get("tag_id") or "").strip()
    if not tok or not tid:
        return False

    ttl = max(1, int(ttl_seconds))
    body = _normalize_payload(dict(payload))
    tag_idx = {"token": tok, "expires": int(float(body.get("expires") or 0))}

    if _use_redis():
        r = get_redis_client()
        try:
            pipe = r.pipeline()
            pipe.setex(_redis_token_key(tok), ttl, json.dumps(body, default=str, ensure_ascii=False))
            pipe.setex(_redis_tag_key(tid), ttl, json.dumps(tag_idx, default=str, ensure_ascii=False))
            pipe.execute()
            logger.info(
                "[boarding_qr_store] issued source=redis tag_id=%s token_prefix=%s ttl_s=%s",
                tid,
                _token_prefix(tok),
                ttl,
            )
            return True
        except Exception as exc:
            logger.warning("[boarding_qr_store] Redis put_boarding_token error: %s", exc)
            if not _use_memory():
                return False

    if _use_memory():
        _memory_tokens[tok] = body
        _memory_tag_index[tid] = tag_idx
        logger.info(
            "[boarding_qr_store] issued source=memory tag_id=%s token_prefix=%s ttl_s=%s",
            tid,
            _token_prefix(tok),
            ttl,
        )
        return True

    return False


def get_boarding_token(token: str) -> Optional[dict[str, Any]]:
    """Token payload okur (consume etmez)."""
    if is_store_unavailable():
        return None

    tok = str(token or "").strip()
    if not tok:
        return None

    if _use_redis():
        r = get_redis_client()
        try:
            raw = r.get(_redis_token_key(tok))
            if not raw:
                return None
            payload = _normalize_payload(json.loads(raw))
            if _payload_expired(payload):
                delete_boarding_token(tok)
                return None
            return payload
        except Exception as exc:
            logger.warning("[boarding_qr_store] Redis get_boarding_token error: %s", exc)
            if not _use_memory():
                return None

    if _use_memory():
        payload = _memory_tokens.get(tok)
        if not payload:
            return None
        payload = _normalize_payload(payload)
        if _payload_expired(payload):
            delete_boarding_token(tok)
            return None
        return payload

    return None


def consume_boarding_token(token: str) -> Optional[dict[str, Any]]:
    """Atomik oku-sil (GETDEL); tag index de temizlenir."""
    if is_store_unavailable():
        return None

    tok = str(token or "").strip()
    if not tok:
        return None

    if _use_redis():
        r = get_redis_client()
        try:
            raw = r.getdel(_redis_token_key(tok))
            if not raw:
                return None
            payload = _normalize_payload(json.loads(raw))
            tid = str(payload.get("tag_id") or "").strip()
            if tid:
                try:
                    r.delete(_redis_tag_key(tid))
                except Exception:
                    pass
            logger.debug(
                "[boarding_qr_store] consumed source=redis token_prefix=%s tag_id=%s",
                _token_prefix(tok),
                tid or "n/a",
            )
            return payload
        except Exception as exc:
            logger.warning("[boarding_qr_store] Redis consume_boarding_token error: %s", exc)
            if not _use_memory():
                return None

    if _use_memory():
        payload = _memory_tokens.pop(tok, None)
        if not payload:
            return None
        payload = _normalize_payload(payload)
        tid = str(payload.get("tag_id") or "").strip()
        if tid:
            idx = _memory_tag_index.get(tid)
            if idx and str(idx.get("token") or "").strip() == tok:
                _memory_tag_index.pop(tid, None)
        logger.debug(
            "[boarding_qr_store] consumed source=memory token_prefix=%s tag_id=%s",
            _token_prefix(tok),
            tid or "n/a",
        )
        return payload

    return None


def delete_boarding_token(token: str) -> None:
    """Token + tag index siler (hata yolları için)."""
    tok = str(token or "").strip()
    if not tok:
        return

    payload: Optional[dict[str, Any]] = None

    if _use_redis():
        r = get_redis_client()
        try:
            raw = r.getdel(_redis_token_key(tok))
            if raw:
                try:
                    payload = _normalize_payload(json.loads(raw))
                except Exception:
                    payload = None
        except Exception as exc:
            logger.warning("[boarding_qr_store] Redis delete_boarding_token error: %s", exc)

    if _use_memory() and tok in _memory_tokens:
        payload = _memory_tokens.pop(tok, None)

    tid = str((payload or {}).get("tag_id") or "").strip()
    if not tid:
        if _use_memory():
            for tag_id, idx in list(_memory_tag_index.items()):
                if str(idx.get("token") or "").strip() == tok:
                    tid = tag_id
                    break

    if tid:
        if _use_redis():
            r = get_redis_client()
            if r is not None:
                try:
                    r.delete(_redis_tag_key(tid))
                except Exception:
                    pass
        if _use_memory():
            idx = _memory_tag_index.get(tid)
            if idx and str(idx.get("token") or "").strip() == tok:
                _memory_tag_index.pop(tid, None)


def purge_boarding_tokens_for_tag(tag_id: str) -> None:
    """Tag'e bağlı tüm token kayıtlarını temizler."""
    tid = str(tag_id or "").strip()
    if not tid:
        return

    token_to_delete: Optional[str] = None

    if _use_redis():
        r = get_redis_client()
        if r is not None:
            try:
                raw_tag = r.get(_redis_tag_key(tid))
                if raw_tag:
                    try:
                        tag_idx = json.loads(raw_tag)
                        token_to_delete = str(tag_idx.get("token") or "").strip() or None
                    except Exception:
                        token_to_delete = None
                r.delete(_redis_tag_key(tid))
            except Exception as exc:
                logger.warning("[boarding_qr_store] Redis purge tag index error: %s", exc)

    if _use_memory():
        idx = _memory_tag_index.pop(tid, None)
        if idx:
            mem_tok = str(idx.get("token") or "").strip()
            if mem_tok:
                token_to_delete = token_to_delete or mem_tok
        for tok, data in list(_memory_tokens.items()):
            if str(data.get("tag_id") or "").strip() == tid:
                _memory_tokens.pop(tok, None)

    if token_to_delete:
        if _use_redis():
            r = get_redis_client()
            if r is not None:
                try:
                    r.delete(_redis_token_key(token_to_delete))
                except Exception:
                    pass
        if _use_memory():
            _memory_tokens.pop(token_to_delete, None)
