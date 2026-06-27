"""
Sprint 5E-6C — Normal Match dispatch ranking shadow logging tests.

Run: py -3 -m pytest backend/tests/test_dispatch_ranking_shadow_logging.py -v
"""
from __future__ import annotations

import json
import os
import sys
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
def server_module():
    import server as srv

    return srv


def _eligible_row(driver_id: str, *, distance_km: float, duration_min: int, rank: int | None = None):
    row = {
        "driver_id": driver_id,
        "driver_name": "Driver",
        "distance_km": distance_km,
        "duration_min": duration_min,
        "rating": 4.0,
    }
    if rank is not None:
        row["_rank_hint"] = rank
    return row


def _driver_by_id(*driver_ids: str) -> dict:
    return {
        did: {
            "id": did,
            "rating": 4.0,
            "last_location_update": "2026-06-27T12:00:00+00:00",
        }
        for did in driver_ids
    }


def test_flag_off_does_not_call_analyze(server_module, monkeypatch):
    monkeypatch.delenv("DISPATCH_RANKING_SHADOW", raising=False)
    eligible = [_eligible_row("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", distance_km=1.0, duration_min=5)]
    with patch.object(
        server_module,
        "analyze_dispatch_ranking_shadow",
    ) as analyze_mock:
        server_module._normal_match_dispatch_ranking_shadow_log(
            eligible_drivers=eligible,
            driver_by_id=_driver_by_id(eligible[0]["driver_id"]),
            tag_id="tag-1",
            radius_km=10.0,
            vehicle_filter=True,
        )
        analyze_mock.assert_not_called()


