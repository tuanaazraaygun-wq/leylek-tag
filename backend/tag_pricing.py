"""
Normal TAG /price/calculate — şehir bazlı genişlemeye uygun sabit fiyat parametreleri.
Endpoint city göndermediği için default Ankara seti kullanılır.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

DEFAULT_TAG_PRICING_CITY = "ankara"

TRAFFIC_RATIO_MIN = 1.0
TRAFFIC_RATIO_MAX = 1.80
TRAFFIC_MULTIPLIER_MAX = 1.20


@dataclass(frozen=True)
class TagVehiclePricing:
    base: float
    per_km: float
    per_min: float
    minimum: float


TAG_PRICING_BY_CITY: Dict[str, Dict[str, TagVehiclePricing]] = {
    "ankara": {
        "car": TagVehiclePricing(base=55.0, per_km=22.0, per_min=4.5, minimum=165.0),
        "motorcycle": TagVehiclePricing(base=45.0, per_km=17.0, per_min=2.85, minimum=130.0),
    },
}


def round_price_to_5_tl(x: float) -> int:
    return int(round(x / 5.0) * 5)


def tag_pricing_for_vehicle(city_key: str, vehicle_kind: str) -> TagVehiclePricing:
    vk = "motorcycle" if str(vehicle_kind).strip().lower() == "motorcycle" else "car"
    city = str(city_key or DEFAULT_TAG_PRICING_CITY).strip().lower()
    tier = TAG_PRICING_BY_CITY.get(city) or TAG_PRICING_BY_CITY[DEFAULT_TAG_PRICING_CITY]
    return tier[vk]


def compute_traffic_ratio(
    duration_min: Optional[float],
    duration_min_no_traffic: Optional[float],
) -> float:
    """Fail-safe traffic_ratio = duration_min / duration_min_no_traffic, clamped [1.0, 1.80]."""
    if duration_min is None:
        return TRAFFIC_RATIO_MIN
    try:
        dur = float(duration_min)
    except (TypeError, ValueError):
        return TRAFFIC_RATIO_MIN
    if duration_min_no_traffic is None:
        return TRAFFIC_RATIO_MIN
    try:
        free = float(duration_min_no_traffic)
    except (TypeError, ValueError):
        return TRAFFIC_RATIO_MIN
    if free <= 0:
        return TRAFFIC_RATIO_MIN
    ratio = dur / free
    return min(max(ratio, TRAFFIC_RATIO_MIN), TRAFFIC_RATIO_MAX)


def traffic_multiplier_from_ratio(ratio: float) -> float:
    """Tiered traffic multiplier; hard cap TRAFFIC_MULTIPLIER_MAX (1.20)."""
    try:
        r = float(ratio)
    except (TypeError, ValueError):
        r = TRAFFIC_RATIO_MIN
    if r < 1.15:
        mult = 1.00
    elif r < 1.35:
        mult = 1.08
    elif r < 1.70:
        mult = 1.15
    else:
        mult = 1.25
    return min(mult, TRAFFIC_MULTIPLIER_MAX)


def compute_tag_ride_price(
    *,
    city_key: str,
    vehicle_kind: str,
    distance_km: float,
    estimated_minutes: int,
    peak_multiplier: float,
    traffic_multiplier: float = 1.0,
) -> Tuple[int, int, int, TagVehiclePricing]:
    """raw = base + km*per_km + min*per_min; max(minimum); * traffic; * peak; 5 TL grid."""
    cfg = tag_pricing_for_vehicle(city_key, vehicle_kind)
    raw = (
        cfg.base
        + float(distance_km) * cfg.per_km
        + float(estimated_minutes) * cfg.per_min
    )
    subtotal = max(cfg.minimum, raw)
    after_traffic = subtotal * float(traffic_multiplier)
    after_peak = after_traffic * float(peak_multiplier)

    min_unit = round_price_to_5_tl(cfg.minimum)
    suggested = round_price_to_5_tl(after_peak)
    if suggested < min_unit:
        suggested = min_unit

    min_price = round_price_to_5_tl(suggested * 0.9)
    min_price = max(min_price, min_unit)

    max_price = round_price_to_5_tl(suggested * 1.1)
    if max_price < min_price:
        max_price = min_price

    return suggested, min_price, max_price, cfg
