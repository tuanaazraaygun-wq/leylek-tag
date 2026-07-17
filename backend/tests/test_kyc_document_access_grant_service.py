"""Phase 5B4 — KYC document access grant service adapter tests (mocked RPC)."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import kyc_document_access_rpc_contract as rpc  # noqa: E402
from services import kyc_document_access_grant_service as grant_service  # noqa: E402

APP_ID = "11111111-2222-4333-8444-555555555555"
VERSION = "2026-07-14T10:05:00+00:00"
HOST = "project-ref.example.supabase.co"
BUCKET = "vehicle-photos"
LICENSE_RELATIVE = f"kyc/{APP_ID}/license_abcd1234.jpg"
LICENSE_URL = f"https://{HOST}/storage/v1/object/public/{BUCKET}/{LICENSE_RELATIVE}"
BINDING_SECRET = b"x" * 32


def _command(**overrides: object) -> grant_service.KycDocumentAccessIssueGrantCommand:
    base = {
        "application_id": APP_ID,
        "document_type": "license",
        "review_reason": "initial_review",
        "if_match_record_version": VERSION,
        "request_id": "req-001",
        "actor_admin_id": "actor-001",
    }
    base.update(overrides)
    return grant_service.KycDocumentAccessIssueGrantCommand(**base)


class _ExecuteResult:
    def __init__(self, data: Any) -> None:
        self.data = data


class _FakeQuery:
    def __init__(self, supabase: "_FakeSupabase", table: str) -> None:
        self._supabase = supabase
        self._table = table
        self._filters: dict[str, Any] = {}

    def select(self, _columns: str) -> "_FakeQuery":
        return self

    def eq(self, key: str, value: Any) -> "_FakeQuery":
        self._filters[key] = value
        return self

    def limit(self, _count: int) -> "_FakeQuery":
        return self

    def execute(self) -> _ExecuteResult:
        if self._table == "users":
            row = self._supabase.users.get(str(self._filters.get("id")))
            return _ExecuteResult([row] if row else [])
        raise AssertionError(f"unexpected table {self._table}")


class _FakeRpc:
    def __init__(self, supabase: "_FakeSupabase") -> None:
        self._supabase = supabase
        self.last_name: str | None = None
        self.last_payload: dict[str, Any] | None = None

    def execute(self) -> _ExecuteResult:
        assert self.last_name == rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_NAME
        assert self.last_payload is not None
        handler = self._supabase.rpc_handler
        if handler is None:
            return _ExecuteResult([])
        return _ExecuteResult(handler(self.last_payload))


class _FakeSupabase:
    def __init__(
        self,
        *,
        users: dict[str, dict[str, Any]] | None = None,
        rpc_handler: Any = None,
    ) -> None:
        self.users = users or {}
        self.rpc_handler = rpc_handler
        self._rpc = _FakeRpc(self)

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self, name)

    def rpc(self, name: str, payload: dict[str, Any]) -> _FakeRpc:
        self._rpc.last_name = name
        self._rpc.last_payload = payload
        return self._rpc


def _pending_user(**driver_overrides: object) -> dict[str, Any]:
    driver_details = {
        "kyc_status": "pending",
        "pending_vehicle_kind": "car",
        "license_photo_url": LICENSE_URL,
    }
    driver_details.update(driver_overrides)
    return {
        "id": APP_ID,
        "updated_at": VERSION,
        "driver_details": driver_details,
    }


def test_invalid_uuid_fails() -> None:
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(),
        binding_secret_key=BINDING_SECRET,
        command=_command(application_id="not-a-uuid"),
    )
    assert result.outcome_code == "validation_failed"


def test_unsupported_document_type_fails() -> None:
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(),
        binding_secret_key=BINDING_SECRET,
        command=_command(document_type="identity"),
    )
    assert result.outcome_code == "validation_failed"


def test_invalid_review_reason_fails() -> None:
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(),
        binding_secret_key=BINDING_SECRET,
        command=_command(review_reason="appeal"),
    )
    assert result.outcome_code == "validation_failed"


def test_missing_actor_fails() -> None:
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(),
        binding_secret_key=BINDING_SECRET,
        command=_command(actor_admin_id=""),
    )
    assert result.outcome_code == "validation_failed"


def test_missing_request_id_fails() -> None:
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(),
        binding_secret_key=BINDING_SECRET,
        command=_command(request_id=""),
    )
    assert result.outcome_code == "validation_failed"


def test_invalid_record_version_fails() -> None:
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(),
        binding_secret_key=BINDING_SECRET,
        command=_command(if_match_record_version="not-a-timestamp"),
    )
    assert result.outcome_code == "validation_failed"


def test_application_not_found() -> None:
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(users={}),
        binding_secret_key=BINDING_SECRET,
        command=_command(),
    )
    assert result.outcome_code == "application_not_found"


def test_document_missing() -> None:
    user = _pending_user(license_photo_url="")
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(users={APP_ID: user}),
        binding_secret_key=BINDING_SECRET,
        command=_command(),
    )
    assert result.outcome_code == "document_missing"


def test_invalid_transition_when_approved() -> None:
    user = _pending_user(kyc_status="approved")
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=_FakeSupabase(users={APP_ID: user}),
        binding_secret_key=BINDING_SECRET,
        command=_command(),
    )
    assert result.outcome_code == "invalid_transition"


def test_rpc_payload_contains_only_safe_parameters() -> None:
    captured: dict[str, Any] = {}

    def _handler(payload: dict[str, Any]) -> list[dict[str, Any]]:
        captured.update(payload)
        return [
            {
                "outcome_code": "issued",
                "grant_id": "22222222-3333-4444-8555-666666666666",
                "grant_reference_hash": payload["p_grant_reference_hash"],
                "state": "issued",
                "issued_at": "2026-07-14T10:05:01+00:00",
                "expires_at": "2026-07-14T10:06:01+00:00",
                "ttl_seconds": 90,
                "is_reused": False,
            }
        ]

    sb = _FakeSupabase(users={APP_ID: _pending_user()}, rpc_handler=_handler)
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[HOST],
    )
    assert result.outcome_code == "issued"
    assert set(captured.keys()) == set(rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES)
    assert "url" not in str(captured).lower()
    assert result.access_grant_token is not None


def test_malformed_rpc_result_fails_closed() -> None:
    def _handler(_payload: dict[str, Any]) -> list[dict[str, Any]]:
        return [{"outcome_code": "issued", "signed_url": "https://example.invalid/x"}]

    sb = _FakeSupabase(users={APP_ID: _pending_user()}, rpc_handler=_handler)
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[HOST],
    )
    assert result.outcome_code == "unavailable"


def test_duplicate_request_maps_deterministically() -> None:
    def _handler(_payload: dict[str, Any]) -> list[dict[str, Any]]:
        return [
            {
                "outcome_code": "duplicate_request",
                "grant_id": "22222222-3333-4444-8555-666666666666",
                "grant_reference_hash": "a" * 64,
                "state": "issued",
                "issued_at": "2026-07-14T10:05:01+00:00",
                "expires_at": "2026-07-14T10:06:01+00:00",
                "ttl_seconds": 90,
                "is_reused": True,
            }
        ]

    sb = _FakeSupabase(users={APP_ID: _pending_user()}, rpc_handler=_handler)
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[HOST],
    )
    assert result.outcome_code == "duplicate_request"
    assert result.is_reused is True
    assert result.access_grant_token is None


def test_conflict_maps_deterministically() -> None:
    def _handler(_payload: dict[str, Any]) -> list[dict[str, Any]]:
        return [{"outcome_code": "request_conflict"}]

    sb = _FakeSupabase(users={APP_ID: _pending_user()}, rpc_handler=_handler)
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[HOST],
    )
    assert result.outcome_code == "request_conflict"


def test_stale_record_maps_from_rpc() -> None:
    def _handler(_payload: dict[str, Any]) -> list[dict[str, Any]]:
        return [{"outcome_code": "record_version_stale"}]

    sb = _FakeSupabase(users={APP_ID: _pending_user()}, rpc_handler=_handler)
    result = grant_service.issue_kyc_document_access_grant(
        supabase_client=sb,
        binding_secret_key=BINDING_SECRET,
        command=_command(),
        allowed_public_hosts=[HOST],
    )
    assert result.outcome_code == "record_version_stale"


def test_service_module_has_no_http_route_registration() -> None:
    source = Path(grant_service.__file__).read_text(encoding="utf-8")
    assert "APIRouter" not in source
    assert "server.py" not in source
    assert "fetch(" not in source
    assert "logger." not in source


def test_readiness_flags_posture() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_ARTIFACT_DEFINED is True
    assert rpc.KYC_DOCUMENT_ACCESS_PYTHON_ADAPTER_DEFINED is True
    assert rpc.KYC_DOCUMENT_ACCESS_GRANT_ROUTE_READY is False
    assert rpc.KYC_DOCUMENT_ACCESS_GRANT_RUNTIME_READY is False
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_READY is False
    assert rpc.KYC_DOCUMENT_ACCESS_SQL_APPLIED is False
