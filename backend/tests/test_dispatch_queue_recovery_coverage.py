"""
RC-PATCH-6B-2 — dispatch_queue insert on broadcast + emit_existing paths.

Run: py -3 -m pytest backend/tests/test_dispatch_queue_recovery_coverage.py -v
"""
from __future__ import annotations

import asyncio
import os
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

TAG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
DRIVER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
DELIVERY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"


@pytest.fixture
def server_module():
    import server as srv

    return srv


def test_broadcast_inserts_queue_after_successful_emit(server_module):
    insert_mock = AsyncMock(return_value=True)
    emit_ok = server_module.OfferEmitResult(True, delivery_id=DELIVERY_ID)

    async def _run():
        mock_sb = MagicMock()
        users_chain = MagicMock()
        users_chain.select.return_value = users_chain
        users_chain.eq.return_value = users_chain
        users_chain.execute.return_value = SimpleNamespace(
            data=[
                {
                    "id": DRIVER_ID,
                    "latitude": 41.0,
                    "longitude": 29.0,
                    "driver_details": {},
                }
            ]
        )
        mock_sb.table.return_value = users_chain

        with (
            patch.object(server_module, "supabase", mock_sb),
            patch.object(server_module, "_dispatch_leader_guard_skip", return_value=(False, "")),
            patch.object(
                server_module,
                "emit_new_passenger_offer_to_driver",
                AsyncMock(return_value=emit_ok),
            ),
            patch.object(
                server_module,
                "is_driver_eligible_for_dispatch_offer",
                AsyncMock(return_value=True),
            ),
            patch.object(server_module, "_dispatch_queue_insert_after_emit", insert_mock),
            patch.object(
                server_module,
                "get_real_route_meta_batch_origins_to_dest",
                AsyncMock(return_value={DRIVER_ID: {"distance_km": 1.0, "duration_min": 2}}),
            ),
            patch.object(server_module, "_apply_driver_active_until_filter", side_effect=lambda q, _now: q),
        ):
            tag_data = {
                "pickup_lat": 41.01,
                "pickup_lng": 29.01,
                "passenger_preferred_vehicle": "car",
                "passenger_id": "p1",
                "passenger_name": "Yolcu",
                "final_price": 100,
            }
            return await server_module.broadcast_offer_to_all(TAG_ID, tag_data)

    sent = asyncio.run(_run())
    assert sent == 1
    insert_mock.assert_awaited_once()
    kwargs = insert_mock.await_args.kwargs
    assert kwargs["is_rolling_batch"] is False
    assert insert_mock.await_args.args[2] == 1
    assert insert_mock.await_args.kwargs["delivery_id"] == DELIVERY_ID


def test_broadcast_skips_queue_on_failed_emit(server_module):
    insert_mock = AsyncMock(return_value=True)
    emit_fail = server_module.OfferEmitResult(False)

    async def _run():
        mock_sb = MagicMock()
        users_chain = MagicMock()
        users_chain.select.return_value = users_chain
        users_chain.eq.return_value = users_chain
        users_chain.execute.return_value = SimpleNamespace(
            data=[
                {
                    "id": DRIVER_ID,
                    "latitude": 41.0,
                    "longitude": 29.0,
                    "driver_details": {},
                }
            ]
        )
        mock_sb.table.return_value = users_chain

        with (
            patch.object(server_module, "supabase", mock_sb),
            patch.object(server_module, "_dispatch_leader_guard_skip", return_value=(False, "")),
            patch.object(
                server_module,
                "emit_new_passenger_offer_to_driver",
                AsyncMock(return_value=emit_fail),
            ),
            patch.object(
                server_module,
                "is_driver_eligible_for_dispatch_offer",
                AsyncMock(return_value=True),
            ),
            patch.object(server_module, "_dispatch_queue_insert_after_emit", insert_mock),
            patch.object(
                server_module,
                "get_real_route_meta_batch_origins_to_dest",
                AsyncMock(return_value={DRIVER_ID: {"distance_km": 1.0, "duration_min": 2}}),
            ),
            patch.object(server_module, "_apply_driver_active_until_filter", side_effect=lambda q, _now: q),
        ):
            tag_data = {
                "pickup_lat": 41.01,
                "pickup_lng": 29.01,
                "passenger_preferred_vehicle": "car",
                "passenger_id": "p1",
            }
            return await server_module.broadcast_offer_to_all(TAG_ID, tag_data)

    sent = asyncio.run(_run())
    assert sent == 0
    insert_mock.assert_not_awaited()


