"""
Sprint 5E-6B — Dispatch ranking shadow helper (pure; no production wiring).

Computes shadow scores and rank deltas for later [dispatch_ranking_shadow] logging.
Does not affect dispatch order, eligibility, or database state.
"""

from __future__ import annotations

import os
from copy import deepcopy
from typing import Any, Literal, Mapping, Optional, Sequence

DispatchRankingMode = Literal["normal", "quick_match"]

_DEFAULT_MAX_AGE_SEC = 120
_DEFAULT_DISTANCE_CAP_KM = 10.0
_DEFAULT_MAX_ETA_MIN = 30.0

_NORMAL_WEIGHTS = {
    "eta_score": 0.40,
    "distance_score": 0.30,
    "freshness_score": 0.15,
    "rating_score": 0.10,
    "vehicle_score": 0.05,
}

_QUICK_MATCH_WEIGHTS = {
    "eta_score": 0.50,
    "distance_score": 0.20,
    "freshness_score": 0.15,
    "rating_score": 0.10,
    "vehicle_score": 0.05,
}


def dispatch_ranking_shadow_enabled() -> bool:
    """DISPATCH_RANKING_SHADOW=0 (default) — helper available; wiring is a later sprint."""
    return os.getenv("DISPATCH_RANKING_SHADOW", "0").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def shadow_weights_for_mode(mode: DispatchRankingMode) -> dict[str, float]:
    if mode == "quick_match":
        return dict(_QUICK_MATCH_WEIGHTS)
    return dict(_NORMAL_WEIGHTS)


def _coerce_float(value: Any, default: float = 0.0) -> float:
    if value is None or (isinstance(value, str) and not value.strip()):
        return default
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    if not (out == out and abs(out) != float("inf")):  # NaN / inf guard
        return default
    return out


def _candidate_driver_id(candidate: Mapping[str, Any]) -> str:
    return str(candidate.get("driver_id") or "").strip().lower()


def _candidate_eta_min(candidate: Mapping[str, Any]) -> float:
    if candidate.get("eta_min") is not None:
        return max(0.0, _coerce_float(candidate.get("eta_min"), 0.0))
    return max(0.0, _coerce_float(candidate.get("duration_min"), 0.0))


def _candidate_freshness_sec(candidate: Mapping[str, Any]) -> Optional[float]:
    if candidate.get("freshness_sec") is not None:
        val = _coerce_float(candidate.get("freshness_sec"), -1.0)
        return val if val >= 0.0 else None
    if candidate.get("location_age_seconds") is not None:
        val = _coerce_float(candidate.get("location_age_seconds"), -1.0)
        return val if val >= 0.0 else None
    return None


def normalize_eta_score(eta_min: float, *, max_eta_min: float) -> float:
    cap = max(float(max_eta_min), 1e-9)
    return 1.0 - min(max(0.0, float(eta_min)) / cap, 1.0)


def normalize_distance_score(distance_km: float, *, distance_cap_km: float) -> float:
    cap = max(float(distance_cap_km), 1e-9)
    return 1.0 - min(max(0.0, float(distance_km)) / cap, 1.0)


def normalize_freshness_score(
    freshness_sec: Optional[float],
    *,
    max_age_sec: int,
    missing_neutral: float = 0.5,
) -> float:
    """Higher score = fresher GPS. Missing age uses neutral (does not punish shadow rank)."""
    if freshness_sec is None:
        return float(missing_neutral)
    if max_age_sec <= 0:
        return float(missing_neutral)
    age = max(0.0, float(freshness_sec))
    return max(0.0, 1.0 - age / float(max_age_sec))


def normalize_rating_score(rating: Any, *, missing_neutral: float = 0.5) -> float:
    if rating is None or (isinstance(rating, str) and not str(rating).strip()):
        return float(missing_neutral)
    try:
        r = float(rating)
    except (TypeError, ValueError):
        return float(missing_neutral)
    return max(0.0, min(1.0, (r - 3.0) / 2.0))


def normalize_vehicle_score(vehicle_match: Any, *, missing_neutral: float = 0.5) -> float:
    if vehicle_match is None:
        return float(missing_neutral)
    if isinstance(vehicle_match, bool):
        return 1.0 if vehicle_match else 0.0
    if isinstance(vehicle_match, (int, float)):
        return 1.0 if float(vehicle_match) > 0.0 else 0.0
    text = str(vehicle_match).strip().lower()
    if not text:
        return float(missing_neutral)
    if text in ("1", "true", "yes", "on", "match", "matched"):
        return 1.0
    if text in ("0", "false", "no", "off"):
        return 0.0
    return float(missing_neutral)


def compute_shadow_score_components(
    candidate: Mapping[str, Any],
    *,
    mode: DispatchRankingMode,
    max_eta_min: float,
    max_age_sec: int = _DEFAULT_MAX_AGE_SEC,
    distance_cap_km: float = _DEFAULT_DISTANCE_CAP_KM,
) -> dict[str, Any]:
    weights = shadow_weights_for_mode(mode)
    eta_min = _candidate_eta_min(candidate)
    distance_km = max(0.0, _coerce_float(candidate.get("distance_km"), 0.0))
    freshness_sec = _candidate_freshness_sec(candidate)

    eta_score = normalize_eta_score(eta_min, max_eta_min=max_eta_min)
    distance_score = normalize_distance_score(distance_km, distance_cap_km=distance_cap_km)
    freshness_score = normalize_freshness_score(freshness_sec, max_age_sec=max_age_sec)
    rating_score = normalize_rating_score(candidate.get("rating"))
    vehicle_score = normalize_vehicle_score(candidate.get("vehicle_match"))

    final_shadow_score = (
        weights["eta_score"] * eta_score
        + weights["distance_score"] * distance_score
        + weights["freshness_score"] * freshness_score
        + weights["rating_score"] * rating_score
        + weights["vehicle_score"] * vehicle_score
    )

    return {
        "driver_id": _candidate_driver_id(candidate),
        "eta_min": eta_min,
        "distance_km": distance_km,
        "freshness_sec": freshness_sec,
        "eta_score": round(eta_score, 6),
        "distance_score": round(distance_score, 6),
        "freshness_score": round(freshness_score, 6),
        "rating_score": round(rating_score, 6),
        "vehicle_score": round(vehicle_score, 6),
        "acceptance_score": None,
        "response_score": None,
        "fairness_score": None,
        "final_shadow_score": round(final_shadow_score, 6),
    }


