"""
Phase D1 — Enterprise KYC decision wire contract (approve/reject).

Internal route only — no browser, no admin_phone, no public URLs on wire.
"""
from __future__ import annotations

from typing import Final, Literal, TypeGuard

KycEnterpriseDecisionKind = Literal["approve", "reject"]
KYC_ENTERPRISE_DECISION_KINDS: Final[tuple[KycEnterpriseDecisionKind, ...]] = (
    "approve",
    "reject",
)

KycEnterpriseRejectionReasonCode = Literal[
    "documents_invalid",
    "documents_incomplete",
    "identity_mismatch",
    "vehicle_mismatch",
    "policy_violation",
    "other",
]
KYC_ENTERPRISE_REJECTION_REASON_CODES: Final[tuple[KycEnterpriseRejectionReasonCode, ...]] = (
    "documents_invalid",
    "documents_incomplete",
    "identity_mismatch",
    "vehicle_mismatch",
    "policy_violation",
    "other",
)

KYC_DECISION_REQUIRED_PERMISSION: Final = "kyc.decide"

PREFERRED_INTERNAL_KYC_DECISION_PATH = (
    "/api/internal/enterprise/kyc/applications/{application_id}/decisions"
)

ENTERPRISE_KYC_DECISION_CONTRACT: Final[dict[str, object]] = {
    "decision_ready": True,
    "runtime_wired": True,
    "product_db_mutation": True,
    "admin_phone_bypass": False,
    "browser_access": False,
    "idempotency_required": True,
    "record_version_required": True,
    "actor_required": True,
    "audit_required": True,
    "decision_path": PREFERRED_INTERNAL_KYC_DECISION_PATH,
    "required_permission": KYC_DECISION_REQUIRED_PERMISSION,
    "push_on_decision": True,
}

_KYC_DECISION_FORBIDDEN_KEY_NORMALIZED: Final[frozenset[str]] = frozenset(
    {
        "adminphone",
        "admin_phone",
        "servicerole",
        "servicetoken",
        "authorization",
        "bearer",
        "phone",
        "plate",
        "nationalid",
        "url",
        "signedurl",
        "publicurl",
    }
)


def normalize_kyc_decision_contract_key(key: str) -> str:
    return key.replace("_", "").replace("-", "").lower()


def is_kyc_decision_forbidden_contract_key(key: str) -> bool:
    return normalize_kyc_decision_contract_key(key) in _KYC_DECISION_FORBIDDEN_KEY_NORMALIZED


def is_kyc_enterprise_decision_kind(value: object) -> TypeGuard[KycEnterpriseDecisionKind]:
    return isinstance(value, str) and value in KYC_ENTERPRISE_DECISION_KINDS


def is_kyc_enterprise_rejection_reason_code(
    value: object,
) -> TypeGuard[KycEnterpriseRejectionReasonCode]:
    return isinstance(value, str) and value in KYC_ENTERPRISE_REJECTION_REASON_CODES


def may_wire_enterprise_kyc_decision_contract() -> bool:
    return bool(ENTERPRISE_KYC_DECISION_CONTRACT["runtime_wired"])