def test_emit_existing_inserts_queue_only_on_success(server_module):
    insert_mock = AsyncMock(return_value=True)
    emit_ok = server_module.OfferEmitResult(True, delivery_id=DELIVERY_ID)
    tag_row = {
        "id": TAG_ID,
        "passenger_id": "p1",
        "passenger_name": "Yolcu",
        "pickup_lat": 41.01,
        "pickup_lng": 29.01,
        "dropoff_lat": 41.02,
        "dropoff_lng": 29.02,
        "pickup_location": "A",
        "dropoff_location": "B",
        "final_price": 50,
        "distance_km": 3,
        "estimated_minutes": 10,
        "passenger_preferred_vehicle": "car",
        "passenger_payment_method": "cash",
    }

    async def _run():
        mock_sb = MagicMock()
        tags_chain = MagicMock()
        tags_chain.select.return_value = tags_chain
        tags_chain.eq.return_value = tags_chain
        tags_chain.execute.return_value = SimpleNamespace(data=[tag_row])

        users_chain = MagicMock()
        users_chain.select.return_value = users_chain
        users_chain.eq.return_value = users_chain
        users_chain.limit.return_value = users_chain
        users_chain.execute.return_value = SimpleNamespace(
            data=[{"id": DRIVER_ID, "latitude": 41.0, "longitude": 29.0, "driver_details": {}}]
        )

        def table_router(name):
            if name == "tags":
                return tags_chain
            if name == "users":
                return users_chain
            return MagicMock()

        mock_sb.table.side_effect = table_router

        with (
            patch.object(server_module, "supabase", mock_sb),
            patch.object(server_module, "resolve_user_id", AsyncMock(return_value=DRIVER_ID)),
            patch.object(
                server_module,
                "is_driver_eligible_for_dispatch_offer",
                AsyncMock(return_value=True),
            ),
            patch.object(server_module, "_driver_is_allowed_for_trip_vehicle", return_value=True),
            patch.object(
                server_module,
                "emit_new_passenger_offer_to_driver",
                AsyncMock(return_value=emit_ok),
            ),
            patch.object(server_module, "_dispatch_queue_insert_after_emit", insert_mock),
            patch.object(server_module, "get_dispatch_config", AsyncMock(return_value={"driver_offer_timeout": 10})),
            patch.object(
                server_module,
                "get_real_route_meta_batch",
                AsyncMock(return_value={TAG_ID: {"distance_km": 1.0, "duration_min": 2}}),
            ),
        ):
            await server_module.emit_existing_waiting_offers_to_driver(DRIVER_ID)

    asyncio.run(_run())
    insert_mock.assert_awaited_once_with(
        TAG_ID,
        DRIVER_ID,
        1,
        delivery_id=DELIVERY_ID,
    )


def test_dispatch_queue_insert_duplicate_returns_false(server_module):
    dup_err = Exception('duplicate key value violates unique constraint "dispatch_queue_tag_id_driver_id_key"')

    insert_chain = MagicMock()
    insert_chain.execute.side_effect = dup_err
    table_mock = MagicMock()
    table_mock.insert.return_value = insert_chain

    with patch.object(server_module, "supabase") as mock_sb:
        mock_sb.table.return_value = table_mock
        ok = asyncio.run(
            server_module._dispatch_queue_insert_after_emit(
                TAG_ID,
                DRIVER_ID,
                1,
                delivery_id=DELIVERY_ID,
            )
        )

    assert ok is False


def test_handle_dispatch_accept_updates_queue_rows(server_module):
    update_chain = MagicMock()
    update_chain.eq.return_value = update_chain
    update_chain.in_.return_value = update_chain
    update_chain.neq.return_value = update_chain
    update_chain.execute.return_value = SimpleNamespace(data=[])

    with (
        patch.object(server_module, "supabase") as mock_sb,
        patch.object(server_module, "dispatch_queues", {}),
        patch.object(server_module, "dispatch_tag_context", {}),
        patch.object(server_module, "active_dispatch_tasks", {}),
    ):
        mock_sb.table.return_value.update.return_value = update_chain
        asyncio.run(server_module.handle_dispatch_accept(TAG_ID, DRIVER_ID))

    assert update_chain.eq.call_count >= 2


def test_revoke_dispatch_offers_reads_sent_rows(server_module):
    select_chain = MagicMock()
    select_chain.eq.return_value = select_chain
    select_chain.execute.return_value = SimpleNamespace(
        data=[{"driver_id": DRIVER_ID}]
    )

    with (
        patch.object(server_module, "_dispatch_db_backed_revoke_enabled", return_value=True),
        patch.object(server_module, "supabase") as mock_sb,
        patch.object(server_module, "emit_passenger_offer_revoked", AsyncMock()),
    ):
        mock_sb.table.return_value.select.return_value = select_chain
        result = asyncio.run(
            server_module.revoke_dispatch_offers_for_tag_from_db(TAG_ID, reason="cancelled")
        )

    assert result["drivers_found"] == 1
    assert result["emits_ok"] == 1
