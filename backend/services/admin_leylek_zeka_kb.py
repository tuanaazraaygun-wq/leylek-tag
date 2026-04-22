"""
Leylek Zeka admin KB — salt okunur eşleşme (answer_engine sonrası, OpenAI öncesi).
Yazma yalnızca routes/admin_leylek_zeka_kb.py üzerinden.

Eşleşme sırası (tetik başına, ilk başarılı kazanır): exact substring → noktalama toleranslı
substring → muhafazakar token örtüşmesi (en az 2 anlamlı tokenın tamamı mesajda).
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any

from services.answer_engine.normalize import normalize_query

logger = logging.getLogger("server")

# Hafif noktalama: normalize_query'den önce boşluğa çevrilir (Türkçe harflere dokunulmaz).
_PUNCT_RE = re.compile(r'[.,!?;:()[\]{}"""\'´`…]+')

# Tek kelime / bağlaç tetiklerinde token-aşamasını devre dışı bırakmak için (yanlış pozitif azaltma).
_KB_STOPWORDS: frozenset[str] = frozenset(
    {
        "ve",
        "veya",
        "ya",
        "ile",
        "için",
        "icin",
        "bir",
        "bu",
        "şu",
        "su",
        "o",
        "da",
        "de",
        "ta",
        "te",
        "mi",
        "mı",
        "mu",
        "mü",
        "ne",
        "nedir",
        "nasıl",
        "nasil",
        "niçin",
        "nicin",
        "çünkü",
        "cunku",
        "ama",
        "fakat",
        "var",
        "yok",
        "gibi",
        "kadar",
        "daha",
        "çok",
        "cok",
        "az",
        "hem",
        "ben",
        "sen",
        "biz",
        "siz",
        "ki",
        "the",
        "a",
        "an",
        "is",
        "are",
    }
)


def _loosen_text(raw: str) -> str:
    """Noktalama toleranslı metin — normalize_query ile aynı boşluk/küçük harf kuralı."""
    s = (raw or "").strip()
    if not s:
        return ""
    return normalize_query(_PUNCT_RE.sub(" ", s))


def _meaningful_tokens(phrase_normalized: str) -> list[str]:
    out: list[str] = []
    for t in phrase_normalized.split():
        if len(t) < 2 or t in _KB_STOPWORDS:
            continue
        out.append(t)
    return out


def _token_overlap_match(phrase_normalized: str, msg_tokens: frozenset[str]) -> bool:
    """
    Muhafazakar: en az 2 anlamlı (stopword dışı, len>=2) token ve hepsi mesajda bütün kelime olarak.
    """
    toks = _meaningful_tokens(phrase_normalized)
    if len(toks) < 2:
        return False
    return all(tok in msg_tokens for tok in toks)


def admin_kb_read_enabled() -> bool:
    v = (os.getenv("ADMIN_KB_READ_ENABLED") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def try_match_admin_kb(user_message: str) -> str | None:
    """
    Aktif kayıtlar arasında çok aşamalı eşleşme (normalize edilmiş metin).
    Sıra: birebir substring → noktalama toleranslı substring → token (>=2 anlamlı kelime, hepsi mesajda).
    Öncelik: priority DESC — sunucu sıralamasına güvenir.
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
    msg_loose = _loosen_text(text)
    msg_tokens = frozenset(t for t in norm_msg.split() if len(t) >= 2)
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
            p_loose = _loosen_text(ph)
            if len(p_loose) >= 2 and p_loose in msg_loose:
                return body
            if _token_overlap_match(p, msg_tokens):
                return body
    return None
