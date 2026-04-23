"""
Güzergah eşleşmesi: Haversine mesafe, pattern hash, rota benzerliği.
"""
from __future__ import annotations

import hashlib
import math
from typing import Any, Optional

# Yaklaşık (kuş uçuşu) 5 km eşik
DEFAULT_MAX_METERS = 5000.0
EARTH_RADIUS_M = 6371000.0


def _rad(d: float) -> float:
    return d * math.pi / 180.0


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """İki nokta arası kuş uçuşu mesafe (metre)."""
    a = 0.5 - math.cos(_rad(lat2 - lat1)) / 2 + math.cos(_rad(lat1)) * math.cos(_rad(lat2)) * (
        1 - math.cos(_rad(lon2 - lon1))
    ) / 2
    return EARTH_RADIUS_M * 2 * math.asin(min(1, math.sqrt(max(0, a))))


def norm_city(city: str) -> str:
    return (city or "").strip()


def same_district_flag(d1: Optional[str], d2: Optional[str]) -> bool:
    a = (d1 or "").strip().lower()
    b = (d2 or "").strip().lower()
    if not a or not b:
        return False
    return a == b


def pattern_hash(
    city: str,
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    decimals: int = 2,
) -> str:
    """
    Aynı şehir + kaba grid (varsayılan 2 ondalık ~1,1 km) — otomatik gruplama anahtarı.
    """
    c = norm_city(city).lower()
    r = round
    key = f"{c}|{r(float(start_lat), decimals)}|{r(float(start_lng), decimals)}|{r(float(end_lat), decimals)}|{r(float(end_lng), decimals)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def neighbor_pattern_hashes(
    city: str,
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    decimals: int = 2,
) -> list[str]:
    """
    Aynı şehir + başlangıç hücresinin 3x3 komşu grid'i (yakın pattern'ler).
    En fazla 9 ayrı hash (tekrarlar atılır).
    """
    step = 10 ** (-decimals)  # 0.01
    out: set[str] = set()
    for dsa in (-step, 0.0, step):
        for dso in (-step, 0.0, step):
            out.add(
                pattern_hash(
                    city,
                    float(start_lat) + dsa,
                    float(start_lng) + dso,
                    end_lat,
                    end_lng,
                    decimals=decimals,
                )
            )
    return list(out)


def route_rows_similar(
    a: dict[str, Any],
    b: dict[str, Any],
    max_m: float = DEFAULT_MAX_METERS,
) -> bool:
    """Aynı city + start ve end noktaları birbirine max_m içindeyse eşleşir."""
    if norm_city(str(a.get("city") or "")) != norm_city(str(b.get("city") or "")):
        return False
    s1, g1, e1, w1 = float(a["start_lat"]), float(a["start_lng"]), float(a["end_lat"]), float(a["end_lng"])
    s2, g2, e2, w2 = float(b["start_lat"]), float(b["start_lng"]), float(b["end_lat"]), float(b["end_lng"])
    d1 = haversine_meters(s1, g1, s2, g2)
    d2 = haversine_meters(e1, w1, e2, w2)
    return d1 <= max_m and d2 <= max_m


def match_distance_meters(
    a: dict[str, Any],
    b: dict[str, Any],
) -> int:
    """route_matches.distance_meters için: iki bacak max'ı (yuvarlanmış int)."""
    s1, g1, e1, w1 = float(a["start_lat"]), float(a["start_lng"]), float(a["end_lat"]), float(a["end_lng"])
    s2, g2, e2, w2 = float(b["start_lat"]), float(b["start_lng"]), float(b["end_lat"]), float(b["end_lng"])
    d1 = haversine_meters(s1, g1, s2, g2)
    d2 = haversine_meters(e1, w1, e2, w2)
    return int(max(d1, d2))


def ordered_pair(ua: str, ub: str) -> tuple[str, str]:
    a = str(ua).strip().lower()
    b = str(ub).strip().lower()
    return (a, b) if a < b else (b, a)
