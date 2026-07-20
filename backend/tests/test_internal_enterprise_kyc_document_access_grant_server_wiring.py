"""Server graph registration tests for D6 internal grant route (no live DB/network)."""
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
_APP_ID = "11111111-2222-3333-4444-555555555555"
_GRANT_PATH = f"/api/internal/enterprise/kyc/applications/{_APP_ID}/documents/license/access-grants"


@pytest.fixture()
def grant_route_mod():
    import routes.internal_enterprise_kyc_document_access_grant as mod

    return mod


def test_server_registers_internal_grant_router() -> None:
    server_src = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    assert "internal_enterprise_kyc_document_access_grant_router" in server_src
    assert "include_router(internal_enterprise_kyc_document_access_grant_router" in server_src


def test_fastapi_app_exposes_grant_route_path() -> None:
    from fastapi.testclient import TestClient
    from server import fastapi_app

    client = TestClient(fastapi_app)
    schema = client.get("/openapi.json").json()
    paths = schema.get("paths", {})
    matched = [
        path
        for path in paths
        if path.endswith("/applications/{application_id}/documents/{document_type}/access-grants")
    ]
    assert matched
    assert matched[0].startswith("/api/internal/enterprise/kyc/")


def test_missing_supabase_client_returns_controlled_503(
    grant_route_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    import services.enterprise_kyc_read_auth as auth
    import services.kyc_document_access_grant_service as grant_service
    import supabase_client

    monkeypatch.setenv(auth.ENTERPRISE_KYC_REVIEW_TOKEN_ENV, _TEST_REVIEW_TOKEN)
    monkeypatch.setenv(grant_service.KYC_DOCUMENT_SOURCE_BINDING_SECRET_ENV, "x" * 32)
    monkeypatch.setenv("SUPABASE_URL", "https://project-ref.example.supabase.co")
    monkeypatch.setattr(supabase_client, "get_supabase", lambda: None)

    app = FastAPI()
    app.include_router(grant_route_mod.router, prefix="/api")
    client = TestClient(app)
    r = client.post(
        _GRANT_PATH,
        headers={
            "Authorization": f"Bearer {_TEST_REVIEW_TOKEN}",
            "X-Karekod-Actor-Id": "synthetic-server-graph-actor",
            "X-Karekod-Request-Id": "req-grant-server-graph-local-001",
        },
        json={"review_reason": "initial_review"},
    )
    assert r.status_code == 503
    assert r.json()["error"] == "upstream_unavailable"
