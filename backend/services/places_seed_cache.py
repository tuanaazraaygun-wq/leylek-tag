"""
Ankara / Türkiye popüler adres seed — /api/places/search cold start hızlandırma.
Prefix + normalize eşleşme; fuzzy yok. Koordinatlar Ankara bbox içinde.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from typing import Any, Optional

# CITY_BBOX Ankara ile uyumlu (min_lon, min_lat, max_lon, max_lat)
_ANKARA_BBOX = (32.2, 39.5, 33.5, 40.4)

_ANKARA_DISTRICT_NORM: frozenset[str] = frozenset(
    {
        "ankara",
        "cankaya",
        "mamak",
        "yenimahalle",
        "kecioren",
        "altindag",
        "sincan",
        "etimesgut",
        "pursaklar",
        "golbasi",
    }
)


def _norm_key(s: str) -> str:
    t = (s or "").strip().lower().replace(",", " ").replace("|", "")
    try:
        t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode("ascii")
    except Exception:
        pass
    return " ".join(t.split())


def _point_in_ankara_bbox(lon: float, lat: float) -> bool:
    min_lon, min_lat, max_lon, max_lat = _ANKARA_BBOX
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


@dataclass(frozen=True)
class _SeedEntry:
    seed_id: str
    aliases: tuple[str, ...]
    title: str
    subtitle: str
    display_name: str
    lat: float
    lng: float


# Koordinatlar: bilinen Ankara POI/soy — bbox içinde tutuldu
_ANKARA_SEEDS: tuple[_SeedEntry, ...] = (
    _SeedEntry(
        seed_id="strazburg_caddesi",
        aliases=("strazburg", "strazburg caddesi", "strazburg cd", "strazburg cad"),
        title="Strazburg Caddesi",
        subtitle="Çankaya, Ankara",
        display_name="Strazburg Caddesi, Çankaya, Ankara, Türkiye",
        lat=39.8964,
        lng=32.8587,
    ),
    _SeedEntry(
        seed_id="kizilay",
        aliases=("kizilay", "kızılay", "kizilay meydani", "kızılay meydanı"),
        title="Kızılay",
        subtitle="Çankaya, Ankara",
        display_name="Kızılay, Çankaya, Ankara, Türkiye",
        lat=39.9208,
        lng=32.8541,
    ),
    _SeedEntry(
        seed_id="ankamall",
        aliases=("ankamall", "anka mall", "ankamall avm"),
        title="Ankamall",
        subtitle="Yenimahalle, Ankara",
        display_name="Ankamall, Yenimahalle, Ankara, Türkiye",
        lat=39.9496,
        lng=32.8312,
    ),
    _SeedEntry(
        seed_id="bilkent",
        aliases=("bilkent", "bilkent universitesi", "bilkent üniversitesi"),
        title="Bilkent",
        subtitle="Çankaya, Ankara",
        display_name="Bilkent, Çankaya, Ankara, Türkiye",
        lat=39.8745,
        lng=32.7473,
    ),
    _SeedEntry(
        seed_id="cankaya",
        aliases=("cankaya", "çankaya"),
        title="Çankaya",
        subtitle="Ankara",
        display_name="Çankaya, Ankara, Türkiye",
        lat=39.9170,
        lng=32.8610,
    ),
    _SeedEntry(
        seed_id="mamak",
        aliases=("mamak",),
        title="Mamak",
        subtitle="Ankara",
        display_name="Mamak, Ankara, Türkiye",
        lat=39.9440,
        lng=32.9160,
    ),
)


def _ankara_search_context(city: str, district: str, city_raw: str) -> bool:
    """Ankara seed yalnızca Ankara kapsamında veya şehir belirsizken."""
    labels = [city, district, city_raw]
    norms = [_norm_key(x) for x in labels if (x or "").strip()]
    if not norms:
        return True
    for nk in norms:
        if nk in _ANKARA_DISTRICT_NORM:
            return True
    return False


def _query_matches_alias(q_norm: str, alias_norm: str) -> bool:
    if len(q_norm) < 2 or len(alias_norm) < 2:
        return False
    if q_norm == alias_norm:
        return True
    if len(q_norm) >= 3 and alias_norm.startswith(q_norm):
        return True
    if len(alias_norm) >= 3 and q_norm.startswith(alias_norm):
        return True
    return False


def _seed_entry_to_row(entry: _SeedEntry) -> dict[str, Any]:
    if not _point_in_ankara_bbox(entry.lng, entry.lat):
        return {}
    return {
        "place_id": f"seed:{entry.seed_id}",
        "google_place_id": None,
        "title": entry.title,
        "subtitle": entry.subtitle,
        "display_name": entry.display_name,
        "lat": str(round(entry.lat, 7)),
        "lng": str(round(entry.lng, 7)),
        "provider": "local_seed",
    }


def lookup_places_seed(
    query: str,
    city: str = "",
    *,
    district: str = "",
    city_raw: str = "",
    max_results: int = 8,
) -> list[dict[str, Any]]:
    """
    Prefix/normalize eşleşme ile koordinatlı seed satırları.
    Yanlış fuzzy yok; kısa query (>=2) ile alias prefix yeterli.
    """
    q_norm = _norm_key(query)
    if len(q_norm) < 2:
        return []
    if not _ankara_search_context(city, district, city_raw):
        return []

    matched: list[tuple[int, int, _SeedEntry]] = []
    for entry in _ANKARA_SEEDS:
        best_rank = 999
        for alias in entry.aliases:
            a_norm = _norm_key(alias)
            if not _query_matches_alias(q_norm, a_norm):
                continue
            if q_norm == a_norm:
                rank = 0
            elif a_norm.startswith(q_norm):
                rank = 1
            else:
                rank = 2
            best_rank = min(best_rank, rank)
        if best_rank < 999:
            matched.append((best_rank, len(q_norm), entry))

    if not matched:
        return []

    matched.sort(key=lambda t: (t[0], -t[1]))
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for _rank, _qlen, entry in matched:
        if entry.seed_id in seen:
            continue
        row = _seed_entry_to_row(entry)
        if not row:
            continue
        seen.add(entry.seed_id)
        out.append(row)
        if len(out) >= max_results:
            break
    return out
