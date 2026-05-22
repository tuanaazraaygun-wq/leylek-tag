"""
Read-only operation snapshots (driver demand / passenger availability).
SELECT only — no dispatch writes, no coordinates or ids in API payloads.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from supabase_client import get_supabase

logger = logging.getLogger(__name__)

SCHEMA_VERSION = "1"
TAG_TYPE_NORMAL = "normal"
DRIVER_UNLIMITED_FREE_PERIOD = os.getenv("DRIVER_UNLIMITED_FREE_PERIOD", "true").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

_PASSENGER_ACTIVE_TAG_STATUSES = (
    "waiting",
    "pending",
    "offers_received",
    "matched",
    "in_progress",
)
_PASSENGER_PICKUP_CENTER_STATUSES = ("waiting", "pending", "offers_received")

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


def _mask_uid(uid: str) -> str:
    s = str(uid or "").strip()
    if len(s) <= 8:
        return "***"
    return f"{s[:4]}…{s[-4:]}"


def clamp_radius_km(radius_km: float) -> float:
    try:
        r = float(radius_km)
    except (TypeError, ValueError):
        r = 20.0
    return max(5.0, min(30.0, r))


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
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


def _canonical_vehicle_kind(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    s = str(value).strip().lower()
    if s == "car":
        return "car"
    if s in ("motorcycle", "motor", "moto"):
        return "motorcycle"
    return None


def _driver_details_as_dict(user_row: dict) -> dict:
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


def _normalize_kyc_vehicle_kinds_list(raw: Any) -> List[str]:
    out: List[str] = []
    parsed: Any = raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw.strip())
        except Exception:
            parsed = None
    seq = parsed if isinstance(parsed, list) else raw if isinstance(raw, list) else None
    if isinstance(seq, list):
        for x in seq:
            c = _canonical_vehicle_kind(x)
            if c and c not in out:
                out.append(c)
    return out


def _kyc_approved_vehicle_kinds_from_details(dd: dict) -> List[str]:
    norm = _normalize_kyc_vehicle_kinds_list(dd.get("approved_vehicle_kinds"))
    if norm:
        return norm
    if dd.get("kyc_status") == "approved":
        one = _canonical_vehicle_kind(dd.get("kyc_vehicle_kind"))
        return [one] if one else []
    return []


def _driver_is_allowed_for_trip_vehicle(driver_row: dict, trip_vehicle_kind: Any) -> bool:
    trip = _canonical_vehicle_kind(trip_vehicle_kind) or "car"
    allowed = _kyc_approved_vehicle_kinds_from_details(_driver_details_as_dict(driver_row))
    if not allowed:
        return False
    return trip in allowed


def _trip_passenger_vehicle_pref(tag_row: dict) -> str:
    pref = _canonical_vehicle_kind(tag_row.get("passenger_preferred_vehicle"))
    return pref or "car"


def _apply_driver_active_until_filter(query, now_iso: str):
    if DRIVER_UNLIMITED_FREE_PERIOD:
        return query
    return query.gt("driver_active_until", now_iso)


def parse_region_label(pickup_location: str) -> Optional[str]:
    loc = str(pickup_location or "").strip()
    if not loc:
        return None
    label = loc.split(",")[0].split("/")[0].strip()
    return label or None


def user_is_driver_for_snapshot(user_row: dict) -> bool:
    dd = _driver_details_as_dict(user_row)
    if str(dd.get("kyc_status") or "").strip().lower() == "approved":
        return True
    if dd.get("vehicle_kind") or dd.get("kyc_vehicle_kind"):
        return True
    if _normalize_kyc_vehicle_kinds_list(dd.get("approved_vehicle_kinds")):
        return True
    return False


def _fetch_user_row(sb, user_id: str) -> Optional[dict]:
    try:
        r = (
            sb.table("users")
            .select("id, latitude, longitude, driver_details")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if r.data:
            return r.data[0]
    except Exception as e:
        logger.warning("operation_snapshot user fetch uid=%s err=%s", _mask_uid(user_id), type(e).__name__)
    return None


def fetch_waiting_normal_tags_sync(sb) -> List[dict]:
    try:
        r = (
            sb.table("tags")
            .select("id, pickup_lat, pickup_lng, pickup_location, passenger_preferred_vehicle")
            .eq("type", TAG_TYPE_NORMAL)
            .eq("status", "waiting")
            .execute()
        )
        return list(r.data or [])
    except Exception as e:
        logger.warning("operation_snapshot waiting tags err=%s", type(e).__name__)
        return []


def count_online_drivers_nearby_sync(
    sb,
    center_lat: float,
    center_lng: float,
    radius_km: float,
    vehicle_pref: Optional[str],
) -> int:
    now = datetime.utcnow().isoformat()
    q = sb.table("users").select("id, latitude, longitude, driver_details").eq("driver_online", True)
    drivers_result = _apply_driver_active_until_filter(q, now).execute()
    pref = _canonical_vehicle_kind(vehicle_pref)
    count = 0
    for d in drivers_result.data or []:
        if pref is not None and not _driver_is_allowed_for_trip_vehicle(d, pref):
            continue
        d_lat, d_lng = d.get("latitude"), d.get("longitude")
        if d_lat is not None and d_lng is not None:
            try:
                if haversine_km(center_lat, center_lng, float(d_lat), float(d_lng)) <= radius_km:
                    count += 1
            except (TypeError, ValueError):
                continue
    return count


def aggregate_region_counts(tags_in_radius: List[dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for tag in tags_in_radius:
        label = parse_region_label(tag.get("pickup_location") or "")
        if label:
            counts[label] = counts.get(label, 0) + 1
    return counts


def top_regions_from_counts(counts: Dict[str, int], max_n: int = 3) -> List[dict]:
    items = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    return [{"label": name, "waiting_count": cnt} for name, cnt in items[:max_n]]


def _tags_nearby_filtered(
    tags: List[dict],
    center_lat: float,
    center_lng: float,
    radius_km: float,
    driver_row: Optional[dict],
    exclude_tag_id: Optional[str] = None,
) -> List[dict]:
    out: List[dict] = []
    ex = str(exclude_tag_id or "").strip().lower()
    for tag in tags:
        tid = str(tag.get("id") or "").strip().lower()
        if ex and tid == ex:
            continue
        tag_lat, tag_lng = tag.get("pickup_lat"), tag.get("pickup_lng")
        if tag_lat is None or tag_lng is None:
            continue
        try:
            distance = haversine_km(center_lat, center_lng, float(tag_lat), float(tag_lng))
        except (TypeError, ValueError):
            continue
        if distance > radius_km:
            continue
        if driver_row is not None:
            pref_tag = _trip_passenger_vehicle_pref(tag)
            if not _driver_is_allowed_for_trip_vehicle(driver_row, pref_tag):
                continue
        out.append(tag)
    return out


def compute_signal_driver(nearby_waiting_count: int, top_regions: List[dict]) -> str:
    if nearby_waiting_count == 0:
        return "weak"
    top = top_regions[0] if top_regions else {}
    if int(top.get("waiting_count") or 0) >= 2:
        return "moderate"
    if nearby_waiting_count >= 2:
        return "weak"
    return "weak"


def build_message_hint_driver(
    *,
    has_data: bool,
    signal: str,
    nearby_waiting_count: int,
    top_regions: List[dict],
) -> str:
    if not has_data or signal == "none":
        return (
            "Şu anda yeterli yoğunluk verisi yok. Yakındaki talepleri uygulama içinden "
            "takip etmeye devam edebilirim."
        )
    if nearby_waiting_count == 0:
        return (
            "Şu an bulunduğunuz çevrede bekleyen yolcu talebi görünmüyor. Uygun talepleri "
            "listeden takip etmeye devam edebilirsiniz."
        )
    if signal == "moderate" and top_regions:
        label = top_regions[0].get("label") or "bu bölge"
        hint = f"Şu an {label} çevresinde talep daha hareketli görünüyor."
        if len(top_regions) > 1 and top_regions[1].get("label"):
            hint += f" {top_regions[1]['label']} yönünü de kontrol edebilirsiniz."
        else:
            hint += " Rotanıza uygun talepleri listeden görebilirsiniz."
        return hint
    if nearby_waiting_count == 1:
        return (
            "Yakın çevrede az sayıda bekleyen talep var. Uygun teklifleri listeden "
            "değerlendirebilirsiniz."
        )
    return (
        "Yakın çevrede birkaç bekleyen talep var; rotanıza uygun olanları listeden "
        "görebilirsiniz."
    )


def compute_signal_passenger(
    nearby_driver_count: int,
    active_waiting_passenger_count: int,
    dispatch_status: Optional[str],
) -> str:
    if nearby_driver_count == 0:
        return "moderate"
    if (
        nearby_driver_count > 0
        and active_waiting_passenger_count >= 3
        and nearby_driver_count <= 2
    ):
        return "moderate"
    return "weak"


def build_message_hint_passenger(
    *,
    has_data: bool,
    signal: str,
    radius_km: float,
    nearby_driver_count: int,
    active_waiting_passenger_count: int,
    dispatch_status: Optional[str],
) -> str:
    if not has_data or signal == "none":
        return (
            "Şu anda bölgesel uygunluk verisini net göremiyorum. İsteğinizi takip etmeye "
            "devam edebilirsiniz."
        )
    r = int(radius_km) if radius_km == int(radius_km) else radius_km
    if nearby_driver_count == 0:
        return (
            f"Şu anda bulunduğunuz bölgenin {r} km çevresinde uygun sürücü görünmüyor. "
            "Biraz bekleyebilir veya isteği daha sonra tekrar deneyebilirsiniz."
        )
    if (
        nearby_driver_count > 0
        and active_waiting_passenger_count >= 3
        and nearby_driver_count <= 2
    ):
        return (
            "Bölgede talep hareketli görünüyor; aktif sürücü sayısı sınırlı. "
            "Biraz beklemek gerekebilir."
        )
    if dispatch_status == "no_drivers" and nearby_driver_count > 0:
        return "Yakında sürücü var; uygun sıra oluşunca teklifler iletilebilir."
    if nearby_driver_count > 0:
        return (
            "Yakın çevrede birkaç aktif sürücü görünüyor. Teklif gelmesi yoğunluğa ve "
            "sürücülerin uygunluğuna bağlı olabilir."
        )
    return (
        "Şu anda bölgesel uygunluk verisini net göremiyorum. İsteğinizi takip etmeye "
        "devam edebilirsiniz."
    )


def read_dispatch_summary_sync(sb, tag_id: str) -> Tuple[Optional[int], Optional[str]]:
    """Read-only dispatch queue özeti (yazma yok)."""
    queue: List[dict] = []
    try:
        import server as srv  # noqa: WPS433 — runtime; bellek kuyruğu öncelikli

        queue = list(getattr(srv, "dispatch_queues", {}).get(tag_id, []) or [])
    except Exception:
        queue = []
    if not queue:
        try:
            result = (
                sb.table("dispatch_queue")
                .select("status,priority")
                .eq("tag_id", tag_id)
                .order("priority")
                .execute()
            )
            queue = list(result.data or [])
        except Exception as e:
            logger.debug("dispatch_queue read tag=%s err=%s", _mask_uid(tag_id), type(e).__name__)
            queue = []
    total = len(queue)
    if total == 0:
        return 0, "no_drivers"

    def _st(e: dict) -> str:
        return str(e.get("status") or "").lower()

    sent = [e for e in queue if _st(e) == "sent"]
    expired = [e for e in queue if _st(e) == "expired"]
    accepted = [e for e in queue if _st(e) == "accepted"]
    if accepted:
        return total, "matched"
    if sent:
        return total, "offering"
    if len(expired) >= total:
        return total, "no_drivers"
    if expired:
        return total, "searching"
    return total, "searching"


def _resolve_passenger_center(
    sb,
    user_id: str,
    tag_id: Optional[str],
) -> Tuple[Optional[float], Optional[float], Optional[str], Optional[str], Optional[str]]:
    """
    (lat, lng, active_tag_id, vehicle_pref, tag_status)
    """
    active: Optional[dict] = None
    if tag_id:
        tid = str(tag_id).strip()
        if not _UUID_RE.match(tid):
            return None, None, None, None, None
        try:
            tr = (
                sb.table("tags")
                .select("id, passenger_id, pickup_lat, pickup_lng, passenger_preferred_vehicle, status")
                .eq("id", tid)
                .eq("type", TAG_TYPE_NORMAL)
                .limit(1)
                .execute()
            )
            if tr.data:
                row = tr.data[0]
                if str(row.get("passenger_id") or "").strip().lower() != user_id:
                    return None, None, None, None, None
                active = row
        except Exception:
            return None, None, None, None, None
    else:
        try:
            tr = (
                sb.table("tags")
                .select("id, pickup_lat, pickup_lng, passenger_preferred_vehicle, status")
                .eq("type", TAG_TYPE_NORMAL)
                .eq("passenger_id", user_id)
                .in_("status", list(_PASSENGER_ACTIVE_TAG_STATUSES))
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if tr.data:
                active = tr.data[0]
        except Exception as e:
            logger.warning(
                "operation_snapshot active tag uid=%s err=%s", _mask_uid(user_id), type(e).__name__
            )

    vehicle_pref: Optional[str] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    active_tag_id: Optional[str] = None
    tag_status: Optional[str] = None

    if active:
        active_tag_id = str(active.get("id") or "").strip() or None
        tag_status = str(active.get("status") or "").strip().lower() or None
        vehicle_pref = _trip_passenger_vehicle_pref(active)
        st = tag_status or ""
        if st in _PASSENGER_PICKUP_CENTER_STATUSES:
            plat, plng = active.get("pickup_lat"), active.get("pickup_lng")
            if plat is not None and plng is not None:
                try:
                    center_lat, center_lng = float(plat), float(plng)
                except (TypeError, ValueError):
                    pass

    if center_lat is None or center_lng is None:
        user = _fetch_user_row(sb, user_id)
        if user:
            if vehicle_pref is None:
                vehicle_pref = _canonical_vehicle_kind(
                    _driver_details_as_dict(user).get("passenger_preferred_vehicle")
                ) or "car"
            ulat, ulng = user.get("latitude"), user.get("longitude")
            if ulat is not None and ulng is not None:
                try:
                    center_lat, center_lng = float(ulat), float(ulng)
                except (TypeError, ValueError):
                    pass
        elif vehicle_pref is None:
            vehicle_pref = "car"

    if vehicle_pref is None:
        vehicle_pref = "car"

    return center_lat, center_lng, active_tag_id, vehicle_pref, tag_status


def build_driver_demand_snapshot_sync(user_id: str, radius_km: float) -> dict:
    sb = get_supabase()
    radius_km = clamp_radius_km(radius_km)
    generated_at = _utc_now_iso()

    user = _fetch_user_row(sb, user_id)
    if not user:
        return {
            "schema_version": SCHEMA_VERSION,
            "role": "driver",
            "radius_km": radius_km,
            "generated_at": generated_at,
            "has_data": False,
            "nearby_waiting_count": 0,
            "top_regions": [],
            "signal": "none",
            "message_hint": build_message_hint_driver(
                has_data=False, signal="none", nearby_waiting_count=0, top_regions=[]
            ),
            "no_guarantee": True,
            "data_quality": "low",
        }

    lat, lng = user.get("latitude"), user.get("longitude")
    if lat is None or lng is None:
        return {
            "schema_version": SCHEMA_VERSION,
            "role": "driver",
            "radius_km": radius_km,
            "generated_at": generated_at,
            "has_data": False,
            "nearby_waiting_count": 0,
            "top_regions": [],
            "signal": "none",
            "message_hint": build_message_hint_driver(
                has_data=False, signal="none", nearby_waiting_count=0, top_regions=[]
            ),
            "no_guarantee": True,
            "data_quality": "low",
        }

    try:
        center_lat, center_lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return {
            "schema_version": SCHEMA_VERSION,
            "role": "driver",
            "radius_km": radius_km,
            "generated_at": generated_at,
            "has_data": False,
            "nearby_waiting_count": 0,
            "top_regions": [],
            "signal": "none",
            "message_hint": build_message_hint_driver(
                has_data=False, signal="none", nearby_waiting_count=0, top_regions=[]
            ),
            "no_guarantee": True,
            "data_quality": "low",
        }

    tags = fetch_waiting_normal_tags_sync(sb)
    nearby = _tags_nearby_filtered(tags, center_lat, center_lng, radius_km, user)
    region_counts = aggregate_region_counts(nearby)
    top_regions = top_regions_from_counts(region_counts, 3)
    nearby_waiting_count = len(nearby)
    signal = compute_signal_driver(nearby_waiting_count, top_regions)
    has_labels = bool(region_counts)
    data_quality = "medium" if has_labels or nearby_waiting_count > 0 else "low"

    return {
        "schema_version": SCHEMA_VERSION,
        "role": "driver",
        "radius_km": radius_km,
        "generated_at": generated_at,
        "has_data": True,
        "nearby_waiting_count": nearby_waiting_count,
        "top_regions": top_regions,
        "signal": signal,
        "message_hint": build_message_hint_driver(
            has_data=True,
            signal=signal,
            nearby_waiting_count=nearby_waiting_count,
            top_regions=top_regions,
        ),
        "no_guarantee": True,
        "data_quality": data_quality,
    }


def build_passenger_availability_snapshot_sync(
    user_id: str,
    radius_km: float,
    tag_id: Optional[str] = None,
) -> dict:
    sb = get_supabase()
    radius_km = clamp_radius_km(radius_km)
    generated_at = _utc_now_iso()

    center_lat, center_lng, active_tag_id, vehicle_pref, _tag_st = _resolve_passenger_center(
        sb, user_id, tag_id
    )

    if center_lat is None or center_lng is None:
        return {
            "schema_version": SCHEMA_VERSION,
            "role": "passenger",
            "radius_km": radius_km,
            "generated_at": generated_at,
            "has_data": False,
            "nearby_driver_count": 0,
            "active_waiting_passenger_count": 0,
            "dispatch_queue_drivers": None,
            "dispatch_status": None,
            "signal": "none",
            "message_hint": build_message_hint_passenger(
                has_data=False,
                signal="none",
                radius_km=radius_km,
                nearby_driver_count=0,
                active_waiting_passenger_count=0,
                dispatch_status=None,
            ),
            "no_guarantee": True,
            "data_quality": "low",
        }

    tags = fetch_waiting_normal_tags_sync(sb)
    nearby_waiting_tags = _tags_nearby_filtered(
        tags, center_lat, center_lng, radius_km, None, exclude_tag_id=active_tag_id
    )
    active_waiting_passenger_count = len(nearby_waiting_tags)
    nearby_driver_count = count_online_drivers_nearby_sync(
        sb, center_lat, center_lng, radius_km, vehicle_pref
    )

    dispatch_queue_drivers: Optional[int] = None
    dispatch_status: Optional[str] = None
    if active_tag_id:
        dispatch_queue_drivers, dispatch_status = read_dispatch_summary_sync(sb, active_tag_id)

    signal = compute_signal_passenger(
        nearby_driver_count, active_waiting_passenger_count, dispatch_status
    )
    message_hint = build_message_hint_passenger(
        has_data=True,
        signal=signal,
        radius_km=radius_km,
        nearby_driver_count=nearby_driver_count,
        active_waiting_passenger_count=active_waiting_passenger_count,
        dispatch_status=dispatch_status,
    )

    return {
        "schema_version": SCHEMA_VERSION,
        "role": "passenger",
        "radius_km": radius_km,
        "generated_at": generated_at,
        "has_data": True,
        "nearby_driver_count": nearby_driver_count,
        "active_waiting_passenger_count": active_waiting_passenger_count,
        "dispatch_queue_drivers": dispatch_queue_drivers,
        "dispatch_status": dispatch_status,
        "signal": signal,
        "message_hint": message_hint,
        "no_guarantee": True,
        "data_quality": "medium",
    }
