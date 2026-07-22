"""
HTTP slow-request observer — watchlist paths only, threshold logging, no PII.
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, FrozenSet, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from services.uvicorn_access_log_redaction import redact_kyc_document_access_stream_path

logger = logging.getLogger("slow_request")

WATCH_PATHS: FrozenSet[str] = frozenset(
    {
        "/api/passenger/active-tag",
        "/api/driver/active-tag",
        "/api/driver/active-trip",
        "/api/driver/requests",
        "/api/driver/nearby-activity",
        "/api/driver/nearby-passengers-map",
        "/api/trip/check-end-request",
        "/api/trust/active",
        "/api/qr/boarding-code",
        "/api/qr/verify-boarding",
        "/api/trip/complete-qr",
        "/api/trip/force-end",
        "/api/trip/force-end-confirm",
        "/api/places/search",
        "/api/price/calculate",
        "/api/route-metrics",
        "/api/directions",
        "/api/trusted/status",
        "/api/trusted/invites",
    }
)

# Path prefix watchlist — dynamic segments (driver-location/{id}, quick-match/*, invites/*)
WATCH_PATH_PREFIXES: tuple[str, ...] = (
    "/api/passenger/driver-location/",
    "/api/driver/passenger-location/",
    "/api/quick-match/",
    "/api/trusted/invites/",
)

SAFE_QUERY_KEYS = ("user_id", "driver_id", "passenger_id", "tag_id")


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return default


def _mask_user_id(value: Any) -> str:
    s = str(value or "").strip()
    if not s:
        return "n/a"
    if len(s) <= 8:
        return f"***{s[-2:]}"
    return f"{s[:4]}***{s[-4:]}"


def _short_tag_id(value: Any) -> str:
    s = str(value or "").strip()
    if not s:
        return "n/a"
    if len(s) <= 12:
        return s
    return f"{s[:6]}…{s[-4:]}"


def _client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _safe_query_fields(request: Request) -> dict[str, str]:
    out: dict[str, str] = {}
    for key in SAFE_QUERY_KEYS:
        val = request.query_params.get(key)
        if not val:
            continue
        if key == "tag_id":
            out["tag_id_short"] = _short_tag_id(val)
        else:
            out[f"{key}_masked"] = _mask_user_id(val)
    return out


def _should_log_path(path: str, watchlist_only: bool) -> bool:
    if not watchlist_only:
        return True
    if path in WATCH_PATHS:
        return True
    return any(path.startswith(prefix) for prefix in WATCH_PATH_PREFIXES)


class SlowRequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs watchlisted HTTP requests that exceed warn/error duration thresholds."""

    async def dispatch(self, request: Request, call_next) -> Response:
        enabled = _env_bool("SLOW_REQUEST_LOG_ENABLED", True)
        if not enabled:
            return await call_next(request)

        method = request.method.upper()
        if method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        # Always redact OPS-D7 stream grant tokens before any slow-path decision/log.
        # Holds even when SLOW_REQUEST_WATCHLIST_ONLY=false.
        log_path = redact_kyc_document_access_stream_path(path)
        watchlist_only = _env_bool("SLOW_REQUEST_WATCHLIST_ONLY", True)
        if not _should_log_path(path, watchlist_only):
            return await call_next(request)

        warn_ms = max(1, _env_int("SLOW_REQUEST_WARN_MS", 500))
        error_ms = max(warn_ms, _env_int("SLOW_REQUEST_ERROR_MS", 2000))

        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - started) * 1000)

        if duration_ms < warn_ms:
            return response

        level = "error" if duration_ms >= error_ms else "warn"
        threshold_ms = error_ms if level == "error" else warn_ms

        payload: dict[str, Any] = {
            "log_tag": "SLOW_HTTP",
            "level": level,
            "method": method,
            "path": log_path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "threshold_ms": threshold_ms,
            "client_ip": _client_ip(request),
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        payload.update(_safe_query_fields(request))

        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if level == "error":
            logger.error(line)
        else:
            logger.warning(line)

        return response
