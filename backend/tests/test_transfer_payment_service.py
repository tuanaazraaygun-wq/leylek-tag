"""
Transfer payment service — unit tests (no network, no server.py).
Run: py -3 -m pytest backend/tests/test_transfer_payment_service.py -v
"""
from __future__ import annotations

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from services.transfer_payment_service import (
    TRANSFER_STATUS_AWAITING,
    TRANSFER_STATUS_CONFIRMED,
    TRANSFER_STATUS_DISPUTED,
    TransferPaymentForbiddenError,
    TransferPaymentStateError,
    claim_transfer_payment,
    is_cash_qr_complete_allowed,
    is_iban_transfer_confirm_required,
    respond_transfer_payment,
    should_reject_complete_qr,
)

DRIVER_ID = "11111111-1111-1111-1111-111111111111"
PASSENGER_ID = "22222222-2222-2222-2222-222222222222"
TAG_ID = "44444444-4444-4444-4444-444444444444"
ACCOUNT_ID = "33333333-3333-3333-3333-333333333333"


def _tag_row(**overrides):
    base = {
        "id": TAG_ID,
        "passenger_id": PASSENGER_ID,
        "driver_id": DRIVER_ID,
        "status": "in_progress",
        "boarding_confirmed_at": "2026-01-01T10:00:00+00:00",
        "matched_bank_account_id": ACCOUNT_ID,
        "passenger_payment_method": None,
        "transfer_payment": None,
    }
    base.update(overrides)
    return base


def _mock_execute(data):
    return SimpleNamespace(data=data)


class MockQuery:
    def __init__(self, terminal_data=None):
        self._terminal_data = terminal_data if terminal_data is not None else []
        self.ops: list[tuple] = []

    def select(self, *args, **kwargs):
        self.ops.append(("select", args))
        return self

    def eq(self, *args, **kwargs):
        self.ops.append(("eq", args))
        return self

    def limit(self, *args, **kwargs):
        self.ops.append(("limit", args))
        return self

    def update(self, *args, **kwargs):
        self.ops.append(("update", args))
        return self

    def insert(self, *args, **kwargs):
        self.ops.append(("insert", args))
        return self

    def execute(self):
        return _mock_execute(self._terminal_data)


@pytest.fixture(autouse=True)
def enable_transfer_flags(monkeypatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    monkeypatch.setenv("IBAN_TRANSFER_CONFIRM_REQUIRED", "1")


def test_should_reject_complete_qr_blocks_iban_snapshot():
    msg = should_reject_complete_qr(_tag_row(), None, "cash")
    assert msg == "IBAN/havale yolculuğu sürücü ödeme onayı ile tamamlanır."


def test_should_reject_complete_qr_allows_cash_qr():
    msg = should_reject_complete_qr(
        _tag_row(passenger_payment_method="cash"),
        "cash",
        "cash",
    )
    assert msg is None


def test_should_reject_complete_qr_skips_without_snapshot():
    msg = should_reject_complete_qr(
        _tag_row(matched_bank_account_id=None),
        None,
        None,
    )
    assert msg is None


def test_should_reject_complete_qr_flag_off(monkeypatch):
    monkeypatch.delenv("IBAN_TRANSFER_CONFIRM_REQUIRED", raising=False)
    msg = should_reject_complete_qr(_tag_row(), None, "cash")
    assert msg is None


def test_claim_sets_awaiting_driver():
    row = _tag_row()
    fetch_q = MockQuery([row])
    update_q = MockQuery([])

    class TagsTable:
        def select(self, *a, **k):
            return fetch_q

        def eq(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return fetch_q

        def update(self, *a, **k):
            return update_q

    sb = MagicMock()
    sb.table.side_effect = lambda name: TagsTable() if name == "tags" else MockQuery([])

    out = claim_transfer_payment(sb, TAG_ID, PASSENGER_ID)
    assert out["success"] is True
    assert out["status"] == TRANSFER_STATUS_AWAITING
    assert out.get("idempotent") is False


def test_claim_forbidden_for_driver():
    sb = MagicMock()
    sb.table.side_effect = lambda name: MockQuery([_tag_row()]) if name == "tags" else MockQuery([])

    with pytest.raises(TransferPaymentForbiddenError):
        claim_transfer_payment(sb, TAG_ID, DRIVER_ID)


def test_respond_approved_completes_tag():
    row = _tag_row(
        transfer_payment={
            "status": TRANSFER_STATUS_AWAITING,
            "claimed_at": "2026-01-01T11:00:00+00:00",
        }
    )
    fetch_q = MockQuery([row])
    update_q = MockQuery([])

    class TagsTable:
        def select(self, *a, **k):
            return fetch_q

        def eq(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return fetch_q

        def update(self, *a, **k):
            return update_q

    sb = MagicMock()
    sb.table.side_effect = lambda name: TagsTable() if name == "tags" else MockQuery([])

    out = respond_transfer_payment(sb, TAG_ID, DRIVER_ID, approved=True)
    assert out["approved"] is True
    assert out["status"] == TRANSFER_STATUS_CONFIRMED
    assert out["show_rating"] is True
    assert update_q.ops


def test_respond_dispute_does_not_complete():
    row = _tag_row(
        transfer_payment={
            "status": TRANSFER_STATUS_AWAITING,
            "claimed_at": "2026-01-01T11:00:00+00:00",
        }
    )
    fetch_q = MockQuery([row])
    update_q = MockQuery([])
    reports_q = MockQuery([{"id": "report-1"}])

    class TagsTable:
        def select(self, *a, **k):
            return fetch_q

        def eq(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return fetch_q

        def update(self, *a, **k):
            body = a[0] if a else {}
            assert body.get("status") != "completed"
            return update_q

    sb = MagicMock()
    sb.table.side_effect = lambda name: {
        "tags": TagsTable(),
        "users": MockQuery([{"name": "Ali", "phone": "532", "driver_details": {}}]),
        "reports": reports_q,
    }[name]

    out = respond_transfer_payment(
        sb,
        TAG_ID,
        DRIVER_ID,
        approved=False,
        dispute_note="Ödeme gelmedi",
    )
    assert out["approved"] is False
    assert out["status"] == TRANSFER_STATUS_DISPUTED
    assert out["show_rating"] is False


def test_respond_requires_awaiting():
    sb = MagicMock()
    sb.table.side_effect = lambda name: MockQuery([_tag_row(transfer_payment=None)]) if name == "tags" else MockQuery([])

    with pytest.raises(TransferPaymentStateError):
        respond_transfer_payment(sb, TAG_ID, DRIVER_ID, approved=True)


def test_is_cash_qr_complete_allowed():
    assert is_cash_qr_complete_allowed("cash", "cash") is True
    assert is_cash_qr_complete_allowed("cash", "card") is False
    assert is_cash_qr_complete_allowed(None, "cash") is False


def test_is_iban_transfer_confirm_required():
    assert is_iban_transfer_confirm_required() is True
