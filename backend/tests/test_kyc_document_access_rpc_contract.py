"""Phase 5B3a — KYC document access RPC contract tests."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import (  # noqa: E402
    enterprise_kyc_document_access_contract as access_5a,
    kyc_document_access_rpc_contract as rpc,
)

FORBIDDEN_ISSUE_INPUTS = frozenset(
    {
        "raw_token",
        "grant_token",
        "p_raw_token",
        "p_signed_url",
        "p_bucket",
        "p_object_path",
        "p_event_type",
        "p_result",
        "p_reason_code",
        "p_state",
        "p_issued_at",
        "p_expires_at",
        "p_document_bytes",
    }
)

FORBIDDEN_REDEEM_INPUTS = FORBIDDEN_ISSUE_INPUTS | frozenset(
    {
        "p_expected_source_binding_hash",
        "p_source_url",
        "p_storage_path",
    }
)

FORBIDDEN_OUTPUT_TOKENS = frozenset(
    {
        "raw_token",
        "grant_token",
        "signed_url",
        "bucket",
        "object_path",
        "storage_path",
        "document_url",
        "document_bytes",
    }
)


def test_issue_rpc_name_exact() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_NAME == "kyc_document_access_issue_grant"


def test_redeem_rpc_name_exact() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME == "kyc_document_access_redeem_grant"


def test_issue_outcomes_closed() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES == (
        "issued",
        "duplicate_request",
        "request_conflict",
        "invalid_input",
        "application_not_found",
        "record_version_stale",
        "document_not_reviewable",
        "document_missing",
        "audit_unavailable",
        "rate_limited",
    )


def test_redeem_outcomes_closed() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES == (
        "redeemed",
        "not_found_or_unauthorized",
        "grant_expired",
        "grant_redeemed",
        "grant_revoked",
        "invalid_input",
        "audit_unavailable",
    )


def test_not_found_or_unauthorized_is_combined() -> None:
    assert "not_found_or_unauthorized" in rpc.KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES
    assert "not_found" not in rpc.KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES
    assert "actor_mismatch" not in rpc.KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES


def test_duplicate_request_exists() -> None:
    assert "duplicate_request" in rpc.KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES


def test_duplicate_request_documentation_does_not_claim_token_recovery() -> None:
    module_doc = rpc.__doc__ or ""
    source = Path(rpc.__file__).read_text(encoding="utf-8")
    combined = module_doc + source
    assert "duplicate_request" in combined
    assert "does not recover" in combined.lower() or "does not re-emit" in combined.lower()


def test_audit_unavailable_in_both_outcome_sets() -> None:
    assert "audit_unavailable" in rpc.KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES
    assert "audit_unavailable" in rpc.KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES


def test_bounds_mirror_persistence_constraints() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_ACTOR_MAX_LENGTH == 128
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_REQUEST_ID_MAX_LENGTH == 128
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_GRANT_REFERENCE_HASH_MAX_LENGTH == 128
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_SOURCE_BINDING_HASH_MAX_LENGTH == 128
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_TOKEN_VERSION_MIN == 1


def test_ttl_mirrors_phase_5a() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_TTL_MIN_SECONDS == access_5a.KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_TTL_MAX_SECONDS == access_5a.KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_TTL_MIN_SECONDS == 60
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_TTL_MAX_SECONDS == 120


def test_issue_input_names_exact() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES == (
        "p_grant_reference_hash",
        "p_token_version",
        "p_application_id",
        "p_document_type",
        "p_actor_admin_id",
        "p_request_id",
        "p_review_reason",
        "p_ttl_seconds",
        "p_source_binding_hash",
        "p_application_record_version",
        "p_source_channel",
    )


def test_redeem_input_names_exact() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES == (
        "p_grant_reference_hash",
        "p_actor_admin_id",
        "p_request_id",
        "p_source_channel",
        "p_observed_source_binding_hash",
        "p_observed_application_record_version",
    )


def test_no_raw_token_input() -> None:
    issue = set(rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES)
    redeem = set(rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES)
    assert issue.isdisjoint(FORBIDDEN_ISSUE_INPUTS)
    assert redeem.isdisjoint(FORBIDDEN_REDEEM_INPUTS)


def test_no_url_bucket_path_input() -> None:
    forbidden_fragments = ("url", "bucket", "path", "bytes")
    for name in rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES:
        lowered = name.lower()
        assert not any(fragment in lowered for fragment in forbidden_fragments)
    for name in rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES:
        lowered = name.lower()
        assert not any(fragment in lowered for fragment in forbidden_fragments)


def test_no_caller_audit_event_or_result_input() -> None:
    assert "p_event_type" not in rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES
    assert "p_result" not in rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES
    assert "p_reason_code" not in rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES
    assert "p_review_reason" in rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES


def test_no_timestamp_or_state_input() -> None:
    for name in (
        *rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_INPUT_NAMES,
        *rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES,
    ):
        lowered = name.lower()
        assert "issued_at" not in lowered
        assert "expires_at" not in lowered
        assert "redeemed_at" not in lowered
        assert lowered != "p_state"


def test_issue_output_fields_exact() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_OUTPUT_FIELDS == (
        "outcome_code",
        "grant_id",
        "grant_reference_hash",
        "state",
        "issued_at",
        "expires_at",
        "ttl_seconds",
        "is_reused",
    )


def test_redeem_output_fields_exact() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS == (
        "outcome_code",
        "grant_id",
        "application_id",
        "document_type",
        "state",
        "redeemed_at",
        "source_binding_hash",
        "application_record_version",
    )


def test_no_raw_token_output() -> None:
    for field in (
        *rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_OUTPUT_FIELDS,
        *rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS,
    ):
        assert field not in FORBIDDEN_OUTPUT_TOKENS
        assert "raw" not in field


def test_no_url_path_bucket_output() -> None:
    forbidden_fragments = ("url", "bucket", "path", "bytes", "token")
    for field in (
        *rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_OUTPUT_FIELDS,
        *rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS,
    ):
        lowered = field.lower()
        if lowered == "grant_reference_hash":
            continue
        assert not any(fragment in lowered for fragment in forbidden_fragments)


def test_all_readiness_flags_posture() -> None:
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_CONTRACT_READY is False
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_READY is True
    assert rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_READY is False
    assert rpc.KYC_DOCUMENT_ACCESS_RPC_ADAPTER_READY is True
    assert rpc.KYC_DOCUMENT_ACCESS_GRANT_RUNTIME_READY is False
