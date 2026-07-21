"""Phase D7-B2B — internal Enterprise KYC document-access stream route tests."""
from __future__ import annotations

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

_TEST_REVIEW_TOKEN = "phase2-test-review-token-not-for-production"
_OPAQUE_TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789AB"
_STREAM_PATH = f"/api/internal/enterprise/kyc/document-access/{_OPAQUE_TOKEN}/stream"
_BINDING_SECRET = "x" * 32
_SUPABASE_URL = "https://project-ref.example.supabase.co"
_BINARY = b"\xff\xd8\xffjpeg-bytes"


@pytest.fixture()
def stream_route_mod():
    import routes.internal_enterprise_kyc_document_access_stream as mod

    return mod


@pytest.fixture(autouse=True)
def _stream_route_env(monkeypatch: pytest.MonkeyPatch) -> None:
    import services.kyc_document_access_grant_service as grant_service

    monkeypatch.setenv(grant_service.KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV, _BINDING_SECRET)
    monkeypatch.setenv("SUPABASE_URL", _SUPABASE_URL)


def _headers(
    *,
    token: str = _TEST_REVIEW_TOKEN,
    actor: str | None = "enterprise-actor-stream",
    request_id: str | None = "req-stream-001",
) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    if actor is not None:
        headers["X-Karekod-Actor-Id"] = actor
    if request_id is not None:
        headers["X-Karekod-Request-Id"] = request_id
    return headers


