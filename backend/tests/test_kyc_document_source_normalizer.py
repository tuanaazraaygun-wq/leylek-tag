"""Phase 5A — KYC document source-reference normalizer tests (pure, synthetic)."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.kyc_document_source_normalizer import (  # noqa: E402
    KycDocumentSourceNormalizationFailure,
    KycDocumentSourceNormalizationSuccess,
    normalize_kyc_document_source_reference,
)

APP_ID = "11111111-2222-4333-8444-555555555555"
UPPER_APP_ID = "11111111-2222-4333-8444-555555555555".upper()
HOST = "project-ref.example.supabase.co"
BUCKET = "vehicle-photos"
RELATIVE = f"kyc/{APP_ID}/license_abcd1234.jpg"
PUBLIC_URL = f"https://{HOST}/storage/v1/object/public/{BUCKET}/{RELATIVE}"


def _success(**kwargs: object) -> KycDocumentSourceNormalizationSuccess:
    result = normalize_kyc_document_source_reference(
        kwargs.pop("raw"),
        application_id=str(kwargs.pop("application_id", APP_ID)),
        allowed_public_hosts=kwargs.pop("allowed_public_hosts", [HOST]),
        allowed_bucket=str(kwargs.pop("allowed_bucket", BUCKET)),
    )
    assert isinstance(result, KycDocumentSourceNormalizationSuccess)
    return result


def _failure(raw: object, **kwargs: object) -> KycDocumentSourceNormalizationFailure:
    result = normalize_kyc_document_source_reference(
        raw,
        application_id=str(kwargs.pop("application_id", APP_ID)),
        allowed_public_hosts=kwargs.pop("allowed_public_hosts", [HOST]),
        allowed_bucket=str(kwargs.pop("allowed_bucket", BUCKET)),
    )
    assert isinstance(result, KycDocumentSourceNormalizationFailure)
    return result


def test_public_url_accepted() -> None:
    result = _success(raw=PUBLIC_URL)
    assert result.normalized_bucket == BUCKET
    assert result.normalized_object_path == RELATIVE
    assert result.provider_kind == "supabase_storage"
    assert result.source_kind == "public_url"


def test_relative_path_accepted() -> None:
    result = _success(raw=RELATIVE)
    assert result.source_kind == "relative_path"
    assert result.normalized_object_path == RELATIVE


def test_uppercase_uuid_canonicalized() -> None:
    relative = f"kyc/{APP_ID}/selfie_abcd1234.jpg"
    result = _success(raw=relative, application_id=UPPER_APP_ID)
    assert result.normalized_object_path == relative


def test_external_host_rejected() -> None:
    result = _failure(
        f"https://evil.example/storage/v1/object/public/{BUCKET}/{RELATIVE}",
    )
    assert result.reason_code == "external_host"


def test_lookalike_host_rejected() -> None:
    result = _failure(
        f"https://project-ref.example.supabase.co.evil.net/storage/v1/object/public/{BUCKET}/{RELATIVE}",
    )
    assert result.reason_code == "external_host"


def test_http_rejected() -> None:
    assert _failure(f"http://{HOST}/storage/v1/object/public/{BUCKET}/{RELATIVE}").reason_code == "unsupported_scheme"


def test_data_file_javascript_rejected() -> None:
    assert _failure("data:text/plain,abc").reason_code == "unsupported_scheme"
    assert _failure("file:///tmp/x.jpg").reason_code == "unsupported_scheme"
    assert _failure("javascript:alert(1)").reason_code == "unsupported_scheme"


def test_username_password_rejected() -> None:
    result = _failure(f"https://user:pass@{HOST}/storage/v1/object/public/{BUCKET}/{RELATIVE}")
    assert result.reason_code == "invalid_source_reference"


def test_fragment_rejected() -> None:
    result = _failure(f"{PUBLIC_URL}#frag")
    assert result.reason_code == "invalid_source_reference"


def test_tokenized_query_rejected() -> None:
    result = _failure(f"{PUBLIC_URL}?token=abc")
    assert result.reason_code == "invalid_source_reference"


def test_signed_route_rejected() -> None:
    signed = f"https://{HOST}/storage/v1/object/sign/{BUCKET}/{RELATIVE}"
    result = _failure(signed)
    assert result.reason_code == "invalid_source_reference"


def test_unknown_supabase_route_rejected() -> None:
    result = _failure(f"https://{HOST}/storage/v1/render/public/{BUCKET}/{RELATIVE}")
    assert result.reason_code == "invalid_source_reference"


def test_wrong_bucket_rejected() -> None:
    result = _failure(
        f"https://{HOST}/storage/v1/object/public/other-bucket/{RELATIVE}",
    )
    assert result.reason_code == "invalid_source_reference"


def test_wrong_application_prefix_rejected() -> None:
    other = "kyc/22222222-2222-4222-8222-222222222222/license_abcd1234.jpg"
    result = _failure(f"https://{HOST}/storage/v1/object/public/{BUCKET}/{other}")
    assert result.reason_code == "ownership_mismatch"


def test_plain_traversal_rejected() -> None:
    result = _failure(f"kyc/{APP_ID}/../other/license_abcd1234.jpg")
    assert result.reason_code in {"traversal_detected", "invalid_source_reference", "ownership_mismatch"}


def test_encoded_traversal_rejected() -> None:
    result = _failure(f"kyc/{APP_ID}/%2e%2e/other/license_abcd1234.jpg")
    assert result.reason_code in {"traversal_detected", "invalid_source_reference", "ownership_mismatch"}


def test_double_encoded_traversal_fail_closed() -> None:
    result = _failure(f"kyc/{APP_ID}/%252e%252e/other/license_abcd1234.jpg")
    assert result.reason_code in {"traversal_detected", "invalid_source_reference", "ownership_mismatch"}


def test_backslash_traversal_rejected() -> None:
    result = _failure(f"kyc\\{APP_ID}\\license_abcd1234.jpg")
    assert result.reason_code == "invalid_source_reference"


def test_control_characters_rejected() -> None:
    result = _failure(f"kyc/{APP_ID}/license_abcd1234.jpg\x00")
    assert result.reason_code == "control_character_detected"


def test_absolute_filesystem_path_rejected() -> None:
    result = _failure(f"/kyc/{APP_ID}/license_abcd1234.jpg")
    assert result.reason_code == "invalid_source_reference"


def test_empty_final_segment_rejected() -> None:
    result = _failure(f"kyc/{APP_ID}/")
    assert result.reason_code == "invalid_source_reference"


def test_unsupported_extension_rejected() -> None:
    result = _failure(f"kyc/{APP_ID}/license_abcd1234.png")
    assert result.reason_code == "invalid_source_reference"


def test_invalid_uuid_rejected() -> None:
    result = _failure(RELATIVE, application_id="not-a-uuid")
    assert result.reason_code == "invalid_application_id"


def test_failure_contains_no_raw_input() -> None:
    raw = f"https://{HOST}/storage/v1/object/public/{BUCKET}/{RELATIVE}?token=secret"
    result = _failure(raw)
    payload = repr(result)
    assert raw not in payload
    assert "secret" not in payload
    assert "vehicle-photos" not in payload


def test_no_storage_imports_in_module() -> None:
    source = Path(BACKEND_DIR, "services", "kyc_document_source_normalizer.py").read_text(encoding="utf-8")
    assert "import supabase" not in source
    assert "from supabase" not in source
    assert "create_signed_url" not in source
    assert "get_public_url" not in source
