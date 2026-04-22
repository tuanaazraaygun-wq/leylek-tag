"""
LeylekTag access JWT (HS256) — server.py ile aynı imza mantığı; döngüsel import yok.
Yalnızca opsiyonel doğrulama (Leylek Zeka support_context vb.).
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Optional

import jwt
from dotenv import load_dotenv
from jwt.exceptions import InvalidTokenError

_ROOT = Path(__file__).resolve().parent
try:
    load_dotenv("/etc/leylektag.env", override=True)
except Exception:
    pass
try:
    load_dotenv(_ROOT / ".env", override=True)
except Exception:
    pass

logger = logging.getLogger(__name__)


def _api_session_signing_secret() -> str:
    explicit = (os.getenv("API_SESSION_SECRET") or "").strip()
    if explicit:
        return explicit
    sr = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if sr:
        return hashlib.sha256(("leylek|api-session|v1|" + sr).encode("utf-8")).hexdigest()
    logger.warning(
        "api_session_jwt: API_SESSION_SECRET ve Supabase service key yok; zayıf varsayılan kullanılıyor."
    )
    return "leylek-insecure-dev-only-change-me"


def verify_access_token_optional(token: str) -> Optional[str]:
    """Bearer token geçerliyse sub (kullanıcı id), değilse None. HTTPException yok."""
    raw = (token or "").strip()
    if not raw:
        return None
    try:
        payload = jwt.decode(
            raw,
            _api_session_signing_secret(),
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
        )
        uid = payload.get("sub")
        if not uid or not isinstance(uid, str):
            return None
        return uid.strip().lower()
    except InvalidTokenError:
        return None