def _mount_client(
    stream_route_mod,
    monkeypatch: pytest.MonkeyPatch,
    *,
    review_token: str | None = _TEST_REVIEW_TOKEN,
    binding_secret: str | None = _BINDING_SECRET,
    supabase_none: bool = False,
    stream_result: Any = None,
    stream_raises: BaseException | None = None,
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

    if supabase_none:
        monkeypatch.setattr(supabase_client, "get_supabase", lambda: None)
    else:
        monkeypatch.setattr(supabase_client, "get_supabase", lambda: MagicMock())

    calls: list[Any] = []

    def _fake_stream(**kwargs):
        calls.append(kwargs)
        if stream_raises is not None:
            raise stream_raises
        return stream_result

    monkeypatch.setattr(stream_route_mod, "stream_kyc_document_access_grant", _fake_stream)

    app = FastAPI()
    app.include_router(stream_route_mod.router, prefix="/api")
    return TestClient(app), calls


def _success_stream_result():
    from services.kyc_document_access_stream_service import KycDocumentAccessStreamResult

    return KycDocumentAccessStreamResult(
        outcome_code="redeemed",
        content=_BINARY,
        content_type="image/jpeg",
    )


def test_auth_config_missing_returns_503(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _mount_client(
        stream_route_mod, monkeypatch, review_token=None, stream_result=_success_stream_result()
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 503
    assert r.json()["detail"] == "service_auth_disabled"


def test_bearer_missing_returns_401(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _mount_client(stream_route_mod, monkeypatch, stream_result=_success_stream_result())
    r = client.get(
        _STREAM_PATH,
        headers={
            "X-Karekod-Actor-Id": "enterprise-actor-stream",
            "X-Karekod-Request-Id": "req-stream-001",
        },
    )
    assert r.status_code == 401


def test_bearer_malformed_returns_401(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _mount_client(stream_route_mod, monkeypatch, stream_result=_success_stream_result())
    r = client.get(
        _STREAM_PATH,
        headers={
            "Authorization": "Token not-bearer",
            "X-Karekod-Actor-Id": "enterprise-actor-stream",
            "X-Karekod-Request-Id": "req-stream-001",
        },
    )
    assert r.status_code == 401


def test_bearer_wrong_returns_403(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _mount_client(stream_route_mod, monkeypatch, stream_result=_success_stream_result())
    r = client.get(_STREAM_PATH, headers=_headers(token="wrong-token-value-not-matching"))
    assert r.status_code == 403


def test_actor_missing_returns_400(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _mount_client(stream_route_mod, monkeypatch, stream_result=_success_stream_result())
    r = client.get(_STREAM_PATH, headers=_headers(actor=None))
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_audit_metadata"


def test_request_id_missing_returns_400(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _mount_client(stream_route_mod, monkeypatch, stream_result=_success_stream_result())
    r = client.get(_STREAM_PATH, headers=_headers(request_id=None))
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_audit_metadata"


def test_request_id_never_auto_generated(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, calls = _mount_client(
        stream_route_mod, monkeypatch, stream_result=_success_stream_result()
    )
    r = client.get(_STREAM_PATH, headers=_headers(request_id=None))
    assert r.status_code == 400
    assert calls == []


def test_successful_binary_response(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, calls = _mount_client(
        stream_route_mod, monkeypatch, stream_result=_success_stream_result()
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 200
    assert r.content == _BINARY
    assert r.headers["content-type"].startswith("image/jpeg")
    assert r.headers.get("cache-control") == "no-store"
    assert len(calls) == 1
    command = calls[0]["command"]
    assert command.access_grant_token == _OPAQUE_TOKEN
    assert command.actor_admin_id == "enterprise-actor-stream"
    assert command.request_id == "req-stream-001"
    assert command.source_channel == "enterprise_bff"


def test_replayed_binary_response(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, calls = _mount_client(
        stream_route_mod, monkeypatch, stream_result=_success_stream_result()
    )
    r1 = client.get(_STREAM_PATH, headers=_headers())
    r2 = client.get(_STREAM_PATH, headers=_headers())
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.content == r2.content == _BINARY
    assert len(calls) == 2
    assert calls[0]["command"].request_id == calls[1]["command"].request_id


@pytest.mark.parametrize(
    ("outcome", "reason"),
    [
        ("not_found_or_unauthorized", "document_unavailable"),
        ("grant_expired", "grant_expired"),
        ("grant_revoked", "grant_revoked"),
        ("grant_redeemed", "grant_redeemed"),
    ],
)
def test_terminal_unavailable_outcomes(
    stream_route_mod, monkeypatch: pytest.MonkeyPatch, outcome: str, reason: str
) -> None:
    from services.kyc_document_access_stream_service import KycDocumentAccessStreamResult

    client, _ = _mount_client(
        stream_route_mod,
        monkeypatch,
        stream_result=KycDocumentAccessStreamResult(outcome_code=outcome),
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["result"]["availability"] == "unavailable"
    assert body["result"]["reason_code"] == reason
    assert "url" not in r.text.lower()
    assert "bucket" not in r.text.lower()
    assert _OPAQUE_TOKEN not in r.text


def test_invalid_input_returns_422(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    from services.kyc_document_access_stream_service import KycDocumentAccessStreamResult

    client, _ = _mount_client(
        stream_route_mod,
        monkeypatch,
        stream_result=KycDocumentAccessStreamResult(outcome_code="invalid_input"),
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_request"


def test_audit_unavailable_returns_503(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    from services.kyc_document_access_stream_service import KycDocumentAccessStreamResult

    client, _ = _mount_client(
        stream_route_mod,
        monkeypatch,
        stream_result=KycDocumentAccessStreamResult(outcome_code="audit_unavailable"),
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 503
    assert r.json()["error"] == "audit_unavailable"


def test_storage_unavailable_returns_503(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    from services.kyc_document_access_stream_service import (
        KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE,
        KycDocumentAccessStreamResult,
    )

    client, _ = _mount_client(
        stream_route_mod,
        monkeypatch,
        stream_result=KycDocumentAccessStreamResult(
            outcome_code=KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE
        ),
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"


def test_supabase_missing_returns_503(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, calls = _mount_client(
        stream_route_mod,
        monkeypatch,
        supabase_none=True,
        stream_result=_success_stream_result(),
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
    assert calls == []


def test_binding_secret_missing_returns_503(
    stream_route_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, calls = _mount_client(
        stream_route_mod,
        monkeypatch,
        binding_secret=None,
        stream_result=_success_stream_result(),
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 503
    assert calls == []


def test_stream_exception_returns_503(stream_route_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _mount_client(
        stream_route_mod,
        monkeypatch,
        stream_raises=RuntimeError("boom"),
    )
    r = client.get(_STREAM_PATH, headers=_headers())
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"


def test_post_not_accepted_on_stream_path(
    stream_route_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = _mount_client(stream_route_mod, monkeypatch, stream_result=_success_stream_result())
    r = client.post(_STREAM_PATH, headers=_headers(), json={})
    assert r.status_code == 405
