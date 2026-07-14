"""Phase 3B — service auth contract tests (no secrets, no live HTTP)."""
from __future__ import annotations

import ast
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts.enterprise_kyc_queue_service_auth_contract import (
    ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT,
    FORBIDDEN_AUTH,
    LEYLEK_ENTERPRISE_KYC_SERVICE_AUTH_DECISION,
    is_forbidden_kyc_service_auth,
    may_wire_enterprise_kyc_service_auth,
)


def test_decision_requires_provisioning() -> None:
    assert (
        LEYLEK_ENTERPRISE_KYC_SERVICE_AUTH_DECISION
        == "SERVICE_AUTH_CONTRACT_READY_PROVISIONING_REQUIRED"
    )
    assert may_wire_enterprise_kyc_service_auth() is False
    assert ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT["runtime_wired"] is False


def test_prefers_separate_internal_route() -> None:
    assert ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT["route_strategy"] == "separate_internal_route"
    assert ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT["preferred_route"].startswith(
        "/api/internal/enterprise/kyc/"
    )
    assert ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT["existing_user_admin_route"].endswith(
        "/queue-safe"
    )


def test_forbids_jwt_mint_and_phone_fallbacks() -> None:
    for kind in (
        "leylek_jwt_mint_in_enterprise",
        "enterprise_supabase_bearer_as_leylek_jwt",
        "admin_phone_query",
        "ADMIN_BACKEND_PHONE",
        "actor_header_as_sole_auth",
        "next_public_token",
    ):
        assert is_forbidden_kyc_service_auth(kind) is True
    assert "leylek_jwt_mint_in_enterprise" in FORBIDDEN_AUTH


def test_env_names_only_no_literal_secrets_in_contract_module() -> None:
    path = Path(__file__).resolve().parents[1] / "contracts" / "enterprise_kyc_queue_service_auth_contract.py"
    src = path.read_text(encoding="utf-8")
    # No obvious assigned secret literals
    assert "sk-" not in src
    assert "eyJ" not in src
    assert "NEXT_PUBLIC_" not in ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT["enterprise_env_token_name"]
    assert ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT["leylek_env_token_name"].startswith("KAREKOD_")


def test_queue_safe_route_module_has_no_service_token_wiring_yet() -> None:
    route = Path(__file__).resolve().parents[1] / "routes" / "admin_kyc_queue_safe.py"
    src = route.read_text(encoding="utf-8")
    assert "KAREKOD_ENTERPRISE_KYC_READ_TOKEN" not in src
    assert "/internal/enterprise/kyc" not in src
    tree = ast.parse(src)
    assert tree is not None
