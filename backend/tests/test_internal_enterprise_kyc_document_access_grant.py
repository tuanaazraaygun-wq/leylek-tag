"""Phase D6 — internal Enterprise KYC document access grant route tests (no live DB/secrets)."""
from __future__ import annotations

import inspect
import json
import logging
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError as PostgrestAPIError

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_TEST_REVIEW_TOKEN = "phase2-test-review-token-not-for-production"
_TEST_QUEUE_TOKEN = "phase3c-test-service-token-not-for-production"
_TEST_DECISION_TOKEN = "phase-d1-test-decision-token-not-for-production"
_APP_ID = "11111111-2222-3333-4444-555555555555"
_RECORD_VERSION = "2026-07-14T13:00:00+00:00"
_GRANT_PATH = f"/api/internal/enterprise/kyc/applications/{_APP_ID}/documents/license/access-grants"
_BINDING_SECRET = "x" * 32
_SUPABASE_URL = "https://project-ref.example.supabase.co"
_OPAQUE_TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789AB"
_DB_GRANT_ID = "e08d4fc0-00a4-4328-b114-3bd5dea31aa3"


@pytest.fixture()
def grant_route_mod():
    import routes.internal_enterprise_kyc_document_access_grant as mod

    return mod


@pytest.fixture()
def auth_mod():
    import services.enterprise_kyc_read_auth as mod

    return mod


@pytest.fixture(autouse=True)
def _grant_route_env(monkeypatch: pytest.MonkeyPatch) -> None:
    import services.kyc_document_access_grant_service as grant_service

    monkeypatch.setenv(grant_service.KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV, _BINDING_SECRET)
    monkeypatch.setenv("SUPABASE_URL", _SUPABASE_URL)


def _sample_row(**dd_overrides: Any) -> dict[str, Any]:
    dd: dict[str, Any] = {
        "kyc_status": "pending",
        "kyc_submitted_at": "2026-07-14T12:00:00+00:00",
        "pending_vehicle_kind": "car",
        "license_photo_url": "https://project-ref.example.supabase.co/storage/v1/object/public/vehicle-photos/kyc/x.jpg",
        "vehicle_photo_url": "https://project-ref.example.supabase.co/storage/v1/object/public/vehicle-photos/kyc/y.jpg",
    }
    dd.update(dd_overrides)
    return {
        "id": _APP_ID,
        "name": "Ayşe Yılmaz",
        "updated_at": _RECORD_VERSION,
        "driver_details": dd,
    }


class _TrackedQuery:
    def __init__(self, data: list[dict[str, Any]] | None, *, execute_error: BaseException | None = None):
        self._data = data or []
        self.select_args: tuple[Any, ...] = ()
        self.eq_calls: list[tuple[str, str]] = []
        self.limit_value: int | None = None
        self._execute_error = execute_error

    def select(self, *args, **kwargs):
        self.select_args = args
        return self

    def eq(self, column: str, value: str):
        self.eq_calls.append((column, value))
        return self

    def limit(self, n: int):
        self.limit_value = n
        return self

    def execute(self):
        if self._execute_error is not None:
            raise self._execute_error
        filtered = self._data
        for col, val in self.eq_calls:
            if col == "id":
                filtered = [r for r in filtered if str(r.get("id")).lower() == str(val).lower()]
        if self.limit_value is not None:
            filtered = filtered[: self.limit_value]
        return MagicMock(data=filtered)


class _TrackedTable:
    def __init__(self, data: list[dict[str, Any]] | None, *, execute_error: BaseException | None = None):
        self._data = data or []
        self.last_query: _TrackedQuery | None = None
        self._execute_error = execute_error

    def select(self, *args, **kwargs):
        self.last_query = _TrackedQuery(self._data, execute_error=self._execute_error)
        self.last_query.select_args = args
        return self.last_query


class _TrackedSB:
    def __init__(
        self,
        rows: list[dict[str, Any]] | None = None,
        *,
        select_execute_error: BaseException | None = None,
    ):
        self._rows = rows if rows is not None else []
        self.last_table: _TrackedTable | None = None
        self._select_execute_error = select_execute_error

    def table(self, name: str):
        self.last_table = _TrackedTable(self._rows, execute_error=self._select_execute_error)
        return self.last_table


