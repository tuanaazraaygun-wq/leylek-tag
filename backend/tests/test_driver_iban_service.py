"""
Driver IBAN service — unit tests (no network, no server.py).
Run from repo root: py -3 -m pytest backend/tests/test_driver_iban_service.py -v
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

from services.driver_iban_service import (
    IbanAccountNotFoundError,
    IbanPaymentsDisabledError,
    IbanValidationError,
    PaymentDetailsForbiddenError,
    PaymentDetailsNotAvailableError,
    build_snapshot_fields_for_tag_update,
    create_driver_bank_account,
    get_trip_payment_details_for_passenger,
    is_iban_payments_enabled,
    is_iban_snapshot_on_match_enabled,
    mask_iban_for_log,
    mask_iban_for_list,
    normalize_iban,
    resolve_matched_bank_account_id_for_driver,
    set_default_driver_bank_account,
    validate_account_holder_name,
    validate_iban_format,
)

# Valid TR IBAN (mod-97 check passes)
VALID_TR_IBAN = "TR330006100519786457841326"
VALID_TR_IBAN_SPACED = "TR33 0006 1005 1978 6457 8413 26"
DRIVER_ID = "11111111-1111-1111-1111-111111111111"
PASSENGER_ID = "22222222-2222-2222-2222-222222222222"
ACCOUNT_ID = "33333333-3333-3333-3333-333333333333"
TAG_ID = "44444444-4444-4444-4444-444444444444"


def _mock_execute(data):
    return SimpleNamespace(data=data)


class MockQuery:
    def __init__(self, terminal_data=None, side_effects=None):
        self._terminal_data = terminal_data if terminal_data is not None else []
        self._side_effects = side_effects
        self.ops: list[tuple] = []

    def select(self, *args, **kwargs):
        self.ops.append(("select", args))
        return self

    def eq(self, *args, **kwargs):
        self.ops.append(("eq", args))
        return self

    def neq(self, *args, **kwargs):
        self.ops.append(("neq", args))
        return self

    def is_(self, *args, **kwargs):
        self.ops.append(("is_", args))
        return self

    def order(self, *args, **kwargs):
        self.ops.append(("order", args))
        return self

    def limit(self, *args, **kwargs):
        self.ops.append(("limit", args))
        return self

    def insert(self, payload):
        self.ops.append(("insert", payload))
        return self

    def update(self, payload):
        self.ops.append(("update", payload))
        return self

    def execute(self):
        if self._side_effects:
            item = self._side_effects.pop(0)
            if isinstance(item, Exception):
                raise item
            return _mock_execute(item)
        return _mock_execute(self._terminal_data)

def _mock_supabase(table_map: dict):
    sb = MagicMock()
    shared_effects: dict = {}

    def table(name):
        cfg = table_map.get(name, {})
        if name not in shared_effects and cfg.get("effects") is not None:
            shared_effects[name] = list(cfg["effects"])
        return MockQuery(
            terminal_data=cfg.get("data"),
            side_effects=shared_effects.get(name),
        )

    sb.table = table
    return sb


@pytest.fixture(autouse=True)
def _clear_iban_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("IBAN_PAYMENTS_ENABLED", raising=False)
    monkeypatch.delenv("IBAN_SNAPSHOT_ON_MATCH", raising=False)


def test_normalize_iban_strips_and_uppercases():
    assert normalize_iban(VALID_TR_IBAN_SPACED) == VALID_TR_IBAN
    assert normalize_iban(" tr33-0006-1005-1978-6457-8413-26 ") == VALID_TR_IBAN


def test_validate_iban_format_rejects_short():
    with pytest.raises(IbanValidationError):
        validate_iban_format("TR123")


def test_validate_iban_format_accepts_valid_tr():
    validate_iban_format(VALID_TR_IBAN)


def test_validate_account_holder_name_min_length():
    validate_account_holder_name("Ali Veli")
    with pytest.raises(IbanValidationError):
        validate_account_holder_name("A")


def test_mask_iban_for_log_never_full():
    masked = mask_iban_for_log(VALID_TR_IBAN)
    assert VALID_TR_IBAN not in masked
    assert masked.startswith("TR")
    assert masked.endswith(VALID_TR_IBAN[-4:])


def test_mask_iban_for_list_never_full():
    masked = mask_iban_for_list(VALID_TR_IBAN)
    assert VALID_TR_IBAN not in masked
    assert "****" in masked


def test_is_iban_payments_enabled_env(monkeypatch: pytest.MonkeyPatch):
    assert is_iban_payments_enabled() is False
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    assert is_iban_payments_enabled() is True


def test_is_iban_snapshot_requires_master(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_SNAPSHOT_ON_MATCH", "1")
    assert is_iban_snapshot_on_match_enabled() is False
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    assert is_iban_snapshot_on_match_enabled() is True


def test_resolve_default_account_found(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    monkeypatch.setenv("IBAN_SNAPSHOT_ON_MATCH", "1")
    sb = _mock_supabase(
        {
            "driver_bank_accounts": {
                "data": [{"id": ACCOUNT_ID}],
            }
        }
    )
    assert resolve_matched_bank_account_id_for_driver(sb, DRIVER_ID) == ACCOUNT_ID


def test_resolve_default_account_none(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    monkeypatch.setenv("IBAN_SNAPSHOT_ON_MATCH", "1")
    sb = _mock_supabase({"driver_bank_accounts": {"data": []}})
    assert resolve_matched_bank_account_id_for_driver(sb, DRIVER_ID) is None


def test_build_snapshot_fields_flag_off():
    sb = _mock_supabase({})
    assert build_snapshot_fields_for_tag_update(sb, DRIVER_ID) == {}


def test_build_snapshot_fields_no_account(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    monkeypatch.setenv("IBAN_SNAPSHOT_ON_MATCH", "1")
    sb = _mock_supabase({"driver_bank_accounts": {"data": []}})
    assert build_snapshot_fields_for_tag_update(sb, DRIVER_ID) == {}


def test_build_snapshot_fields_success(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    monkeypatch.setenv("IBAN_SNAPSHOT_ON_MATCH", "1")
    sb = _mock_supabase(
        {"driver_bank_accounts": {"data": [{"id": ACCOUNT_ID}]}}
    )
    assert build_snapshot_fields_for_tag_update(sb, DRIVER_ID) == {
        "matched_bank_account_id": ACCOUNT_ID,
    }


def test_build_snapshot_fields_db_error_fail_open(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    monkeypatch.setenv("IBAN_SNAPSHOT_ON_MATCH", "1")
    sb = _mock_supabase(
        {
            "driver_bank_accounts": {
                "effects": [RuntimeError("db down")],
            }
        }
    )
    assert build_snapshot_fields_for_tag_update(sb, DRIVER_ID) == {}


def test_create_disabled_raises():
    sb = _mock_supabase({})
    with pytest.raises(IbanPaymentsDisabledError):
        create_driver_bank_account(sb, DRIVER_ID, VALID_TR_IBAN, "Ali Veli")


def test_create_success(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    row = {
        "id": ACCOUNT_ID,
        "driver_id": DRIVER_ID,
        "iban": VALID_TR_IBAN,
        "account_holder_name": "Ali Veli",
        "label": "Ana",
        "is_default": True,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "deleted_at": None,
    }
    sb = _mock_supabase(
        {
            "driver_bank_accounts": {
                "effects": [
                    [],
                    [row],
                ]
            }
        }
    )
    out = create_driver_bank_account(
        sb, DRIVER_ID, VALID_TR_IBAN_SPACED, "Ali Veli", label="Ana", is_default=True
    )
    assert out["iban"] == VALID_TR_IBAN
    assert out["id"] == ACCOUNT_ID


def test_set_default_clears_others(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    row = {
        "id": ACCOUNT_ID,
        "driver_id": DRIVER_ID,
        "iban": VALID_TR_IBAN,
        "account_holder_name": "Ali Veli",
        "label": None,
        "is_default": True,
        "created_at": "t",
        "updated_at": "t",
        "deleted_at": None,
    }
    sb = _mock_supabase(
        {
            "driver_bank_accounts": {
                "effects": [
                    [row],
                    [],
                    [row],
                ]
            }
        }
    )
    out = set_default_driver_bank_account(sb, DRIVER_ID, ACCOUNT_ID)
    assert out["is_default"] is True


def test_payment_details_wrong_passenger(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    sb = _mock_supabase(
        {
            "tags": {
                "data": [
                    {
                        "id": TAG_ID,
                        "passenger_id": PASSENGER_ID,
                        "status": "in_progress",
                        "boarding_confirmed_at": "2026-01-01T00:00:00+00:00",
                        "matched_bank_account_id": ACCOUNT_ID,
                    }
                ]
            }
        }
    )
    with pytest.raises(PaymentDetailsForbiddenError):
        get_trip_payment_details_for_passenger(sb, TAG_ID, "99999999-9999-9999-9999-999999999999")


def test_payment_details_no_boarding(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    sb = _mock_supabase(
        {
            "tags": {
                "data": [
                    {
                        "id": TAG_ID,
                        "passenger_id": PASSENGER_ID,
                        "status": "matched",
                        "boarding_confirmed_at": None,
                        "matched_bank_account_id": ACCOUNT_ID,
                    }
                ]
            }
        }
    )
    with pytest.raises(PaymentDetailsForbiddenError):
        get_trip_payment_details_for_passenger(sb, TAG_ID, PASSENGER_ID)


def test_payment_details_no_snapshot(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    sb = _mock_supabase(
        {
            "tags": {
                "data": [
                    {
                        "id": TAG_ID,
                        "passenger_id": PASSENGER_ID,
                        "status": "in_progress",
                        "boarding_confirmed_at": "2026-01-01T00:00:00+00:00",
                        "matched_bank_account_id": None,
                    }
                ]
            }
        }
    )
    with pytest.raises(PaymentDetailsNotAvailableError):
        get_trip_payment_details_for_passenger(sb, TAG_ID, PASSENGER_ID)


def test_payment_details_success(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    sb = _mock_supabase(
        {
            "tags": {
                "data": [
                    {
                        "id": TAG_ID,
                        "passenger_id": PASSENGER_ID,
                        "status": "in_progress",
                        "boarding_confirmed_at": "2026-01-01T00:00:00+00:00",
                        "matched_bank_account_id": ACCOUNT_ID,
                    }
                ]
            },
            "driver_bank_accounts": {
                "data": [
                    {
                        "id": ACCOUNT_ID,
                        "iban": VALID_TR_IBAN,
                        "account_holder_name": "Ali Veli",
                        "label": "Ana",
                        "deleted_at": None,
                    }
                ]
            },
        }
    )
    out = get_trip_payment_details_for_passenger(sb, TAG_ID, PASSENGER_ID)
    assert out["iban"] == VALID_TR_IBAN
    assert out["account_holder_name"] == "Ali Veli"
    assert out["account_id"] == ACCOUNT_ID


def test_list_disabled_raises():
    from services.driver_iban_service import list_driver_bank_accounts

    sb = _mock_supabase({})
    with pytest.raises(IbanPaymentsDisabledError):
        list_driver_bank_accounts(sb, DRIVER_ID)


def test_get_not_found(monkeypatch: pytest.MonkeyPatch):
    from services.driver_iban_service import get_driver_bank_account

    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "1")
    sb = _mock_supabase({"driver_bank_accounts": {"data": []}})
    with pytest.raises(IbanAccountNotFoundError):
        get_driver_bank_account(sb, DRIVER_ID, ACCOUNT_ID)
