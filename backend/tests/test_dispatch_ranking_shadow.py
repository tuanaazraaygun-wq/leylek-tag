"""
Sprint 5E-6B — dispatch_ranking_shadow pure helper tests.

Run: py -3 -m pytest backend/tests/test_dispatch_ranking_shadow.py -v
"""
from __future__ import annotations

import os
import sys
from copy import deepcopy
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.dispatch_ranking_shadow import (  # noqa: E402
    analyze_dispatch_ranking_shadow,
    build_dispatch_ranking_shadow_log_payload,
    compute_shadow_score_components,
    dispatch_ranking_shadow_enabled,
    normalize_freshness_score,
    normalize_rating_score,
    rank_candidates_by_shadow_score,
    shadow_weights_for_mode,
    snapshot_candidates,
)


@pytest.fixture(autouse=True)
def _clear_shadow_flag(monkeypatch):
    monkeypatch.delenv("DISPATCH_RANKING_SHADOW", raising=False)


def _base_candidate(**overrides):
    row = {
        "driver_id": "driver-a",
        "distance_km": 2.0,
        "duration_min": 8,
        "rating": 4.0,
        "freshness_sec": 30,
        "vehicle_match": True,
    }
    row.update(overrides)
    return row


def test_flag_defaults_off():
    assert dispatch_ranking_shadow_enabled() is False
    os.environ["DISPATCH_RANKING_SHADOW"] = "1"
    assert dispatch_ranking_shadow_enabled() is True


def test_lower_eta_ranks_higher_when_other_fields_equal():
    candidates = [
        _base_candidate(driver_id="slow", duration_min=12, current_rank=1),
        _base_candidate(driver_id="fast", duration_min=4, current_rank=2),
    ]
    ranked = rank_candidates_by_shadow_score(candidates, mode="normal", max_eta_min=15)
    assert ranked[0]["driver_id"] == "fast"
    assert ranked[0]["shadow_rank"] == 1
    assert ranked[1]["driver_id"] == "slow"
    assert ranked[1]["shadow_rank"] == 2


def test_lower_distance_improves_rank():
    candidates = [
        _base_candidate(driver_id="far", distance_km=8.0, current_rank=1),
        _base_candidate(driver_id="near", distance_km=1.0, current_rank=2),
    ]
    ranked = rank_candidates_by_shadow_score(
        candidates,
        mode="normal",
        max_eta_min=10,
        distance_cap_km=10,
    )
    assert ranked[0]["driver_id"] == "near"


def test_fresh_gps_ranks_above_stale():
    candidates = [
        _base_candidate(driver_id="stale", freshness_sec=110, current_rank=1),
        _base_candidate(driver_id="fresh", freshness_sec=10, current_rank=2),
    ]
    ranked = rank_candidates_by_shadow_score(candidates, mode="normal", max_eta_min=10)
    assert ranked[0]["driver_id"] == "fresh"


def test_rating_helps_but_does_not_dominate_eta():
    candidates = [
        _base_candidate(driver_id="fast-low-rating", duration_min=3, rating=3.0, current_rank=2),
        _base_candidate(driver_id="slow-high-rating", duration_min=14, rating=5.0, current_rank=1),
    ]
    ranked = rank_candidates_by_shadow_score(candidates, mode="normal", max_eta_min=15)
    assert ranked[0]["driver_id"] == "fast-low-rating"


def test_missing_rating_defaults_neutral():
    comp = compute_shadow_score_components(
        _base_candidate(rating=None),
        mode="normal",
        max_eta_min=10,
    )
    assert comp["rating_score"] == 0.5


def test_missing_freshness_defaults_neutral():
    comp = compute_shadow_score_components(
        _base_candidate(freshness_sec=None),
        mode="normal",
        max_eta_min=10,
    )
    assert comp["freshness_score"] == 0.5
    assert normalize_freshness_score(None, max_age_sec=120) == 0.5


