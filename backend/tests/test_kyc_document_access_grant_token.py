"""Phase 5B3a — KYC document access grant token helper tests."""
from __future__ import annotations

import inspect
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import kyc_document_access_grant_token as grant_token  # noqa: E402

_VALID_TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCD"
_VALID_HASH = "a" * 64


def test_generated_token_is_string() -> None:
    assert isinstance(grant_token.generate_kyc_document_access_grant_token(), str)


def test_generated_token_non_empty() -> None:
    assert grant_token.generate_kyc_document_access_grant_token()


def test_generated_token_url_safe_charset_only() -> None:
    token = grant_token.generate_kyc_document_access_grant_token()
    assert grant_token.is_valid_kyc_document_access_grant_token(token)


def test_multiple_generated_tokens_differ() -> None:
    tokens = {grant_token.generate_kyc_document_access_grant_token() for _ in range(20)}
    assert len(tokens) == 20


def test_no_deterministic_generation_result() -> None:
    assert (
        grant_token.generate_kyc_document_access_grant_token()
        != grant_token.generate_kyc_document_access_grant_token()
    )


def test_token_contains_no_uuid_application_fixture() -> None:
    token = grant_token.generate_kyc_document_access_grant_token()
    assert "00000000-0000-0000-0000-000000000001" not in token


def test_token_validates() -> None:
    assert grant_token.is_valid_kyc_document_access_grant_token(_VALID_TOKEN)


def test_empty_token_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token("")


def test_whitespace_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token(" abcdefghijklmnopqrstuvwxyz0123456789AB")
    assert not grant_token.is_valid_kyc_document_access_grant_token("abcdefghijklmnopqrstuvwxyz0123456789AB ")


def test_control_characters_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token("abc\x01def")


def test_slash_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token(_VALID_TOKEN + "/")


def test_backslash_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token(_VALID_TOKEN + "\\")


def test_query_fragment_characters_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token(_VALID_TOKEN + "?")
    assert not grant_token.is_valid_kyc_document_access_grant_token(_VALID_TOKEN + "#")


def test_percent_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token(_VALID_TOKEN + "%")


def test_invalid_type_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_token(None)
    assert not grant_token.is_valid_kyc_document_access_grant_token(123)


def test_hash_is_64_lowercase_hex() -> None:
    digest = grant_token.hash_kyc_document_access_grant_token(_VALID_TOKEN)
    assert len(digest) == 64
    assert digest == digest.lower()
    assert all(ch in "0123456789abcdef" for ch in digest)


def test_same_token_gives_same_hash() -> None:
    assert grant_token.hash_kyc_document_access_grant_token(_VALID_TOKEN) == grant_token.hash_kyc_document_access_grant_token(
        _VALID_TOKEN
    )


def test_different_tokens_give_different_hashes() -> None:
    other = _VALID_TOKEN[:-1] + ("Z" if _VALID_TOKEN[-1] != "Z" else "Y")
    assert grant_token.hash_kyc_document_access_grant_token(_VALID_TOKEN) != grant_token.hash_kyc_document_access_grant_token(
        other
    )


def test_invalid_token_cannot_be_hashed() -> None:
    with pytest.raises(ValueError, match="invalid grant token"):
        grant_token.hash_kyc_document_access_grant_token("bad-token")


def test_valid_hash_accepted() -> None:
    assert grant_token.is_valid_kyc_document_access_grant_hash(_VALID_HASH)


def test_uppercase_hash_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_hash("A" * 64)


def test_wrong_length_hash_rejected() -> None:
    assert not grant_token.is_valid_kyc_document_access_grant_hash("a" * 63)


def test_compare_digest_true_for_same_hash() -> None:
    assert grant_token.grant_hashes_equal(_VALID_HASH, _VALID_HASH)


def test_compare_false_for_different_or_invalid_hash() -> None:
    assert not grant_token.grant_hashes_equal(_VALID_HASH, "b" * 64)
    assert not grant_token.grant_hashes_equal("bad", _VALID_HASH)


def test_generated_result_token_version_is_one() -> None:
    material = grant_token.generate_kyc_document_access_grant_material()
    assert material.token_version == 1


def test_object_repr_does_not_contain_raw_token() -> None:
    material = grant_token.generate_kyc_document_access_grant_material()
    rendered = repr(material)
    assert material.raw_token not in rendered
    assert "[REDACTED]" in rendered


def test_no_logging_or_serialization_helper_exists() -> None:
    public_names = grant_token.__all__
    for name in public_names:
        assert "log" not in name.lower()
        assert "serialize" not in name.lower()
        assert "persist" not in name.lower()
    source = inspect.getsource(grant_token)
    assert "import logging" not in source
    assert "json" not in source
