"""Focused tests: SlowRequestLoggingMiddleware never logs raw OPS-D7 grant tokens."""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response
from starlette.routing import Route
from starlette.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.slow_request_middleware import SlowRequestLoggingMiddleware  # noqa: E402
from services.uvicorn_access_log_redaction import (  # noqa: E402
    KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION,
)

SYNTHETIC = "SYNTHETIC_GRANT_PLACEHOLDER_NOT_A_SECRET"
STREAM_PATH = (
    f"/api/internal/enterprise/kyc/document-access/{SYNTHETIC}/stream"
)


async def _ok(_request: Request) -> Response:
    return PlainTextResponse("ok")


async def _slow_ok(_request: Request) -> Response:
    import asyncio

    await asyncio.sleep(0.05)
    return PlainTextResponse("ok")


def _app_with_middleware() -> Starlette:
    app = Starlette(
        routes=[
            Route(STREAM_PATH, _slow_ok, methods=["GET"]),
            Route("/api/passenger/active-tag", _slow_ok, methods=["GET"]),
            Route("/api/unrelated/fast", _ok, methods=["GET"]),
        ]
    )
    app.add_middleware(SlowRequestLoggingMiddleware)
    return app


@pytest.fixture()
def caplog_slow(caplog: pytest.LogCaptureFixture):
    caplog.set_level(logging.WARNING, logger="slow_request")
    return caplog


def test_watchlist_only_true_skips_non_watchlist_stream(
    monkeypatch: pytest.MonkeyPatch, caplog_slow: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("SLOW_REQUEST_WATCHLIST_ONLY", "true")
    monkeypatch.setenv("SLOW_REQUEST_WARN_MS", "1")
    client = TestClient(_app_with_middleware())
    r = client.get(STREAM_PATH)
    assert r.status_code == 200
    joined = "\n".join(r.message for r in caplog_slow.records)
    assert SYNTHETIC not in joined
    # Stream is not on the watchlist — no slow log expected.
    assert "SLOW_HTTP" not in joined


def test_watchlist_only_false_logs_redacted_stream_path(
    monkeypatch: pytest.MonkeyPatch, caplog_slow: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("SLOW_REQUEST_WATCHLIST_ONLY", "false")
    monkeypatch.setenv("SLOW_REQUEST_WARN_MS", "1")
    client = TestClient(_app_with_middleware())
    r = client.get(
        STREAM_PATH,
        headers={
            "Authorization": "Bearer should-never-appear",
            "X-Karekod-Request-Id": "req-correlation-abc",
        },
    )
    assert r.status_code == 200
    joined = "\n".join(rec.message for rec in caplog_slow.records)
    assert "SLOW_HTTP" in joined
    assert SYNTHETIC not in joined
    assert KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION in joined
    assert "Bearer should-never-appear" not in joined
    assert "should-never-appear" not in joined
    payload = json.loads(
        next(rec.message for rec in caplog_slow.records if "SLOW_HTTP" in rec.message)
    )
    assert payload["path"] == (
        f"/api/internal/enterprise/kyc/document-access/"
        f"{KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION}/stream"
    )
    assert "duration_ms" in payload
    assert payload["method"] == "GET"


def test_unrelated_watchlist_route_unchanged(
    monkeypatch: pytest.MonkeyPatch, caplog_slow: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("SLOW_REQUEST_WATCHLIST_ONLY", "true")
    monkeypatch.setenv("SLOW_REQUEST_WARN_MS", "1")
    client = TestClient(_app_with_middleware())
    r = client.get("/api/passenger/active-tag")
    assert r.status_code == 200
    joined = "\n".join(rec.message for rec in caplog_slow.records)
    assert "SLOW_HTTP" in joined
    assert "/api/passenger/active-tag" in joined
    assert SYNTHETIC not in joined
    assert KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION not in joined


def test_query_not_introduced_as_raw_grant(
    monkeypatch: pytest.MonkeyPatch, caplog_slow: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("SLOW_REQUEST_WATCHLIST_ONLY", "false")
    monkeypatch.setenv("SLOW_REQUEST_WARN_MS", "1")
    client = TestClient(_app_with_middleware())
    r = client.get(f"{STREAM_PATH}?user_id=abcdef1234567890")
    assert r.status_code == 200
    joined = "\n".join(rec.message for rec in caplog_slow.records)
    assert SYNTHETIC not in joined
    # Only SAFE_QUERY_KEYS are mirrored (masked) — grant never appears.
    assert "Authorization" not in joined
    payload = json.loads(
        next(rec.message for rec in caplog_slow.records if "SLOW_HTTP" in rec.message)
    )
    assert SYNTHETIC not in json.dumps(payload)
    assert "user_id_masked" in payload


def test_synthetic_absent_from_all_caplog(
    monkeypatch: pytest.MonkeyPatch, caplog_slow: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("SLOW_REQUEST_WATCHLIST_ONLY", "false")
    monkeypatch.setenv("SLOW_REQUEST_WARN_MS", "1")
    client = TestClient(_app_with_middleware())
    client.get(STREAM_PATH)
    for rec in caplog_slow.records:
        assert SYNTHETIC not in rec.message
        assert SYNTHETIC not in str(rec.args)