def _resolve_max_eta_min(candidates: Sequence[Mapping[str, Any]], explicit: Optional[float]) -> float:
    if explicit is not None and explicit > 0:
        return float(explicit)
    etas = [_candidate_eta_min(c) for c in candidates]
    if etas:
        return max(max(etas), 1.0)
    return _DEFAULT_MAX_ETA_MIN


def rank_candidates_by_shadow_score(
    candidates: Sequence[Mapping[str, Any]],
    *,
    mode: DispatchRankingMode,
    max_eta_min: Optional[float] = None,
    max_age_sec: int = _DEFAULT_MAX_AGE_SEC,
    distance_cap_km: float = _DEFAULT_DISTANCE_CAP_KM,
) -> list[dict[str, Any]]:
    """
    Rank candidates by shadow score without mutating the input list or dicts.

    Tie-break: lower shadow_rank prefers higher final_shadow_score, then lexicographic driver_id.
    """
    if not candidates:
        return []

    eta_cap = _resolve_max_eta_min(candidates, max_eta_min)
    enriched: list[dict[str, Any]] = []
    for idx, raw in enumerate(candidates, start=1):
        current_rank = raw.get("current_rank")
        if current_rank is None:
            current_rank = idx
        else:
            try:
                current_rank = int(current_rank)
            except (TypeError, ValueError):
                current_rank = idx

        components = compute_shadow_score_components(
            raw,
            mode=mode,
            max_eta_min=eta_cap,
            max_age_sec=max_age_sec,
            distance_cap_km=distance_cap_km,
        )
        enriched.append(
            {
                **components,
                "current_rank": current_rank,
            }
        )

    enriched.sort(
        key=lambda row: (
            -float(row["final_shadow_score"]),
            str(row.get("driver_id") or ""),
        )
    )

    results: list[dict[str, Any]] = []
    for shadow_rank, row in enumerate(enriched, start=1):
        current_rank = int(row["current_rank"])
        rank_delta = shadow_rank - current_rank
        results.append(
            {
                **row,
                "shadow_rank": shadow_rank,
                "rank_delta": rank_delta,
                "would_promote": shadow_rank < current_rank,
                "would_demote": shadow_rank > current_rank,
            }
        )
    return results


def build_dispatch_ranking_shadow_log_payload(
    result_row: Mapping[str, Any],
    *,
    mode: DispatchRankingMode,
    request_id: Optional[str] = None,
    tag_id: Optional[str] = None,
    eligible_count: Optional[int] = None,
) -> dict[str, Any]:
    """Structured payload for future [dispatch_ranking_shadow] log lines."""
    payload: dict[str, Any] = {
        "mode": mode,
        "driver_id": result_row.get("driver_id"),
        "current_rank": result_row.get("current_rank"),
        "shadow_rank": result_row.get("shadow_rank"),
        "rank_delta": result_row.get("rank_delta"),
        "eta_min": result_row.get("eta_min"),
        "distance_km": result_row.get("distance_km"),
        "freshness_sec": result_row.get("freshness_sec"),
        "eta_score": result_row.get("eta_score"),
        "distance_score": result_row.get("distance_score"),
        "freshness_score": result_row.get("freshness_score"),
        "rating_score": result_row.get("rating_score"),
        "vehicle_score": result_row.get("vehicle_score"),
        "acceptance_score": None,
        "response_score": None,
        "fairness_score": None,
        "final_shadow_score": result_row.get("final_shadow_score"),
        "would_promote": result_row.get("would_promote"),
        "would_demote": result_row.get("would_demote"),
    }
    if request_id:
        payload["request_id"] = str(request_id).strip()
    if tag_id:
        payload["tag_id"] = str(tag_id).strip()
    if eligible_count is not None:
        payload["eligible_count"] = int(eligible_count)
    return payload


def analyze_dispatch_ranking_shadow(
    candidates: Sequence[Mapping[str, Any]],
    *,
    mode: DispatchRankingMode,
    max_eta_min: Optional[float] = None,
    max_age_sec: int = _DEFAULT_MAX_AGE_SEC,
    distance_cap_km: float = _DEFAULT_DISTANCE_CAP_KM,
) -> list[dict[str, Any]]:
    """
    High-level entry: shadow rank analysis + optional log payloads attached under log_payload.
    Input candidates are never mutated (verified via deep copy guard in tests).
    """
    ranked = rank_candidates_by_shadow_score(
        candidates,
        mode=mode,
        max_eta_min=max_eta_min,
        max_age_sec=max_age_sec,
        distance_cap_km=distance_cap_km,
    )
    out: list[dict[str, Any]] = []
    for row in ranked:
        item = dict(row)
        item["log_payload"] = build_dispatch_ranking_shadow_log_payload(
            row,
            mode=mode,
            eligible_count=len(candidates),
        )
        out.append(item)
    return out


def snapshot_candidates(candidates: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Test helper: deep snapshot to prove inputs were not mutated."""
    return deepcopy([dict(c) for c in candidates])
