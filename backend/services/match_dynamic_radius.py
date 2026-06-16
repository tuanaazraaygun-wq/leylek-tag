"""
MATCH-1A — Dynamic dispatch radius shadow resolver (pure, no side effects).

Observability only: production dispatch continues to use DISPATCH_RADIUS_KM.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

TIER_METRO = "metro"
TIER_ORTA = "orta"
TIER_KUCUK_IL = "kucuk_il"
TIER_KIRSAL = "kirsal"

RADIUS_KM_BY_TIER: dict[str, float] = {
    TIER_METRO: 10.0,
    TIER_ORTA: 15.0,
    TIER_KUCUK_IL: 25.0,
    TIER_KIRSAL: 30.0,
}

# Büyük metro — yoğun çekirdek
_METRO_CITIES = frozenset(
    {"İstanbul", "Ankara", "İzmir", "Bursa", "Kocaeli"}
)

# Orta ölçekli il merkezleri
_ORTA_CITIES = frozenset(
    {
        "Antalya",
        "Adana",
        "Konya",
        "Gaziantep",
        "Şanlıurfa",
        "Mersin",
        "Diyarbakır",
        "Hatay",
        "Manisa",
        "Kayseri",
        "Samsun",
        "Balıkesir",
        "Kahramanmaraş",
        "Aydın",
        "Denizli",
        "Sakarya",
        "Tekirdağ",
        "Muğla",
        "Eskişehir",
        "Trabzon",
        "Malatya",
        "Erzurum",
    }
)

# Küçük il
_KUCUK_IL_CITIES = frozenset({"Van", "Mardin", "Adıyaman", "Ağrı"})

# min_lon, min_lat, max_lon, max_lat — frontend CITY_DATA ile hizalı
_CITY_BBOX: dict[str, tuple[float, float, float, float]] = {
    "İstanbul": (28.5, 40.8, 29.9, 41.7),
    "Ankara": (32.2, 39.5, 33.5, 40.4),
    "İzmir": (26.5, 38.0, 27.8, 39.0),
    "Bursa": (28.4, 39.8, 30.0, 40.6),
    "Antalya": (29.8, 36.1, 32.5, 37.5),
    "Adana": (34.5, 36.5, 36.2, 38.0),
    "Konya": (31.5, 36.8, 34.5, 38.8),
    "Gaziantep": (36.5, 36.5, 38.2, 37.8),
    "Şanlıurfa": (38.0, 36.5, 40.5, 38.0),
    "Kocaeli": (29.3, 40.5, 30.5, 41.2),
    "Mersin": (33.5, 36.0, 35.5, 37.5),
    "Diyarbakır": (39.5, 37.3, 41.2, 38.8),
    "Hatay": (35.5, 35.8, 37.0, 37.0),
    "Manisa": (27.0, 38.2, 28.5, 39.2),
    "Kayseri": (34.5, 38.0, 36.5, 39.5),
    "Samsun": (35.5, 40.8, 37.2, 41.8),
    "Balıkesir": (27.0, 39.0, 29.0, 40.5),
    "Kahramanmaraş": (36.2, 37.0, 37.8, 38.3),
    "Van": (42.5, 37.8, 44.5, 39.5),
    "Aydın": (27.0, 37.3, 28.8, 38.5),
    "Denizli": (28.5, 37.2, 30.0, 38.3),
    "Sakarya": (29.8, 40.3, 31.0, 41.2),
    "Tekirdağ": (26.5, 40.5, 28.5, 41.5),
    "Muğla": (27.5, 36.5, 29.5, 37.8),
    "Eskişehir": (29.8, 39.0, 31.5, 40.5),
    "Mardin": (40.0, 36.8, 41.5, 37.8),
    "Trabzon": (38.8, 40.5, 40.5, 41.5),
    "Malatya": (37.5, 37.8, 39.2, 38.9),
    "Erzurum": (40.3, 39.3, 42.5, 40.5),
    "Adıyaman": (37.4, 37.3, 38.8, 38.2),
    "Ağrı": (42.45, 39.20, 44.55, 40.15),
}

_CITY_CENTER: dict[str, tuple[float, float]] = {
    "İstanbul": (41.0082, 28.9784),
    "Ankara": (39.9334, 32.8597),
    "İzmir": (38.4237, 27.1428),
    "Bursa": (40.1885, 29.0610),
    "Antalya": (36.8969, 30.7133),
    "Adana": (37.0000, 35.3213),
    "Konya": (37.8746, 32.4932),
    "Gaziantep": (37.0662, 37.3833),
    "Şanlıurfa": (37.1591, 38.7969),
    "Kocaeli": (40.8533, 29.8815),
    "Mersin": (36.8000, 34.6333),
    "Diyarbakır": (37.9144, 40.2306),
    "Hatay": (36.4018, 36.3498),
    "Manisa": (38.6191, 27.4289),
    "Kayseri": (38.7312, 35.4787),
    "Samsun": (41.2867, 36.3300),
    "Balıkesir": (39.6484, 27.8826),
    "Kahramanmaraş": (37.5858, 36.9371),
    "Van": (38.4891, 43.4089),
    "Aydın": (37.8560, 27.8416),
    "Denizli": (37.7765, 29.0864),
    "Sakarya": (40.7569, 30.3780),
    "Tekirdağ": (40.9833, 27.5167),
    "Muğla": (37.2153, 28.3636),
    "Eskişehir": (39.7767, 30.5206),
    "Mardin": (37.3212, 40.7245),
    "Trabzon": (41.0027, 39.7168),
    "Malatya": (38.3552, 38.3095),
    "Erzurum": (39.9043, 41.2679),
    "Adıyaman": (37.7648, 38.2786),
    "Ağrı": (39.7191, 43.0503),
}

# İl merkezinden bu km'den uzak pickup → kırsal/uzak ilçe tier
_REMOTE_KM_BY_BASE_TIER: dict[str, float] = {
    TIER_METRO: 18.0,
    TIER_ORTA: 14.0,
    TIER_KUCUK_IL: 10.0,
}

_TR_FOLD = str.maketrans({"İ": "I", "ı": "i", "Ş": "S", "ş": "s", "Ğ": "G", "ğ": "g", "Ü": "U", "ü": "u", "Ö": "O", "ö": "o", "Ç": "C", "ç": "c"})


@dataclass(frozen=True)
class DynamicDispatchRadiusResult:
    dynamic_radius_km: float
    tier: str
    pickup_city: Optional[str]
    pickup_district: Optional[str]
    legacy_radius_km: float
    remote_district: bool = False


def _fold_tr(s: str) -> str:
    return str(s or "").translate(_TR_FOLD)


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
    return r_earth * 2 * math.asin(math.sqrt(min(1.0, a)))


def _point_in_bbox(lat: float, lng: float, bbox: tuple[float, float, float, float]) -> bool:
    min_lon, min_lat, max_lon, max_lat = bbox
    return min_lon <= lng <= max_lon and min_lat <= lat <= max_lat


def _bbox_area(bbox: tuple[float, float, float, float]) -> float:
    min_lon, min_lat, max_lon, max_lat = bbox
    return max(0.0, max_lon - min_lon) * max(0.0, max_lat - min_lat)


def _parse_pickup_district(pickup_location: str) -> Optional[str]:
    loc = str(pickup_location or "").strip()
    if not loc:
        return None
    head = loc.split(",")[0].split("/")[0].strip()
    return head or None


def _city_from_location_text(pickup_location: str) -> Optional[str]:
    loc = _fold_tr(str(pickup_location or "").strip()).casefold()
    if len(loc) < 2:
        return None
    best: Optional[str] = None
    best_len = 0
    for city in _CITY_BBOX:
        needle = _fold_tr(city).casefold()
        if len(needle) < 2:
            continue
        if needle in loc and len(needle) > best_len:
            best = city
            best_len = len(needle)
    return best


def _resolve_city_from_coords(lat: float, lng: float) -> Optional[str]:
    matches: list[tuple[float, str]] = []
    for city, bbox in _CITY_BBOX.items():
        if _point_in_bbox(lat, lng, bbox):
            matches.append((_bbox_area(bbox), city))
    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0][1]


def _base_tier_for_city(city: str) -> str:
    if city in _METRO_CITIES:
        return TIER_METRO
    if city in _ORTA_CITIES:
        return TIER_ORTA
    if city in _KUCUK_IL_CITIES:
        return TIER_KUCUK_IL
    return TIER_KIRSAL


def _is_rural_location_text(pickup_location: str) -> bool:
    folded = _fold_tr(str(pickup_location or "")).casefold()
    if not folded:
        return False
    rural_markers = ("koy", "mezra", "belde", "kirsal", "bucak", "koyu")
    return any(m in folded for m in rural_markers)


def resolve_dynamic_dispatch_radius(
    pickup_lat: float,
    pickup_lng: float,
    pickup_location: str = "",
    *,
    legacy_radius_km: float = 10.0,
) -> DynamicDispatchRadiusResult:
    """
    Pure helper — MATCH-1A shadow tier resolver.
    Dispatch pipeline MUST NOT use this result until a later rollout phase.
    """
    try:
        lat = float(pickup_lat)
        lng = float(pickup_lng)
    except (TypeError, ValueError):
        lat, lng = 0.0, 0.0

    pickup_district = _parse_pickup_district(pickup_location)
    city_from_coords = _resolve_city_from_coords(lat, lng) if lat and lng else None
    city_from_text = _city_from_location_text(pickup_location)
    pickup_city = city_from_coords or city_from_text

    if _is_rural_location_text(pickup_location) and not city_from_coords:
        return DynamicDispatchRadiusResult(
            dynamic_radius_km=RADIUS_KM_BY_TIER[TIER_KIRSAL],
            tier=TIER_KIRSAL,
            pickup_city=pickup_city,
            pickup_district=pickup_district,
            legacy_radius_km=float(legacy_radius_km),
            remote_district=True,
        )

    if not pickup_city:
        return DynamicDispatchRadiusResult(
            dynamic_radius_km=RADIUS_KM_BY_TIER[TIER_KIRSAL],
            tier=TIER_KIRSAL,
            pickup_city=None,
            pickup_district=pickup_district,
            legacy_radius_km=float(legacy_radius_km),
            remote_district=True,
        )

    base_tier = _base_tier_for_city(pickup_city)
    remote_district = False
    center = _CITY_CENTER.get(pickup_city)
    if center is not None and lat and lng:
        dist_center = _haversine_km(lat, lng, center[0], center[1])
        remote_limit = _REMOTE_KM_BY_BASE_TIER.get(base_tier, 12.0)
        if dist_center > remote_limit:
            remote_district = True

    if remote_district:
        tier = TIER_KIRSAL
    else:
        tier = base_tier

    return DynamicDispatchRadiusResult(
        dynamic_radius_km=RADIUS_KM_BY_TIER[tier],
        tier=tier,
        pickup_city=pickup_city,
        pickup_district=pickup_district,
        legacy_radius_km=float(legacy_radius_km),
        remote_district=remote_district,
    )
