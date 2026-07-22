"""Focused tests for OPS-D7 Uvicorn access-log grant-token redaction."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.uvicorn_access_log_redaction import (  # noqa: E402
    KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION,
    UVICORN_ACCESS_LOGGER_NAME,
    UvicornAccessLogRedactionFilter,
    redact_kyc_document_access_stream_path,
    register_uvicorn_access_log_redaction,
)

SYNTHETIC = "SYNTHETIC_GRANT_PLACEHOLDER_NOT_A_SECRET"
STREAM_RAW = (
    f"/api/internal/enterprise/kyc/document-access/{SYNTHETIC}/stream"
)
STREAM_REDACTED = (
    f"/api/internal/enterprise/kyc/document-access/"
    f"{KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION}/stream"
)


def _emit_access(logger: logging.Logger, path: str) -> str:
    """Emit a uvicorn-shaped access record and return the formatted message."""
    record = logger.makeRecord(
        UVICORN_ACCESS_LOGGER_NAME,
        logging.INFO,
        __file__,
        0,
        '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:12345", "GET", path, "1.1", 200),
        None,
    )
    for f in list(logger.filters):
        assert f.filter(record) is True
    return record.getMessage()


def test_helper_exact_route_redacts_placeholder() -> None:
    out = redact_kyc_document_access_stream_path(STREAM_RAW)
    assert SYNTHETIC not in out
    assert KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION in out
    assert out == STREAM_REDACTED


def test_helper_preserves_query_string() -> None:
    raw = f"{STREAM_RAW}?trace=1&x=y"
    out = redact_kyc_document_access_stream_path(raw)
    assert SYNTHETIC not in out
    assert out.endswith("?trace=1&x=y")
    assert STREAM_REDACTED in out


def test_helper_percent_encoded_segment_absent() -> None:
    enc = "abc%2Fdef%2Eghi0123456789ABCDEF"
    raw = f"/api/internal/enterprise/kyc/document-access/{enc}/stream"
    out = redact_kyc_document_access_stream_path(raw)
    assert enc not in out
    assert SYNTHETIC not in out
    assert KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION in out


def test_helper_very_long_token_absent() -> None:
    long_tok = "A" * 500
    raw = f"/api/internal/enterprise/kyc/document-access/{long_tok}/stream"
    out = redact_kyc_document_access_stream_path(raw)
    assert long_tok not in out
    assert KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION in out


def test_helper_unrelated_token_like_route_unchanged() -> None:
    raw = f"/api/other/document-access/{SYNTHETIC}/stream"
    assert redact_kyc_document_access_stream_path(raw) == raw


def test_helper_missing_stream_suffix_unchanged() -> None:
    raw = f"/api/internal/enterprise/kyc/document-access/{SYNTHETIC}"
    assert redact_kyc_document_access_stream_path(raw) == raw


def test_helper_extra_path_segment_unchanged() -> None:
    raw = f"{STREAM_RAW}/extra"
    assert redact_kyc_document_access_stream_path(raw) == raw
    assert SYNTHETIC in raw


def test_helper_empty_segment_unchanged() -> None:
    raw = "/api/internal/enterprise/kyc/document-access//stream"
    assert redact_kyc_document_access_stream_path(raw) == raw


def test_helper_none_and_non_string_safe() -> None:
    assert redact_kyc_document_access_stream_path(None) == ""
    assert redact_kyc_document_access_stream_path(12345) == "12345"
    odd = redact_kyc_document_access_stream_path(
        f"/api/internal/enterprise/kyc/document-access/{SYNTHETIC}/stream"
    )
    assert SYNTHETIC not in odd


def test_filter_uvicorn_shaped_record_redacts_path() -> None:
    logger = logging.getLogger("test_uvicorn_access_redaction_once")
    logger.handlers.clear()
    logger.filters.clear()
    logger.addFilter(UvicornAccessLogRedactionFilter())
    msg = _emit_access(logger, STREAM_RAW)
    assert SYNTHETIC not in msg
    assert KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION in msg
    assert "GET" in msg
    assert "HTTP/1.1" in msg
    assert "200" in msg
    assert "127.0.0.1:12345" in msg


def test_filter_unrelated_access_record_unchanged() -> None:
    logger = logging.getLogger("test_uvicorn_access_redaction_unrelated")
    logger.handlers.clear()
    logger.filters.clear()
    logger.addFilter(UvicornAccessLogRedactionFilter())
    path = "/api/auth/check-user"
    msg = _emit_access(logger, path)
    assert path in msg
    assert KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION not in msg


def test_filter_odd_args_no_exception() -> None:
    filt = UvicornAccessLogRedactionFilter()
    record = logging.LogRecord(
        name=UVICORN_ACCESS_LOGGER_NAME,
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg="plain %s",
        args=["not-a-path"],
        exc_info=None,
    )
    assert filt.filter(record) is True
    record2 = logging.LogRecord(
        name=UVICORN_ACCESS_LOGGER_NAME,
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg=STREAM_RAW,
        args=None,
        exc_info=None,
    )
    assert filt.filter(record2) is True
    assert SYNTHETIC not in record2.getMessage()
    # Mapping-style args: set after construct (Py3.14 LogRecord ctor rejects Mapping args).
    record3 = logging.LogRecord(
        name=UVICORN_ACCESS_LOGGER_NAME,
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg="%(path)s",
        args=(),
        exc_info=None,
    )
    record3.args = {"path": STREAM_RAW}
    assert filt.filter(record3) is True
    assert SYNTHETIC not in record3.getMessage()


def test_register_idempotent_single_filter() -> None:
    access = logging.getLogger(UVICORN_ACCESS_LOGGER_NAME)
    # Remove only our filter type to start clean for this assertion.
    access.filters[:] = [
        f for f in access.filters if not isinstance(f, UvicornAccessLogRedactionFilter)
    ]
    register_uvicorn_access_log_redaction()
    register_uvicorn_access_log_redaction()
    register_uvicorn_access_log_redaction()
    ours = [
        f for f in access.filters if isinstance(f, UvicornAccessLogRedactionFilter)
    ]
    assert len(ours) == 1


def test_server_registers_redaction_on_import() -> None:
    # Import side-effect: server.py calls register_uvicorn_access_log_redaction().
    import importlib

    import server as server_mod

    importlib.reload(server_mod)
    access = logging.getLogger(UVICORN_ACCESS_LOGGER_NAME)
    ours = [
        f for f in access.filters if isinstance(f, UvicornAccessLogRedactionFilter)
    ]
    assert len(ours) >= 1


def test_synthetic_placeholder_never_in_filtered_message() -> None:
    filt = UvicornAccessLogRedactionFilter()
    record = logging.LogRecord(
        name=UVICORN_ACCESS_LOGGER_NAME,
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg='%s - "%s %s HTTP/%s" %d',
        args=("127.0.0.1:1", "GET", STREAM_RAW, "1.1", 401),
        exc_info=None,
    )
    assert filt.filter(record) is True
    rendered = record.getMessage()
    assert SYNTHETIC not in rendered
    assert "401" in rendered
