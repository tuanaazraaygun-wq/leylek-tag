"""
Sprint 5E-6D — Quick Match dispatch ranking shadow logging tests.

Run: py -3 -m pytest backend/tests/test_quick_match_shadow_logging.py -v
"""
from __future__ import annotations

import json
import os
import sys
import asyncio
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


@pytest.fixture
def qm_module():
    import services.quick_match as qm

    return qm


def _eligible(driver_id: str, *, duration_min: int, distance_km: float) -> dict:
    return {
        "driver_id": driver_id,
        "driver_name": "Driver",
        "distance_km": distance_km,
        "duration_min": duration_min,
        "rating": 4.0,
    }


def _request_row(request_id: str = "req-11111111-1111-1111-1111-111111111111") -> dict:
    return {
        "id": request_id,
        "passenger_id": "pass-22222222-2222-2222-2222-222222222222",
        "pickup_lat": 41.0,
        "pickup_lng": 29.0,
        "vehicle_preference": "car",
        "attempt_count": 0,
    }


def test_flag_off_does_not_call_analyze(qm_module, monkeypatch):
    monkeypatch.delenv("DISPATCH_RANKING_SHADOW", raising=False)
    eligible = [_eligible("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", duration_min=5, distance_km=1.0)]
    with patch.object(qm_module, "analyze_dispatch_ranking_shadow") as analyze_mock:
        qm_module._quick_match_dispatch_ranking_shadow_log(
            eligible=eligible,
            request_id="req-1",
            max_eta_min=10,
        )
        analyze_mock.assert_not_called()


