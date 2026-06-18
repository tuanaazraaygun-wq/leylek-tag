"""
MATCH-REL-1C-A — location freshness helpers for match eligibility.

Faz 1: telemetry only (QM); enforce in later phases.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

_DEFAULT_MAX_AGE_SEC = 120


def get_location_max_age_seconds() -> int:
    """LOCATION_MAX_AGE_SECONDS env; default 120; 0 = disabled (future enforce)."""
    try:
        return int(os.getenv("LOCATION_MAX_AGE_SECONDS", str(_DEFAULT_MAX_AGE_SEC)).strip())
    except (TypeError, ValueError):
        return _DEFAULT_MAX_AGE_SEC


def _parse_iso_ts(value: Any) -> Optional[datetime]:
    if value is None or str(value).strip() == "":
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def location_age_seconds(row: dict) -> Optional[float]:
    """Seconds since last_location_update; None if missing or unparseable."""
    dt = _parse_iso_ts(row.get("last_location_update"))
    if dt is None:
        return None
    return (datetime.now(timezone.utc) - dt).total_seconds()


def is_driver_location_fresh(row: dict) -> bool:
    """True if location is within max age; always True when max age is 0 (disabled)."""
    max_age = get_location_max_age_seconds()
    if max_age <= 0:
        return True
    age = location_age_seconds(row)
    if age is None:
        return False
    return age <= max_age
