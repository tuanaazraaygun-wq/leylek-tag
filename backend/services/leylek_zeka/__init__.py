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
    ReplyGuardResult,
    admin_kb_body_allowed,
    evaluate_user_visible_reply,
    find_forbidden_claim_hits,
    find_user_reply_policy_violations,
    guard_user_visible_reply,
    is_user_reply_policy_violation,
    safe_fail_closed_reply,
)
from .response_contract import (
    LeylekZekaResponseMetadata,
    build_leylek_zeka_response_metadata,
    classify_message_topic,
    map_support_route_for_topic,
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
    "ReplyGuardResult",
    "admin_kb_body_allowed",
    "evaluate_user_visible_reply",
    "find_forbidden_claim_hits",
    "find_user_reply_policy_violations",
    "guard_user_visible_reply",
    "is_user_reply_policy_violation",
    "safe_fail_closed_reply",
    "LeylekZekaResponseMetadata",
    "build_leylek_zeka_response_metadata",
    "classify_message_topic",
    "map_support_route_for_topic",
]
