"""
Anonim öğrenilmiş adres kaydı — POST /api/places/learn upsert.
Kişisel veri (user_id, phone, tag_id, route pair) saklanmaz.
"""
from __future__ import annotations

import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional

TABLE_LEARNED_ADDRESSES = "learned_addresses"

_MIN_DISPLAY_NAME_LEN = 5
_MIN_NORMALIZED_QUERY_LEN = 2
_MAX_DISPLAY_NAME_LEN = 512
_MAX_QUERY_LEN = 128
_MAX_CITY_LEN = 128
_MAX_DISTRICT_LEN = 128
_MAX_PROVIDER_LEN = 32

# FE route picker ile uyumlu Türkiye bbox
_TR_LAT_MIN = 35.0
_TR_LAT_MAX = 43.0
_TR_LNG_MIN = 25.0
_TR_LNG_MAX = 46.0

_ALLOWED_PROVIDERS: frozenset[str] = frozenset(
    {
        "learned",
        "map_confirm",
        "search_confirm",
        "google",
        "nominatim",
        "local_seed",
    }
)


def _norm_key(s: str) -> str:
    t = (s or "").strip().lower().replace(",", " ").replace("|", "")
    try:
        t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode("ascii")
    except Exception:
        pass
    return " ".join(t.split())


def _is_in_turkey_bbox(latitude: float, longitude: float) -> bool:
    if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
        return False
    if abs(latitude) < 1e-6 and abs(longitude) < 1e-6:
        return False
    return (
        _TR_LAT_MIN <= latitude <= _TR_LAT_MAX
        and _TR_LNG_MIN <= longitude <= _TR_LNG_MAX
    )


def build_learned_dedupe_key(
    city: str,
    district: str,
    latitude: float,
    longitude: float,
) -> str:
    """norm(city)|norm(district)|round(lat,4)|round(lng,4)"""
    c = _norm_key(city)
    d = _norm_key(district)
    return f"{c}|{d}|{round(float(latitude), 4)}|{round(float(longitude), 4)}"


def _sanitize_provider(raw: str) -> str:
    p = _norm_key(raw).replace(" ", "_")
    if p in _ALLOWED_PROVIDERS:
        return p
    return "learned"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LearnedAddressValidationError(ValueError):
    """Geçersiz learn payload — HTTP 400."""


def upsert_learned_address(supabase: Any, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Anonim adres upsert. conflict → usage_count +1, last_used_at = now().
    supabase: Supabase client (service role).
    """
    if supabase is None:
        raise RuntimeError("Supabase client unavailable")

    display_name = str(payload.get("display_name") or "").strip()
    normalized_query = str(payload.get("normalized_query") or "").strip()
    city = str(payload.get("city") or "").strip()
    district = str(payload.get("district") or "").strip()
    provider_raw = str(payload.get("provider") or "learned").strip()

    if len(display_name) < _MIN_DISPLAY_NAME_LEN:
        raise LearnedAddressValidationError(
            f"display_name en az {_MIN_DISPLAY_NAME_LEN} karakter olmalı"
        )
    if len(display_name) > _MAX_DISPLAY_NAME_LEN:
        display_name = display_name[:_MAX_DISPLAY_NAME_LEN]

    nq = _norm_key(normalized_query)
    if len(nq) < _MIN_NORMALIZED_QUERY_LEN:
        raise LearnedAddressValidationError(
            f"normalized_query en az {_MIN_NORMALIZED_QUERY_LEN} karakter olmalı"
        )
    if len(nq) > _MAX_QUERY_LEN:
        nq = nq[:_MAX_QUERY_LEN]

    try:
        latitude = float(payload.get("latitude"))
        longitude = float(payload.get("longitude"))
    except (TypeError, ValueError) as exc:
        raise LearnedAddressValidationError("latitude ve longitude sayısal olmalı") from exc

    if not _is_in_turkey_bbox(latitude, longitude):
        raise LearnedAddressValidationError("Koordinat Türkiye sınırları dışında")

    city = city[:_MAX_CITY_LEN]
    district = district[:_MAX_DISTRICT_LEN]
    provider = _sanitize_provider(provider_raw)[:_MAX_PROVIDER_LEN]

    dedupe_key = build_learned_dedupe_key(city, district, latitude, longitude)
    now_iso = _utc_now_iso()

    existing = (
        supabase.table(TABLE_LEARNED_ADDRESSES)
        .select("id, usage_count")
        .eq("dedupe_key", dedupe_key)
        .limit(1)
        .execute()
    )
    rows = existing.data if isinstance(existing.data, list) else []

    if rows:
        row_id = rows[0].get("id")
        prev_count = int(rows[0].get("usage_count") or 0)
        update_body = {
            "usage_count": max(1, prev_count) + 1,
            "last_used_at": now_iso,
            "display_name": display_name,
            "normalized_query": nq,
            "city": city,
            "district": district,
            "latitude": latitude,
            "longitude": longitude,
            "provider": provider,
        }
        supabase.table(TABLE_LEARNED_ADDRESSES).update(update_body).eq("id", row_id).execute()
        return {"success": True, "dedupe_key": dedupe_key, "usage_count": update_body["usage_count"]}

    insert_body = {
        "dedupe_key": dedupe_key,
        "normalized_query": nq,
        "display_name": display_name,
        "city": city,
        "district": district,
        "latitude": latitude,
        "longitude": longitude,
        "provider": provider,
        "usage_count": 1,
        "last_used_at": now_iso,
        "created_at": now_iso,
    }
    supabase.table(TABLE_LEARNED_ADDRESSES).insert(insert_body).execute()
    return {"success": True, "dedupe_key": dedupe_key, "usage_count": 1}
