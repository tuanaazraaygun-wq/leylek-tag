"""Phase 3E — staging-only KYC queue fixture mode tests (no live DB/secrets)."""
from __future__ import annotations

import json
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

_TEST_TOKEN = "phase3e-test-service-token-not-for-production"
_PRODUCT_URL = "https://ujvploftywsxprlzejgc.supabase.co"


@pytest.fixture()
def gate_mod():
    import services.kyc_queue_fixture_gate as mod

    return mod


@pytest.fixture()
def queue_svc():
    import services.kyc_queue_safe_service as mod

    return mod


@pytest.fixture()
def fixture_mod():
    import fixtures.kyc_queue_safe_fixture as mod

    return mod


@pytest.fixture()
def internal_mod():
    import routes.internal_enterprise_kyc_queue as mod

    return mod


@pytest.fixture()
def admin_mod():
    import routes.admin_kyc_queue_safe as mod

    return mod


def _clear_fixture_env(monkeypatch: pytest.MonkeyPatch) -> None:
    import services.kyc_queue_fixture_gate as gate

    monkeypatch.delenv(gate.APP_ENV_NAME, raising=False)
    monkeypatch.delenv(gate.DATA_MODE_ENV_NAME, raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    for name in (
        "PUSH_ENABLED",
        "SMS_ENABLED",
        "EMAIL_ENABLED",
        "PAYMENTS_ENABLED",
        "IBAN_PAYMENTS_ENABLED",
        "AGORA_ENABLED",
        "NOTIFICATIONS_ENABLED",
    ):
        monkeypatch.delenv(name, raising=False)


def _enable_safe_staging_fixture(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_fixture_env(monkeypatch)
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("LEYLEK_KYC_QUEUE_DATA_MODE", "fixture")
    monkeypatch.setenv("SUPABASE_URL", "https://example-staging.invalid")
    monkeypatch.setenv("PUSH_ENABLED", "0")
    monkeypatch.setenv("SMS_ENABLED", "0")
    monkeypatch.setenv("EMAIL_ENABLED", "0")
    monkeypatch.setenv("PAYMENTS_ENABLED", "0")
    monkeypatch.setenv("IBAN_PAYMENTS_ENABLED", "0")
    monkeypatch.setenv("AGORA_ENABLED", "0")
    monkeypatch.setenv("NOTIFICATIONS_ENABLED", "0")


def test_staging_fixture_allowed(gate_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    assert gate_mod.is_staging_fixture_mode_allowed() is True
    assert gate_mod.fixture_mode_denial_reason() is None


@pytest.mark.parametrize(
    "app_env,mode",
    [
        ("production", "fixture"),
        ("", "fixture"),
        ("development", "fixture"),
        ("Staging", "fixture"),
        ("staging", ""),
        ("staging", "product"),
        ("staging", "Fixture"),
        ("staging", "FIXTURE"),
        ("dev", "fixture"),
    ],
)
def test_fixture_denied_for_bad_env_or_mode(
    gate_mod, monkeypatch: pytest.MonkeyPatch, app_env: str, mode: str
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    if app_env == "":
        monkeypatch.delenv("APP_ENV", raising=False)
    else:
        monkeypatch.setenv("APP_ENV", app_env)
    if mode == "":
        monkeypatch.delenv("LEYLEK_KYC_QUEUE_DATA_MODE", raising=False)
    else:
        monkeypatch.setenv("LEYLEK_KYC_QUEUE_DATA_MODE", mode)
    assert gate_mod.is_staging_fixture_mode_allowed() is False
    if mode == "fixture":
        assert gate_mod.fixture_mode_denial_reason() == "fixture_mode_denied"
    else:
        assert gate_mod.fixture_mode_denial_reason() is None


def test_product_supabase_blocks_fixture(
    gate_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    monkeypatch.setenv("SUPABASE_URL", _PRODUCT_URL)
    assert gate_mod.is_staging_fixture_mode_allowed() is False
    assert (
        gate_mod.fixture_mode_denial_reason() == "fixture_unsafe_product_supabase"
    )


def test_outbound_enabled_blocks_fixture(
    gate_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    monkeypatch.setenv("PUSH_ENABLED", "1")
    assert gate_mod.is_staging_fixture_mode_allowed() is False
    assert gate_mod.fixture_mode_denial_reason() == "fixture_unsafe_outbound_enabled"


def test_fixture_load_no_db_no_network(
    queue_svc, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    calls: list[str] = []

    class Boom:
        def table(self, *_a, **_k):
            calls.append("table")
            raise AssertionError("fixture must not touch DB")

    # Even if a client were passed somehow, fixture loader ignores it.
    payload = queue_svc.load_kyc_queue_safe_payload_from_fixture(limit=50)
    assert payload["success"] is True
    assert payload["source"] == "fixture"
    assert payload["count"] == 3
    assert calls == []
    assert "supabase" not in json.dumps(payload).lower()


def test_fixture_deterministic_and_pii_free(fixture_mod, queue_svc) -> None:
    a = queue_svc.load_kyc_queue_safe_payload_from_fixture(limit=50)
    b = queue_svc.load_kyc_queue_safe_payload_from_fixture(limit=50)
    assert a == b
    assert a["items"][0]["id"] == "fixture-kyc-001"
    assert any(i["city"] is None for i in a["items"])
    blob = json.dumps(a)
    for needle in (
        "phone",
        "plaka",
        "plate",
        "tc",
        "identity_number",
        "document_url",
        "storage_path",
        "bucket",
        "access_token",
        "service_role",
        "http://",
        "https://",
    ):
        assert needle not in blob.lower() or needle in (
            # boolean field name identity_present contains no forbidden tokens above
        )
    # identity_present boolean is OK; identity_number must be absent
    assert "identity_number" not in blob
    assert "identity_present" in blob
    for item in a["items"]:
        assert all(isinstance(v, bool) for v in item["documents"].values())
        assert "phone" not in item
        assert "plate" not in item


def test_fixture_source_file_security_scan(fixture_mod) -> None:
    src = Path(fixture_mod.__file__).read_text(encoding="utf-8").lower()
    assert "identity_present" in src
    for needle in (
        "phone",
        "plaka",
        "plate_number",
        "document_url",
        "storage_path",
        "service_role",
        "access_token",
        "https://",
        "http://",
    ):
        assert needle not in src


def _mount_internal(
    internal_mod,
    monkeypatch: pytest.MonkeyPatch,
    *,
    env_token: str | None = _TEST_TOKEN,
):
    import server as srv
    import services.enterprise_kyc_read_auth as auth

    if env_token is None:
        monkeypatch.delenv(auth.ENTERPRISE_KYC_READ_TOKEN_ENV, raising=False)
    else:
        monkeypatch.setenv(auth.ENTERPRISE_KYC_READ_TOKEN_ENV, env_token)

    # Product path should not be reached in fixture tests; keep a boom client.
    boom = MagicMock()
    boom.table.side_effect = AssertionError("product_db must not be used in fixture mode")
    monkeypatch.setattr(srv, "supabase", boom, raising=False)

    app = FastAPI()
    app.include_router(internal_mod.router, prefix="/api")
    return TestClient(app)


def test_internal_auth_required_even_in_fixture(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    client = _mount_internal(internal_mod, monkeypatch)
    r = client.get("/api/internal/enterprise/kyc/queue-safe")
    assert r.status_code == 401


def test_internal_wrong_token_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    client = _mount_internal(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert r.status_code == 403


def test_internal_correct_token_fixture_200(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    client = _mount_internal(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 200
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.json()
    assert body["success"] is True
    assert body["source"] == "fixture"
    assert body["count"] == 3
    blob = json.dumps(body)
    assert _TEST_TOKEN not in blob
    assert "phone" not in blob
    assert "plate" not in blob
    assert "Ayşe" not in blob
    assert "https://" not in blob


def test_internal_fixture_limit_clamp(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    client = _mount_internal(internal_mod, monkeypatch)
    r1 = client.get(
        "/api/internal/enterprise/kyc/queue-safe?limit=1",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r1.status_code == 200
    assert r1.json()["count"] == 1
    assert r1.json()["items"][0]["id"] == "fixture-kyc-001"

    r2 = client.get(
        "/api/internal/enterprise/kyc/queue-safe?limit=999",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r2.status_code == 200
    assert r2.json()["count"] == 3


def test_internal_production_fixture_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_safe_staging_fixture(monkeypatch)
    monkeypatch.setenv("APP_ENV", "production")
    client = _mount_internal(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 503
    assert r.json()["error"] == "fixture_mode_denied"


def test_admin_route_ignores_fixture_env(
    admin_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Admin queue-safe must keep Product DB path even if staging fixture env is set."""
    _enable_safe_staging_fixture(monkeypatch)
    import server as srv

    class _Exec:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, data):
            self._data = data

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        @property
        def not_(self):
            return self

        def is_(self, *_a, **_k):
            return self

        def execute(self):
            return _Exec(self._data)

    class _Table:
        def __init__(self, auth_data, users_data):
            self._auth = auth_data
            self._users = users_data

        def select(self, *a, **_k):
            cols = a[0] if a else ""
            if "is_admin" in cols:
                return _Query(self._auth)
            return _Query(self._users)

    users = [
        {
            "id": "admin-prod-row",
            "name": "Prod User",
            "driver_details": {
                "kyc_status": "pending",
                "kyc_submitted_at": "2026-07-01T00:00:00+00:00",
                "vehicle_kind": "car",
            },
        }
    ]
    auth_row = [{"id": "admin-1", "is_admin": True}]

    class _SB:
        def table(self, _name):
            return _Table(auth_row, users)

    monkeypatch.setattr(
        srv, "verify_access_token", lambda token: "admin-1" if token == "good" else None
    )
    monkeypatch.setattr(srv, "supabase", _SB())

    app = FastAPI()
    app.include_router(admin_mod.router, prefix="/api")
    client = TestClient(app)
    r = client.get(
        "/api/admin/kyc/queue-safe",
        headers={"Authorization": "Bearer good"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["items"][0]["id"] == "admin-prod-row"
    assert body.get("source") != "fixture"
    assert "fixture-kyc" not in json.dumps(body)


def test_fixture_constants_have_city_null(fixture_mod) -> None:
    assert any(i.get("city") is None for i in fixture_mod.KYC_QUEUE_SAFE_FIXTURE_ITEMS)
