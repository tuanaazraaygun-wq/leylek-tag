"""
Pure KYC document source-reference normalization (Phase 5A).

Product-internal only. No storage I/O, signed URLs, or network access.
"""
from __future__ import annotations

import ipaddress
import re
import uuid
from dataclasses import dataclass
from typing import Collection, Literal, Optional, Union
from urllib.parse import unquote, urlparse

STORAGE_PUBLIC_OBJECT_PREFIX = "/storage/v1/object/public/"

KycDocumentSourceNormalizationFailureReason = Literal[
    "invalid_source_reference",
    "unsupported_scheme",
    "external_host",
    "bucket_mismatch",
    "ownership_mismatch",
    "traversal_detected",
    "invalid_application_id",
    "control_character_detected",
]

KYC_OBJECT_SEGMENT_PATTERN = re.compile(
    r"^(license|vehicle|motorcycle|selfie)_[0-9a-f]{8}\.jpg$",
    re.IGNORECASE,
)

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


@dataclass(frozen=True, slots=True)
class KycDocumentSourceNormalizationSuccess:
    normalized_bucket: str
    normalized_object_path: str
    provider_kind: Literal["supabase_storage"]
    source_kind: Literal["public_url", "relative_path"]


@dataclass(frozen=True, slots=True)
class KycDocumentSourceNormalizationFailure:
    reason_code: KycDocumentSourceNormalizationFailureReason


KycDocumentSourceNormalizationResult = Union[
    KycDocumentSourceNormalizationSuccess,
    KycDocumentSourceNormalizationFailure,
]


def _failure(reason_code: KycDocumentSourceNormalizationFailureReason) -> KycDocumentSourceNormalizationFailure:
    return KycDocumentSourceNormalizationFailure(reason_code=reason_code)


def _canonical_application_id(application_id: str) -> Optional[str]:
    raw = str(application_id or "").strip()
    if not raw:
        return None
    try:
        return str(uuid.UUID(raw)).lower()
    except (ValueError, AttributeError, TypeError):
        return None


def _contains_control_chars(value: str) -> bool:
    return _CONTROL_CHARS.search(value) is not None


