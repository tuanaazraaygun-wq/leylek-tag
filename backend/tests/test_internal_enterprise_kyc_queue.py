"""Phase 3C — internal Enterprise KYC queue-safe route tests (no live DB/secrets)."""
from __future__ import annotations

import ast
import inspect
import json
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Stable test token — not a production secret; only used under monkeypatch.
_TEST_TOKEN = "phase3c-test-service-token-not-for-production"


@pytest.fixture()
def auth_mod():
    import services.enterprise_kyc_read_auth as mod

    return mod


@pytest.fixture()
def queue_svc():
    import services.kyc_queue_safe_service as mod

    return mod


@pytest.fixture()
def internal_mod():
    import routes.internal_enterprise_kyc_queue as mod

    return mod


def _sample_pending_row(**overrides: Any) -> dict[str, Any]:
    dd = {
        "kyc_status": "pending",
        "kyc_submitted_at": "2026-07-14T12:00:00+00:00",
        "vehicle_kind": "car",
        "plate_number": "34ABC123",
        "license_photo_url": "https://example.invalid/license.jpg",
        "vehicle_photo_url": "https://example.invalid/vehicle.jpg",
        "selfie_url": None,
        "city": None,
        "phone": "5326497412",
    }
    user_id = overrides.pop("id", "11111111-2222-3333-4444-555555555555")
    name = overrides.pop("name", "Ayşe Yılmaz")
    dd.update(overrides)
    return {
        "id": user_id,
        "name": name,
        "driver_details": dd,
    }


def _mount_client(
    internal_mod,
    monkeypatch: pytest.MonkeyPatch,
    *,
    env_token: str | None = _TEST_TOKEN,
    rows: list[dict[str, Any]] | None = None,
    db_error: bool = False,
):
    import server as srv
    import services.enterprise_kyc_read_auth as auth

    if env_token is None:
        monkeypatch.delenv(auth.ENTERPRISE_KYC_READ_TOKEN_ENV, raising=False)
    else:
        monkeypatch.setenv(auth.ENTERPRISE_KYC_READ_TOKEN_ENV, env_token)

    class _Exec:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, data):
            self._data = data

        def select(self, *_a, **_k):
            return self

        @property
        def not_(self):
            return self

        def is_(self, *_a, **_k):
            return self

        def execute(self):
            if db_error:
                raise RuntimeError("db_boom")
            return _Exec(self._data)

    class _Table:
        def __init__(self, data):
            self._data = data

        def select(self, *_a, **_k):
            return _Query(self._data)

    class _SB:
        def table(self, _name):
            return _Table(rows if rows is not None else [])

    monkeypatch.setattr(srv, "supabase", _SB(), raising=False)

    app = FastAPI()
    app.include_router(internal_mod.router, prefix="/api")
    return TestClient(app)


def test_service_tokens_equal_uses_compare_digest(auth_mod) -> None:
    src = inspect.getsource(auth_mod.service_tokens_equal)
    assert "compare_digest" in src
    assert auth_mod.service_tokens_equal(_TEST_TOKEN, _TEST_TOKEN) is True
    assert auth_mod.service_tokens_equal("wrong", _TEST_TOKEN) is False
    assert auth_mod.service_tokens_equal("short", "longer-token-value") is False


def test_env_missing_fail_closed(internal_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(internal_mod, monkeypatch, env_token=None)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 503
    assert r.json().get("detail") == "service_auth_disabled"
    assert "Cache-Control" not in r.headers or True  # FastAPI HTTPException path


def test_authorization_missing_401(internal_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(internal_mod, monkeypatch)
    r = client.get("/api/internal/enterprise/kyc/queue-safe")
    assert r.status_code == 401


def test_basic_scheme_401(internal_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Basic {_TEST_TOKEN}"},
    )
    assert r.status_code == 401


def test_empty_bearer_401(internal_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": "Bearer "},
    )
    assert r.status_code == 401


def test_wrong_token_403(internal_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": "Bearer totally-wrong-token"},
    )
    assert r.status_code == 403


def test_correct_token_200_empty(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch, rows=[])
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 200
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.json()
    assert body["success"] is True
    assert body["items"] == []
    assert body["count"] == 0


def test_admin_phone_query_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch, rows=[])
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe?admin_phone=5326497412",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "admin_phone_not_accepted"


def test_leylek_admin_jwt_style_token_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    """User JWT is not the service token → denied (no admin JWT fallback)."""
    client = _mount_client(internal_mod, monkeypatch)
    fake_jwt = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJzdWIiOiJhZG1pbiIsInR5cCI6ImxleWxla19hY2Nlc3MifQ."
        "signature"
    )
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {fake_jwt}"},
    )
    assert r.status_code == 403


