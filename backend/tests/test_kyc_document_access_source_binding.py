"""Phase 5B3a — KYC document source-binding helper tests."""
from __future__ import annotations

import inspect
import sys
import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import kyc_document_access_source_binding as binding  # noqa: E402

_APP_ID = "550e8400-e29b-41d4-a716-446655440000"
_APP_ID_CANON = str(uuid.UUID(_APP_ID))
_BUCKET = "kyc-documents"
_OBJECT_PATH = f"kyc/{_APP_ID_CANON}/license_abcd1234.jpg"
_KEY = b"x" * 32


def _compute(**overrides: object) -> str:
    params = {
        "secret_key": _KEY,
        "application_id": _APP_ID,
        "document_type": "license",
        "normalized_bucket": _BUCKET,
        "normalized_object_path": _OBJECT_PATH,
        "application_record_version": "2026-01-01T00:00:00+00:00",
    }
    params.update(overrides)
    return binding.compute_kyc_document_source_binding_hash(**params)  # type: ignore[arg-type]


def test_deterministic_output_for_same_inputs_key() -> None:
    assert _compute() == _compute()


def test_different_key_changes_hash() -> None:
    assert _compute(secret_key=b"y" * 32) != _compute()


def test_different_application_changes_hash() -> None:
    other_app = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    other_path = f"kyc/{other_app}/license_abcd1234.jpg"
    assert _compute(
        application_id=other_app,
        normalized_object_path=other_path,
    ) != _compute()


def test_different_document_type_changes_hash() -> None:
    assert _compute(document_type="selfie") != _compute()


def test_different_bucket_changes_hash() -> None:
    assert _compute(normalized_bucket="other-bucket") != _compute()


def test_different_object_path_changes_hash() -> None:
    other_path = f"kyc/{_APP_ID_CANON}/license_efgh5678.jpg"
    assert _compute(normalized_object_path=other_path) != _compute()


def test_different_record_version_changes_hash() -> None:
    assert _compute(application_record_version="2026-01-02T00:00:00+00:00") != _compute()


def test_null_version_differs_from_empty_version() -> None:
    null_hash = _compute(application_record_version=None)
    empty_hash = _compute(application_record_version="")
    assert null_hash != empty_hash


def test_output_is_64_lowercase_hex() -> None:
    digest = _compute()
    assert len(digest) == 64
    assert digest == digest.lower()


def test_valid_hash_accepted() -> None:
    assert binding.is_valid_kyc_document_source_binding_hash(_compute())


def test_uppercase_rejected() -> None:
    assert not binding.is_valid_kyc_document_source_binding_hash("A" * 64)


def test_compare_true_for_same_hash() -> None:
    digest = _compute()
    assert binding.source_binding_hashes_equal(digest, digest)


def test_compare_false_for_different_or_invalid_hash() -> None:
    digest = _compute()
    assert not binding.source_binding_hashes_equal(digest, "b" * 64)
    assert not binding.source_binding_hashes_equal("bad", digest)


def test_non_bytes_key_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding key"):
        _compute(secret_key="not-bytes")  # type: ignore[arg-type]


def test_empty_key_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding key"):
        _compute(secret_key=b"")


def test_key_shorter_than_32_bytes_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding key"):
        _compute(secret_key=b"x" * 31)


def test_valid_32_byte_key_accepted() -> None:
    assert binding.is_valid_kyc_document_source_binding_hash(_compute(secret_key=b"z" * 32))


def test_invalid_uuid_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(application_id="not-a-uuid")


def test_uuid_canonicalized_lowercase() -> None:
    upper = "550E8400-E29B-41D4-A716-446655440000"
    assert _compute(application_id=upper) == _compute(application_id=_APP_ID_CANON)


def test_unsupported_document_type_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(document_type="identity")


def test_empty_bucket_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_bucket="")


def test_bucket_control_character_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_bucket="bad\x01bucket")


def test_empty_object_path_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_object_path="")


def test_wrong_application_prefix_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_object_path="kyc/other-app/license_abcd1234.jpg")


def test_traversal_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_object_path=f"kyc/{_APP_ID_CANON}/../license_abcd1234.jpg")


def test_backslash_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_object_path=f"kyc\\{_APP_ID_CANON}\\license_abcd1234.jpg")


def test_query_fragment_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_object_path=f"kyc/{_APP_ID_CANON}/license_abcd1234.jpg?x=1")
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_object_path=f"kyc/{_APP_ID_CANON}/license_abcd1234.jpg#frag")


def test_excessively_long_inputs_rejected() -> None:
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(normalized_bucket="b" * (binding.KYC_DOCUMENT_SOURCE_BINDING_BUCKET_MAX_LENGTH + 1))
    with pytest.raises(ValueError, match="invalid binding input"):
        _compute(
            normalized_object_path="kyc/"
            + _APP_ID_CANON
            + "/"
            + ("a" * binding.KYC_DOCUMENT_SOURCE_BINDING_OBJECT_PATH_MAX_LENGTH)
        )


def test_exception_messages_contain_no_raw_path() -> None:
    bad_path = f"kyc/not-{_APP_ID_CANON}/secret/license_abcd1234.jpg"
    with pytest.raises(ValueError) as exc:
        _compute(normalized_object_path=bad_path)
    assert bad_path not in str(exc.value)


def test_exception_messages_contain_no_secret() -> None:
    with pytest.raises(ValueError) as exc:
        _compute(secret_key=b"")
    assert _KEY.decode() not in str(exc.value)


def test_canonicalization_prevents_field_boundary_collisions() -> None:
    # Length-prefixing prevents bucket/path boundary ambiguity across fields.
    hash_a = _compute(normalized_bucket="ab", normalized_object_path=f"kyc/{_APP_ID_CANON}/c/d.jpg")
    hash_b = _compute(normalized_bucket="a", normalized_object_path=f"kyc/{_APP_ID_CANON}/bc/d.jpg")
    assert hash_a != hash_b


def test_no_environment_read() -> None:
    source = inspect.getsource(binding)
    assert "os.getenv" not in source
    assert "os.environ" not in source
    assert "dotenv" not in source


def test_no_db_storage_network_imports() -> None:
    module_names = {name for name in binding.__dict__ if not name.startswith("_")}
    forbidden = {"supabase", "requests", "httpx", "storage", "boto3"}
    assert module_names.isdisjoint(forbidden)
    source = inspect.getsource(binding)
    assert "supabase" not in source
    assert "requests" not in source
    assert "httpx" not in source
