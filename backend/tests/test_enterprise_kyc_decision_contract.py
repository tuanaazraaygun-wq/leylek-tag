"""Phase D1 — Enterprise KYC decision contract tests (no DB, routes, or secrets)."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import enterprise_kyc_decision_contract as decision  # noqa: E402


def test_decision_kind_allowlist() -> None:
    assert decision.KYC_ENTERPRISE_DECISION_KINDS == ("approve", "reject")
    assert decision.is_kyc_enterprise_decision_kind("approve")
    assert not decision.is_kyc_enterprise_decision_kind("request_docs")


def test_rejection_reason_codes_closed() -> None:
    assert "documents_invalid" in decision.KYC_ENTERPRISE_REJECTION_REASON_CODES
    assert decision.is_kyc_enterprise_rejection_reason_code("other")
    assert not decision.is_kyc_enterprise_rejection_reason_code("freeform")


def test_decision_contract_security_posture() -> None:
    contract = decision.ENTERPRISE_KYC_DECISION_CONTRACT
    assert contract["decision_ready"] is True
    assert contract["runtime_wired"] is True
    assert contract["admin_phone_bypass"] is False
    assert contract["browser_access"] is False
    assert contract["idempotency_required"] is True
    assert contract["record_version_required"] is True
    assert contract["actor_required"] is True
    assert contract["audit_required"] is True
    assert contract["required_permission"] == "kyc.decide"


def test_decision_path() -> None:
    assert (
        decision.PREFERRED_INTERNAL_KYC_DECISION_PATH
        == "/api/internal/enterprise/kyc/applications/{application_id}/decisions"
    )
    assert decision.may_wire_enterprise_kyc_decision_contract() is True


def test_forbidden_admin_phone_key() -> None:
    assert decision.is_kyc_decision_forbidden_contract_key("admin_phone")
