"""
Supabase Auth oturumu (access + refresh JWT): `users.id` ile `auth.users` içinde aynı UUID.

Akış: admin.create_user (id sabit, synthetic email) → admin.generate_link(magiclink)
→ auth.verify_otp(token_hash) → Session.

`get_supabase_auth_session_client()` — verify_otp burada; tablo işleri `get_supabase()` ile (kirlenme yok).
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional, Tuple

from supabase_client import get_supabase_auth_session_client

logger = logging.getLogger(__name__)

SYNTHETIC_EMAIL_DOMAIN = "leylek.app"


def synthetic_email_for_user_id(user_id: str) -> str:
    u = str(user_id).strip().lower()
    return f"{u}@{SYNTHETIC_EMAIL_DOMAIN}"


def mint_supabase_session_tokens(user_id: str) -> Tuple[Optional[str], Optional[str]]:
    """users.id ile Supabase Auth oturumu üret; başarısızsa (None, None)."""
    sb = get_supabase_auth_session_client()
    if not sb:
        logger.warning(
            "[supabase_token_mint_failed] user_id=%s error=no_auth_session_client",
            str(user_id).strip().lower()[:36],
        )
        return None, None
    uid = str(user_id).strip().lower()
    try:
        uuid.UUID(uid)
    except Exception:
        logger.warning(
            "[supabase_token_mint_failed] user_id=%s error=invalid_uuid",
            str(user_id)[:64],
        )
        return None, None

    email = synthetic_email_for_user_id(uid)

    try:
        sb.auth.admin.create_user(
            {
                "id": uid,
                "email": email,
                "email_confirm": True,
            }
        )
    except Exception as e:
        msg = str(e).lower()
        if "already" in msg or "registered" in msg or "exists" in msg or "duplicate" in msg:
            pass
        else:
            logger.exception("mint_supabase_session: create_user failed (non-duplicate error)")

    try:
        link = sb.auth.admin.generate_link({"type": "magiclink", "email": email})
        hashed = link.properties.hashed_token
        auth_res = sb.auth.verify_otp({"token_hash": hashed, "type": "magiclink"})
        if auth_res.session:
            return auth_res.session.access_token, auth_res.session.refresh_token
        logger.warning(
            "[supabase_token_mint_failed] user_id=%s error=verify_otp_no_session",
            uid,
        )
    except Exception as ex:
        logger.warning(
            "[supabase_token_mint_failed] user_id=%s error=%s",
            uid,
            str(ex),
            exc_info=True,
        )
    return None, None


def attach_supabase_tokens_to_auth_payload(payload: dict, user_id: Optional[str]) -> dict:
    """API yanıtına supabase_access_token / supabase_refresh_token ekler (best-effort)."""
    if not user_id:
        return payload
    try:
        a, r = mint_supabase_session_tokens(str(user_id))
        if a and r:
            return {**payload, "supabase_access_token": a, "supabase_refresh_token": r}
        logger.warning(
            "[supabase_token_mint_failed] user_id=%s error=mint_returned_empty",
            user_id,
        )
    except Exception as ex:
        logger.warning(
            "[supabase_token_mint_failed] user_id=%s error=%s",
            user_id,
            str(ex),
            exc_info=True,
        )
    return payload
