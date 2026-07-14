"""
Staging-only KYC queue fixture gate (Phase 3E).

Fixture is allowed only when BOTH are exact matches:
  APP_ENV=staging
  LEYLEK_KYC_QUEUE_DATA_MODE=fixture

Never case-fold. Never treat truthy booleans as staging.
"""
from __future__ import annotations

import os
from typing import Optional

# Product (live Leylek) Supabase project ref — fixture must not run if this appears.
PRODUCT_SUPABASE_REF = "ujvploftywsxprlzejgc"

APP_ENV_NAME = "APP_ENV"
DATA_MODE_ENV_NAME = "LEYLEK_KYC_QUEUE_DATA_MODE"

REQUIRED_APP_ENV = "staging"
REQUIRED_DATA_MODE = "fixture"

# If any of these is "production-enabled", fixture mode is denied.
_OUTBOUND_KILL_SWITCH_ENVS = (
    "PUSH_ENABLED",
    "SMS_ENABLED",
    "EMAIL_ENABLED",
    "PAYMENTS_ENABLED",
    "IBAN_PAYMENTS_ENABLED",
    "AGORA_ENABLED",
    "NOTIFICATIONS_ENABLED",
)

_OUTBOUND_OFF = frozenset({"", "0", "false", "off", "no"})


def _env_exact(name: str) -> str:
    return os.getenv(name) or ""


def is_fixture_data_mode_requested() -> bool:
    return _env_exact(DATA_MODE_ENV_NAME) == REQUIRED_DATA_MODE


def supabase_url_contains_product_ref(supabase_url: Optional[str] = None) -> bool:
    url = supabase_url if supabase_url is not None else _env_exact("SUPABASE_URL")
    return PRODUCT_SUPABASE_REF in str(url)


def outbound_providers_appear_enabled() -> bool:
    """Fail-closed: any non-off value is treated as enabled."""
    for name in _OUTBOUND_KILL_SWITCH_ENVS:
        raw = _env_exact(name).strip().lower()
        if raw not in _OUTBOUND_OFF:
            return True
    return False


def fixture_mode_denial_reason() -> Optional[str]:
    """
    If fixture mode is requested, return a stable denial code when unsafe.
    If fixture mode is not requested, return None (caller uses product_db).
    """
    if not is_fixture_data_mode_requested():
        return None

    if _env_exact(APP_ENV_NAME) != REQUIRED_APP_ENV:
        return "fixture_mode_denied"

    if supabase_url_contains_product_ref():
        return "fixture_unsafe_product_supabase"

    if outbound_providers_appear_enabled():
        return "fixture_unsafe_outbound_enabled"

    return None


def is_staging_fixture_mode_allowed() -> bool:
    """True only when fixture is requested and all gates pass."""
    if not is_fixture_data_mode_requested():
        return False
    return fixture_mode_denial_reason() is None
