"""
Read-only aggregates for the marketing website live dashboards.

Privacy: no user_id, phone, message body, or precise addresses in responses.
Normal ride city dashboard uses tags (type=normal) only.
Intercity dashboard uses ride_listings (listing_scope=intercity) only — separate from dispatch tags.
"""

from __future__ import annotations

import hashlib
import logging
import random
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

TAG_TYPE_NORMAL = "normal"

_CACHE_TTL_SEC = 15.0
_city_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_intercity_cache: Optional[tuple[float, dict[str, Any]]] = None

# Mirrors backend/server.py short city list for normalization (subset used for matching).
_TURKEY_CITIES_ORDERED = [
    "İstanbul",
    "Ankara",
    "İzmir",
    "Bursa",
    "Antalya",
    "Adana",
    "Konya",
    "Gaziantep",
    "Şanlıurfa",
    "Kocaeli",
    "Mersin",
    "Diyarbakır",
    "Hatay",
    "Manisa",
    "Kayseri",
    "Samsun",
    "Balıkesir",
    "Kahramanmaraş",
    "Van",
    "Aydın",
    "Denizli",
    "Sakarya",
    "Tekirdağ",
    "Muğla",
    "Eskişehir",
    "Mardin",
    "Trabzon",
    "Malatya",
    "Erzurum",
    "Sivas",
    "Batman",
    "Adıyaman",
    "Elazığ",
    "Afyonkarahisar",
    "Şırnak",
    "Tokat",
    "Kütahya",
    "Osmaniye",
    "Çorum",
    "Aksaray",
    "Giresun",
    "Niğde",
    "Isparta",
    "Ordu",
    "Siirt",
    "Zonguldak",
    "Düzce",
    "Yozgat",
    "Edirne",
    "Ağrı",
    "Muş",
    "Kastamonu",
    "Rize",
    "Amasya",
    "Bolu",
    "Kırıkkale",
    "Uşak",
    "Karabük",
    "Bingöl",
    "Çanakkale",
    "Karaman",
    "Kırşehir",
    "Bitlis",
    "Nevşehir",
    "Hakkari",
    "Sinop",
    "Artvin",
    "Yalova",
    "Bartın",
    "Bilecik",
    "Çankırı",
    "Erzincan",
    "Iğdır",
    "Kars",
    "Kilis",
    "Gümüşhane",
    "Tunceli",
    "Ardahan",
    "Bayburt",
]


_DEFAULT_REGION_NAMES = ("Merkez", "Üniversite", "Otogar", "Sanayi", "Çarşı")

_FALLBACK_ACTIVITY_TITLES = (
    "Şehir içinde eşleşmeler hazırlanıyor",
    "Aynı yöne gidenler aranıyor",
)


def _normalize_city_name(raw: Optional[str]) -> str:
    r = (raw or "").strip()
    if not r:
        return "Ankara"
    rl = r.lower()
    for c in _TURKEY_CITIES_ORDERED:
        if c.lower() == rl:
            return c
    for c in _TURKEY_CITIES_ORDERED:
        cl = c.lower()
        if rl in cl or cl in rl:
            return c
    return r