def test_input_list_not_mutated():
    candidates = [
        _base_candidate(driver_id="a", current_rank=1),
        _base_candidate(driver_id="b", current_rank=2),
    ]
    before = snapshot_candidates(candidates)
    rank_candidates_by_shadow_score(candidates, mode="quick_match", max_eta_min=10)
    assert candidates == before
    analyze_dispatch_ranking_shadow(candidates, mode="normal", max_eta_min=10)
    assert candidates == before


def test_normal_and_quick_match_use_different_weights():
    normal_w = shadow_weights_for_mode("normal")
    qm_w = shadow_weights_for_mode("quick_match")
    assert normal_w["eta_score"] == 0.40
    assert qm_w["eta_score"] == 0.50
    assert normal_w["distance_score"] == 0.30
    assert qm_w["distance_score"] == 0.20

    candidate = _base_candidate(driver_id="x", duration_min=6, distance_km=3.0)
    normal = compute_shadow_score_components(candidate, mode="normal", max_eta_min=10)
    qm = compute_shadow_score_components(candidate, mode="quick_match", max_eta_min=10)
    assert normal["final_shadow_score"] != qm["final_shadow_score"]


def test_promote_demote_and_rank_delta():
    candidates = [
        _base_candidate(driver_id="prod-first", duration_min=10, current_rank=1),
        _base_candidate(driver_id="shadow-first", duration_min=3, current_rank=2),
    ]
    ranked = rank_candidates_by_shadow_score(candidates, mode="normal", max_eta_min=12)
    by_id = {r["driver_id"]: r for r in ranked}

    assert by_id["shadow-first"]["shadow_rank"] == 1
    assert by_id["shadow-first"]["current_rank"] == 2
    assert by_id["shadow-first"]["rank_delta"] == -1
    assert by_id["shadow-first"]["would_promote"] is True
    assert by_id["shadow-first"]["would_demote"] is False

    assert by_id["prod-first"]["shadow_rank"] == 2
    assert by_id["prod-first"]["rank_delta"] == 1
    assert by_id["prod-first"]["would_promote"] is False
    assert by_id["prod-first"]["would_demote"] is True


def test_stable_tie_break_by_driver_id():
    candidates = [
        _base_candidate(driver_id="z-driver", duration_min=5, current_rank=1),
        _base_candidate(driver_id="a-driver", duration_min=5, current_rank=2),
    ]
    ranked = rank_candidates_by_shadow_score(candidates, mode="normal", max_eta_min=10)
    assert ranked[0]["driver_id"] == "a-driver"
    assert ranked[1]["driver_id"] == "z-driver"


def test_behavioral_scores_remain_null():
    ranked = rank_candidates_by_shadow_score(
        [_base_candidate()],
        mode="normal",
        max_eta_min=10,
    )
    row = ranked[0]
    assert row["acceptance_score"] is None
    assert row["response_score"] is None
    assert row["fairness_score"] is None


def test_log_payload_shape():
    ranked = rank_candidates_by_shadow_score(
        [_base_candidate(driver_id="d1", current_rank=1)],
        mode="quick_match",
        max_eta_min=10,
    )
    payload = build_dispatch_ranking_shadow_log_payload(
        ranked[0],
        mode="quick_match",
        request_id="req-1",
        tag_id="tag-1",
        eligible_count=1,
    )
    assert payload["mode"] == "quick_match"
    assert payload["request_id"] == "req-1"
    assert payload["tag_id"] == "tag-1"
    assert payload["would_promote"] in (True, False)
    assert payload["acceptance_score"] is None


def test_analyze_attaches_log_payload_without_mutation():
    candidates = [_base_candidate(driver_id="d1")]
    snap = deepcopy(candidates)
    analyzed = analyze_dispatch_ranking_shadow(candidates, mode="normal", max_eta_min=10)
    assert candidates == snap
    assert "log_payload" in analyzed[0]
    assert analyzed[0]["log_payload"]["mode"] == "normal"