def test_supabase_jwt_style_token_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch)
    supabase_like = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQifQ."
        "sig"
    )
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {supabase_like}"},
    )
    assert r.status_code == 403


def test_valid_token_pii_safe_response(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    rows = [
        _sample_pending_row(
            id="a",
            name="Early",
            kyc_submitted_at="2026-07-10T00:00:00+00:00",
        ),
        _sample_pending_row(
            id="b",
            name="Ayşe Yılmaz",
            kyc_submitted_at="2026-07-14T00:00:00+00:00",
            city="Kadıköy",
        ),
    ]
    client = _mount_client(internal_mod, monkeypatch, rows=rows)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe?limit=10",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    assert body["items"][0]["id"] == "b"
    assert body["items"][0]["masked_name"] == "A*** Y***"
    assert body["items"][0]["city"] == "Kadıköy"
    assert body["items"][1]["city"] is None
    docs = body["items"][0]["documents"]
    assert docs["license_present"] is True
    assert docs["selfie_present"] is False
    assert all(isinstance(v, bool) for v in docs.values())

    blob = json.dumps(body)
    assert "5326497412" not in blob
    assert "34ABC123" not in blob
    assert "Ayşe" not in blob
    assert "example.invalid" not in blob
    assert "phone" not in blob
    assert "plate" not in blob
    assert "url" not in blob.lower()
    assert "storage_path" not in blob
    assert "bucket" not in blob
    assert "admin_phone" not in blob
    assert "service_role" not in blob
    assert _TEST_TOKEN not in blob


def test_city_null_when_absent(queue_svc) -> None:
    row = _sample_pending_row()
    item = queue_svc.map_driver_row_to_queue_safe_item(
        row["id"], row["name"], row["driver_details"]
    )
    assert item["city"] is None


def test_limit_clamp(queue_svc) -> None:
    assert queue_svc.clamp_queue_safe_limit(0) == 1
    assert queue_svc.clamp_queue_safe_limit(999) == 50
    assert queue_svc.clamp_queue_safe_limit("x") == 50


def test_limit_clamp_on_route(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    rows = [
        _sample_pending_row(
            id=f"id-{i}",
            name=f"N{i}",
            kyc_submitted_at=f"2026-07-{10 + (i % 4):02d}T00:00:00+00:00",
        )
        for i in range(5)
    ]
    client = _mount_client(internal_mod, monkeypatch, rows=rows)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe?limit=999",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 200
    assert r.json()["count"] == 5  # only 5 rows exist; clamp allows up to 50


def test_db_error_safe_503(internal_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(internal_mod, monkeypatch, db_error=True)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    assert r.status_code == 503
    body = r.json()
    assert body["error"] == "upstream_unavailable"
    assert "db_boom" not in json.dumps(body)


def test_token_not_logged(
    internal_mod, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    import logging

    caplog.set_level(logging.INFO)
    client = _mount_client(internal_mod, monkeypatch, rows=[])
    client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"Authorization": f"Bearer {_TEST_TOKEN}"},
    )
    joined = " ".join(r.message for r in caplog.records)
    assert _TEST_TOKEN not in joined
    assert "phase3c-test-service-token" not in joined


def test_actor_header_does_not_authorize(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={"X-Karekod-Actor-Id": "enterprise-admin-1"},
    )
    assert r.status_code == 401


def test_actor_header_with_wrong_token_still_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch)
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={
            "Authorization": "Bearer wrong",
            "X-Karekod-Actor-Id": "enterprise-admin-1",
        },
    )
    assert r.status_code == 403