def _mount_client(
    grant_route_mod,
    monkeypatch: pytest.MonkeyPatch,
    *,
    review_token: str | None = _TEST_REVIEW_TOKEN,
    rows: list[dict[str, Any]] | None = None,
    supabase_none: bool = False,
    supabase_raises: bool = False,
    select_execute_error: BaseException | None = None,
    binding_secret: str | None = _BINDING_SECRET,
):
    import services.enterprise_kyc_read_auth as auth
    import services.kyc_document_access_grant_service as grant_service
    import supabase_client

    if review_token is None:
        monkeypatch.delenv(auth.ENTERPRISE_KYC_REVIEW_TOKEN_ENV, raising=False)
    else:
        monkeypatch.setenv(auth.ENTERPRISE_KYC_REVIEW_TOKEN_ENV, review_token)

    if binding_secret is None:
        monkeypatch.delenv(grant_service.KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV, raising=False)
    else:
        monkeypatch.setenv(grant_service.KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV, binding_secret)

    sb: Any = None
    if supabase_raises:

        def _raise_supabase():
            raise RuntimeError("supabase accessor unavailable")

        monkeypatch.setattr(supabase_client, "get_supabase", _raise_supabase)
    elif supabase_none:
        monkeypatch.setattr(supabase_client, "get_supabase", lambda: None)
    else:
        sb = _TrackedSB(
            rows if rows is not None else [_sample_row()],
            select_execute_error=select_execute_error,
        )
        monkeypatch.setattr(supabase_client, "get_supabase", lambda: sb)

    app = FastAPI()
    app.include_router(grant_route_mod.router, prefix="/api")
    return TestClient(app), sb


def _headers(
    *,
    token: str = _TEST_REVIEW_TOKEN,
    actor: str | None = "enterprise-actor-grant",
    request_id: str | None = "req-grant-001",
) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    if actor is not None:
        headers["X-Karekod-Actor-Id"] = actor
    if request_id is not None:
        headers["X-Karekod-Request-Id"] = request_id
    return headers


def _body(review_reason: str = "initial_review") -> dict[str, str]:
    return {"review_reason": review_reason}


def _issued_result(**overrides: Any):
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    base = {
        "outcome_code": "issued",
        "grant_id": _DB_GRANT_ID,
        "grant_reference_hash": "a" * 64,
        "state": "issued",
        "issued_at": "2026-07-14T13:00:01+00:00",
        "expires_at": "2026-07-14T13:01:31+00:00",
        "ttl_seconds": 90,
        "is_reused": False,
        "access_grant_token": _OPAQUE_TOKEN,
    }
    base.update(overrides)
    return KycDocumentAccessIssueGrantRpcResult(**base)


def _mock_issue(monkeypatch: pytest.MonkeyPatch, grant_route_mod, result):
    calls: list[dict[str, Any]] = []

    def _fake_issue(**kwargs: Any):
        calls.append(kwargs)
        return result

    monkeypatch.setattr(grant_route_mod, "issue_kyc_document_access_grant", _fake_issue)
    return calls


def test_route_registered_under_api(grant_route_mod) -> None:
    route_names = [getattr(route, "name", "") for route in grant_route_mod.router.routes]
    assert "post_internal_enterprise_kyc_document_access_grant" in route_names
    methods = [getattr(route, "methods", set()) for route in grant_route_mod.router.routes]
    assert any("POST" in method_set for method_set in methods)


def test_review_token_env_missing_503(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch, review_token=None)
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json().get("detail") == "service_auth_disabled"


