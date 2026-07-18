"""Phase D1 — internal Enterprise KYC decision route tests (no live DB/secrets)."""
from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_TEST_DECISION_TOKEN = "phase-d1-test-decision-token-not-for-production"
_TEST_REVIEW_TOKEN = "phase2-test-review-token-not-for-production"
_APP_ID = "11111111-2222-3333-4444-555555555555"
_RECORD_VERSION = "2026-07-14T13:00:00+00:00"
_DECISION_PATH = f"/api/internal/enterprise/kyc/applications/{_APP_ID}/decisions"
_IDEMPOTENCY_KEY = "idem-kyc-decision-test-001"


@pytest.fixture()
def decision_route_mod():
    import routes.internal_enterprise_kyc_decision as mod

    return mod


@pytest.fixture()
def auth_mod():
    import services.enterprise_kyc_read_auth as mod

    return mod


@pytest.fixture(autouse=True)
def _reset_decision_stores() -> None:
    from services.kyc_enterprise_decision_audit import clear_kyc_decision_audit_events
    from services.kyc_enterprise_decision_idempotency import clear_decision_idempotency_ledger

    clear_kyc_decision_audit_events()
    clear_decision_idempotency_ledger()
    yield
    clear_kyc_decision_audit_events()
    clear_decision_idempotency_ledger()


def _sample_row(**dd_overrides: Any) -> dict[str, Any]:
    dd: dict[str, Any] = {
        "kyc_status": "pending",
        "kyc_submitted_at": "2026-07-14T12:00:00+00:00",
        "pending_vehicle_kind": "car",
        "license_photo_url": "https://example.invalid/license.jpg",
        "vehicle_photo_url": "https://example.invalid/vehicle.jpg",
    }
    dd.update(dd_overrides)
    return {
        "id": _APP_ID,
        "name": "Ayşe Yılmaz",
        "push_token": None,
        "updated_at": _RECORD_VERSION,
        "driver_details": dd,
    }


class _DecisionQuery:
    def __init__(self, rows: list[dict[str, Any]]):
        self._rows = copy.deepcopy(rows)
        self._mode: str | None = None
        self._update_payload: dict[str, Any] | None = None
        self.eq_filters: list[tuple[str, str]] = []

    def select(self, *_a, **_k):
        self._mode = "select"
        return self

    def update(self, payload: dict[str, Any]):
        self._mode = "update"
        self._update_payload = payload
        return self

    def eq(self, column: str, value: str):
        self.eq_filters.append((column, str(value)))
        return self

    def limit(self, _n: int):
        return self

    def execute(self):
        if self._mode == "select":
            filtered = self._rows
            for col, val in self.eq_filters:
                if col == "id":
                    filtered = [r for r in filtered if str(r.get("id")).lower() == str(val).lower()]
            return MagicMock(data=copy.deepcopy(filtered))

        if self._mode == "update":
            assert self._update_payload is not None
            id_val = next((v for c, v in self.eq_filters if c == "id"), None)
            version_val = next((v for c, v in self.eq_filters if c == "updated_at"), None)
            for idx, row in enumerate(self._rows):
                if str(row.get("id")).lower() != str(id_val).lower():
                    continue
                if str(row.get("updated_at")) != str(version_val):
                    return MagicMock(data=[])
                updated = copy.deepcopy(row)
                updated.update(self._update_payload)
                self._rows[idx] = updated
                return MagicMock(data=[copy.deepcopy(updated)])
            return MagicMock(data=[])
        return MagicMock(data=[])


class _DecisionTable:
    def __init__(self, rows: list[dict[str, Any]]):
        self._rows = rows
        self.last_query: _DecisionQuery | None = None

    def select(self, *args, **kwargs):
        self.last_query = _DecisionQuery(self._rows)
        return self.last_query.select(*args, **kwargs)

    def update(self, payload: dict[str, Any]):
        self.last_query = _DecisionQuery(self._rows)
        return self.last_query.update(payload)


class _DecisionSB:
    def __init__(self, rows: list[dict[str, Any]] | None = None):
        self._rows = rows if rows is not None else []
        self.last_table: _DecisionTable | None = None

    def table(self, _name: str):
        self.last_table = _DecisionTable(self._rows)
        return self.last_table


def _mount_client(
    decision_route_mod,
    monkeypatch: pytest.MonkeyPatch,
    *,
    decision_token: str | None = _TEST_DECISION_TOKEN,
    rows: list[dict[str, Any]] | None = None,
    supabase_none: bool = False,
):
    import server as srv
    import services.enterprise_kyc_read_auth as auth

    if decision_token is None:
        monkeypatch.delenv(auth.ENTERPRISE_KYC_DECISION_TOKEN_ENV, raising=False)
    else:
        monkeypatch.setenv(auth.ENTERPRISE_KYC_DECISION_TOKEN_ENV, decision_token)

    if supabase_none:
        monkeypatch.setattr(srv, "supabase", None, raising=False)
    else:
        sb = _DecisionSB(rows)
        monkeypatch.setattr(srv, "supabase", sb, raising=False)

    app = FastAPI()
    app.include_router(decision_route_mod.router, prefix="/api")
    return TestClient(app), getattr(srv, "supabase", None)


