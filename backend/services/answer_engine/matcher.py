"""
Answer Engine — kural tabanlı intent eşleme (ML yok).
Public API: try_resolve(message, context) -> ResolvedAnswer | None
"""
from __future__ import annotations

import logging
from typing import Any, Literal, NotRequired, TypedDict

from .catalog import (
    INTENT_DEFINITIONS,
    IntentDefinition,
    MATCHING_WORKS,
    TEKLIF_BRIEF,
    TEKLIF_INCOMING_PROBLEM_PHRASES,
    WHO_SENDS_OFFER_SHORT,
)
from .normalize import normalize_query

logger = logging.getLogger("server")

# Gelen teklif / bekleme sinyali — how_to_send_offer cezası (ifadeler: catalog.TEKLIF_INCOMING_PROBLEM_PHRASES)

AnswerEngineSource = Literal["answer_engine"]


class ResolvedAnswer(TypedDict):
    intent_id: str
    text: str
    deterministic: Literal[True]
    source: AnswerEngineSource
    title: NotRequired[str]


_NEGATIVE = (
    "gelmiyor",
    "yok",
    "bulamıyorum",
    "kimse yok",
    "kimse",
    "olmuyor",
    "bekledim",
    "bekliyorum",
    "uzun süre",
    "neden yok",
)

_QUICK_SKIP_PAIN = (
    "gelmiyor",
    "gelmedi",
    "olmuyor",
    "bekliyorum",
    "bekledim",
    "kimse",
    "bulamıyorum",
    "neden yok",
    "gecik",
    "uzun sür",
)


def _problem_style_message(t: str) -> bool:
    """Sorun/şikâyet dili — match_not_happening vb. için tam skor bırak."""
    if "nasıl" in t or "nedir" in t:
        return False
    if any(p in t for p in ("kim teklif", "teklifi kim", "teklif kimden")):
        return False
    if not (("eşleş" in t or "esles" in t) or "teklif" in t):
        return False
    return any(p in t for p in _QUICK_SKIP_PAIN)


def _strip_trailing_punct(t: str) -> str:
    return t.strip().rstrip("?!.…").strip()


def _quick_keyword_matching_resolve(t: str) -> ResolvedAnswer | None:
    """
    Eşleşme akışı bilgi sorularında model çağrılmadan önce deterministic dönüş.
    Sorun/arıza dilinde None — mevcut intent skorlaması devreye girer.
    """
    if _problem_style_message(t):
        return None

    ts = _strip_trailing_punct(t)

    _who = (
        "kim teklif",
        "teklifi kim",
        "teklif kimden",
        "teklif kime",
        "hangi taraf teklif",
        "teklif hangi taraftan",
        "kim gönderir teklif",
        "kim gonderir teklif",
        "teklifi kim gönderir",
        "teklifi kim gonderir",
        "teklifi kim yollar",
        "teklifi kim atar",
    )
    if any(p in t for p in _who):
        return ResolvedAnswer(
            intent_id="who_sends_offer",
            text=WHO_SENDS_OFFER_SHORT,
            deterministic=True,
            source="answer_engine",
            title="Teklifi kim gönderir?",
        )

    if "nasıl" not in t and "nasil" not in t and "gönderemiyorum" not in t and "gonderemiyorum" not in t:
        if ts in ("teklif", "teklif nedir", "teklif ne", "teklif ne demek"):
            return ResolvedAnswer(
                intent_id="teklif_brief",
                text=TEKLIF_BRIEF,
                deterministic=True,
                source="answer_engine",
                title="Teklif nedir?",
            )

    flow_q = (
        "eşleşme nasıl" in t
        or "eslesme nasil" in t
        or (("eşleşme" in t or "eslesme" in t) and "nedir" in t)
        or ("nasıl" in t and ("eşleş" in t or "esles" in t))
        or ("nasil" in t and ("eşleş" in t or "esles" in t))
    )
    if flow_q:
        return ResolvedAnswer(
            intent_id="how_matching_works",
            text=MATCHING_WORKS,
            deterministic=True,
            source="answer_engine",
            title="Eşleşme nasıl çalışır?",
        )

    if ts in ("eşleşme", "eslesme", "eşleş", "esles", "match", "eşleşme nedir", "eslesme nedir"):
        return ResolvedAnswer(
            intent_id="how_matching_works",
            text=MATCHING_WORKS,
            deterministic=True,
            source="answer_engine",
            title="Eşleşme nasıl çalışır?",
        )

    return None


def _ctx_dict(context: dict[str, Any] | None) -> dict[str, Any]:
    return context if isinstance(context, dict) else {}


def infer_role(context: dict[str, Any] | None, t: str) -> str | None:
    """passenger | driver | None — istemci bağlamı + kısa metin ipuçları."""
    ctx = _ctx_dict(context)
    if ctx.get("isDriver") is True:
        return "driver"
    if ctx.get("isPassenger") is True:
        return "passenger"
    fh = str(ctx.get("flowHint") or "").lower()
    if fh.startswith("driver"):
        return "driver"
    if fh.startswith("passenger"):
        return "passenger"
    if "sürücü" in t or "surucu" in t or "şoför" in t:
        if "yolcu" not in t:
            return "driver"
    if "yolcu" in t or "müşteri" in t:
        if "sürücü" not in t and "surucu" not in t:
            return "passenger"
    return None


