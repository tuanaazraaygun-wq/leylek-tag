"""
Anonim öğrenilmiş adres kaydı — POST /api/places/learn upsert.
Kişisel veri (user_id, phone, tag_id, route pair) saklanmaz.
"""
from __future__ import annotations

import math
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

# P1-A: düşük skorlu learned satırları döndürme — provider fallback açık kalsın
_MIN_LEARNED_SCORE = 32.0
_LEARNED_FETCH_LIMIT = 35

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


def _learned_text_match_tier(q_norm: str, stored_nq: str) -> int:
    """3=exact, 2=prefix, 1=reverse-prefix, 0=miss."""
    if not _learned_query_matches(q_norm, stored_nq):
        return 0
    if q_norm == stored_nq:
        return 3
    if len(q_norm) >= 3 and stored_nq.startswith(q_norm):
        return 2
    if len(stored_nq) >= 3 and q_norm.startswith(stored_nq):
        return 1
    return 0


def _learned_scope_norms(
    *,
    city: str = "",
    district: str = "",
    city_raw: str = "",
) -> tuple[set[str], set[str]]:
    scope: set[str] = set()
    for label in (city, district, city_raw):
        nk = _norm_key(label)
        if nk:
            scope.add(nk)
    dist = _norm_key(district)
    district_scope = {dist} if dist else set()
    return scope, district_scope


def _learned_city_district_score(
    row_city: str,
    row_district: str,
    *,
    city: str = "",
    district: str = "",
    city_raw: str = "",
) -> tuple[float, float]:
    scope, district_scope = _learned_scope_norms(
        city=city, district=district, city_raw=city_raw
    )
    rc = _norm_key(row_city)
    rd = _norm_key(row_district)

    if not scope:
        city_score = 0.5
        district_score = 0.5 if rd else 0.0
        return city_score, district_score

    city_score = 1.0 if rc in scope or rd in scope else 0.0
    district_score = 1.0 if rd and rd in district_scope else 0.0
    if district_score == 0.0 and rd and rd in scope:
        district_score = 0.75
    return city_score, district_score


def _learned_usage_score(usage_count: int) -> float:
    return math.log1p(max(0, int(usage_count))) * 2.5


def _learned_recency_score(last_used_at: str) -> float:
    raw = (last_used_at or "").strip()
    if not raw:
        return 0.0
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age_days = max(
            0.0,
            (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()
            / 86400.0,
        )
        return 10.0 * (0.5 ** (age_days / 30.0))
    except (TypeError, ValueError, OverflowError):
        return 0.0


def _compute_learned_score(
    q_norm: str,
    row: dict[str, Any],
    *,
    city: str = "",
    district: str = "",
    city_raw: str = "",
) -> float:
    stored_nq = _norm_key(str(row.get("normalized_query") or ""))
    tier = _learned_text_match_tier(q_norm, stored_nq)
    if tier == 0:
        return -1.0

    text_points = {3: 100.0, 2: 72.0, 1: 42.0}[tier]
    city_s, dist_s = _learned_city_district_score(
        str(row.get("city") or ""),
        str(row.get("district") or ""),
        city=city,
        district=district,
        city_raw=city_raw,
    )
    scope, _ = _learned_scope_norms(city=city, district=district, city_raw=city_raw)
    if scope and city_s <= 0.0:
        text_points *= 0.45

    usage_score = _learned_usage_score(int(row.get("usage_count") or 1))
    recency_score = _learned_recency_score(str(row.get("last_used_at") or ""))

    return (
        text_points
        + city_s * 15.0
        + dist_s * 8.0
        + usage_score
        + recency_score
    )


def _learned_row_to_result(
    row: dict[str, Any],
    *,
    score: float,
    q_norm: str,
) -> Optional[dict[str, Any]]:
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
        "_score": score,
        "_usage_count": int(row.get("usage_count") or 1),
        "_last_used_at": str(row.get("last_used_at") or ""),
        "_normalized_query": _norm_key(str(row.get("normalized_query") or "")),
        "_text_tier": _learned_text_match_tier(
            q_norm, _norm_key(str(row.get("normalized_query") or ""))
        ),
    }


