"""
RC-RACE-6A-1 — passenger cancel status guard unit tests (no network).

Run: py -3 -m pytest backend/tests/test_passenger_cancel_status_guard.py -v
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

PASSENGER_CANCELLABLE_STATUSES = ("waiting", "offers_received", "pending")
TAG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
PASSENGER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def _mock_execute(data):
    return SimpleNamespace(data=data)


class _TagsTableMock:
    def __init__(self, parent: "_MockSupabase"):
        self._parent = parent

    def select(self, *_args, **_kwargs):
        self._parent._pending = "select"
        return self

    def update(self, *_args, **_kwargs):
        self._parent._pending = "update"
        return self

    def delete(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self._parent._filters.append((column, value))
        return self

    def in_(self, column, values):
        self._parent._filters.append((f"in:{column}", tuple(values)))
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return self._parent._execute_tags()


class _MockSupabase:
    def __init__(self, tag_status: str, *, update_succeeds: bool):
        self.tag_status = tag_status
        self.update_succeeds = update_succeeds
        self._pending = ""
        self._filters: list[tuple[str, object]] = []
        self._execute_count = 0
        self._tags = _TagsTableMock(self)

    def table(self, name: str):
        if name == "tags":
            return self._tags
        if name == "offers":
            offers_chain = MagicMock()
            offers_chain.eq.return_value = offers_chain
            offers_chain.execute.return_value = _mock_execute([])
            return SimpleNamespace(update=MagicMock(return_value=offers_chain))
        if name == "dispatch_queue":
            dq = MagicMock()
            dq.eq.return_value = dq
            dq.execute.return_value = _mock_execute([])
            return dq
        return MagicMock()

    def _execute_tags(self):
        self._execute_count += 1
        if self._pending == "select" and self._execute_count == 1:
            self._filters = []
            return _mock_execute(
                [
                    {
                        "created_at": (
                            datetime.now(timezone.utc) - timedelta(seconds=30)
                        ).isoformat(),
                        "driver_id": None,
                    }
                ]
            )
        if self._pending == "update":
            status_in = None
            for key, val in self._filters:
                if key == "in:status":
                    status_in = val
            assert status_in == PASSENGER_CANCELLABLE_STATUSES
            self._filters = []
            if self.update_succeeds:
                self.tag_status = "cancelled"
                return _mock_execute([{"id": TAG_ID, "status": "cancelled"}])
            return _mock_execute([])
        if self._pending == "select":
            self._filters = []
            return _mock_execute([{"status": self.tag_status}])
        return _mock_execute([])


@pytest.fixture
def server_module():
    import server as srv

    return srv


def test_cancellable_statuses_align_with_accept_guard(server_module):
    assert server_module.MATCHABLE_TAG_STATUSES_FOR_ACCEPT_LIST == list(
        PASSENGER_CANCELLABLE_STATUSES
    )


def _cancel_patches(server_module, mock_db: _MockSupabase):
    return (
        patch.object(server_module, "supabase", mock_db),
        patch.object(server_module, "resolve_user_id", AsyncMock(return_value=PASSENGER_ID)),
        patch.object(server_module, "invalidate_tag_cache"),
        patch.object(server_module, "revoke_dispatch_offers_for_tag_from_db", AsyncMock()),
        patch.object(server_module, "rolling_dispatch_stop", AsyncMock()),
        patch.object(server_module, "dispatch_queues", {}),
        patch.object(server_module, "dispatch_tag_context", {}),
        patch.object(server_module, "active_dispatch_tasks", {}),
    )


def test_cancel_post_succeeds_from_waiting(server_module):
    mock_db = _MockSupabase("waiting", update_succeeds=True)

    async def _run():
        p = _cancel_patches(server_module, mock_db)
        with p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], patch.object(server_module, "sio") as sio:
            sio.emit = AsyncMock()
            return await server_module.cancel_tag_post(
                request=server_module.CancelTagRequest(tag_id=TAG_ID),
                passenger_id=PASSENGER_ID,
            )

    result = asyncio.run(_run())
    assert result == {"success": True, "message": "TAG iptal edildi"}
    assert mock_db.tag_status == "cancelled"


def test_cancel_post_blocked_when_matched(server_module):
    mock_db = _MockSupabase("matched", update_succeeds=False)

    async def _run():
        p = _cancel_patches(server_module, mock_db)
        with p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], patch.object(server_module, "sio") as sio:
            sio.emit = AsyncMock()
            return await server_module.cancel_tag_post(
                request=server_module.CancelTagRequest(tag_id=TAG_ID),
                passenger_id=PASSENGER_ID,
            ), sio

    result, sio = asyncio.run(_run())
    assert result == {"success": False, "message": "TAG iptal edilemez"}
    assert mock_db.tag_status == "matched"
    sio.emit.assert_not_called()


def test_cancel_delete_idempotent_when_already_cancelled(server_module):
    mock_db = _MockSupabase("cancelled", update_succeeds=False)

    async def _run():
        p = _cancel_patches(server_module, mock_db)
        with p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]:
            return await server_module.cancel_tag_delete(
                tag_id=TAG_ID,
                passenger_id=PASSENGER_ID,
            )

    result = asyncio.run(_run())
    assert result == {"success": True, "message": "TAG iptal edildi"}