def test_flag_on_calls_analyze(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [_eligible("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", duration_min=5, distance_km=1.0)]
    with patch.object(qm_module, "analyze_dispatch_ranking_shadow", return_value=[]) as analyze_mock:
        with patch.object(qm_module.logger, "info"):
            qm_module._quick_match_dispatch_ranking_shadow_log(
                eligible=eligible,
                request_id="req-1",
                max_eta_min=10,
            )
            analyze_mock.assert_called_once()


def test_eta_ordering_unchanged(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [
        _eligible("slow", duration_min=12, distance_km=2.0),
        _eligible("fast", duration_min=3, distance_km=1.0),
    ]
    eligible.sort(key=lambda x: (x["duration_min"], x["distance_km"]))
    before = deepcopy(eligible)
    with patch.object(qm_module.logger, "info"):
        qm_module._quick_match_dispatch_ranking_shadow_log(
            eligible=eligible,
            request_id="req-order",
            max_eta_min=15,
        )
    assert eligible == before
    assert [e["driver_id"] for e in eligible] == ["fast", "slow"]


def test_first_invited_driver_unchanged_with_flag_on(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [
        _eligible("first-pick", duration_min=4, distance_km=1.0),
        _eligible("second", duration_min=8, distance_km=2.0),
    ]

    async def _find_fn(*_args, **_kwargs):
        return list(eligible)

    def _busy_fn(_driver_id: str) -> bool:
        return False

    async def _run_pick():
        with patch.object(qm_module.logger, "info"):
            return await qm_module._quick_match_pick_next_driver(
                _request_row(),
                attempted_driver_ids=[],
                find_eligible_drivers_fn=_find_fn,
                driver_busy_fn=_busy_fn,
            )

    candidate_on, _ = asyncio.run(_run_pick())
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "0")
    candidate_off, _ = asyncio.run(_run_pick())
    assert candidate_off["driver_id"] == "first-pick"
    assert candidate_on["driver_id"] == "first-pick"


def test_top10_cap_respected(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [
        _eligible(f"{i:08d}-0000-0000-0000-000000000000", duration_min=i + 1, distance_km=float(i))
        for i in range(15)
    ]
    log_calls = 0

    def _capture_info(msg, *args):
        nonlocal log_calls
        if msg == "[dispatch_ranking_shadow] %s":
            log_calls += 1

    with patch.object(qm_module.logger, "info", side_effect=_capture_info):
        qm_module._quick_match_dispatch_ranking_shadow_log(
            eligible=eligible,
            request_id="req-top10",
            max_eta_min=20,
        )
    assert log_calls == 10


def test_empty_eligible_list_safe(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    with patch.object(qm_module, "analyze_dispatch_ranking_shadow") as analyze_mock:
        qm_module._quick_match_dispatch_ranking_shadow_log(
            eligible=[],
            request_id="req-empty",
            max_eta_min=10,
        )
        analyze_mock.assert_not_called()


def test_single_eligible_safe(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    did = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    eligible = [_eligible(did, duration_min=6, distance_km=1.5)]
    payloads: list[dict] = []

    def _capture_info(msg, *args):
        if msg == "[dispatch_ranking_shadow] %s" and args:
            payloads.append(json.loads(args[0]))

    with patch.object(qm_module.logger, "info", side_effect=_capture_info):
        qm_module._quick_match_dispatch_ranking_shadow_log(
            eligible=eligible,
            request_id="req-one",
            max_eta_min=10,
        )

    assert len(payloads) == 1
    assert payloads[0]["current_rank"] == 1
    assert payloads[0]["shadow_rank"] == 1
    assert payloads[0]["mode"] == "quick_match"
    assert payloads[0]["max_eta"] == 10


def test_candidate_list_not_mutated(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [
        _eligible("a", duration_min=5, distance_km=1.0),
        _eligible("b", duration_min=7, distance_km=2.0),
    ]
    before = deepcopy(eligible)
    with patch.object(qm_module.logger, "info"):
        qm_module._quick_match_dispatch_ranking_shadow_log(
            eligible=eligible,
            request_id="req-mut",
            max_eta_min=10,
        )
    assert eligible == before


def test_shadow_ranks_valid(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    d_fast = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    d_slow = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    eligible = [
        _eligible(d_slow, duration_min=12, distance_km=5.0),
        _eligible(d_fast, duration_min=3, distance_km=2.0),
    ]
    payloads: list[dict] = []

    def _capture_info(msg, *args):
        if msg == "[dispatch_ranking_shadow] %s" and args:
            payloads.append(json.loads(args[0]))

    with patch.object(qm_module.logger, "info", side_effect=_capture_info):
        qm_module._quick_match_dispatch_ranking_shadow_log(
            eligible=eligible,
            request_id="req-ranks",
            max_eta_min=15,
        )

    assert len(payloads) == 2
    by_driver = {p["driver_id"]: p for p in payloads}
    assert by_driver[qm_module._qm_funnel_id(d_fast)]["shadow_rank"] == 1
    assert by_driver[qm_module._qm_funnel_id(d_slow)]["shadow_rank"] == 2
    assert by_driver[qm_module._qm_funnel_id(d_fast)]["would_promote"] is True
    assert by_driver[qm_module._qm_funnel_id(d_slow)]["would_demote"] is True


def test_pick_loop_order_unchanged(qm_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    order = ["d1", "d2", "d3"]
    eligible = [_eligible(d, duration_min=i + 1, distance_km=float(i)) for i, d in enumerate(order)]

    async def _find_fn(*_args, **_kwargs):
        return list(eligible)

    visited: list[str] = []

    def _busy_fn(driver_id: str) -> bool:
        visited.append(driver_id)
        return driver_id != "d1"

    async def _run_pick():
        with patch.object(qm_module.logger, "info"):
            return await qm_module._quick_match_pick_next_driver(
                _request_row(),
                attempted_driver_ids=[],
                find_eligible_drivers_fn=_find_fn,
                driver_busy_fn=_busy_fn,
            )

    candidate, reason = asyncio.run(_run_pick())
    assert visited == ["d1"]
    assert candidate["driver_id"] == "d1"
    assert reason == "selected"