def _headers(
    *,
    token: str = _TEST_DECISION_TOKEN,
    actor: str = "enterprise-owner-actor",
    idempotency: str = _IDEMPOTENCY_KEY,
) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "X-Karekod-Actor-Id": actor,
        "X-Karekod-Request-Id": "req-decision-001",
        "Idempotency-Key": idempotency,
    }


def _approve_body(record_version: str = _RECORD_VERSION) -> dict[str, Any]:
    return {"decision": "approve", "record_version": record_version}


def _reject_body(record_version: str = _RECORD_VERSION) -> dict[str, Any]:
    return {
        "decision": "reject",
        "record_version": record_version,
        "rejection": {
            "reason_code": "documents_invalid",
            "reason_text": "Belgeler okunamıyor",
        },
    }


def test_approve_success(decision_route_mod, monkeypatch) -> None:
    client, sb = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(_DECISION_PATH, headers=_headers(), json=_approve_body())
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["result"]["decision"] == "approve"
    assert body["result"]["kyc_status"] == "approved"
    assert body["result"]["idempotent_replay"] is False
    assert sb is not None
    assert sb.last_table is not None
    assert sb.last_table.last_query is not None
    assert sb.last_table.last_query._mode == "update"

    from services.kyc_enterprise_decision_audit import list_kyc_decision_audit_events

    events = list_kyc_decision_audit_events()
    assert any(e["event_type"] == "kyc.decision.applied" for e in events)


def test_reject_success(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(_DECISION_PATH, headers=_headers(idempotency="idem-reject-001"), json=_reject_body())
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["result"]["decision"] == "reject"
    assert body["result"]["kyc_status"] == "rejected"


def test_missing_rejection_reason(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(
        _DECISION_PATH,
        headers=_headers(idempotency="idem-missing-reject"),
        json={"decision": "reject", "record_version": _RECORD_VERSION},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "rejection_required"


def test_unauthorized_caller(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(
        _DECISION_PATH,
        headers=_headers(token="wrong-token"),
        json=_approve_body(),
    )
    assert r.status_code == 403


def test_review_token_not_accepted_for_decision(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(
        _DECISION_PATH,
        headers=_headers(token=_TEST_REVIEW_TOKEN),
        json=_approve_body(),
    )
    assert r.status_code == 403


def test_stale_record_version(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(
        _DECISION_PATH,
        headers=_headers(idempotency="idem-stale-version"),
        json=_approve_body(record_version="2026-01-01T00:00:00+00:00"),
    )
    assert r.status_code == 409
    assert r.json()["error"] == "stale_record_version"


def test_duplicate_idempotency_key_replay(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    headers = _headers(idempotency="idem-replay-001")
    first = client.post(_DECISION_PATH, headers=headers, json=_approve_body())
    assert first.status_code == 200

    second = client.post(_DECISION_PATH, headers=headers, json=_approve_body())
    assert second.status_code == 200
    assert second.json()["result"]["idempotent_replay"] is True
    assert second.json()["result"]["decision"] == "approve"


def test_idempotency_conflict_different_payload(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    headers = _headers(idempotency="idem-conflict-001")
    first = client.post(_DECISION_PATH, headers=headers, json=_approve_body())
    assert first.status_code == 200

    second = client.post(
        _DECISION_PATH,
        headers=headers,
        json=_reject_body(),
    )
    assert second.status_code == 409
    assert second.json()["error"] == "idempotency_conflict"


def test_audit_creation_on_success(decision_route_mod, monkeypatch) -> None:
    from services.kyc_enterprise_decision_audit import list_kyc_decision_audit_events

    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(
        _DECISION_PATH,
        headers=_headers(idempotency="idem-audit-001"),
        json=_approve_body(),
    )
    assert r.status_code == 200
    events = list_kyc_decision_audit_events()
    assert len(events) == 1
    assert events[0]["event_type"] == "kyc.decision.applied"
    assert events[0]["actor_id"] == "enterprise-owner-actor"
    assert events[0]["idempotency_key"] == "idem-audit-001"


def test_forbidden_admin_phone_path(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.post(
        f"{_DECISION_PATH}?admin_phone=5326497412",
        headers=_headers(idempotency="idem-admin-phone"),
        json=_approve_body(),
    )
    assert r.status_code == 400
    assert r.json()["error"] == "admin_phone_not_accepted"


def test_missing_idempotency_key(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, rows=[_sample_row()])
    headers = _headers()
    del headers["Idempotency-Key"]
    r = client.post(_DECISION_PATH, headers=headers, json=_approve_body())
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_idempotency_key"


def test_decision_token_env_missing_503(decision_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(decision_route_mod, monkeypatch, decision_token=None, rows=[_sample_row()])
    r = client.post(_DECISION_PATH, headers=_headers(), json=_approve_body())
    assert r.status_code == 503
    assert r.json()["detail"] == "service_auth_disabled"
