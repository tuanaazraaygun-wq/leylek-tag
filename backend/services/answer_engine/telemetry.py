"""
Answer Engine — hafif gözlemlenebilirlik (isteğe bağlı).

- Açık: ANSWER_ENGINE_TELEMETRY=1|true|yes|on
- Log: logger adı `answer_engine.telemetry`, satır başına tek JSON (grep / Loki uyumu)
- Sayaçlar: süreç içi; ileride admin veya metrik endpoint'ine taşınabilir

Tam kullanıcı metni yazılmaz; yalnızca normalize edilmiş uzunluk + kısaltılmış snippet.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

from .normalize import normalize_query

_LOG = logging.getLogger("answer_engine.telemetry")

_enabled_flag: bool | None = None
_SNIPPET_MAX = 96


def _snippet_max() -> int:
    try:
        return max(16, min(256, int(os.getenv("ANSWER_ENGINE_TELEMETRY_SNIPPET_MAX") or str(_SNIPPET_MAX))))
    except ValueError:
        return _SNIPPET_MAX


def is_answer_engine_telemetry_enabled() -> bool:
    global _enabled_flag
    if _enabled_flag is None:
        v = (os.getenv("ANSWER_ENGINE_TELEMETRY") or "").strip().lower()
        _enabled_flag = v in ("1", "true", "yes", "on")
    return _enabled_flag


_counters_lock = threading.Lock()
_counters: dict[str, Any] = {
    "answer_engine_hits": 0,
    "answer_engine_misses": 0,
    "by_intent": {},
}


def get_answer_engine_telemetry_counters() -> dict[str, Any]:
    """Süreç yerel anlık görüntü (kalıcı değil)."""
    with _counters_lock:
        return {
            "answer_engine_hits": int(_counters["answer_engine_hits"]),
            "answer_engine_misses": int(_counters["answer_engine_misses"]),
            "by_intent": dict(_counters["by_intent"]),
        }


def get_answer_engine_telemetry_admin_summary() -> dict[str, Any]:
    """Admin JSON: açık/kapalı bayrağı + süreç içi sayaçlar."""
    c = get_answer_engine_telemetry_counters()
    return {
        "telemetry_enabled": is_answer_engine_telemetry_enabled(),
        "answer_engine_hits": c["answer_engine_hits"],
        "answer_engine_misses": c["answer_engine_misses"],
        "by_intent": c["by_intent"],
    }


def _safe_context(ctx: dict[str, Any] | None) -> dict[str, Any]:
    """Şehir / serbest metin yok; yalnızca akış ipuçları."""
    if not ctx or not isinstance(ctx, dict):
        return {}
    keys = (
        "flowHint",
        "isDriver",
        "isPassenger",
        "isWaitingMatch",
        "hasActiveOffer",
        "vehicleType",
        "screen",
        "role",
    )
    out: dict[str, Any] = {}
    for k in keys:
        v = ctx.get(k)
        if v is None or v == "":
            continue
        if k == "screen" and isinstance(v, str) and len(v) > 64:
            v = v[:64] + "…"
        out[k] = v
    return out


def _normalized_snippet(user_message: str) -> tuple[int, str]:
    n = normalize_query(user_message)
    lim = _snippet_max()
    ln = len(n)
    if ln <= lim:
        return ln, n
    return ln, n[:lim]


def emit_answer_engine_resolution(
    *,
    hit: bool,
    intent_id: str | None,
    response_source: str,
    context: dict[str, Any] | None,
    user_message: str,
) -> None:
    """
    hit=True → answer_engine ile yanıtlandı.
    hit=False → try_resolve eşleşmedi; response_source openai veya fallback.
    """
    if not is_answer_engine_telemetry_enabled():
        return

    q_len, q_snippet = _normalized_snippet(user_message)
    payload: dict[str, Any] = {
        "ae_event": "answer_engine_hit" if hit else "answer_engine_miss",
        "intent_id": intent_id if hit else None,
        "source": response_source,
        "ctx": _safe_context(context),
        "q_norm_len": q_len,
        "q_snippet": q_snippet,
    }

    with _counters_lock:
        if hit:
            _counters["answer_engine_hits"] = int(_counters["answer_engine_hits"]) + 1
            iid = intent_id or "unknown"
            bi: dict[str, int] = _counters["by_intent"]
            bi[iid] = int(bi.get(iid, 0)) + 1
        else:
            _counters["answer_engine_misses"] = int(_counters["answer_engine_misses"]) + 1

    try:
        _LOG.info("%s", json.dumps(payload, ensure_ascii=False))
    except Exception:
        logging.getLogger("server").debug("answer_engine.telemetry log failed", exc_info=True)
