"""
Leylek Muhabbeti Faz 3A — sadece metin moderasyonu (post + yorum gövdesi).
Görüntü / kuyruk / admin paneli yok.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Literal

import httpx

logger = logging.getLogger("server")

TargetKind = Literal["post", "comment"]
ModDecision = Literal["allow", "block"]

CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"
REQUEST_TIMEOUT_SEC = 20.0

_SYSTEM = (
    "You are a text moderator for a Turkish local neighborhood community (Leylek Muhabbeti). "
    "Classify the text as 'allow' or 'block'. "
    "Block if it has: hate, harassment, credible threats, instructions for illegal activity, "
    "explicit sexual content, or severe violence. "
    "Allow normal neighborly chat, mild swearing, local complaints, and jokes. "
    "Reply with one JSON object only, no other text: "
    '{\"decision\":\"allow\"} or {\"decision\":\"block\"} '
)


class ModerationUnavailableError(Exception):
    """Metin dış servisle denetlenemedi (ağ, API anahtarı, geçersiz yanıt)."""


def _no_ai_allowed() -> bool:
    return (os.getenv("MUHABBET_MODERATION_ALLOW_NO_AI") or "").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )


async def moderate_muhabbet_text(
    *, text: str, target_kind: TargetKind, timeout_sec: float = REQUEST_TIMEOUT_SEC
) -> tuple[ModDecision, str, str | None]:
    """
    return (decision, model_label, detail_for_storage)

    * MUHABBET_MODERATION_ALLOW_NO_AI: lokalde tüm metne izin (model no_ai_allow)
    * OPENAI_API_KEY yok: ModerationUnavailableError
    * Aksi halde OpenAI chat.completions (JSON)
    * Ağ / geçersiz yanıt: ModerationUnavailableError
    """
    raw = (text or "").strip()
    if not raw:
        return "block", "empty", "empty_text"

    if _no_ai_allowed():
        return "allow", "no_ai_allow", None
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise ModerationUnavailableError("no_openai_key")

    model = (os.getenv("MUHABBET_MODERATION_OPENAI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    user_payload = f"Target: {target_kind}\nText:\n{raw}\n"
    body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_payload},
        ],
        "temperature": 0,
        "max_tokens": 32,
    }
    if not (model.lower().startswith("o1") or "reasoning" in model.lower()):
        body["response_format"] = {"type": "json_object"}

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            r = await client.post(CHAT_COMPLETIONS_URL, json=body, headers=headers)
    except (httpx.TimeoutException, httpx.RequestError) as e:
        logger.warning("muhabbet_moderation: istek hatası: %s", e)
        raise ModerationUnavailableError("http_error") from e

    if r.status_code != 200:
        logger.warning("muhabbet_moderation: OpenAI %s: %s", r.status_code, (r.text or "")[:400])
        raise ModerationUnavailableError("bad_http")

    try:
        data = r.json()
        content = (
            (data.get("choices") or [{}])[0]
            .get("message", {})
            .get("content")
        )
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
        logger.warning("muhabbet_moderation: parse hata: %s", e)
        raise ModerationUnavailableError("bad_response_shape") from e

    if not content or not isinstance(content, str):
        raise ModerationUnavailableError("empty_content")

    m = re.search(r"\{[^{}]*\}", content, re.DOTALL)
    to_parse = m.group(0) if m else content.strip()
    try:
        obj = json.loads(to_parse)
    except json.JSONDecodeError:
        logger.warning("muhabbet_moderation: JSON ayrıştırılamadı: %s", content[:200])
        raise ModerationUnavailableError("json_parse") from None

    dec = (obj.get("decision") or "").strip().lower()
    if dec not in ("allow", "block"):
        raise ModerationUnavailableError("invalid_decision")
    d: ModDecision = "allow" if dec == "allow" else "block"
    return d, model, None
