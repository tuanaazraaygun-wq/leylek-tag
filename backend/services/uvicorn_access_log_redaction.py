"""
Uvicorn access-log redaction for OPS-D7 KYC document-access stream paths.

Redacts the opaque grant token path segment from:
  /api/internal/enterprise/kyc/document-access/{grant_id}/stream

Default-on. No env flag. No secrets. Standard library only.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Final

# Exact OPS-D7 stream shape: one path segment between .../document-access/ and /stream.
# After /stream: end of string, query (?), or fragment (#) — not another path segment.
_KYC_DOCUMENT_ACCESS_STREAM_PATH_RE: Final[re.Pattern[str]] = re.compile(
    r"(/api/internal/enterprise/kyc/document-access/)([^/?#]+)(/stream)(?=[?#]|$)",
)

KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION: Final[str] = "<redacted>"

UVICORN_ACCESS_LOGGER_NAME: Final[str] = "uvicorn.access"


def redact_kyc_document_access_stream_path(value: object) -> str:
    """
    Return a string with the stream-route grant segment replaced by <redacted>.

    Safe for None / non-strings. Never raises. Deterministic.
    Query strings after /stream are preserved; the grant segment is never left visible.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        text = value
    else:
        try:
            text = str(value)
        except Exception:
            return ""
    try:
        return _KYC_DOCUMENT_ACCESS_STREAM_PATH_RE.sub(
            rf"\g<1>{KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION}\g<3>",
            text,
        )
    except Exception:
        return text


def _redact_logging_value(value: Any) -> Any:
    if isinstance(value, str):
        return redact_kyc_document_access_stream_path(value)
    return value


class UvicornAccessLogRedactionFilter(logging.Filter):
    """Redact KYC stream grant tokens from uvicorn.access LogRecord msg/args."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.msg, str):
                record.msg = redact_kyc_document_access_stream_path(record.msg)
            args = record.args
            if args is None:
                return True
            if isinstance(args, dict):
                record.args = {k: _redact_logging_value(v) for k, v in args.items()}
            elif isinstance(args, tuple):
                record.args = tuple(_redact_logging_value(a) for a in args)
            elif isinstance(args, list):
                record.args = [_redact_logging_value(a) for a in args]
            elif isinstance(args, str):
                record.args = redact_kyc_document_access_stream_path(args)
        except Exception:
            # Fail open for logging continuum; never raise from the filter.
            return True
        return True


def register_uvicorn_access_log_redaction() -> None:
    """
    Attach the redaction filter to uvicorn.access exactly once (idempotent).

    Safe to call multiple times. Does not disable access logging.
    """
    access_logger = logging.getLogger(UVICORN_ACCESS_LOGGER_NAME)
    for existing in access_logger.filters:
        if isinstance(existing, UvicornAccessLogRedactionFilter):
            return
    access_logger.addFilter(UvicornAccessLogRedactionFilter())


__all__ = (
    "KYC_DOCUMENT_ACCESS_STREAM_PATH_REDACTION",
    "UVICORN_ACCESS_LOGGER_NAME",
    "UvicornAccessLogRedactionFilter",
    "redact_kyc_document_access_stream_path",
    "register_uvicorn_access_log_redaction",
)
