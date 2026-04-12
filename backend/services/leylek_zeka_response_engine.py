"""
Leylek Zeka — admin onaylı KB ile cevap üretimi.

Öncelik: admin KB (Supabase `leylek_zeka_kb_entry` üzerinden list_entries) eşleşmesi.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from services import leylek_zeka_entry_service as entry_service


def _norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"\s+", " ", s)
    return s


def _tokens(s: str) -> set[str]:
    s = _norm(s)
    parts = re.split(r"[^a-z0-9ğüşöçıİĞÜŞÖÇ]+", s)
    return {p for p in parts if len(p) >= 2}


def _jaccard_tokens(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb) or 1
    return inter / union


def _faq_score(question: str, patterns: list[str]) -> float:
    qn = _norm(question)
    qt = _tokens(question)
    if not qt and not qn:
        return 0.0
    best = 0.0
    for p in patterns or []:
        pn = _norm(str(p))
        if not pn:
            continue
        if pn in qn or qn in pn:
            best = max(best, 0.95)
            continue
        pt = _tokens(str(p))
        if not pt:
            continue
        inter = len(qt & pt)
        union = len(qt | pt) or 1
        j = inter / union
        if j >= 0.25:
            best = max(best, 0.5 + 0.45 * j)
    return best


def _fact_score(question: str, keywords: list[str]) -> float:
    qn = _norm(question)
    qt = _tokens(question)
    if not keywords:
        return 0.0
    hits = 0
    for kw in keywords:
        k = _norm(str(kw))
        if not k:
            continue
        if k in qn:
            hits += 1
            continue
        for t in qt:
            if k in t or t in k:
                hits += 1
                break
    if hits == 0:
        return 0.0
    return min(1.0, 0.35 + 0.2 * hits)


def _kb_reply_text(record_type: str, body: dict[str, Any]) -> str:
    if record_type == "faq":
        return str(body.get("answer") or "").strip()
    if record_type == "product_fact":
        return str(body.get("text") or "").strip()
    return ""


def generate_response(question: str) -> dict[str, Any] | None:
    """Admin onaylı KB girişlerinden en iyi eşleşmeyi döndürür; yoksa None."""
    q = (question or "").strip()
    if not q:
        return None

    best: dict[str, Any] | None = None
    best_score = 0.0

    for entry in entry_service.list_entries():
        body = entry.get("body") or {}
        if not isinstance(body, dict):
            continue
        rt = entry.get("record_type")
        score = 0.0
        if rt == "faq":
            q_text = str(body.get("question") or "").strip()
            score = _faq_score(q, [q_text] if q_text else [])
        elif rt == "product_fact":
            text = str(body.get("text") or "")
            kws = list(body.get("keywords") or [])
            score = max(_fact_score(q, kws), _jaccard_tokens(q, text) * 0.92)
        else:
            continue

        if score > best_score:
            best_score = score
            best = {
                "entry_id": entry.get("id"),
                "record_type": rt,
                "body": body,
                "confidence": round(min(1.0, max(0.0, score)), 3),
            }

    if best is None or best_score < 0.45:
        return None

    reply_text = _kb_reply_text(str(best["record_type"]), best["body"])
    if not reply_text:
        return None
    best["reply_text"] = reply_text
    return best
