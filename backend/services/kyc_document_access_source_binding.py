"""
Pure KYC document source-binding HMAC helpers (Phase 5B3a).

Receives already-normalized Product-internal values only.
No env reads, storage I/O, DB access, or canonical message exposure.
"""
from __future__ import annotations

import hmac
import re
import uuid
from hashlib import sha256
from typing import Final

from contracts.kyc_document_access_persistence_contract import (
    KYC_DOCUMENT_ACCESS_DOCUMENT_TYPES,
)

KYC_DOCUMENT_SOURCE_BINDING_VERSION: Final = 1
KYC_DOCUMENT_SOURCE_BINDING_SECRET_KEY_MIN_BYTES: Final = 32
KYC_DOCUMENT_SOURCE_BINDING_HASH_HEX_LENGTH: Final = 64
KYC_DOCUMENT_SOURCE_BINDING_BUCKET_MAX_LENGTH: Final = 128
KYC_DOCUMENT_SOURCE_BINDING_OBJECT_PATH_MAX_LENGTH: Final = 512
KYC_DOCUMENT_SOURCE_BINDING_RECORD_VERSION_MAX_LENGTH: Final = 128

_RECORD_VERSION_NULL_MARKER: Final = "__NULL__"
_RECORD_VERSION_EMPTY_MARKER: Final = "__EMPTY__"

_BINDING_HASH_HEX_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def _canonical_uuid(application_id: str) -> str:
    try:
        return str(uuid.UUID(str(application_id).strip()))
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValueError("invalid binding input") from exc


def _validate_document_type(document_type: str) -> str:
    value = str(document_type).strip()
    if value not in KYC_DOCUMENT_ACCESS_DOCUMENT_TYPES:
        raise ValueError("invalid binding input")
    return value


def _validate_bucket(normalized_bucket: str) -> str:
    value = str(normalized_bucket).strip()
    if not value:
        raise ValueError("invalid binding input")
    if len(value) > KYC_DOCUMENT_SOURCE_BINDING_BUCKET_MAX_LENGTH:
        raise ValueError("invalid binding input")
    if _CONTROL_CHARS.search(value):
        raise ValueError("invalid binding input")
    if any(char in value for char in ("/", "\\", "?", "#", "%")):
        raise ValueError("invalid binding input")
    return value


def _validate_object_path(normalized_object_path: str, application_id: str) -> str:
    value = str(normalized_object_path).strip()
    if not value:
        raise ValueError("invalid binding input")
    if len(value) > KYC_DOCUMENT_SOURCE_BINDING_OBJECT_PATH_MAX_LENGTH:
        raise ValueError("invalid binding input")
    if _CONTROL_CHARS.search(value):
        raise ValueError("invalid binding input")
    if "\\" in value or "?" in value or "#" in value:
        raise ValueError("invalid binding input")
    if ".." in value.split("/"):
        raise ValueError("invalid binding input")
    expected_prefix = f"kyc/{application_id}/"
    if not value.startswith(expected_prefix):
        raise ValueError("invalid binding input")
    return value


def _canonical_record_version(application_record_version: str | None) -> str:
    if application_record_version is None:
        return _RECORD_VERSION_NULL_MARKER
    value = str(application_record_version).strip()
    if len(value) > KYC_DOCUMENT_SOURCE_BINDING_RECORD_VERSION_MAX_LENGTH:
        raise ValueError("invalid binding input")
    if _CONTROL_CHARS.search(value):
        raise ValueError("invalid binding input")
    if value == "":
        return _RECORD_VERSION_EMPTY_MARKER
    return value


def _validate_secret_key(secret_key: object) -> bytes:
    if not isinstance(secret_key, (bytes, bytearray)):
        raise ValueError("invalid binding key")
    key = bytes(secret_key)
    if len(key) < KYC_DOCUMENT_SOURCE_BINDING_SECRET_KEY_MIN_BYTES:
        raise ValueError("invalid binding key")
    return key


def _length_prefixed_field(value: str) -> bytes:
    encoded = value.encode("utf-8")
    return f"{len(encoded)}:".encode("ascii") + encoded


def _build_canonical_message(
    *,
    application_id: str,
    document_type: str,
    normalized_bucket: str,
    normalized_object_path: str,
    application_record_version: str | None,
) -> bytes:
    app_uuid = _canonical_uuid(application_id)
    doc_type = _validate_document_type(document_type)
    bucket = _validate_bucket(normalized_bucket)
    object_path = _validate_object_path(normalized_object_path, app_uuid)
    record_version = _canonical_record_version(application_record_version)

    parts = [
        f"v{KYC_DOCUMENT_SOURCE_BINDING_VERSION}".encode("ascii"),
        _length_prefixed_field(app_uuid),
        _length_prefixed_field(doc_type),
        _length_prefixed_field(bucket),
        _length_prefixed_field(object_path),
        _length_prefixed_field(record_version),
    ]
    return b"\n".join(parts)


def compute_kyc_document_source_binding_hash(
    *,
    secret_key: bytes,
    application_id: str,
    document_type: str,
    normalized_bucket: str,
    normalized_object_path: str,
    application_record_version: str | None,
) -> str:
    key = _validate_secret_key(secret_key)
    message = _build_canonical_message(
        application_id=application_id,
        document_type=document_type,
        normalized_bucket=normalized_bucket,
        normalized_object_path=normalized_object_path,
        application_record_version=application_record_version,
    )
    digest = hmac.new(key, message, sha256).hexdigest()
    if not is_valid_kyc_document_source_binding_hash(digest):
        raise ValueError("invalid binding hash")
    return digest


def is_valid_kyc_document_source_binding_hash(value: object) -> bool:
    return isinstance(value, str) and _BINDING_HASH_HEX_PATTERN.fullmatch(value) is not None


def source_binding_hashes_equal(left: str, right: str) -> bool:
    if not is_valid_kyc_document_source_binding_hash(left):
        return False
    if not is_valid_kyc_document_source_binding_hash(right):
        return False
    return hmac.compare_digest(left, right)


__all__ = [
    "KYC_DOCUMENT_SOURCE_BINDING_BUCKET_MAX_LENGTH",
    "KYC_DOCUMENT_SOURCE_BINDING_HASH_HEX_LENGTH",
    "KYC_DOCUMENT_SOURCE_BINDING_OBJECT_PATH_MAX_LENGTH",
    "KYC_DOCUMENT_SOURCE_BINDING_RECORD_VERSION_MAX_LENGTH",
    "KYC_DOCUMENT_SOURCE_BINDING_SECRET_KEY_MIN_BYTES",
    "KYC_DOCUMENT_SOURCE_BINDING_VERSION",
    "compute_kyc_document_source_binding_hash",
    "is_valid_kyc_document_source_binding_hash",
    "source_binding_hashes_equal",
]
