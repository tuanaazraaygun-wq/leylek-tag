"""
Operasyon metrikleri — yalnızca agregasyon; kişisel veri prompta ham dökülmez.
Supabase service role ile okuma; tablo/kolon yoksa güvenli boş dönüş.
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from supabase_client import get_supabase

logger = logging.getLogger("server")

# Büyük sorgu sınırı (performans)
DEFAULT_TAG_LIMIT = 400
DEFAULT_DISPATCH_LIMIT = 800
DEFAULT_SINCE_DAYS = 7


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(s: Any) -> datetime | None:
    if not s or not isinstance(s, str):
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _region_key(lat: Any, lng: Any, city: Any) -> str:
    """Gizlilik: ham koordinat yerine kaba grid + şehir."""
    c = (str(city).strip() if city else "") or "bilinmeyen_sehir"
    try:
        la = float(lat)
        lo = float(lng)
        return f"{c}|{round(la, 2)},{round(lo, 2)}"
    except (TypeError, ValueError):
        return c


def fetch_ops_snapshot(
    *,
    since_days: int = DEFAULT_SINCE_DAYS,
    tag_limit: int = DEFAULT_TAG_LIMIT,
    dispatch_limit: int = DEFAULT_DISPATCH_LIMIT,
) -> dict[str, Any]:
    """
    Mevcut tablolardan mümkün metrikler.
    Eksik şema durumunda `errors` ve boş sayaçlar döner.
    """
    sb = get_supabase()
    out: dict[str, Any] = {
        "generated_at": _utc_now().isoformat(),
        "window_days": since_days,
        "tags": {},
        "dispatch_queue": {},
        "drivers_online_by_city": {},
        "notes": [],
        "errors": [],
    }
    if not sb:
        out["errors"].append("supabase_client_not_ready")
        return out

    since = (_utc_now() - timedelta(days=since_days)).isoformat()

    tags_rows: list[dict[str, Any]] = []
    try:
        res = (
            sb.table("tags")
            .select(
                "id,status,city,pickup_lat,pickup_lng,pickup_location,"
                "passenger_preferred_vehicle,created_at,matched_at,cancelled_at,driver_id,passenger_id"
            )
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(tag_limit)
            .execute()
        )
        tags_rows = list(res.data or [])
    except Exception as e:
        logger.warning("ai_ops_service: tags select failed: %s", e)
        out["errors"].append(f"tags:{e!s}")

    status_ct: Counter[str] = Counter()
    city_demand: Counter[str] = Counter()
    hour_ct: Counter[int] = Counter()
    vehicle_ct: Counter[str] = Counter()
    region_waiting: Counter[str] = Counter()
    region_cancelled: Counter[str] = Counter()
    region_matched: Counter[str] = Counter()
    waiting_durations_min: list[float] = []

    for row in tags_rows:
        st = str(row.get("status") or "unknown")
        status_ct[st] += 1
        city = (row.get("city") or "bilinmeyen") or "bilinmeyen"
        city_demand[city] += 1
        pref = row.get("passenger_preferred_vehicle")
        if pref:
            vehicle_ct[str(pref)] += 1
        created = _parse_ts(row.get("created_at"))
        if created:
            hour_ct[created.astimezone(timezone.utc).hour] += 1
        rk = _region_key(row.get("pickup_lat"), row.get("pickup_lng"), row.get("city"))
        if st in ("waiting", "pending", "offers_received"):
            region_waiting[rk] += 1
            if created:
                waiting_durations_min.append((_utc_now() - created.astimezone(timezone.utc)).total_seconds() / 60.0)
        if st == "cancelled":
            region_cancelled[rk] += 1
        if st in ("matched", "in_progress", "completed"):
            region_matched[rk] += 1

    total_tags = sum(status_ct.values()) or 1
    cancel_rate = (status_ct.get("cancelled", 0) / total_tags) if total_tags else 0.0

    out["tags"] = {
        "total_in_window": len(tags_rows),
        "by_status": dict(status_ct),
        "by_city_demand": dict(city_demand),
        "by_hour_utc": {str(k): v for k, v in sorted(hour_ct.items())},
        "by_vehicle_preference": dict(vehicle_ct),
        "cancel_rate": round(cancel_rate, 4),
        "waiting_now_by_region_top": region_waiting.most_common(12),
        "cancelled_by_region_top": region_cancelled.most_common(8),
        "matched_by_region_top": region_matched.most_common(8),
        "waiting_age_minutes_p50": _percentile(waiting_durations_min, 0.5),
        "waiting_age_minutes_p90": _percentile(waiting_durations_min, 0.9),
    }

    dq_rows: list[dict[str, Any]] = []
    try:
        dq = (
            sb.table("dispatch_queue")
            .select("id,tag_id,driver_id,status,created_at,sent_at,responded_at")
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(dispatch_limit)
            .execute()
        )
        dq_rows = list(dq.data or [])
    except Exception as e:
        logger.warning("ai_ops_service: dispatch_queue select failed: %s", e)
        out["errors"].append(f"dispatch_queue:{e!s}")

    dq_status = Counter(str(r.get("status") or "?") for r in dq_rows)
    sent = dq_status.get("sent", 0) + dq_status.get("waiting", 0)
    accepted = dq_status.get("accepted", 0)
    expired = dq_status.get("expired", 0)
    offer_conversion = (accepted / (accepted + expired)) if (accepted + expired) else None

    out["dispatch_queue"] = {
        "rows_in_window": len(dq_rows),
        "by_status": dict(dq_status),
        "offer_accept_vs_expired_ratio": round(offer_conversion, 4) if offer_conversion is not None else None,
    }

    try:
        ures = (
            sb.table("users")
            .select("city,driver_online")
            .eq("driver_online", True)
            .limit(500)
            .execute()
        )
        online_by_city: Counter[str] = Counter()
        for u in ures.data or []:
            ct = (u.get("city") or "bilinmeyen") or "bilinmeyen"
            online_by_city[ct] += 1
        out["drivers_online_by_city"] = dict(online_by_city)
    except Exception as e:
        logger.warning("ai_ops_service: users online select failed: %s", e)
        out["errors"].append(f"users_online:{e!s}")

    # Çıkarım etiketleri (uydurma değil — oranlara dayalı)
    inferences: list[str] = []
    if cancel_rate > 0.35:
        inferences.append("high_cancellation_rate_in_window")
    if out["tags"].get("waiting_age_minutes_p90") and out["tags"]["waiting_age_minutes_p90"] > 25:
        inferences.append("long_tail_waiting_times_observed")
    if offer_conversion is not None and offer_conversion < 0.15 and (accepted + expired) > 10:
        inferences.append("low_offer_acceptance_relative_to_expired")

    out["inferences"] = inferences
    out["notes"].append(
        "Metrikler son penceredeki agregasyonlardır; dış hava/etkinlik gibi nedenler modele verilmez."
    )
    return out


def _percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    idx = min(len(s) - 1, max(0, int(q * (len(s) - 1))))
    return round(s[idx], 1)


def filter_snapshot_for_region(
    snapshot: dict[str, Any],
    *,
    city: str | None = None,
    region_hint: str | None = None,
) -> dict[str, Any]:
    """Bölge içgörüsü için metrik alt kümesi (metin eşleşmesi)."""
    snap = dict(snapshot)
    c = (city or "").strip().lower()
    rh = (region_hint or "").strip().lower()
    tags = snap.get("tags") or {}
    wtop = tags.get("waiting_now_by_region_top") or []
    filtered = [
        x
        for x in wtop
        if isinstance(x, (list, tuple))
        and len(x) == 2
        and (not c or c in str(x[0]).lower())
        and (not rh or rh in str(x[0]).lower())
    ]
    tags = dict(tags)
    tags["waiting_now_by_region_top"] = filtered[:20] or tags.get("waiting_now_by_region_top") or []
    tags["waiting_filtered_note"] = "Filtre: city/region_hint ile kısıtlandı."
    snap["tags"] = tags
    snap["filter"] = {"city": city, "region_hint": region_hint}
    return snap


def help_topic_proxy_from_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """
    Gerçek destek ticket tablosu yoksa talep akışından vekil özet.
    """
    tags = snapshot.get("tags") or {}
    st = tags.get("by_status") or {}
    return {
        "proxy_passenger_stuck_matching": int(st.get("waiting", 0) + st.get("offers_received", 0)),
        "proxy_active_negotiation": int(st.get("offers_received", 0)),
        "proxy_cancelled": int(st.get("cancelled", 0)),
        "disclaimer": "Gerçek 'yardım konusu' log tablosu yok; tag durumlarından vekil sayaç.",
    }