def test_flag_on_calls_analyze(server_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [_eligible_row("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", distance_km=1.0, duration_min=5)]
    with patch.object(
        server_module,
        "analyze_dispatch_ranking_shadow",
        return_value=[
            {
                "driver_id": eligible[0]["driver_id"],
                "current_rank": 1,
                "shadow_rank": 1,
                "rank_delta": 0,
                "would_promote": False,
                "would_demote": False,
                "log_payload": {"mode": "normal"},
            }
        ],
    ) as analyze_mock:
        with patch.object(server_module.logger, "info") as log_info:
            server_module._normal_match_dispatch_ranking_shadow_log(
                eligible_drivers=eligible,
                driver_by_id=_driver_by_id(eligible[0]["driver_id"]),
                tag_id="tag-1",
                radius_km=10.0,
                vehicle_filter=True,
            )
            analyze_mock.assert_called_once()
            assert log_info.called


def test_dispatch_order_unchanged(server_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [
        _eligible_row("11111111-1111-1111-1111-111111111111", distance_km=2.0, duration_min=8),
        _eligible_row("22222222-2222-2222-2222-222222222222", distance_km=1.0, duration_min=4),
    ]
    before = deepcopy(eligible)
    driver_map = _driver_by_id(eligible[0]["driver_id"], eligible[1]["driver_id"])
    with patch.object(server_module.logger, "info"):
        server_module._normal_match_dispatch_ranking_shadow_log(
            eligible_drivers=eligible,
            driver_by_id=driver_map,
            tag_id="tag-order",
            radius_km=10.0,
            vehicle_filter=True,
        )
    assert eligible == before
    assert [e["driver_id"] for e in eligible] == [b["driver_id"] for b in before]


def test_emitted_ranks_valid(server_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    d_fast = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    d_slow = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    eligible = [
        _eligible_row(d_slow, distance_km=5.0, duration_min=12),
        _eligible_row(d_fast, distance_km=2.0, duration_min=3),
    ]
    payloads: list[dict] = []

    def _capture_info(msg, *args):
        if msg == "[dispatch_ranking_shadow] %s" and args:
            payloads.append(json.loads(args[0]))

    with patch.object(server_module.logger, "info", side_effect=_capture_info):
        server_module._normal_match_dispatch_ranking_shadow_log(
            eligible_drivers=eligible,
            driver_by_id=_driver_by_id(d_fast, d_slow),
            tag_id="tag-ranks",
            radius_km=10.0,
            vehicle_filter=True,
        )

    assert len(payloads) == 2
    by_raw = {p["driver_id"]: p for p in payloads}
    assert all("current_rank" in p and "shadow_rank" in p for p in payloads)
    fast_masked = server_module._mask_log_id(d_fast)
    slow_masked = server_module._mask_log_id(d_slow)
    assert by_raw[fast_masked]["shadow_rank"] == 1
    assert by_raw[slow_masked]["shadow_rank"] == 2
    assert by_raw[fast_masked]["would_promote"] is True
    assert by_raw[slow_masked]["would_demote"] is True


def test_top10_cap_respected(server_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    eligible = [
        _eligible_row(f"{i:08d}-0000-0000-0000-000000000000", distance_km=float(i), duration_min=i + 1)
        for i in range(15)
    ]
    driver_map = {row["driver_id"]: {"id": row["driver_id"]} for row in eligible}
    log_calls = 0

    def _capture_info(msg, *args):
        nonlocal log_calls
        if msg == "[dispatch_ranking_shadow] %s":
            log_calls += 1

    with patch.object(server_module.logger, "info", side_effect=_capture_info):
        server_module._normal_match_dispatch_ranking_shadow_log(
            eligible_drivers=eligible,
            driver_by_id=driver_map,
            tag_id="tag-top10",
            radius_km=10.0,
            vehicle_filter=False,
        )

    assert log_calls == 10


def test_empty_eligible_list_safe(server_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    with patch.object(
        server_module,
        "analyze_dispatch_ranking_shadow",
    ) as analyze_mock:
        server_module._normal_match_dispatch_ranking_shadow_log(
            eligible_drivers=[],
            driver_by_id={},
            tag_id="tag-empty",
            radius_km=10.0,
            vehicle_filter=True,
        )
        analyze_mock.assert_not_called()


def test_single_eligible_safe(server_module, monkeypatch):
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    did = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    eligible = [_eligible_row(did, distance_km=1.5, duration_min=6)]
    payloads: list[dict] = []

    def _capture_info(msg, *args):
        if msg == "[dispatch_ranking_shadow] %s" and args:
            payloads.append(json.loads(args[0]))

    with patch.object(server_module.logger, "info", side_effect=_capture_info):
        server_module._normal_match_dispatch_ranking_shadow_log(
            eligible_drivers=eligible,
            driver_by_id=_driver_by_id(did),
            tag_id="tag-one",
            radius_km=10.0,
            vehicle_filter=True,
        )

    assert len(payloads) == 1
    assert payloads[0]["current_rank"] == 1
    assert payloads[0]["shadow_rank"] == 1
    assert payloads[0]["rank_delta"] == 0
    assert payloads[0]["eligible_count"] == 1
    assert payloads[0]["mode"] == "normal"


def test_find_eligible_sort_unchanged_with_flag_on(server_module, monkeypatch):
    """Production sort key path unchanged: distance asc, rating desc."""
    monkeypatch.setenv("DISPATCH_RANKING_SHADOW", "1")
    rows = [
        {"driver_id": "far", "distance_km": 5.0, "rating": 5.0, "duration_min": 10},
        {"driver_id": "near", "distance_km": 1.0, "rating": 3.5, "duration_min": 4},
    ]
    sorted_rows = sorted(rows, key=lambda x: (x["distance_km"], -x["rating"]))
    assert [r["driver_id"] for r in sorted_rows] == ["near", "far"]

    before_ids = [r["driver_id"] for r in sorted_rows]
    with patch.object(server_module.logger, "info"):
        server_module._normal_match_dispatch_ranking_shadow_log(
            eligible_drivers=sorted_rows,
            driver_by_id={"near": {}, "far": {}},
            tag_id="tag-sort",
            radius_km=10.0,
            vehicle_filter=True,
        )
    after_ids = [r["driver_id"] for r in sorted_rows]
    assert before_ids == after_ids == ["near", "far"]
