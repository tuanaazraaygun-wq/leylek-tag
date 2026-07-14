"""
Phase 3B — Enterprise → Leylek KYC queue service-auth CONTRACT (not implemented).

Decision: no production-safe S2S primitive exists today for wiring
GET /api/admin/kyc/queue-safe from Enterprise BFF.

Forbidden paths (do not implement here):
- copying API_SESSION_SECRET / JWT mint into Enterprise
- ADMIN_BACKEND_PHONE / admin_phone query
- Enterprise → Product DB via service-role
- browser-visible tokens

Required before runtime wiring (provisioning):
"""

from __future__ import annotations

LEYLEK_ENTERPRISE_KYC_SERVICE_AUTH_DECISION = (
    "SERVICE_AUTH_CONTRACT_READY_PROVISIONING_REQUIRED"
)

# Recommended env *names* only — do not place values in repo.
LEYLEK_SERVER_ENV_TOKEN_NAME = "KAREKOD_ENTERPRISE_KYC_READ_TOKEN"
ENTERPRISE_SERVER_ENV_TOKEN_NAME = "LEYLEK_KYC_READ_SERVICE_TOKEN"

PREFERRED_INTERNAL_ROUTE = "/api/internal/enterprise/kyc/queue-safe"
EXISTING_ADMIN_BEARER_ROUTE = "/api/admin/kyc/queue-safe"

REQUIRED_SCOPE = "kyc.queue.read"
REQUIRED_AUTH_SCHEME = "authorization_bearer_scoped_service_token"

FORBIDDEN_AUTH = (
    "admin_phone_query",
    "ADMIN_BACKEND_PHONE",
    "enterprise_supabase_bearer_as_leylek_jwt",
    "leylek_jwt_mint_in_enterprise",
    "actor_header_as_sole_auth",
    "next_public_token",
)

ROUTE_STRATEGY = "separate_internal_route"

ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT = {
    "decision": LEYLEK_ENTERPRISE_KYC_SERVICE_AUTH_DECISION,
    "preferred_route": PREFERRED_INTERNAL_ROUTE,
    "existing_user_admin_route": EXISTING_ADMIN_BEARER_ROUTE,
    "route_strategy": ROUTE_STRATEGY,
    "auth_scheme": REQUIRED_AUTH_SCHEME,
    "required_scope": REQUIRED_SCOPE,
    "leylek_env_token_name": LEYLEK_SERVER_ENV_TOKEN_NAME,
    "enterprise_env_token_name": ENTERPRISE_SERVER_ENV_TOKEN_NAME,
    "forbidden_auth": FORBIDDEN_AUTH,
    "compare": "secrets.compare_digest",
    "token_logging": "forbidden",
    "actor_header_is_auth_proof": False,
    "actor_header_optional_audit_only": True,
    "actor_header_name": "X-Karekod-Actor-Id",
    "request_id_header_name": "X-Karekod-Request-Id",
    "fixed_upstream_base_allowlist": (
        "https://api.karekodteknoloji.com",
        "https://api.leylektag.com",
    ),
    "response_must_reuse_queue_safe_pii_dto": True,
    "product_db_mutation": False,
    "enterprise_db_kyc_copy": False,
    "runtime_wired": False,
    "hmac_required_in_v1": False,
    "notes": (
        "Reuse of Leylek HS256 user JWT mint in Enterprise is rejected: signing "
        "material must stay on Leylek runtime. Supabase Bearer is not verified by "
        "queue-safe today. Iyzico webhook HMAC and trip QR tokens are out of scope."
    ),
}


def may_wire_enterprise_kyc_service_auth() -> bool:
    wired = bool(ENTERPRISE_KYC_SERVICE_AUTH_CONTRACT["runtime_wired"])
    return wired


def is_forbidden_kyc_service_auth(kind: str) -> bool:
    return kind in FORBIDDEN_AUTH
