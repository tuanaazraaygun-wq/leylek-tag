"""
Leylek Zeka — product truth and policy contracts (deterministic, no I/O).
"""
from __future__ import annotations

from .product_knowledge_manifest import (
    LeylekZekaProductKnowledgeManifest,
    find_forbidden_user_terms,
    get_leylek_zeka_product_manifest,
    get_manifest_release_version,
    get_supported_product_fact,
    get_unavailable_feature,
    is_forbidden_claim,
    is_forbidden_user_term,
)
from .reply_guard import (
    admin_kb_body_allowed,
    find_forbidden_claim_hits,
    find_user_reply_policy_violations,
    guard_user_visible_reply,
    is_user_reply_policy_violation,
    safe_fail_closed_reply,
)

__all__ = [
    "LeylekZekaProductKnowledgeManifest",
    "get_leylek_zeka_product_manifest",
    "get_manifest_release_version",
    "is_forbidden_user_term",
    "find_forbidden_user_terms",
    "is_forbidden_claim",
    "get_supported_product_fact",
    "get_unavailable_feature",
    "admin_kb_body_allowed",
    "find_forbidden_claim_hits",
    "find_user_reply_policy_violations",
    "guard_user_visible_reply",
    "is_user_reply_policy_violation",
    "safe_fail_closed_reply",
]