def _is_blocked_host(hostname: str) -> bool:
    host = hostname.strip().lower().rstrip(".")
    if not host:
        return True
    if host in {"localhost", "127.0.0.1", "::1"}:
        return True
    if host.endswith(".local") or host.endswith(".internal"):
        return True
    try:
        ip = ipaddress.ip_address(host)
        return bool(ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
    except ValueError:
        return False


def _normalize_relative_object_path(raw_path: str) -> Optional[str]:
    candidate = str(raw_path or "").strip()
    if not candidate:
        return None
    if candidate.startswith("/") or "\\" in candidate:
        return None
    if "?" in candidate or "#" in candidate:
        return None
    if _contains_control_chars(candidate):
        return None
    decoded = unquote(candidate)
    if _contains_control_chars(decoded):
        return None
    if decoded != decoded.strip():
        return None
    segments = [segment for segment in decoded.split("/") if segment != ""]
    if not segments:
        return None
    if any(segment in {".", ".."} for segment in segments):
        return None
    return "/".join(segments)


def _validate_object_path_for_application(
    object_path: str,
    *,
    application_id: str,
) -> Optional[KycDocumentSourceNormalizationFailureReason]:
    canonical_id = _canonical_application_id(application_id)
    if canonical_id is None:
        return "invalid_application_id"

    normalized = _normalize_relative_object_path(object_path)
    if normalized is None:
        return "invalid_source_reference"

    expected_prefix = f"kyc/{canonical_id}/"
    if not normalized.startswith(expected_prefix):
        if normalized == expected_prefix.rstrip("/"):
            return "invalid_source_reference"
        return "ownership_mismatch"

    relative_tail = normalized[len(expected_prefix) :]
    if not relative_tail or relative_tail.endswith("/"):
        return "invalid_source_reference"

    filename = relative_tail.rsplit("/", 1)[-1]
    if not filename or not KYC_OBJECT_SEGMENT_PATTERN.fullmatch(filename):
        return "invalid_source_reference"

    double_decoded = unquote(unquote(normalized))
    if double_decoded != normalized and ".." in double_decoded.split("/"):
        return "traversal_detected"

    return None


def _parse_supabase_public_url(
    raw_reference: str,
    *,
    allowed_public_hosts: Collection[str],
    allowed_bucket: str,
) -> Optional[tuple[str, str]]:
    parsed = urlparse(str(raw_reference).strip())
    if parsed.scheme != "https":
        return None
    if parsed.username or parsed.password:
        return None
    if parsed.fragment:
        return None
    if parsed.query:
        return None
    if not parsed.hostname:
        return None
    if _is_blocked_host(parsed.hostname):
        return None

    allowed_hosts = {host.strip().lower().rstrip(".") for host in allowed_public_hosts if str(host).strip()}
    host = parsed.hostname.strip().lower().rstrip(".")
    if host not in allowed_hosts:
        return None

    path = unquote(parsed.path or "")
    if "/object/sign/" in path:
        return None
    if not path.startswith(STORAGE_PUBLIC_OBJECT_PREFIX):
        return None

    remainder = path[len(STORAGE_PUBLIC_OBJECT_PREFIX) :]
    if not remainder or "/" not in remainder:
        return None

    bucket, object_path = remainder.split("/", 1)
    if bucket != allowed_bucket:
        return None

    normalized_object_path = _normalize_relative_object_path(object_path)
    if normalized_object_path is None:
        return None

    return bucket, normalized_object_path


def normalize_kyc_document_source_reference(
    raw_reference: object,
    *,
    application_id: str,
    allowed_public_hosts: Collection[str],
    allowed_bucket: str,
) -> KycDocumentSourceNormalizationResult:
    if raw_reference is None:
        return _failure("invalid_source_reference")

    if not isinstance(raw_reference, str):
        return _failure("invalid_source_reference")

    raw = raw_reference.strip()
    if not raw or _contains_control_chars(raw):
        return _failure("control_character_detected")

    lowered = raw.lower()
    if lowered.startswith("data:") or lowered.startswith("file:") or lowered.startswith("javascript:"):
        return _failure("unsupported_scheme")

    if lowered.startswith("http://"):
        return _failure("unsupported_scheme")

    bucket = str(allowed_bucket or "").strip()
    if not bucket:
        return _failure("bucket_mismatch")

    if lowered.startswith("https://"):
        parsed = _parse_supabase_public_url(
            raw,
            allowed_public_hosts=allowed_public_hosts,
            allowed_bucket=bucket,
        )
        if parsed is None:
            if urlparse(raw).scheme == "https" and urlparse(raw).hostname:
                host = urlparse(raw).hostname.strip().lower().rstrip(".")
                allowed_hosts = {
                    h.strip().lower().rstrip(".") for h in allowed_public_hosts if str(h).strip()
                }
                if host not in allowed_hosts:
                    return _failure("external_host")
            return _failure("invalid_source_reference")

        _, object_path = parsed
        validation_error = _validate_object_path_for_application(
            object_path,
            application_id=application_id,
        )
        if validation_error is not None:
            return _failure(validation_error)

        return KycDocumentSourceNormalizationSuccess(
            normalized_bucket=bucket,
            normalized_object_path=object_path,
            provider_kind="supabase_storage",
            source_kind="public_url",
        )

    if "://" in raw:
        return _failure("unsupported_scheme")

    validation_error = _validate_object_path_for_application(
        raw,
        application_id=application_id,
    )
    if validation_error is not None:
        return _failure(validation_error)

    normalized_object_path = _normalize_relative_object_path(raw)
    if normalized_object_path is None:
        return _failure("invalid_source_reference")

    return KycDocumentSourceNormalizationSuccess(
        normalized_bucket=bucket,
        normalized_object_path=normalized_object_path,
        provider_kind="supabase_storage",
        source_kind="relative_path",
    )


__all__ = [
    "KYC_OBJECT_SEGMENT_PATTERN",
    "KycDocumentSourceNormalizationFailure",
    "KycDocumentSourceNormalizationFailureReason",
    "KycDocumentSourceNormalizationResult",
    "KycDocumentSourceNormalizationSuccess",
    "STORAGE_PUBLIC_OBJECT_PREFIX",
    "normalize_kyc_document_source_reference",
]
