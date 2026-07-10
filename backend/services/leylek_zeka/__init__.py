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

__all__ = [
    "LeylekZekaProductKnowledgeManifest",
    "get_leylek_zeka_product_manifest",
    "get_manifest_release_version",
    "is_forbidden_user_term",
    "find_forbidden_user_terms",
    "is_forbidden_claim",
    "get_supported_product_fact",
    "get_unavailable_feature",
]