def _role_allows_intent(intent: IntentDefinition, ctx: dict[str, Any], inferred: str | None) -> bool:
    sr = intent.supported_roles
    if "any" in sr:
        return True
    if "passenger" in sr and "driver" in sr:
        return True
    if sr == ("passenger",):
        if ctx.get("isDriver") is True:
            return False
        if inferred == "driver":
            return False
        return True
    if sr == ("driver",):
        if ctx.get("isPassenger") is True:
            return False
        if inferred == "passenger":
            return False
        return True
    return True


def _score_intent(intent: IntentDefinition, t: str, ctx: dict[str, Any]) -> int:
    score = 0
    for phrase, w in intent.phrase_weights:
        p = normalize_query(phrase)
        if p and p in t:
            score += w
    for p in intent.match_phrases:
        pn = normalize_query(p)
        if pn and pn in t:
            score += max(2, min(len(pn) // 4, 8))

    if intent.id == "match_not_happening":
        if any(n in t for n in _NEGATIVE):
            score += 5
        if "eşleş" in t or "esles" in t:
            score += 3
    if intent.id == "how_matching_works":
        if any(n in t for n in _NEGATIVE) and "nasıl" not in t and "nedir" not in t:
            score -= 10
        if "nasıl" in t or "nedir" in t or "çalış" in t:
            score += 2

    fh = str(ctx.get("flowHint") or "").lower()
    if intent.id == "how_to_send_offer":
        if "driver_offer" in fh or "driver_offer_compose" in fh or "driver_offer_list" in fh:
            score += 4
        if "passenger_offer_waiting" in fh or "passenger_matching" in fh:
            score += 1
        # Gelen teklif yok / bekleme → match_not_happening veya benzeri olmalı
        if any(p in t for p in TEKLIF_INCOMING_PROBLEM_PHRASES):
            score -= 20
        # Sorun dili + teklif kelimesi ama “nasıl” yok → genelde bekleme/arıza, adım adım değil
        if "teklif" in t and any(n in t for n in _NEGATIVE):
            if "nasıl" not in t and "nasil" not in t and "neden" not in t and "niye" not in t:
                score -= 8

    if intent.id == "how_in_app_messaging_works":
        if any(x in t for x in ("mesaj", "sohbet", "chat")) and any(
            x in t
            for x in (
                "nasıl",
                "nasil",
                "nerede",
                "nereden",
                "gitmiyor",
                "atamıyorum",
                "atamiyorum",
                "yazamıyorum",
                "yazamiyorum",
            )
        ):
            score += 6
        # Teklif/fiyat sorusu ile karışmasın; mesaj/sohbet/chat bağlamı yoksa düşür
        if any(x in t for x in ("teklif", "fiyat", "ücret", "ucret")) and not any(
            x in t for x in ("mesaj", "sohbet", "chat", "yazamıyorum", "yazamiyorum", "yazmak", "yazarım", "yazarim", "gitmiyor")
        ):
            score -= 22

    return score


def _resolve_role_for_offer(ctx: dict[str, Any], inferred: str | None) -> str | None:
    if inferred in ("passenger", "driver"):
        return inferred
    fh = str(ctx.get("flowHint") or "").lower()
    if fh.startswith("driver"):
        return "driver"
    if fh.startswith("passenger"):
        return "passenger"
    return None


def _render_intent(intent: IntentDefinition, ctx: dict[str, Any], inferred: str | None) -> str | None:
    if intent.role_specific_templates:
        role = _resolve_role_for_offer(ctx, inferred)
        if role:
            tpl = intent.role_specific_templates.get(role)
            if tpl:
                return tpl
        if intent.default_template:
            return intent.default_template
        return None
    if intent.default_template:
        return intent.default_template
    return None


def try_resolve(message: str, context: dict[str, Any] | None = None) -> ResolvedAnswer | None:
    """
    Mesaj ve isteğe bağlı bağlamla en iyi intent'i seçer.
    Eşik altında veya şablon üretilemezse None.
    """
    t = normalize_query(message)
    if not t:
        return None

    quick = _quick_keyword_matching_resolve(t)
    if quick is not None:
        return quick

    ctx = _ctx_dict(context)
    inferred = infer_role(ctx, t)

    best: tuple[int, IntentDefinition] | None = None
    for intent in INTENT_DEFINITIONS:
        if not _role_allows_intent(intent, ctx, inferred):
            continue
        s = _score_intent(intent, t, ctx)
        if s < 6:
            continue
        if best is None or s > best[0]:
            best = (s, intent)
        elif s == best[0]:
            # Öncelik: katalog sırası (ilk tanımlanan kazanır)
            pass

    if best is None:
        return None

    _, winner = best
    text = _render_intent(winner, ctx, inferred)
    if not text:
        logger.debug("answer_engine: intent %s şablon üretemedi", winner.id)
        return None

    return ResolvedAnswer(
        intent_id=winner.id,
        text=text,
        deterministic=True,
        source="answer_engine",
        title=winner.title,
    )
