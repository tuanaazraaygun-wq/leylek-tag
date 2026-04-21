"""
Leylek Zeka admin KB — salt okunur eşleşme (answer_engine sonrası, OpenAI öncesi).
Yazma yalnızca routes/admin_leylek_zeka_kb.py üzerinden.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from services.answer_engine.normalize import normalize_query

logger = logging.getLogger("server")


def admin_kb_read_enabled() -> bool:
    v = (os.getenv("ADMIN_KB_READ_ENABLED") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def try_match_admin_kb(user_message: str) -> str | None:
    """
    Aktif kayıtlar arasında basit substring eşleşmesi (normalize edilmiş metin).
    Öncelik: priority DESC, sonra created_at (yenisi önce) — sunucu sıralamasına güvenir.
    """
    if not admin_kb_read_enabled():
        return None
    text = (user_message or "").strip()
    if not text:
        return None
    try:
        import server as srv
    except Exception as e:  # pragma: no cover
        logger.debug("admin_kb: server import failed: %s", e)
        return None
    sb = getattr(srv, "supabase", None)
    if sb is None:
        return None
    norm_msg = normalize_query(text)
    if len(norm_msg) < 2:
        return None
    try:
        res = (
            sb.table("leylek_zeka_kb_items")
            .select("trigger_phrases,body,priority,created_at")
            .eq("is_active", True)
            .order("priority", desc=True)
            .limit(150)
            .execute()
        )
        rows: list[dict[str, Any]] = list(res.data or [])
    except Exception as e:
        logger.warning("admin_kb: okuma hatası: %s", e)
        return None

    for row in rows:
        phrases = row.get("trigger_phrases") or []
        if not isinstance(phrases, (list, tuple)):
            continue
        body = (row.get("body") or "").strip()
        if not body:
            continue
        for ph in phrases:
            if not isinstance(ph, str):
                continue
            p = normalize_query(ph)
            if len(p) < 2:
                continue
            if p in norm_msg:
                return body
    return None
