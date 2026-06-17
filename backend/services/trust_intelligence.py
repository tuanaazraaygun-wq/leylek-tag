"""
TIE-2BE-A — read-only Trust Intelligence enrichment for trusted connections.
No dispatch/matching/QM writes; suggested_action always null.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from services.tie_pair_stats import TiePairStat, resolve_days_since_last_trip

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1
ACTION_BLOCK_REASON = "actions_not_enabled"

INSIGHT_MESSAGES: dict[str, str] = {
    "TIE_READY_NEARBY": "Yakınınızda müsait görünüyor",
    "TIE_FREQUENT_TRAVEL": "Birlikte {n} yolculuk tamamladınız",
    "TIE_RECENT_TRUSTED": "Son birlikte yolculuğunuz yakın zamanda",
    "TIE_HIGH_RATED": "Yüksek puanlı sürücü",
    "TIE_ON_TRIP": "Şu an yolculukta",
    "TIE_OFFLINE": "Şu an müsait görünmüyor",
    "TIE_INSUFFICIENT_DATA": "Henüz birlikte yolculuk geçmişi yok",
}

_RADAR_RANK_CAPS: dict[str, int] = {
    "TRUST_ON_TRIP": 40,
    "TRUST_OFFLINE": 25,
    "TRUST_STALE": 35,
    "TRUST_UNKNOWN": 20,
}


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


def _days_since(value: Any) -> Optional[int]:
    dt = _parse_iso_ts(value)
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    delta = now - dt
    if delta.total_seconds() < 0:
        return 0
    return max(0, int(delta.total_seconds() // 86400))


def _availability_norm(radar: Optional[dict]) -> float:
    if not radar or not isinstance(radar, dict):
        return 0.0
    try:
        rank = float(radar.get("availability_rank") or 0)
    except (TypeError, ValueError):
        rank = 0.0
    return max(0.0, min(1.0, rank / 100.0))


def _relationship_norm(pair_completed_trips: int) -> float:
    return min(max(0, int(pair_completed_trips)), 5) / 5.0


def _recency_norm(days_since_last_trip: Optional[int]) -> float:
    if days_since_last_trip is None:
        return 0.0
    days = max(0, int(days_since_last_trip))
    if days <= 7:
        return 1.0
    if days <= 30:
        return 0.7
    if days <= 90:
        return 0.35
    return 0.15


def _tenure_norm(responded_at: Any) -> float:
    days = _days_since(responded_at)
    if days is None:
        return 0.0
    return min(days / 90.0, 1.0)


def _quality_norm(user_row: Optional[dict]) -> float:
    if not user_row or not isinstance(user_row, dict):
        return 0.5
    try:
        rating = float(user_row.get("rating"))
    except (TypeError, ValueError):
        return 0.5
    if rating <= 3.0:
        return 0.0
    if rating >= 5.0:
        return 1.0
    return max(0.0, min(1.0, (rating - 3.0) / 2.0))


def _radar_state(radar: Optional[dict]) -> str:
    if not radar or not isinstance(radar, dict):
        return "TRUST_UNKNOWN"
    return str(radar.get("radar_state") or "TRUST_UNKNOWN").strip()


def _distance_band(radar: Optional[dict]) -> str:
    if not radar or not isinstance(radar, dict):
        return "UNKNOWN"
    return str(radar.get("distance_band") or "UNKNOWN").strip()


def _compute_tie_rank(
    *,
    radar: Optional[dict],
    pair_completed_trips: int,
    days_since_last_trip: Optional[int],
    responded_at: Any,
    user_row: Optional[dict],
) -> int:
    score = (
        0.35 * _availability_norm(radar)
        + 0.30 * _relationship_norm(pair_completed_trips)
        + 0.15 * _recency_norm(days_since_last_trip)
        + 0.10 * _tenure_norm(responded_at)
        + 0.10 * _quality_norm(user_row)
    )
    tie_rank = int(round(max(0.0, min(1.0, score)) * 100))
    state = _radar_state(radar)
    cap = _RADAR_RANK_CAPS.get(state)
    if cap is not None:
        tie_rank = min(tie_rank, cap)
    return tie_rank


def _confidence(
    *,
    radar: Optional[dict],
    pair_completed_trips: int,
    days_since_last_trip: Optional[int],
    responded_at: Any,
) -> str:
    state = _radar_state(radar)
    tenure_days = _days_since(responded_at)
    if (
        state == "TRUST_READY"
        and pair_completed_trips >= 2
        and days_since_last_trip is not None
        and days_since_last_trip <= 30
    ):
        return "high"
    if state == "TRUST_READY" and (
        pair_completed_trips >= 1 or (tenure_days is not None and tenure_days >= 7)
    ):
        return "medium"
    return "low"


def _insight_applies(
    code: str,
    *,
    radar: Optional[dict],
    pair_completed_trips: int,
    days_since_last_trip: Optional[int],
    user_row: Optional[dict],
) -> bool:
    state = _radar_state(radar)
    band = _distance_band(radar)
    if code == "TIE_ON_TRIP":
        return state == "TRUST_ON_TRIP"
    if code == "TIE_OFFLINE":
        return state in ("TRUST_OFFLINE", "TRUST_STALE")
    if code == "TIE_READY_NEARBY":
        return state == "TRUST_READY" and band in ("VERY_CLOSE", "NEARBY")
    if code == "TIE_FREQUENT_TRAVEL":
        return pair_completed_trips >= 3
    if code == "TIE_RECENT_TRUSTED":
        return (
            pair_completed_trips >= 1
            and days_since_last_trip is not None
            and days_since_last_trip <= 14
        )
    if code == "TIE_HIGH_RATED":
        try:
            rating = float((user_row or {}).get("rating"))
            total_trips = int((user_row or {}).get("total_trips") or 0)
        except (TypeError, ValueError):
            return False
        return rating >= 4.5 and total_trips >= 20
    if code == "TIE_INSUFFICIENT_DATA":
        return pair_completed_trips <= 0
    return False


def _primary_insight_code(
    *,
    radar: Optional[dict],
    pair_completed_trips: int,
    days_since_last_trip: Optional[int],
    user_row: Optional[dict],
) -> str:
    priority = (
        "TIE_ON_TRIP",
        "TIE_OFFLINE",
        "TIE_READY_NEARBY",
        "TIE_FREQUENT_TRAVEL",
        "TIE_RECENT_TRUSTED",
        "TIE_HIGH_RATED",
        "TIE_INSUFFICIENT_DATA",
    )
    for code in priority:
        if _insight_applies(
            code,
            radar=radar,
            pair_completed_trips=pair_completed_trips,
            days_since_last_trip=days_since_last_trip,
            user_row=user_row,
        ):
            return code
    return "TIE_INSUFFICIENT_DATA"


def _format_insight_message(code: str, *, pair_completed_trips: int) -> str:
    template = INSIGHT_MESSAGES.get(code, INSIGHT_MESSAGES["TIE_INSUFFICIENT_DATA"])
    if "{n}" in template:
        return template.format(n=max(0, int(pair_completed_trips)))
    return template


def _insights_list(
    *,
    radar: Optional[dict],
    pair_completed_trips: int,
    days_since_last_trip: Optional[int],
    user_row: Optional[dict],
    primary_insight_code: str,
) -> list[str]:
    priority = (
        "TIE_ON_TRIP",
        "TIE_OFFLINE",
        "TIE_READY_NEARBY",
        "TIE_FREQUENT_TRAVEL",
        "TIE_RECENT_TRUSTED",
        "TIE_HIGH_RATED",
    )
    messages: list[str] = []
    for code in priority:
        if not _insight_applies(
            code,
            radar=radar,
            pair_completed_trips=pair_completed_trips,
            days_since_last_trip=days_since_last_trip,
            user_row=user_row,
        ):
            continue
        msg = _format_insight_message(code, pair_completed_trips=pair_completed_trips)
        if msg and msg not in messages:
            messages.append(msg)
        if len(messages) >= 2:
            break
    if not messages and pair_completed_trips <= 0:
        messages.append(INSIGHT_MESSAGES["TIE_INSUFFICIENT_DATA"])
    elif not messages and primary_insight_code != "TIE_INSUFFICIENT_DATA":
        msg = _format_insight_message(primary_insight_code, pair_completed_trips=pair_completed_trips)
        if msg:
            messages.append(msg)
    return messages[:2]


def build_tie_for_driver_connection(
    *,
    radar: Optional[dict],
    user_row: Optional[dict],
    pair_stat: TiePairStat,
    responded_at: Any,
    connection_last_trip_at: Any,
) -> dict:
    pair_completed_trips = max(0, int(pair_stat.pair_completed_trips))
    days_since_last_trip = resolve_days_since_last_trip(
        pair_stat,
        connection_last_trip_at=connection_last_trip_at,
    )
    primary = _primary_insight_code(
        radar=radar,
        pair_completed_trips=pair_completed_trips,
        days_since_last_trip=days_since_last_trip,
        user_row=user_row,
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "tie_rank": _compute_tie_rank(
            radar=radar,
            pair_completed_trips=pair_completed_trips,
            days_since_last_trip=days_since_last_trip,
            responded_at=responded_at,
            user_row=user_row,
        ),
        "confidence": _confidence(
            radar=radar,
            pair_completed_trips=pair_completed_trips,
            days_since_last_trip=days_since_last_trip,
            responded_at=responded_at,
        ),
        "primary_insight_code": primary,
        "insights": _insights_list(
            radar=radar,
            pair_completed_trips=pair_completed_trips,
            days_since_last_trip=days_since_last_trip,
            user_row=user_row,
            primary_insight_code=primary,
        ),
        "pair_completed_trips": pair_completed_trips,
        "days_since_last_trip": days_since_last_trip,
        "suggested_action": None,
        "action_block_reason": ACTION_BLOCK_REASON,
    }


def insufficient_tie_fallback() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "tie_rank": 0,
        "confidence": "low",
        "primary_insight_code": "TIE_INSUFFICIENT_DATA",
        "insights": [INSIGHT_MESSAGES["TIE_INSUFFICIENT_DATA"]],
        "pair_completed_trips": 0,
        "days_since_last_trip": None,
        "suggested_action": None,
        "action_block_reason": ACTION_BLOCK_REASON,
    }


def attach_tie_to_connections(
    *,
    connections: list[dict],
    users_by_id: dict[str, dict],
    pair_stats_by_driver: dict[str, TiePairStat],
    connection_meta_by_id: dict[str, dict],
) -> None:
    """Mutates connection dicts in place — driver peers only."""
    for item in connections:
        role = str(item.get("role") or "").strip().lower()
        if role != "driver":
            continue
        if not isinstance(item.get("radar"), dict):
            continue
        cp = item.get("counterparty") if isinstance(item.get("counterparty"), dict) else {}
        uid = str(cp.get("user_id") or "").strip().lower()
        user_row = users_by_id.get(uid)
        meta = connection_meta_by_id.get(str(item.get("connection_id") or ""), {})
        pair_stat = pair_stats_by_driver.get(uid) or TiePairStat(
            pair_completed_trips=0,
            days_since_last_trip=None,
        )
        try:
            item["tie"] = build_tie_for_driver_connection(
                radar=item.get("radar"),
                user_row=user_row,
                pair_stat=pair_stat,
                responded_at=meta.get("responded_at"),
                connection_last_trip_at=item.get("last_trip_at"),
            )
        except Exception as exc:
            logger.warning(
                "trust_intelligence attach connection_id=%s err=%s",
                str(item.get("connection_id") or "")[:8],
                type(exc).__name__,
            )
            item["tie"] = insufficient_tie_fallback()