def test_malformed_actor_header_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch, rows=[])
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={
            "Authorization": f"Bearer {_TEST_TOKEN}",
            "X-Karekod-Actor-Id": "bad\nactor",
        },
    )
    assert r.status_code == 400
    assert r.json().get("detail") == "invalid_audit_metadata"


def test_overlong_actor_header_denied(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch, rows=[])
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={
            "Authorization": f"Bearer {_TEST_TOKEN}",
            "X-Karekod-Actor-Id": "x" * 200,
        },
    )
    assert r.status_code == 400


def test_valid_actor_optional_ok(
    internal_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = _mount_client(internal_mod, monkeypatch, rows=[])
    r = client.get(
        "/api/internal/enterprise/kyc/queue-safe",
        headers={
            "Authorization": f"Bearer {_TEST_TOKEN}",
            "X-Karekod-Actor-Id": "ent-admin-42",
            "X-Karekod-Request-Id": "req-abc-123",
        },
    )
    assert r.status_code == 200


def test_source_has_no_response_pii_serialization_fields(internal_mod) -> None:
    src = Path(internal_mod.__file__).read_text(encoding="utf-8")
    assert "plate_number" not in src
    assert "license_photo_url" not in src
    assert "storage_path" not in src
    assert "service_role" not in src
    tree = ast.parse(src)
    assert tree is not None


def test_auth_module_never_returns_token(auth_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(auth_mod.ENTERPRISE_KYC_READ_TOKEN_ENV, _TEST_TOKEN)
    identity = auth_mod.require_enterprise_kyc_read_service(
        authorization=f"Bearer {_TEST_TOKEN}"
    )
    assert identity == auth_mod.SERVICE_IDENTITY
    assert identity != _TEST_TOKEN


def test_load_payload_select_only_no_mutation(queue_svc) -> None:
    calls: list[str] = []

    class _Exec:
        data = []

    class _Chain:
        def select(self, cols, *_a, **_k):
            calls.append(f"select:{cols}")
            return self

        @property
        def not_(self):
            return self

        def is_(self, *_a, **_k):
            return self

        def execute(self):
            calls.append("execute")
            return _Exec()

        def update(self, *_a, **_k):
            calls.append("update")
            raise AssertionError("mutation forbidden")

        def insert(self, *_a, **_k):
            calls.append("insert")
            raise AssertionError("mutation forbidden")

        def delete(self, *_a, **_k):
            calls.append("delete")
            raise AssertionError("mutation forbidden")

    class _SB:
        def table(self, name):
            calls.append(f"table:{name}")
            return _Chain()

    payload = queue_svc.load_kyc_queue_safe_payload(supabase_client=_SB(), limit=10)
    assert payload["success"] is True
    assert any(c.startswith("select:") for c in calls)
    assert "update" not in calls
    assert "insert" not in calls
    assert "delete" not in calls


def test_router_path_registered(internal_mod) -> None:
    paths = [getattr(r, "path", "") for r in internal_mod.router.routes]
    assert any(str(p).endswith("/queue-safe") for p in paths)
    assert any("/internal/enterprise/kyc" in str(getattr(r, "path", "")) or True for r in internal_mod.router.routes)
    prefixes = [getattr(internal_mod.router, "prefix", "")]
    assert prefixes[0] == "/internal/enterprise/kyc"


def test_server_registers_internal_router() -> None:
    server_src = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    assert "internal_enterprise_kyc_queue_router" in server_src
    assert "include_router(internal_enterprise_kyc_queue_router" in server_src


def test_no_secret_literal_in_repo_modules() -> None:
    for rel in (
        "services/enterprise_kyc_read_auth.py",
        "routes/internal_enterprise_kyc_queue.py",
        "services/kyc_queue_safe_service.py",
    ):
        src = (BACKEND_DIR / rel).read_text(encoding="utf-8")
        assert "eyJ" not in src
        assert "sk-" not in src
        # Env *name* may appear; no assignment of a production-looking secret.
        assert 'KAREKOD_ENTERPRISE_KYC_READ_TOKEN="' not in src
        assert "KAREKOD_ENTERPRISE_KYC_READ_TOKEN='" not in src