def _learned_sort_key(item: dict[str, Any]) -> tuple[float, int, str]:
    return (
        -float(item.get("_score", 0.0)),
        -int(item.get("_text_tier", 0)),
        str(item.get("_last_used_at", "")),
    )


def _scope_labels(city: str, district: str, city_raw: str) -> list[str]:
    labels: list[str] = []
    for label in (city, district, city_raw):
        t = (label or "").strip()
        if t and t not in labels:
            labels.append(t)
    return labels


def _learned_or_filter(scope_labels: list[str]) -> str:
    parts: list[str] = []
    for label in scope_labels[:3]:
        parts.append(f"city.eq.{label}")
        parts.append(f"district.eq.{label}")
    return ",".join(parts)


def _fetch_learned_rows_primary(
    supabase: Any,
    q_norm: str,
) -> list[dict[str, Any]]:
    try:
        q = supabase.table(TABLE_LEARNED_ADDRESSES).select("*")
        if len(q_norm) >= 3:
            q = q.like("normalized_query", f"{q_norm}%")
        else:
            q = q.eq("normalized_query", q_norm)
        res = (
            q.order("usage_count", desc=True)
            .order("last_used_at", desc=True)
            .limit(_LEARNED_FETCH_LIMIT)
            .execute()
        )
        rows = res.data if isinstance(res.data, list) else []
        return [r for r in rows if isinstance(r, dict)]
    except Exception:
        return []


def _fetch_learned_rows_scoped_popular(
    supabase: Any,
    scope_labels: list[str],
) -> list[dict[str, Any]]:
    try:
        q = supabase.table(TABLE_LEARNED_ADDRESSES).select("*")
        if scope_labels:
            q = q.or_(_learned_or_filter(scope_labels))
        res = (
            q.order("usage_count", desc=True)
            .order("last_used_at", desc=True)
            .limit(_LEARNED_FETCH_LIMIT)
            .execute()
        )
        rows = res.data if isinstance(res.data, list) else []
        return [r for r in rows if isinstance(r, dict)]
    except Exception:
        return []


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
    Öğrenilmiş anonim adres araması — P1-A composite score ile sıralama.
    En fazla max_results satır; düşük skorlu adaylar elenir.
    """
    if supabase is None:
        return []

    q_norm = _norm_key(query)
    if len(q_norm) < 2:
        return []

    max_results = max(1, min(int(max_results or 5), 5))
    matched: dict[str, dict[str, Any]] = {}
    scope_labels = _scope_labels(city, district, city_raw)

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
            score = _compute_learned_score(
                q_norm,
                row,
                city=city,
                district=district,
                city_raw=city_raw,
            )
            if score < _MIN_LEARNED_SCORE:
                continue
            result = _learned_row_to_result(row, score=score, q_norm=q_norm)
            if not result:
                continue
            dedupe_key = str(row.get("dedupe_key") or row.get("id") or result.get("place_id"))
            prev = matched.get(dedupe_key)
            if prev is not None and float(prev.get("_score", 0.0)) >= score:
                continue
            matched[dedupe_key] = result

    _ingest_rows(_fetch_learned_rows_primary(supabase, q_norm))

    needs_reverse = len(q_norm) >= 3 and any(
        int(item.get("_text_tier", 0)) < 2 for item in matched.values()
    )
    if len(matched) < max_results or needs_reverse:
        _ingest_rows(_fetch_learned_rows_scoped_popular(supabase, scope_labels))

    if not matched:
        return []

    ranked = sorted(matched.values(), key=_learned_sort_key)
    out: list[dict[str, Any]] = []
    for item in ranked[:max_results]:
        clean = dict(item)
        clean.pop("_score", None)
        clean.pop("_text_tier", None)
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