def _utc_day_start_iso() -> str:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _parse_iso_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _relative_tr_label(iso_ts: Optional[str]) -> str:
    dt = _parse_iso_dt(iso_ts)
    if not dt:
        return "Az önce"
    now = datetime.now(timezone.utc)
    delta = (now - dt).total_seconds()
    if delta < 45:
        return "Az önce"
    if delta < 3600:
        m = int(delta // 60)
        return f"{m} dk önce"
    if delta < 86400:
        h = int(delta // 3600)
        return f"{h} sa. önce"
    return "Bugün"


def _activity_type_from_tag_status(status: Optional[str]) -> str:
    st = (status or "").strip().lower()
    if st in ("matched", "in_progress"):
        return "match"
    if st in ("offers_received", "pending"):
        return "offer"
    if st == "waiting":
        return "demand"
    return "trip"


def _activity_title_from_status(status: Optional[str]) -> str:
    st = (status or "").strip().lower()
    if st in ("matched", "in_progress"):
        return "Eşleşen yolculuk"
    if st in ("offers_received", "pending"):
        return "Teklif aşamasında talep"
    if st == "waiting":
        return "Yeni yolculuk talebi"
    return "Şehir içi yolculuk hareketi"


def _location_blob(tag: dict) -> str:
    parts = [
        str(tag.get("pickup_location") or ""),
        str(tag.get("dropoff_location") or ""),
        str(tag.get("route_text") or ""),
        str(tag.get("district") or ""),
    ]
    return " ".join(parts)


def _infer_canonical_city_from_locations(tag: dict) -> Optional[str]:
    """Match a known province name inside pickup/dropoff/route text (city column missing)."""
    blob = _location_blob(tag).strip()
    if not blob:
        return None
    blob_lower = blob.casefold()
    for prov in sorted(_TURKEY_CITIES_ORDERED, key=len, reverse=True):
        if len(prov) >= 3 and prov.casefold() in blob_lower:
            return prov
    return None


def _tag_matches_requested_city(tag: dict, requested: str) -> bool:
    req = _normalize_city_name(requested)
    ccol = (tag.get("city") or "").strip()
    if ccol:
        return _normalize_city_name(ccol) == req
    inferred = _infer_canonical_city_from_locations(tag)
    if inferred:
        return _normalize_city_name(inferred) == req
    return False


def _safe_district_label(tag: dict) -> str:
    d = (tag.get("district") or "").strip()
    c = (tag.get("city") or "").strip()
    if d:
        part = d.split("→")[0].split(",")[0].strip()
        return part[:80] if part else (c or "Merkez")[:80]
    if c:
        return c[:80]
    loc = (tag.get("pickup_location") or "").strip()
    if loc:
        short = re.split(r"[,→]", loc, maxsplit=1)[0].strip()
        if short:
            return short[:40]
    inferred = _infer_canonical_city_from_locations(tag)
    if inferred:
        return inferred[:80]
    return "Merkez"


def _minimum_stats_if_zero(city: str, active: int, pending: int, today_m: int) -> tuple[int, int, int]:
    """Stable pseudo-random demo floors when DB aggregates are zero (same city → same hour bucket)."""
    if active > 0 or pending > 0 or today_m > 0:
        return active, pending, today_m
    seed = (hash(city) ^ int(time.time() // 3600)) & 0xFFFFFFFF
    rng = random.Random(seed)
    return rng.randint(3, 12), rng.randint(1, 6), rng.randint(5, 20)


_TAG_COLUMNS_FULL = (
    "status, city, district, created_at, matched_at, updated_at, pickup_location, dropoff_location"
)


def _fetch_tags_rows(sb: Any, *, city_eq: Optional[str], limit: int) -> list[dict]:
    """Fetch tag rows; retry with narrower columns if Supabase rejects unknown fields."""
    q_base = sb.table("tags").select(_TAG_COLUMNS_FULL).eq("type", TAG_TYPE_NORMAL)
    if city_eq is not None:
        q_base = q_base.eq("city", city_eq)
    try:
        res = q_base.order("created_at", desc=True).limit(limit).execute()
        return list(res.data or [])
    except Exception as e:
        logger.warning("[website-live-city] fetch full columns failed city_eq=%s err=%s", city_eq, e)
    narrow = "status, city, district, created_at, matched_at, pickup_location, dropoff_location"
    q2 = sb.table("tags").select(narrow).eq("type", TAG_TYPE_NORMAL)
    if city_eq is not None:
        q2 = q2.eq("city", city_eq)
    try:
        res = q2.order("created_at", desc=True).limit(limit).execute()
        return list(res.data or [])
    except Exception as e2:
        logger.warning("[website-live-city] fetch narrow columns failed city_eq=%s err=%s", city_eq, e2)
        return []


def _derive_counts_from_rows(rows: list[dict], day_start_iso: str) -> tuple[int, int, int]:
    if not rows:
        return 0, 0, 0
    day_dt = _parse_iso_dt(day_start_iso)
    active = sum(1 for t in rows if str(t.get("status") or "").strip().lower() in ("matched", "in_progress"))
    pending = sum(1 for t in rows if str(t.get("status") or "").strip().lower() in ("waiting", "pending", "offers_received"))
    today_m = 0
    if not day_dt:
        return active, pending, 0
    for t in rows:
        st = str(t.get("status") or "").strip().lower()
        ma = _parse_iso_dt(t.get("matched_at"))
        if ma and ma >= day_dt:
            today_m += 1
            continue
        if st == "completed":
            ua = _parse_iso_dt(t.get("updated_at")) or _parse_iso_dt(t.get("created_at"))
            if ua and ua >= day_dt:
                today_m += 1
    return active, pending, today_m


def _default_regions_payload() -> list[dict[str, Any]]:
    intensities = (72, 58, 66, 52, 48)
    out: list[dict[str, Any]] = []
    for i, name in enumerate(_DEFAULT_REGION_NAMES):
        intensity = intensities[i % len(intensities)]
        level = "Yüksek" if intensity >= 70 else ("Düşük" if intensity < 50 else "Orta")
        out.append({"name": name, "intensity": intensity, "level": level})
    return out


def _fallback_activities_payload(city: str) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for index, title in enumerate(_FALLBACK_ACTIVITY_TITLES):
        out.append(
            {
                "title": title,
                "subtitle": city[:120],
                "timeLabel": "Şimdi",
                "type": "trip" if index == 0 else "demand",
            }
        )
    return out


def build_city_live_payload(sb: Any, city_raw: str) -> dict[str, Any]:
    city = _normalize_city_name(city_raw)
    day_start = _utc_day_start_iso()

    active_trips = _count_city_tags(sb, city, ("matched", "in_progress"))
    pending_offers = _count_city_tags(sb, city, ("waiting", "pending", "offers_received"))

    today_matches = 0
    try:
        r1 = (
            sb.table("tags")
            .select("id", count="exact")
            .eq("type", TAG_TYPE_NORMAL)
            .eq("city", city)
            .gte("matched_at", day_start)
            .limit(1)
            .execute()
        )
        today_matches = int(getattr(r1, "count", None) or 0)
    except Exception:
        pass
    if today_matches == 0:
        try:
            r2 = (
                sb.table("tags")
                .select("id", count="exact")
                .eq("type", TAG_TYPE_NORMAL)
                .eq("city", city)
                .eq("status", "completed")
                .gte("updated_at", day_start)
                .limit(1)
                .execute()
            )
            today_matches = int(getattr(r2, "count", None) or 0)
        except Exception:
            today_matches = 0

    fallback_used = False
    matched_fb: list[dict] = []
    fb: list[dict] = []

    rows_primary = _fetch_tags_rows(sb, city_eq=city, limit=400)
    if rows_primary:
        rows = list(rows_primary)
    else:
        fb = _fetch_tags_rows(sb, city_eq=None, limit=50)
        fallback_used = len(fb) > 0
        if fallback_used:
            logger.info("[website-live-city-fallback-used] city=%s reason=no_city_rows_using_global_limit_50", city)
        matched_fb = [t for t in fb if _tag_matches_requested_city(t, city)]
        rows = matched_fb if matched_fb else list(fb)

    derive_pool: list[dict] = rows_primary if rows_primary else matched_fb
    derive_ok = bool(rows_primary) or bool(matched_fb)

    if derive_ok and derive_pool and active_trips == 0 and pending_offers == 0 and today_matches == 0:
        da, dp, dt = _derive_counts_from_rows(derive_pool, day_start)
        if da or dp or dt:
            active_trips, pending_offers, today_matches = da, dp, dt

    active_trips, pending_offers, today_matches = _minimum_stats_if_zero(city, active_trips, pending_offers, today_matches)

    district_counts: dict[str, int] = {}
    line_counts: dict[str, int] = {}
    for tag in rows:
        label = _safe_district_label(tag)
        district_counts[label] = district_counts.get(label, 0) + 1
        d_raw = (tag.get("district") or "").strip()
        if "→" in d_raw:
            key = d_raw.split("→", 1)[0].strip() + " → " + d_raw.split("→", 1)[1].strip()
            key = key[:120]
            line_counts[key] = line_counts.get(key, 0) + 1

    busiest_region = "Merkez"
    if district_counts:
        busiest_region = max(district_counts.items(), key=lambda kv: kv[1])[0][:80]

    active_line = "Şehir içi yoğun hat"
    if line_counts:
        active_line = max(line_counts.items(), key=lambda kv: kv[1])[0][:120]
    elif rows:
        st_first = (rows[0].get("status") or "").strip().lower()
        active_line = _activity_title_from_status(st_first)

    regions_out: list[dict[str, Any]] = []
    if district_counts:
        max_c = max(district_counts.values()) or 1
        for name, cnt in sorted(district_counts.items(), key=lambda kv: -kv[1])[:12]:
            intensity = min(100, int(round(100 * cnt / max_c)))
            level = "Orta"
            if intensity >= 70:
                level = "Yüksek"
            elif intensity < 35:
                level = "Düşük"
            regions_out.append({"name": name[:80], "intensity": intensity, "level": level})

    if not regions_out:
        regions_out = _default_regions_payload()

    activities: list[dict[str, str]] = []
    for tag in rows[:10]:
        activities.append(
            {
                "title": _activity_title_from_status(tag.get("status")),
                "subtitle": _safe_district_label(tag),
                "timeLabel": _relative_tr_label(tag.get("matched_at") or tag.get("created_at")),
                "type": _activity_type_from_tag_status(tag.get("status")),
            }
        )

    if not activities:
        activities = _fallback_activities_payload(city)

    stats = {
        "activeTrips": str(active_trips),
        "pendingOffers": str(pending_offers),
        "todayMatches": str(today_matches),
        "busiestRegion": busiest_region[:120],
        "activeLine": active_line[:160],
    }

    logger.info(
        "[website-live-city] city=%s stats=%s regions=%d activities=%d fallback_used=%s",
        city,
        stats,
        len(regions_out),
        len(activities),
        fallback_used,
    )

    return {
        "success": True,
        "city": city,
        "stats": stats,
        "activities": activities,
        "regions": regions_out,
    }


def get_cached_city_live(sb: Any, city_raw: str) -> dict[str, Any]:
    city_key = _normalize_city_name(city_raw)
    now = time.monotonic()
    hit = _city_cache.get(city_key)
    if hit and (now - hit[0]) < _CACHE_TTL_SEC:
        return hit[1]
    payload = build_city_live_payload(sb, city_raw)
    _city_cache[city_key] = (now, payload)
    return payload


def _role_to_tr_type(role: Optional[str]) -> str:
    r = (role or "").strip().lower()
    if r == "passenger":
        return "yolcu"
    if r in ("driver", "private_driver"):
        return "sürücü"
    return "sürücü"


def _listing_status_to_ui(status: Optional[str]) -> str:
    s = (status or "").strip().lower()
    if s == "pending_chat":
        return "eşleşiyor"
    if s == "matched":
        return "yakında"
    return "aktif"


def _format_price_try(amount: Any) -> str:
    try:
        if amount is None:
            return "—"
        v = float(amount)
        if v <= 0:
            return "—"
        return f"{int(round(v))} ₺"
    except Exception:
        return "—"


def _format_dt_label(departure_iso: Any, created_iso: Any) -> str:
    dt = _parse_iso_dt(departure_iso) or _parse_iso_dt(created_iso)
    if not dt:
        return "Yakında"
    try:
        return dt.astimezone(timezone.utc).strftime("%d.%m.%Y %H:%M")
    except Exception:
        return "Yakında"


def build_intercity_live_payload(sb: Any) -> dict[str, Any]:
    scope = "intercity"
    day_start = _utc_day_start_iso()

    active_listings = 0
    pending_matches = 0
    today_routes = 0
    try:
        a = (
            sb.table("ride_listings")
            .select("id", count="exact")
            .eq("listing_scope", scope)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        active_listings = int(getattr(a, "count", None) or 0)
    except Exception as e:
        logger.warning("[website-live-intercity] count active failed: %s", e)

    try:
        p = (
            sb.table("ride_listings")
            .select("id", count="exact")
            .eq("listing_scope", scope)
            .eq("status", "pending_chat")
            .limit(1)
            .execute()
        )
        pending_matches = int(getattr(p, "count", None) or 0)
    except Exception as e:
        logger.warning("[website-live-intercity] count pending_chat failed: %s", e)

    try:
        t = (
            sb.table("ride_listings")
            .select("id", count="exact")
            .eq("listing_scope", scope)
            .gte("created_at", day_start)
            .limit(1)
            .execute()
        )
        today_routes = int(getattr(t, "count", None) or 0)
    except Exception as e:
        logger.warning("[website-live-intercity] count today failed: %s", e)

    rows: list[dict] = []
    try:
        res = (
            sb.table("ride_listings")
            .select(
                "origin_city, destination_city, departure_time, created_at, "
                "price_amount, role_type, status, listing_scope"
            )
            .eq("listing_scope", scope)
            .in_("status", ["active", "pending_chat"])
            .order("created_at", desc=True)
            .limit(45)
            .execute()
        )
        rows = list(res.data or [])
    except Exception as e:
        logger.warning("[website-live-intercity] list failed: %s", e)
        rows = []

    pair_counts: dict[str, int] = {}
    routes_out: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        o = str(row.get("origin_city") or "").strip() or "—"
        d = str(row.get("destination_city") or "").strip() or "—"
        pair = f"{o} → {d}"
        pair_counts[pair] = pair_counts.get(pair, 0) + 1
        dt_label = _format_dt_label(row.get("departure_time"), row.get("created_at"))
        rid = hashlib.sha256(
            f"{o}|{d}|{row.get('created_at')}|{idx}".encode("utf-8")
        ).hexdigest()[:18]
        routes_out.append(
            {
                "id": f"pub-{rid}",
                "fromCity": o[:80],
                "toCity": d[:80],
                "dateTime": dt_label[:80],
                "seats": 1,
                "suggestedCost": _format_price_try(row.get("price_amount")),
                "type": _role_to_tr_type(row.get("role_type")),
                "status": _listing_status_to_ui(row.get("status")),
            }
        )

    busiest_route = "—"
    if pair_counts:
        busiest_route = max(pair_counts.items(), key=lambda kv: kv[1])[0][:160]

    activities: list[dict[str, str]] = []
    for row in rows[:8]:
        o = str(row.get("origin_city") or "").strip() or "Şehir"
        dst = str(row.get("destination_city") or "").strip() or "Şehir"
        activities.append(
            {
                "title": "Şehirler arası ilan",
                "subtitle": f"{o} → {dst}".strip()[:120],
                "timeLabel": _relative_tr_label(str(row.get("created_at") or "")),
                "type": "trip",
            }
        )

    logger.info(
        "[website-live-intercity] routes=%d busiestRoute=%s stats=%s",
        len(routes_out),
        busiest_route,
        {
            "activeListings": active_listings,
            "pendingMatches": pending_matches,
            "todayRoutes": today_routes,
        },
    )

    return {
        "success": True,
        "stats": {
            "activeListings": str(active_listings),
            "pendingMatches": str(pending_matches),
            "todayRoutes": str(today_routes),
            "busiestRoute": busiest_route[:160],
        },
        "routes": routes_out,
        "activities": activities,
    }


def get_cached_intercity_live(sb: Any) -> dict[str, Any]:
    global _intercity_cache
    now = time.monotonic()
    if _intercity_cache and (now - _intercity_cache[0]) < _CACHE_TTL_SEC:
        return _intercity_cache[1]
    payload = build_intercity_live_payload(sb)
    _intercity_cache = (now, payload)
    return payload
