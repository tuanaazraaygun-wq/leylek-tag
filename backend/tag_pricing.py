"""
Normal TAG /price/calculate — şehir bazlı genişlemeye uygun sabit fiyat parametreleri.
Endpoint city göndermediği için default Ankara seti kullanılır.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple

DEFAULT_TAG_PRICING_CITY = "ankara"


@dataclass(frozen=True)
class TagVehiclePricing:
    base: float
    per_km: float
    per_min: float
    minimum: float


TAG_PRICING_BY_CITY: Dict[str, Dict[str, TagVehiclePricing]] = {
    "ankara": {
        "car": TagVehiclePricing(base=65.0, per_km=22.0, per_min=3.5, minimum=175.0),
        "motorcycle": TagVehiclePricing(base=45.0, per_km=14.0, per_min=2.5, minimum=125.0),
    },
}


def round_price_to_5_tl(x: float) -> int:
    return int(round(x / 5.0) * 5)


def tag_pricing_for_vehicle(city_key: str, vehicle_kind: str) -> TagVehiclePricing:
    vk = "motorcycle" if str(vehicle_kind).strip().lower() == "motorcycle" else "car"
    city = str(city_key or DEFAULT_TAG_PRICING_CITY).strip().lower()
    tier = TAG_PRICING_BY_CITY.get(city) or TAG_PRICING_BY_CITY[DEFAULT_TAG_PRICING_CITY]
    return tier[vk]


def compute_tag_ride_price(
    *,
    city_key: str,
    vehicle_kind: str,
    distance_km: float,
    estimated_minutes: int,
    peak_multiplier: float,
) -> Tuple[int, int, int, TagVehiclePricing]:
    """raw = base + km*per_km + min*per_min; max(minimum, raw); * peak; 5 TL grid."""
    cfg = tag_pricing_for_vehicle(city_key, vehicle_kind)
    raw = (
        cfg.base
        + float(distance_km) * cfg.per_km
        + float(estimated_minutes) * cfg.per_min
    )
    subtotal = max(cfg.minimum, raw)
    after_peak = subtotal * float(peak_multiplier)

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
