from __future__ import annotations

from . import leylek_zeka_draft_service as draft_service

last_question: str | None = None

_KEY_SORU = "soru:"
_KEY_CEVAP = "cevap:"


def _parse_same_message_soru_cevap(message: str) -> tuple[str, str] | None:
    """Tek mesajda soru: ... cevap: ... (veya ters sıra) için (soru_metni, cevap_metni). Geçersizse None."""
    lower = message.lower()
    i_s = lower.find(_KEY_SORU)
    i_c = lower.find(_KEY_CEVAP)
    if i_s < 0 or i_c < 0:
        return None
    if i_s < i_c:
        q = message[i_s + len(_KEY_SORU) : i_c].strip()
        a = message[i_c + len(_KEY_CEVAP) :].strip()
    else:
        a = message[i_c + len(_KEY_CEVAP) : i_s].strip()
        q = message[i_s + len(_KEY_SORU) :].strip()
    if not q or not a:
        return None
    return (q, a)


def process_admin_message(message: str) -> dict:
    """
    Admin eğitim protokolü.
    Dönüş: created_drafts (0 veya 1 FAQ), outcome: draft | soru_stored | cevap_no_question | invalid_same | none
    """
    global last_question
    raw = (message or "").strip()
    lower = raw.lower()
    has_soru = _KEY_SORU in lower
    has_cevap = _KEY_CEVAP in lower

    if has_soru and has_cevap:
        pair = _parse_same_message_soru_cevap(raw)
        if pair:
            q, a = pair
            draft = draft_service.create_draft(
                "faq",
                {"question": q, "answer": a},
                [],
            )
            last_question = None
            return {
                "message": message,
                "created_drafts": [draft],
                "outcome": "draft",
            }
        return {
            "message": message,
            "created_drafts": [],
            "outcome": "invalid_same",
        }

    if has_soru:
        i = lower.find(_KEY_SORU)
        last_question = raw[i + len(_KEY_SORU) :].strip()
        return {
            "message": message,
            "created_drafts": [],
            "outcome": "soru_stored",
        }

    if has_cevap:
        if last_question:
            i = lower.find(_KEY_CEVAP)
            answer = raw[i + len(_KEY_CEVAP) :].strip()
            draft = draft_service.create_draft(
                "faq",
                {"question": last_question, "answer": answer},
                [],
            )
            last_question = None
            return {
                "message": message,
                "created_drafts": [draft],
                "outcome": "draft",
            }
        return {
            "message": message,
            "created_drafts": [],
            "outcome": "cevap_no_question",
        }

    return {"message": message, "created_drafts": [], "outcome": "none"}
