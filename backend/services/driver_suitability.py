"""
MATCH-REL-1C-C — Quick Match suitability score (shadow / logging only).

Pure helper; does not affect driver ordering or eligibility.
"""

from __future__ import annotations

from typing import Any, Optional

from services.match_location_freshness import location_age_seconds

_DEFAULT_DISTANCE_REF_KM = 8.0

_WEIGHT_ETA = 0.50
_WEIGHT_DISTANCE = 0.25
_WEIGHT_FRESHNESS = 0.15
_WEIGHT_RATING = 0.05
_WEIGHT_VEHICLE = 0.05


def _rating_norm(rating: Any) -> float:
    if rating is None or str(rating).strip() == "":
        # Neutral 0.5 — missing rating must not punish new drivers (0.0 would).
        return 0.5
    try:
        r = float(rating)
    except (TypeError, ValueError):
        return 0.5
    return max(0.0, min(1.0, (r - 3.0) / 2.0))


def compute_qm_suitability_score(
    driver_row: dict,
    route_meta: dict,
    *,
    max_eta_min: float,
    max_age_sec: int,
    distance_ref_km: float = _DEFAULT_DISTANCE_REF_KM,
) -> dict:
    """
    Composite suitability score for Quick Match shadow logging (V1 weights).

    route_meta expects duration_min and distance_km from routing.
    """
    duration_min = float(route_meta.get("duration_min", 0) or 0)
    distance_km = float(route_meta.get("distance_km", 0) or 0)
    eta_cap = max(float(max_eta_min), 1e-9)
    dist_cap = max(float(distance_ref_km), 1e-9)

    eta_norm = 1.0 - min(duration_min / eta_cap, 1.0)
    distance_norm = 1.0 - min(distance_km / dist_cap, 1.0)

    age_sec: Optional[float] = location_age_seconds(driver_row)
    if age_sec is None or max_age_sec <= 0:
        freshness_norm = 0.0
    else:
        freshness_norm = max(0.0, 1.0 - age_sec / max_age_sec)

    rating_norm = _rating_norm(driver_row.get("rating"))
    vehicle_norm = 1.0  # QM vehicle hard gate already applied upstream

    score = (
        _WEIGHT_ETA * eta_norm
        + _WEIGHT_DISTANCE * distance_norm
        + _WEIGHT_FRESHNESS * freshness_norm
        + _WEIGHT_RATING * rating_norm
        + _WEIGHT_VEHICLE * vehicle_norm
    )

    return {
        "score": score,
        "eta_norm": eta_norm,
        "distance_norm": distance_norm,
        "freshness_norm": freshness_norm,
        "rating_norm": rating_norm,
        "vehicle_norm": vehicle_norm,
        "age_sec": age_sec,
    }
