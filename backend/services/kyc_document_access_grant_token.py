"""
Pure KYC document access grant token helpers (Phase 5B3a).

No persistence, env reads, Supabase, logging, or token recovery.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from typing import Final

KYC_DOCUMENT_ACCESS_GRANT_TOKEN_VERSION: Final = 1
KYC_DOCUMENT_ACCESS_GRANT_TOKEN_URLSAFE_BYTES: Final = 32
KYC_DOCUMENT_ACCESS_GRANT_TOKEN_MIN_LENGTH: Final = 32
KYC_DOCUMENT_ACCESS_GRANT_TOKEN_MAX_LENGTH: Final = 64
KYC_DOCUMENT_ACCESS_GRANT_REFERENCE_HASH_HEX_LENGTH: Final = 64

_TOKEN_URLSAFE_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_GRANT_HASH_HEX_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


@dataclass(frozen=True, slots=True)
class GeneratedKycDocumentAccessGrantToken:
    raw_token: str
    grant_reference_hash: str
    token_version: int

    def __repr__(self) -> str:
        return (
            "GeneratedKycDocumentAccessGrantToken("
            "raw_token='[REDACTED]', "
            f"grant_reference_hash='{self.grant_reference_hash}', "
            f"token_version={self.token_version})"
        )


def generate_kyc_document_access_grant_token() -> str:
    token = secrets.token_urlsafe(KYC_DOCUMENT_ACCESS_GRANT_TOKEN_URLSAFE_BYTES)
    if not is_valid_kyc_document_access_grant_token(token):
        raise ValueError("invalid grant token")
    return token


def is_valid_kyc_document_access_grant_token(value: object) -> bool:
    if not isinstance(value, str):
        return False
    if not value or value.strip() != value or not value.strip():
        return False
    if _CONTROL_CHARS.search(value):
        return False
    if any(char in value for char in ("/", "\\", "?", "#", "%")):
        return False
    if len(value) < KYC_DOCUMENT_ACCESS_GRANT_TOKEN_MIN_LENGTH:
        return False
    if len(value) > KYC_DOCUMENT_ACCESS_GRANT_TOKEN_MAX_LENGTH:
        return False
    return _TOKEN_URLSAFE_PATTERN.fullmatch(value) is not None


def hash_kyc_document_access_grant_token(raw_token: str) -> str:
    if not is_valid_kyc_document_access_grant_token(raw_token):
        raise ValueError("invalid grant token")
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def is_valid_kyc_document_access_grant_hash(value: object) -> bool:
    return isinstance(value, str) and _GRANT_HASH_HEX_PATTERN.fullmatch(value) is not None


def grant_hashes_equal(left: str, right: str) -> bool:
    if not is_valid_kyc_document_access_grant_hash(left):
        return False
    if not is_valid_kyc_document_access_grant_hash(right):
        return False
    return hmac.compare_digest(left, right)


def generate_kyc_document_access_grant_material() -> GeneratedKycDocumentAccessGrantToken:
    raw_token = generate_kyc_document_access_grant_token()
    return GeneratedKycDocumentAccessGrantToken(
        raw_token=raw_token,
        grant_reference_hash=hash_kyc_document_access_grant_token(raw_token),
        token_version=KYC_DOCUMENT_ACCESS_GRANT_TOKEN_VERSION,
    )


__all__ = [
    "GeneratedKycDocumentAccessGrantToken",
    "KYC_DOCUMENT_ACCESS_GRANT_REFERENCE_HASH_HEX_LENGTH",
    "KYC_DOCUMENT_ACCESS_GRANT_TOKEN_MAX_LENGTH",
    "KYC_DOCUMENT_ACCESS_GRANT_TOKEN_MIN_LENGTH",
    "KYC_DOCUMENT_ACCESS_GRANT_TOKEN_URLSAFE_BYTES",
    "KYC_DOCUMENT_ACCESS_GRANT_TOKEN_VERSION",
    "generate_kyc_document_access_grant_material",
    "generate_kyc_document_access_grant_token",
    "grant_hashes_equal",
    "hash_kyc_document_access_grant_token",
    "is_valid_kyc_document_access_grant_hash",
    "is_valid_kyc_document_access_grant_token",
]
