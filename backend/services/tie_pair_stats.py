"""
TIE-2BE-A — batch pairwise trip stats for trusted driver peers (read-only).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

TAG_TYPE_NORMAL = "normal"
TAG_STATUS_COMPLETED = "completed"


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


def _days_since(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    delta = now - dt
    if delta.total_seconds() < 0:
        return 0
    return max(0, int(delta.total_seconds() // 86400))


@dataclass(frozen=True)
class TiePairStat:
    pair_completed_trips: int
    days_since_last_trip: Optional[int]


def _empty_stats(driver_ids: list[str]) -> dict[str, TiePairStat]:
    return {
        str(d).strip().lower(): TiePairStat(pair_completed_trips=0, days_since_last_trip=None)
        for d in driver_ids
        if str(d or "").strip()
    }


def fetch_pair_stats_for_trusted_drivers(
    supabase: Any,
    passenger_id: str,
    driver_ids: list[str],
) -> dict[str, TiePairStat]:
    """
    Batch read completed normal tags for passenger ↔ trusted drivers.
    Returns map driver_id -> TiePairStat.
    """
    actor = str(passenger_id or "").strip().lower()
    ids = sorted({str(d).strip().lower() for d in driver_ids if str(d or "").strip()})
    if not actor or not ids or supabase is None:
        return _empty_stats(ids)

    counts: dict[str, int] = {did: 0 for did in ids}
    max_completed: dict[str, Optional[datetime]] = {did: None for did in ids}

    try:
        res = (
            supabase.table("tags")
            .select("driver_id, completed_at")
            .eq("passenger_id", actor)
            .eq("type", TAG_TYPE_NORMAL)
            .eq("status", TAG_STATUS_COMPLETED)
            .in_("driver_id", ids)
            .execute()
        )
        for row in res.data or []:
            did = str(row.get("driver_id") or "").strip().lower()
            if did not in counts:
                continue
            counts[did] = counts.get(did, 0) + 1
            completed = _parse_iso_ts(row.get("completed_at"))
            if completed is None:
                continue
            prev = max_completed.get(did)
            if prev is None or completed > prev:
                max_completed[did] = completed
    except Exception as exc:
        logger.warning("tie_pair_stats batch query err=%s", type(exc).__name__)
        return _empty_stats(ids)

    out: dict[str, TiePairStat] = {}
    for did in ids:
        out[did] = TiePairStat(
            pair_completed_trips=counts.get(did, 0),
            days_since_last_trip=_days_since(max_completed.get(did)),
        )
    return out


def resolve_days_since_last_trip(
    pair_stat: TiePairStat,
    *,
    connection_last_trip_at: Any,
) -> Optional[int]:
    """Prefer tags aggregate; fallback to trusted_connections.last_trip_at."""
    if pair_stat.days_since_last_trip is not None:
        return pair_stat.days_since_last_trip
    return _days_since(_parse_iso_ts(connection_last_trip_at))
