"""Phase D7-B2B — redeem service unit tests (no live DB/network)."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.kyc_document_access_grant_token import (  # noqa: E402
    hash_kyc_document_access_grant_token,
)
from services.kyc_document_access_redeem_service import (  # noqa: E402
    KycDocumentAccessRedeemCommand,
    build_kyc_document_access_redeem_rpc_payload,
    map_kyc_document_access_redeem_rpc_row,
    redeem_kyc_document_access_grant,
    validate_kyc_document_access_redeem_command,
)
from services.kyc_document_access_stream_service import (  # noqa: E402
    KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE,
    download_kyc_document_object_bytes,
    stream_kyc_document_access_grant,
)
from contracts.kyc_document_access_rpc_contract import (  # noqa: E402
    KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES,
    KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME,
)

_OPAQUE_TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789AB"
_GRANT_HASH = hash_kyc_document_access_grant_token(_OPAQUE_TOKEN)
_APP_ID = "11111111-2222-3333-4444-555555555555"
_RECORD_VERSION = "2026-07-14T13:00:00+00:00"
_BINDING_SECRET = b"x" * 32
_OBJECT_PATH = f"kyc/{_APP_ID}/license_abcd1234.jpg"
_PUBLIC_URL = (
    f"https://project-ref.example.supabase.co/storage/v1/object/public/"
    f"vehicle-photos/{_OBJECT_PATH}"
)
_HOST = "project-ref.example.supabase.co"


def _command(**overrides: Any) -> KycDocumentAccessRedeemCommand:
    base = {
        "access_grant_token": _OPAQUE_TOKEN,
        "actor_admin_id": "enterprise-actor-redeem",
        "request_id": "req-redeem-001",
        "source_channel": "enterprise_bff",
    }
    base.update(overrides)
    return KycDocumentAccessRedeemCommand(**base)


def _user_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": _APP_ID,
        "updated_at": _RECORD_VERSION,
        "driver_details": {
            "kyc_status": "pending",
            "license_photo_url": _PUBLIC_URL,
            "pending_vehicle_kind": "car",
        },
    }
    row.update(overrides)
    return row


def _rpc_redeemed_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "outcome_code": "redeemed",
        "grant_id": "e08d4fc0-00a4-4328-b114-3bd5dea31aa3",
        "application_id": _APP_ID,
        "document_type": "license",
        "state": "redeemed",
        "redeemed_at": "2026-07-14T13:05:00+00:00",
        "source_binding_hash": "a" * 64,
        "application_record_version": _RECORD_VERSION,
    }
    row.update(overrides)
    return row


class _FakeQuery:
    def __init__(self, rows: list[dict[str, Any]]):
        self._rows = rows
        self.eq_calls: list[tuple[str, Any]] = []

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column: str, value: Any):
        self.eq_calls.append((column, value))
        return self

    def limit(self, _n: int):
        return self

    def execute(self):
        filtered = list(self._rows)
        for col, val in self.eq_calls:
            filtered = [r for r in filtered if str(r.get(col)).lower() == str(val).lower()]
        return MagicMock(data=filtered)


class _FakeRpc:
    def __init__(self, payload_sink: list[tuple[str, dict[str, Any]]], response: Any):
        self._payload_sink = payload_sink
        self._response = response
        self._name: str | None = None
        self._payload: dict[str, Any] | None = None

    def __call__(self, name: str, payload: dict[str, Any]):
        self._name = name
        self._payload = payload
        self._payload_sink.append((name, dict(payload)))
        return self

    def execute(self):
        if isinstance(self._response, BaseException):
            raise self._response
        return MagicMock(data=self._response)


class _FakeStorageBucket:
    def __init__(self, *, download_result: Any = None, download_error: BaseException | None = None):
        self.download_result = download_result if download_result is not None else b"\xff\xd8jpeg"
        self.download_error = download_error
        self.download_paths: list[str] = []
        self.create_signed_url_called = False
        self.get_public_url_called = False

    def download(self, path: str):
        self.download_paths.append(path)
        if self.download_error is not None:
            raise self.download_error
        return self.download_result

    def create_signed_url(self, *_args, **_kwargs):
        self.create_signed_url_called = True
        raise AssertionError("create_signed_url must not be called")

    def get_public_url(self, *_args, **_kwargs):
        self.get_public_url_called = True
        raise AssertionError("get_public_url must not be called")


class _FakeStorage:
    def __init__(self, bucket: _FakeStorageBucket):
        self._bucket = bucket
        self.from_buckets: list[str] = []

    def from_(self, bucket: str):
        self.from_buckets.append(bucket)
        return self._bucket


class _FakeSB:
    def __init__(
        self,
        *,
        grant_rows: list[dict[str, Any]] | None = None,
        user_rows: list[dict[str, Any]] | None = None,
        rpc_response: Any = None,
        storage_bucket: _FakeStorageBucket | None = None,
    ):
        self.grant_rows = grant_rows if grant_rows is not None else []
        self.user_rows = user_rows if user_rows is not None else []
        self.rpc_payloads: list[tuple[str, dict[str, Any]]] = []
        self.rpc = _FakeRpc(self.rpc_payloads, rpc_response if rpc_response is not None else [_rpc_redeemed_row()])
        self.storage = _FakeStorage(storage_bucket or _FakeStorageBucket())

    def table(self, name: str):
        if name == "kyc_document_access_grants":
            return _FakeQuery(self.grant_rows)
        if name == "users":
            return _FakeQuery(self.user_rows)
        raise AssertionError(f"unexpected table {name}")


def test_validate_malformed_opaque_token() -> None:
    assert validate_kyc_document_access_redeem_command(_command(access_grant_token="bad")) == "invalid_input"


def test_validate_missing_actor_and_request_id() -> None:
    assert validate_kyc_document_access_redeem_command(_command(actor_admin_id="")) == "invalid_input"
    assert validate_kyc_document_access_redeem_command(_command(request_id="")) == "invalid_input"


def test_rpc_payload_has_exact_six_arguments() -> None:
    payload = build_kyc_document_access_redeem_rpc_payload(
        grant_reference_hash=_GRANT_HASH,
        actor_admin_id="actor",
        request_id="req",
        source_channel="enterprise_bff",
        observed_source_binding_hash="b" * 64,
        observed_application_record_version=datetime(2026, 7, 14, 13, 0, tzinfo=timezone.utc),
    )
    assert set(payload.keys()) == set(KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES)
    assert len(payload) == 6


def test_unknown_token_uses_dummy_observed_values_without_existence_leak() -> None:
    sb = _FakeSB(
        grant_rows=[],
        user_rows=[],
        rpc_response=[
            {
                "outcome_code": "not_found_or_unauthorized",
                "grant_id": None,
                "application_id": None,
                "document_type": None,
                "state": None,
                "redeemed_at": None,
                "source_binding_hash": None,
                "application_record_version": None,
            }
        ],
    )
    result = redeem_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert result.outcome_code == "not_found_or_unauthorized"
    assert len(sb.rpc_payloads) == 1
    name, payload = sb.rpc_payloads[0]
    assert name == KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME
    assert payload["p_grant_reference_hash"] == _GRANT_HASH
    assert payload["p_observed_source_binding_hash"] == "0" * 64
    assert payload["p_observed_application_record_version"].startswith("1970-01-01")


def test_redeemed_success_resolves_object_and_maps_row() -> None:
    sb = _FakeSB(
        grant_rows=[{"application_id": _APP_ID, "document_type": "license", "grant_reference_hash": _GRANT_HASH}],
        user_rows=[_user_row()],
        rpc_response=[_rpc_redeemed_row()],
    )
    result = redeem_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert result.outcome_code == "redeemed"
    assert result.application_id == _APP_ID
    assert result.document_type == "license"
    assert result.resolved_object is not None
    assert result.resolved_object.bucket == "vehicle-photos"
    assert result.resolved_object.object_path == _OBJECT_PATH
    name, payload = sb.rpc_payloads[0]
    assert name == KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME
    assert payload["p_actor_admin_id"] == "enterprise-actor-redeem"
    assert payload["p_request_id"] == "req-redeem-001"
    assert payload["p_source_channel"] == "enterprise_bff"
    assert payload["p_observed_source_binding_hash"] != "0" * 64
    assert len(payload["p_observed_source_binding_hash"]) == 64


@pytest.mark.parametrize(
    "outcome",
    ["grant_expired", "grant_revoked", "grant_redeemed", "invalid_input", "audit_unavailable"],
)
def test_terminal_redeem_outcomes(outcome: str) -> None:
    sb = _FakeSB(
        grant_rows=[{"application_id": _APP_ID, "document_type": "license", "grant_reference_hash": _GRANT_HASH}],
        user_rows=[_user_row()],
        rpc_response=[
            {
                "outcome_code": outcome,
                "grant_id": None,
                "application_id": None,
                "document_type": None,
                "state": None,
                "redeemed_at": None,
                "source_binding_hash": None,
                "application_record_version": None,
            }
        ],
    )
    result = redeem_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert result.outcome_code == outcome
    assert result.resolved_object is None


def test_malformed_rpc_response_maps_to_audit_unavailable() -> None:
    sb = _FakeSB(
        grant_rows=[],
        rpc_response=[{"outcome_code": "not-a-real-outcome"}],
    )
    result = redeem_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert result.outcome_code == "audit_unavailable"


def test_empty_rpc_data_maps_to_audit_unavailable() -> None:
    sb = _FakeSB(grant_rows=[], rpc_response=[])
    result = redeem_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert result.outcome_code == "audit_unavailable"


def test_rpc_exception_propagates_for_route_fail_closed() -> None:
    sb = _FakeSB(grant_rows=[], rpc_response=RuntimeError("rpc down"))
    with pytest.raises(RuntimeError):
        redeem_kyc_document_access_grant(
            supabase_client=sb,
            binding_secret_key=_BINDING_SECRET,
            command=_command(),
            allowed_public_hosts=[_HOST],
        )


def test_map_row_rejects_forbidden_keys() -> None:
    assert map_kyc_document_access_redeem_rpc_row({"outcome_code": "redeemed", "signed_url": "x"}) is None


def test_stream_downloads_bytes_without_signed_urls() -> None:
    bucket = _FakeStorageBucket(download_result=b"\xff\xd8binary")
    sb = _FakeSB(
        grant_rows=[{"application_id": _APP_ID, "document_type": "license", "grant_reference_hash": _GRANT_HASH}],
        user_rows=[_user_row()],
        rpc_response=[_rpc_redeemed_row()],
        storage_bucket=bucket,
    )
    result = stream_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert result.outcome_code == "redeemed"
    assert result.content == b"\xff\xd8binary"
    assert result.content_type == "image/jpeg"
    assert bucket.download_paths == [_OBJECT_PATH]
    assert bucket.create_signed_url_called is False
    assert bucket.get_public_url_called is False


def test_same_key_retry_invokes_redeem_rpc_again_with_identical_payload() -> None:
    sb = _FakeSB(
        grant_rows=[{"application_id": _APP_ID, "document_type": "license", "grant_reference_hash": _GRANT_HASH}],
        user_rows=[_user_row()],
        rpc_response=[_rpc_redeemed_row()],
        storage_bucket=_FakeStorageBucket(download_result=b"img"),
    )
    first = stream_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    second = stream_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert first.outcome_code == "redeemed"
    assert second.outcome_code == "redeemed"
    assert len(sb.rpc_payloads) == 2
    assert sb.rpc_payloads[0] == sb.rpc_payloads[1]
    assert sb.rpc_payloads[0][1]["p_request_id"] == "req-redeem-001"


def test_storage_failure_after_redeem_returns_storage_unavailable() -> None:
    bucket = _FakeStorageBucket(download_error=RuntimeError("storage down"))
    sb = _FakeSB(
        grant_rows=[{"application_id": _APP_ID, "document_type": "license", "grant_reference_hash": _GRANT_HASH}],
        user_rows=[_user_row()],
        rpc_response=[_rpc_redeemed_row()],
        storage_bucket=bucket,
    )
    result = stream_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=_BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[_HOST],
    )
    assert result.outcome_code == KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE
    assert result.content is None
    assert len(sb.rpc_payloads) == 1


def test_download_helper_rejects_string_payload() -> None:
    from services.kyc_document_access_redeem_service import KycDocumentAccessResolvedObject

    bucket = _FakeStorageBucket(download_result="https://evil.example/x")
    sb = _FakeSB(storage_bucket=bucket)
    with pytest.raises(TypeError):
        download_kyc_document_object_bytes(
            supabase_client=sb,
            resolved_object=KycDocumentAccessResolvedObject(
                bucket="vehicle-photos",
                object_path=_OBJECT_PATH,
            ),
        )