def test_bearer_missing_401(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(
        _GRANT_PATH,
        headers={"X-Karekod-Actor-Id": "enterprise-actor-grant"},
        json=_body(),
    )
    assert r.status_code == 401
    assert r.json().get("detail") == "unauthorized"


def test_wrong_bearer_403(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(_GRANT_PATH, headers=_headers(token=_TEST_QUEUE_TOKEN), json=_body())
    assert r.status_code == 403
    assert r.json().get("detail") == "forbidden"


def test_actor_missing_400(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(
        _GRANT_PATH,
        headers={"Authorization": f"Bearer {_TEST_REVIEW_TOKEN}"},
        json=_body(),
    )
    assert r.status_code == 400
    assert r.json().get("detail") == "invalid_audit_metadata"


def test_malformed_application_uuid_422(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(
        "/api/internal/enterprise/kyc/applications/not-a-uuid/documents/license/access-grants",
        headers=_headers(),
        json=_body(),
    )
    assert r.status_code == 422


def test_unsupported_document_type_422(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    path = f"/api/internal/enterprise/kyc/applications/{_APP_ID}/documents/identity/access-grants"
    r = client.post(path, headers=_headers(), json=_body())
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_document_type"


def test_missing_review_reason_422(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(_GRANT_PATH, headers=_headers(), json={})
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_request"


def test_invalid_review_reason_422(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(_GRANT_PATH, headers=_headers(), json={"review_reason": "appeal"})
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_review_reason"


def test_valid_issued_response_200(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["result"]["availability"] == "ready"


def test_access_grant_id_is_opaque_token_not_db_uuid(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    grant = r.json()["result"]["grant"]
    assert grant["access_grant_id"] == _OPAQUE_TOKEN
    assert grant["access_grant_id"] != _DB_GRANT_ID


def test_response_has_no_forbidden_fields(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    serialized = json.dumps(r.json())
    lowered = serialized.lower()
    assert "https://" not in lowered
    assert "grant_reference_hash" not in lowered
    assert _DB_GRANT_ID not in serialized
    assert "bucket" not in lowered
    assert "storagepath" not in lowered.replace("_", "")


def test_cache_control_no_store(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.headers.get("cache-control") == "no-store"


def test_actor_passed_to_service_from_header(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    actor = "header-actor-001"
    client.post(_GRANT_PATH, headers=_headers(actor=actor), json=_body())
    assert calls[0]["command"].actor_admin_id == actor


def test_source_channel_enterprise_bff(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert calls[0]["command"].source_channel == "enterprise_bff"


def test_ttl_seconds_fixed_to_90(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert calls[0]["command"].ttl_seconds == 90


def test_record_version_from_user_row(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch, rows=[_sample_row()])
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert calls[0]["command"].if_match_record_version == _RECORD_VERSION


def test_duplicate_request_409_without_token(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="duplicate_request",
            grant_id=_DB_GRANT_ID,
            grant_reference_hash="a" * 64,
            state="issued",
            issued_at="2026-07-14T13:00:01+00:00",
            expires_at="2026-07-14T13:01:31+00:00",
            ttl_seconds=90,
            is_reused=True,
            access_grant_token=None,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 409
    assert r.json()["error"] == "request_conflict"
    assert "access_grant_id" not in r.text


def test_request_conflict_409(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="request_conflict",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 409
    assert r.json()["error"] == "request_conflict"


def test_record_version_stale_409(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="record_version_stale",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 409
    assert r.json()["error"] == "record_version_stale"


def test_application_not_found_200(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch, rows=[])
    calls = _mock_issue(
        monkeypatch,
        grant_route_mod,
        _issued_result(),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 200
    assert r.json()["result"]["availability"] == "not_found"
    assert r.json()["result"]["reason_code"] == "application_not_found"
    assert calls == []


def test_document_missing_200_unavailable(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="document_missing",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 200
    assert r.json()["result"]["availability"] == "unavailable"
    assert r.json()["result"]["reason_code"] == "document_missing"


def test_document_not_reviewable_200_unavailable(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="document_not_reviewable",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 200
    assert r.json()["result"]["availability"] == "unavailable"
    assert r.json()["result"]["reason_code"] == "document_not_reviewable"


def test_audit_unavailable_503(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="audit_unavailable",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "audit_unavailable"


def test_missing_binding_secret_503_before_service(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch, binding_secret=None)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
    assert calls == []


def test_short_binding_secret_503_before_service(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch, binding_secret="short-secret")
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
    assert calls == []


def test_supabase_unavailable_503(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch, supabase_none=True)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
    assert calls == []


def test_unexpected_service_exception_503_redacted(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)

    def _boom(**_kwargs: Any):
        raise RuntimeError(f"secret-token-{_OPAQUE_TOKEN}")

    monkeypatch.setattr(grant_route_mod, "issue_kyc_document_access_grant", _boom)
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
    assert _OPAQUE_TOKEN not in r.text


def test_no_live_network_or_database_calls(grant_route_mod, monkeypatch) -> None:
    client, sb = _mount_client(grant_route_mod, monkeypatch)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert calls
    assert isinstance(sb, _TrackedSB)
    assert sb.last_table is not None
    assert "rpc" not in inspect.getsource(_TrackedSB)


def test_decision_token_not_accepted(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(_GRANT_PATH, headers=_headers(token=_TEST_DECISION_TOKEN), json=_body())
    assert r.status_code == 403


def test_request_id_replay_uses_header_value(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    request_id = "req-grant-replay-001"
    client.post(_GRANT_PATH, headers=_headers(request_id=request_id), json=_body())
    assert calls[0]["command"].request_id == request_id


def test_extra_body_fields_rejected(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    r = client.post(
        _GRANT_PATH,
        headers=_headers(),
        json={"review_reason": "initial_review", "actor_admin_id": "evil"},
    )
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_request"


def test_canonical_supabase_accessor_used_without_server_global(
    grant_route_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    import services.enterprise_kyc_read_auth as auth
    import services.kyc_document_access_grant_service as grant_service
    import supabase_client

    sb = _TrackedSB([_sample_row()])
    monkeypatch.setenv(auth.ENTERPRISE_KYC_REVIEW_TOKEN_ENV, _TEST_REVIEW_TOKEN)
    monkeypatch.setenv(grant_service.KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV, _BINDING_SECRET)
    monkeypatch.setenv("SUPABASE_URL", _SUPABASE_URL)
    monkeypatch.setattr(supabase_client, "get_supabase", lambda: sb)
    import server as srv

    monkeypatch.setattr(srv, "supabase", None, raising=False)

    app = FastAPI()
    app.include_router(grant_route_mod.router, prefix="/api")
    client = TestClient(app)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 200
    assert calls


def test_supabase_accessor_raises_503_before_select(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch, supabase_raises=True)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
    assert calls == []


def test_select_postgrest_error_503_without_service_call(grant_route_mod, monkeypatch) -> None:
    sensitive = (
        "https://example.invalid/document Bearer fake-secret storage/path/example fake-binding-secret"
    )
    execute_error = PostgrestAPIError({"message": sensitive, "code": "PGRST000"})
    client, _ = _mount_client(
        grant_route_mod,
        monkeypatch,
        select_execute_error=execute_error,
    )
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
    assert sensitive not in r.text
    assert calls == []


def test_select_postgrest_error_logs_stage_and_class(
    grant_route_mod, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    execute_error = PostgrestAPIError({"message": "https://example.invalid/document", "code": "PGRST000"})
    client, _ = _mount_client(
        grant_route_mod,
        monkeypatch,
        select_execute_error=execute_error,
    )
    _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    client.post(_GRANT_PATH, headers=_headers(), json=_body())
    joined = " ".join(record.message for record in caplog.records)
    assert "failure_stage=select_application" in joined
    assert "exception_class=APIError" in joined
    assert "https://example.invalid/document" not in joined
    assert "Bearer" not in joined


def test_unexpected_service_exception_logs_issue_grant_stage(
    grant_route_mod, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    client, _ = _mount_client(grant_route_mod, monkeypatch)

    def _boom(**_kwargs: Any):
        raise RuntimeError("https://example.invalid/document Bearer fake-secret")

    monkeypatch.setattr(grant_route_mod, "issue_kyc_document_access_grant", _boom)
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    joined = " ".join(record.message for record in caplog.records)
    assert "failure_stage=issue_grant" in joined
    assert "exception_class=RuntimeError" in joined
    assert "https://example.invalid/document" not in joined
    assert "Bearer fake-secret" not in joined
    assert _OPAQUE_TOKEN not in r.text


def test_rate_limited_outcome_200_denied(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="rate_limited",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 200
    assert r.json()["result"]["availability"] == "denied"
    assert r.json()["result"]["reason_code"] == "rate_limited"


def test_invalid_input_outcome_422(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="invalid_input",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_request"


def test_unknown_outcome_503_fail_closed(grant_route_mod, monkeypatch) -> None:
    from services.kyc_document_access_grant_service import KycDocumentAccessIssueGrantRpcResult

    client, _ = _mount_client(grant_route_mod, monkeypatch)
    _mock_issue(
        monkeypatch,
        grant_route_mod,
        KycDocumentAccessIssueGrantRpcResult(
            outcome_code="synthetic_unknown_outcome",
            grant_id=None,
            grant_reference_hash=None,
            state=None,
            issued_at=None,
            expires_at=None,
            ttl_seconds=None,
            is_reused=False,
        ),
    )
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"


def test_asgi_success_path_uses_http_route(grant_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(
        _GRANT_PATH,
        headers=_headers(actor="synthetic-actor-local", request_id="req-grant-asgi-local-001"),
        json=_body(),
    )
    assert r.status_code == 200
    assert calls
    assert calls[0]["command"].actor_admin_id == "synthetic-actor-local"
    assert calls[0]["command"].request_id == "req-grant-asgi-local-001"


def test_asgi_select_failure_503_no_service_mutation(grant_route_mod, monkeypatch) -> None:
    execute_error = PostgrestAPIError({"message": "synthetic select failure", "code": "PGRST000"})
    client, _ = _mount_client(
        grant_route_mod,
        monkeypatch,
        select_execute_error=execute_error,
    )
    calls = _mock_issue(monkeypatch, grant_route_mod, _issued_result())
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    assert calls == []


def test_log_redaction_on_sensitive_exception_message(
    grant_route_mod, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    client, _ = _mount_client(grant_route_mod, monkeypatch)
    sensitive = (
        "https://example.invalid/document Bearer fake-secret storage/path/example fake-binding-secret"
    )

    def _boom(**_kwargs: Any):
        raise RuntimeError(sensitive)

    monkeypatch.setattr(grant_route_mod, "issue_kyc_document_access_grant", _boom)
    r = client.post(_GRANT_PATH, headers=_headers(), json=_body())
    assert r.status_code == 503
    joined = " ".join(record.message for record in caplog.records)
    assert "exception_class=RuntimeError" in joined
    assert sensitive not in joined
    assert sensitive not in r.text
    assert _OPAQUE_TOKEN not in r.text
