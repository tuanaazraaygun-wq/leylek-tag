"""
Trust Radar R1A — read-only presence projection for trusted connections.
No dispatch/matching/QM writes; no coordinates exposed to clients.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1
TAG_TYPE_NORMAL = "normal"
OFFER_BLOCK_REASON = "trust_offer_not_enabled"
OFFER_BLOCK_BUSY = "driver_busy"
OFFER_BLOCK_OFFLINE = "driver_offline"
OFFER_BLOCK_STALE = "location_stale"
OFFER_BLOCK_UNAVAILABLE = "driver_unavailable"
PASSENGER_CP_BLOCK_REASON = "passenger_radar_v2"

STALE_LOCATION_MAX_AGE_SEC = 15 * 60

TRUST_RADAR_BUSY_STATUSES = (
    "accepted",
    "driver_arriving",
    "passenger_onboard",
    "in_progress",
)

_DISTANCE_VERY_CLOSE_KM = 2.0
_DISTANCE_NEARBY_KM = 5.0
_DISTANCE_IN_CITY_KM = 15.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r_earth = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return r_earth * 2 * math.asin(math.sqrt(a))


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


def _coords_pair(row: Optional[dict]) -> Optional[tuple[float, float]]:
    if not row or not isinstance(row, dict):
        return None
    lat, lng = row.get("latitude"), row.get("longitude")
    if lat is None or lng is None:
        return None
    try:
        la, lo = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    if not (-90.0 <= la <= 90.0 and -180.0 <= lo <= 180.0):
        return None
    if la == 0.0 and lo == 0.0:
        return None
    return la, lo


def _is_location_stale(last_location_update: Any) -> bool:
    dt = _parse_iso_ts(last_location_update)
    if dt is None:
        return True
    age = (datetime.now(timezone.utc) - dt).total_seconds()
    return age > STALE_LOCATION_MAX_AGE_SEC


def _driver_details_dict(user_row: dict) -> dict:
    dd = user_row.get("driver_details")
    if isinstance(dd, dict):
        return dd
    if isinstance(dd, str) and dd.strip():
        try:
            parsed = json.loads(dd)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


def _driver_kyc_approved(user_row: dict) -> bool:
    dd = _driver_details_dict(user_row)
    return str(dd.get("kyc_status") or "").strip().lower() == "approved"


def fetch_busy_driver_ids(supabase: Any, driver_ids: list[str]) -> set[str]:
    """Batch read — driver has normal tag in active-trip statuses."""
    ids = [str(d).strip().lower() for d in driver_ids if str(d or "").strip()]
    if not ids or supabase is None:
        return set()
    try:
        res = (
            supabase.table("tags")
            .select("driver_id")
            .eq("type", TAG_TYPE_NORMAL)
            .in_("driver_id", ids)
            .in_("status", list(TRUST_RADAR_BUSY_STATUSES))
            .execute()
        )
        out: set[str] = set()
        for row in res.data or []:
            did = str(row.get("driver_id") or "").strip().lower()
            if did:
                out.add(did)
        return out
    except Exception as exc:
        logger.warning("trusted_radar busy_driver_ids err=%s", type(exc).__name__)
        return set()


def count_ready_trusted_drivers(
    supabase: Any,
    *,
    driver_rows: list[dict],
) -> int:
    """TRUST_READY count — same state rules as build_driver_connection_radar."""
    rows = [r for r in driver_rows if isinstance(r, dict)]
    if not rows:
        return 0
    ids = [str(r.get("id") or "").strip().lower() for r in rows if str(r.get("id") or "").strip()]
    busy_ids = fetch_busy_driver_ids(supabase, ids)
    ready = 0
    for row in rows:
        uid = str(row.get("id") or "").strip().lower()
        if not uid:
            continue
        peer_stale = _is_location_stale(row.get("last_location_update"))
        state = _radar_state_for_driver(row, busy=uid in busy_ids, peer_stale=peer_stale)
        if state == "TRUST_READY":
            ready += 1
    return ready


def _distance_band_from_coords(
    actor_coords: Optional[tuple[float, float]],
    peer_coords: Optional[tuple[float, float]],
) -> str:
    if actor_coords is None or peer_coords is None:
        return "UNKNOWN"
    km = _haversine_km(actor_coords[0], actor_coords[1], peer_coords[0], peer_coords[1])
    if km <= _DISTANCE_VERY_CLOSE_KM:
        return "VERY_CLOSE"
    if km <= _DISTANCE_NEARBY_KM:
        return "NEARBY"
    if km <= _DISTANCE_IN_CITY_KM:
        return "IN_CITY"
    return "FAR"


def _availability_rank(state: str, distance_band: str) -> int:
    if state == "TRUST_READY":
        if distance_band == "VERY_CLOSE":
            return 100
        if distance_band == "NEARBY":
            return 95
        if distance_band == "IN_CITY":
            return 90
        return 85
    if state == "TRUST_ON_TRIP":
        return 25
    if state == "TRUST_STALE":
        return 10
    return 0


def _radar_state_for_driver(
    user_row: dict,
    *,
    busy: bool,
    peer_stale: bool,
) -> str:
    if busy:
        return "TRUST_ON_TRIP"
    if user_row.get("driver_online") is not True:
        return "TRUST_OFFLINE"
    if peer_stale:
        return "TRUST_STALE"
    if _coords_pair(user_row) is None:
        return "TRUST_UNKNOWN"
    return "TRUST_READY"


def _radar_copy(state: str, distance_band: str) -> tuple[str, Optional[str]]:
    if state == "TRUST_READY":
        label = "Şu anda müsait"
        base = "Güvenilir sürücün"
        if distance_band == "VERY_CLOSE":
            return label, f"{base} · Sana çok yakın"
        if distance_band == "NEARBY":
            return label, f"{base} · Yakınında"
        return label, base
    mapping: dict[str, tuple[str, Optional[str]]] = {
        "TRUST_ON_TRIP": ("Yolculukta", "Şu an müsait değil"),
        "TRUST_OFFLINE": ("Çevrimdışı", "Son görüldüğünde müsait değildi"),
        "TRUST_STALE": ("Sinyal eski", "Çevrimiçi görünüyor"),
        "TRUST_UNKNOWN": ("Durum net değil", None),
    }
    return mapping.get(state, ("Durum net değil", None))


def _is_quick_match_ready_driver(
    user_row: dict,
    *,
    busy: bool,
    peer_stale: bool,
    state: str,
) -> bool:
    if state != "TRUST_READY":
        return False
    if busy or peer_stale:
        return False
    if user_row.get("driver_online") is not True:
        return False
    if _coords_pair(user_row) is None:
        return False
    if not _driver_kyc_approved(user_row):
        return False
    return True


def _trust_offer_eligibility(
    state: str,
    *,
    busy: bool,
    driver_row: dict,
    peer_stale: bool,
) -> tuple[bool, str]:
    if (
        state == "TRUST_READY"
        and not busy
        and driver_row.get("driver_online") is True
        and not peer_stale
        and _coords_pair(driver_row) is not None
        and _driver_kyc_approved(driver_row)
    ):
        return True, ""
    if state == "TRUST_ON_TRIP" or busy:
        return False, OFFER_BLOCK_BUSY
    if state == "TRUST_OFFLINE" or driver_row.get("driver_online") is not True:
        return False, OFFER_BLOCK_OFFLINE
    if peer_stale or state == "TRUST_STALE":
        return False, OFFER_BLOCK_STALE
    return False, OFFER_BLOCK_UNAVAILABLE


def unknown_radar(*, offer_block_reason: str = OFFER_BLOCK_REASON) -> dict:
    label, subtitle = _radar_copy("TRUST_UNKNOWN", "UNKNOWN")
    return {
        "schema_version": SCHEMA_VERSION,
        "radar_state": "TRUST_UNKNOWN",
        "radar_label": label,
        "radar_subtitle": subtitle,
        "availability_rank": 0,
        "distance_band": "UNKNOWN",
        "available_in_band": None,
        "is_quick_match_ready": False,
        "trust_offer_eligible": False,
        "offer_block_reason": offer_block_reason,
    }


def build_driver_connection_radar(
    *,
    actor_row: Optional[dict],
    driver_row: dict,
    busy: bool,
) -> dict:
    try:
        actor_coords = _coords_pair(actor_row)
        peer_coords = _coords_pair(driver_row)
        peer_stale = _is_location_stale(driver_row.get("last_location_update"))

        state = _radar_state_for_driver(driver_row, busy=busy, peer_stale=peer_stale)

        if state == "TRUST_READY":
            distance_band = _distance_band_from_coords(actor_coords, peer_coords)
        elif state == "TRUST_ON_TRIP":
            distance_band = (
                _distance_band_from_coords(actor_coords, peer_coords)
                if not peer_stale
                else "UNKNOWN"
            )
        else:
            distance_band = "UNKNOWN"

        label, subtitle = _radar_copy(state, distance_band)
        trust_offer_eligible, offer_block_reason = _trust_offer_eligibility(
            state,
            busy=busy,
            driver_row=driver_row,
            peer_stale=peer_stale,
        )
        return {
            "schema_version": SCHEMA_VERSION,
            "radar_state": state,
            "radar_label": label,
            "radar_subtitle": subtitle,
            "availability_rank": _availability_rank(state, distance_band),
            "distance_band": distance_band,
            "available_in_band": None,
            "is_quick_match_ready": _is_quick_match_ready_driver(
                driver_row,
                busy=busy,
                peer_stale=peer_stale,
                state=state,
            ),
            "trust_offer_eligible": trust_offer_eligible,
            "offer_block_reason": offer_block_reason or None,
        }
    except Exception as exc:
        logger.warning("trusted_radar build_driver err=%s", type(exc).__name__)
        return unknown_radar()


def build_passenger_connection_radar() -> dict:
    return unknown_radar(offer_block_reason=PASSENGER_CP_BLOCK_REASON)


def attach_radar_to_connections(
    *,
    actor_row: Optional[dict],
    connections: list[dict],
    users_by_id: dict[str, dict],
    busy_driver_ids: set[str],
) -> None:
    """Mutates connection dicts in place."""
    for item in connections:
        role = str(item.get("role") or "").strip().lower()
        cp = item.get("counterparty") if isinstance(item.get("counterparty"), dict) else {}
        uid = str(cp.get("user_id") or "").strip().lower()
        user_row = users_by_id.get(uid)
        try:
            if role != "driver" or not user_row:
                item["radar"] = build_passenger_connection_radar()
                continue
            item["radar"] = build_driver_connection_radar(
                actor_row=actor_row,
                driver_row=user_row,
                busy=uid in busy_driver_ids,
            )
        except Exception as exc:
            logger.warning(
                "trusted_radar attach connection_id=%s err=%s",
                str(item.get("connection_id") or "")[:8],
                type(exc).__name__,
            )
            item["radar"] = unknown_radar()
