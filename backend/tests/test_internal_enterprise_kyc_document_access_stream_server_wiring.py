"""Server graph registration tests for D7-B2B redeem-and-stream route (no live DB/network)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_TEST_REVIEW_TOKEN = "phase2-test-review-token-not-for-production"
_OPAQUE_TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789AB"
_STREAM_PATH = f"/api/internal/enterprise/kyc/document-access/{_OPAQUE_TOKEN}/stream"


@pytest.fixture()
def stream_route_mod():
    import routes.internal_enterprise_kyc_document_access_stream as mod

    return mod


def test_server_registers_internal_stream_router() -> None:
    server_src = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    assert "internal_enterprise_kyc_document_access_stream_router" in server_src
    assert "include_router(internal_enterprise_kyc_document_access_stream_router" in server_src
    assert "internal_enterprise_kyc_document_access_grant_router" in server_src


def test_fastapi_app_exposes_stream_route_path_get_only() -> None:
    from server import fastapi_app

    client = TestClient(fastapi_app)
    schema = client.get("/openapi.json").json()
    paths = schema.get("paths", {})
    matched = [
        path
        for path in paths
        if path.endswith("/document-access/{grant_id}/stream")
    ]
    assert matched
    assert matched[0] == "/api/internal/enterprise/kyc/document-access/{grant_id}/stream"
    methods = {m.lower() for m in paths[matched[0]].keys()}
    assert "get" in methods
    assert "post" not in methods


def test_authentication_dependency_active(
    stream_route_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    import services.enterprise_kyc_read_auth as auth
    import services.kyc_document_access_grant_service as grant_service
    import supabase_client

    monkeypatch.setenv(auth.ENTERPRISE_KYC_REVIEW_TOKEN_ENV, _TEST_REVIEW_TOKEN)
    monkeypatch.setenv(grant_service.KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV, "x" * 32)
    monkeypatch.setenv("SUPABASE_URL", "https://project-ref.example.supabase.co")
    monkeypatch.setattr(supabase_client, "get_supabase", lambda: None)

    app = FastAPI()
    app.include_router(stream_route_mod.router, prefix="/api")
    client = TestClient(app)
    r = client.get(
        _STREAM_PATH,
        headers={
            "Authorization": f"Bearer {_TEST_REVIEW_TOKEN}",
            "X-Karekod-Actor-Id": "synthetic-server-graph-actor",
            "X-Karekod-Request-Id": "req-stream-server-graph-local-001",
        },
    )
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"


def test_importability_of_stream_modules() -> None:
    import routes.internal_enterprise_kyc_document_access_stream as route_mod
    import services.kyc_document_access_redeem_service as redeem_mod
    import services.kyc_document_access_stream_service as stream_mod

    assert route_mod.router is not None
    assert callable(redeem_mod.redeem_kyc_document_access_grant)
    assert callable(stream_mod.stream_kyc_document_access_grant)
