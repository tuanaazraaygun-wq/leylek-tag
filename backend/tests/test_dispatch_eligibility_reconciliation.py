"""
RC-PATCH-6B-3A — shared dispatch emit row gate + find alignment.

Run: py -3 -m pytest backend/tests/test_dispatch_eligibility_reconciliation.py -v
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

DRIVER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
TAG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
NOW_ISO = datetime.now(timezone.utc).isoformat()


@pytest.fixture
def server_module():
    import server as srv

    return srv


def _driver_row(**overrides):
    base = {
        "id": DRIVER_ID,
        "driver_online": True,
        "driver_active_until": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "latitude": 41.0,
        "longitude": 29.0,
        "is_active": True,
        "is_deleted": False,
        "deleted_at": None,
        "is_banned": False,
    }
    base.update(overrides)
    return base


def test_gate_rejects_offline_driver(server_module):
    ok, reason = server_module._driver_row_dispatch_emit_gate(
        _driver_row(driver_online=False),
        NOW_ISO,
    )
    assert ok is False
    assert reason == "driver_offline"


def test_gate_rejects_missing_lat_lng(server_module):
    ok, reason = server_module._driver_row_dispatch_emit_gate(
        _driver_row(latitude=None, longitude=29.0),
        NOW_ISO,
    )
    assert ok is False
    assert reason == "missing_lat_lng"


def test_gate_rejects_banned_account(server_module):
    ok, reason = server_module._driver_row_dispatch_emit_gate(
        _driver_row(is_banned=True),
        NOW_ISO,
    )
    assert ok is False
    assert reason == "account_ineligible"


def test_find_excludes_gate_failing_row(server_module):
    online_row = _driver_row(driver_online=False, name="Off", rating=4.0, driver_details={})
    eligible_row = _driver_row(name="On", rating=4.5, driver_details={})

    async def _run():
        with (
            patch.object(
                server_module,
                "_fetch_online_users_for_dispatch_with_geo_canary",
                return_value=[online_row, eligible_row],
            ),
            patch.object(
                server_module,
                "get_real_route_meta_batch_origins_to_dest",
                AsyncMock(
                    return_value={
                        str(eligible_row["id"]).lower(): {
                            "distance_km": 1.0,
                            "duration_min": 2,
                        }
                    }
                ),
            ),
            patch.object(server_module, "_match_bbox_prefilter_deg", return_value=True),
            patch.object(server_module, "_driver_is_allowed_for_trip_vehicle", return_value=True),
        ):
            return await server_module.find_eligible_drivers(
                41.01,
                29.01,
                passenger_vehicle_kind="car",
                tag_id=TAG_ID,
            )

    result = asyncio.run(_run())
    assert len(result) == 1
    assert result[0]["driver_id"] == str(eligible_row["id"]).lower()


def test_emit_still_re_fetches_and_can_fail_after_find(server_module):
    row_pass = _driver_row()

    async def _run():
        with (
            patch.object(server_module, "supabase", MagicMock()),
            patch.object(server_module, "resolve_user_id", AsyncMock(return_value=DRIVER_ID)),
            patch.object(
                server_module,
                "_fetch_user_row_for_dispatch_offer",
                side_effect=[row_pass, _driver_row(driver_online=False)],
            ),
        ):
            gate_find_ok, _ = server_module._driver_row_dispatch_emit_gate(row_pass, NOW_ISO)
            first = await server_module.is_driver_eligible_for_dispatch_offer(DRIVER_ID)
            second = await server_module.is_driver_eligible_for_dispatch_offer(DRIVER_ID)
            return gate_find_ok, first, second

    gate_find_ok, first, second = asyncio.run(_run())
    assert gate_find_ok is True
    assert first is True
    assert second is False


def test_rolling_inserts_queue_only_after_successful_emit(server_module):
    """Regression: queue insert remains gated on emit_res (6B-2 invariant)."""
    insert_mock = AsyncMock(return_value=True)
    emit_ok = server_module.OfferEmitResult(True, delivery_id="delivery-1")

    async def _run():
        with (
            patch.object(
                server_module,
                "_check_driver_dispatch_emit_eligibility",
                AsyncMock(return_value=(True, "")),
            ),
            patch.object(
                server_module,
                "emit_new_passenger_offer_to_driver",
                AsyncMock(return_value=emit_ok),
            ),
            patch.object(server_module, "_dispatch_queue_insert_after_emit", insert_mock),
        ):
            emit_res = await server_module.emit_new_passenger_offer_to_driver(DRIVER_ID, {"tag_id": TAG_ID})
            if emit_res:
                await server_module._dispatch_queue_insert_after_emit(
                    TAG_ID,
                    DRIVER_ID,
                    1,
                    delivery_id=emit_res.delivery_id,
                )
            return emit_res

    asyncio.run(_run())
    insert_mock.assert_awaited_once()
