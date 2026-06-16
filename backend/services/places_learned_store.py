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


def _learned_query_matches(q_norm: str, stored_nq: str) -> bool:
    """Prefix eşleşme — seed ile aynı konservatif kurallar; contains yok."""
    if len(q_norm) < 2 or len(stored_nq) < 2:
        return False
    if q_norm == stored_nq:
        return True
    if len(q_norm) >= 3 and stored_nq.startswith(q_norm):
        return True
    if len(stored_nq) >= 3 and q_norm.startswith(stored_nq):
        return True
    return False


def _learned_city_context_match(
    row_city: str,
    row_district: str,
    *,
    city: str = "",
    district: str = "",
    city_raw: str = "",
) -> bool:
    """Yakın şehir/ilçe kapsamı — boş scope'ta filtre yok."""
    scope: set[str] = set()
    for label in (city, district, city_raw):
        nk = _norm_key(label)
        if nk:
            scope.add(nk)
    if not scope:
        return True
    row_labels = {_norm_key(row_city), _norm_key(row_district)}
    row_labels.discard("")
    if not row_labels:
        return False
    return bool(scope & row_labels)


def _learned_row_to_result(row: dict[str, Any]) -> Optional[dict[str, Any]]:
    display_name = str(row.get("display_name") or "").strip()
    if len(display_name) < _MIN_DISPLAY_NAME_LEN:
        return None
    if int(row.get("usage_count") or 0) < 1:
        return None
    stored_nq = str(row.get("normalized_query") or "").strip()
    if len(_norm_key(stored_nq)) < _MIN_NORMALIZED_QUERY_LEN:
        return None
    try:
        latitude = float(row.get("latitude"))
        longitude = float(row.get("longitude"))
    except (TypeError, ValueError):
        return None
    if not _is_in_turkey_bbox(latitude, longitude):
        return None

    parts = [p.strip() for p in display_name.split(",") if p.strip()]
    title = parts[0] if parts else display_name[:120]
    subtitle = ", ".join(parts[1:3]) if len(parts) > 1 else ""
    dedupe_key = str(row.get("dedupe_key") or row.get("id") or "").strip()
    place_id = f"learned:{dedupe_key}" if dedupe_key else "learned:unknown"

    return {
        "place_id": place_id,
        "google_place_id": None,
        "title": title[:120],
        "subtitle": subtitle[:160],
        "display_name": display_name[:300],
        "lat": str(round(latitude, 7)),
        "lng": str(round(longitude, 7)),
        "provider": "learned",
        "_usage_count": int(row.get("usage_count") or 1),
        "_last_used_at": str(row.get("last_used_at") or ""),
        "_normalized_query": stored_nq,
    }


def _learned_sort_key(item: dict[str, Any]) -> tuple[int, str]:
    return (-int(item.get("_usage_count", 1)), str(item.get("_last_used_at", "")))


def lookup_learned_addresses(
    supabase: Any,
    query: str,
    *,
    city: str = "",
    district: str = "",
    city_raw: str = "",
    max_results: int = 5,
) -> list[dict[str, Any]]:
    """
    Öğrenilmiş anonim adres araması — normalized_query + şehir/ilçe kapsamı.
    usage_count DESC, last_used_at DESC; en fazla max_results satır.
    """
    if supabase is None:
        return []

    q_norm = _norm_key(query)
    if len(q_norm) < 2:
        return []

    max_results = max(1, min(int(max_results or 5), 5))
    matched: dict[str, dict[str, Any]] = {}

    def _ingest_rows(rows: Any) -> None:
        if not isinstance(rows, list):
            return
        for row in rows:
            if not isinstance(row, dict):
                continue
            stored_nq = _norm_key(str(row.get("normalized_query") or ""))
            if not _learned_query_matches(q_norm, stored_nq):
                continue
            if not _learned_city_context_match(
                str(row.get("city") or ""),
                str(row.get("district") or ""),
                city=city,
                district=district,
                city_raw=city_raw,
            ):
                continue
            result = _learned_row_to_result(row)
            if not result:
                continue
            dedupe_key = str(row.get("dedupe_key") or row.get("id") or result.get("place_id"))
            if dedupe_key in matched:
                continue
            matched[dedupe_key] = result

    def _fetch_exact() -> None:
        try:
            res = (
                supabase.table(TABLE_LEARNED_ADDRESSES)
                .select("*")
                .eq("normalized_query", q_norm)
                .order("usage_count", desc=True)
                .order("last_used_at", desc=True)
                .limit(20)
                .execute()
            )
            _ingest_rows(res.data)
        except Exception:
            pass

    def _fetch_prefix() -> None:
        if len(q_norm) < 3:
            return
        try:
            res = (
                supabase.table(TABLE_LEARNED_ADDRESSES)
                .select("*")
                .like("normalized_query", f"{q_norm}%")
                .order("usage_count", desc=True)
                .order("last_used_at", desc=True)
                .limit(20)
                .execute()
            )
            _ingest_rows(res.data)
        except Exception:
            pass

    def _fetch_city_scoped_usage() -> None:
        """Reverse-prefix: kullanıcı sorgusu stored query ile başlıyorsa."""
        if len(q_norm) < 3:
            return
        scope_labels: list[str] = []
        for label in (city, district, city_raw):
            t = (label or "").strip()
            if t and t not in scope_labels:
                scope_labels.append(t)
        try:
            if scope_labels:
                seen_ids: set[str] = set()
                for label in scope_labels[:3]:
                    res = (
                        supabase.table(TABLE_LEARNED_ADDRESSES)
                        .select("*")
                        .eq("city", label)
                        .order("usage_count", desc=True)
                        .order("last_used_at", desc=True)
                        .limit(25)
                        .execute()
                    )
                    rows = res.data if isinstance(res.data, list) else []
                    for row in rows:
                        rid = str(row.get("id") or row.get("dedupe_key") or "")
                        if rid and rid in seen_ids:
                            continue
                        if rid:
                            seen_ids.add(rid)
                        _ingest_rows([row])
                    res_d = (
                        supabase.table(TABLE_LEARNED_ADDRESSES)
                        .select("*")
                        .eq("district", label)
                        .order("usage_count", desc=True)
                        .order("last_used_at", desc=True)
                        .limit(25)
                        .execute()
                    )
                    rows_d = res_d.data if isinstance(res_d.data, list) else []
                    for row in rows_d:
                        rid = str(row.get("id") or row.get("dedupe_key") or "")
                        if rid and rid in seen_ids:
                            continue
                        if rid:
                            seen_ids.add(rid)
                        _ingest_rows([row])
            else:
                res = (
                    supabase.table(TABLE_LEARNED_ADDRESSES)
                    .select("*")
                    .order("usage_count", desc=True)
                    .order("last_used_at", desc=True)
                    .limit(40)
                    .execute()
                )
                _ingest_rows(res.data)
        except Exception:
            pass

    _fetch_exact()
    if len(matched) < max_results:
        _fetch_prefix()
    if len(matched) < max_results:
        _fetch_city_scoped_usage()

    if not matched:
        return []

    ranked = sorted(matched.values(), key=_learned_sort_key)
    out: list[dict[str, Any]] = []
    for item in ranked[:max_results]:
        clean = dict(item)
        clean.pop("_usage_count", None)
        clean.pop("_last_used_at", None)
        clean.pop("_normalized_query", None)
        out.append(clean)
    return out


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
