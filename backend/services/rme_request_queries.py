"""
RME relationship_match_requests — read-only query helpers.

No writes. Used by match_intent_guard and future TDM orchestrator (RME-3+).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

TABLE_RELATIONSHIP_MATCH_REQUESTS = "relationship_match_requests"

RME_REQUEST_STATUS_PENDING = "pending_responder"
MATCH_MODULE_TRUSTED_DIRECT = "trusted_direct"

_PENDING_REQUEST_SELECT = (
    "id, match_module, relationship_type, requester_id, responder_id, "
    "relationship_connection_id, status, expires_at, created_at, updated_at"
)


def _norm_user_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _norm_module(value: Any) -> str:
    return str(value or MATCH_MODULE_TRUSTED_DIRECT).strip().lower()


def get_pending_relationship_match_request(
    supabase,
    requester_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> Optional[Dict[str, Any]]:
    """
    Return the active pending_responder request for requester + module, or None.
    """
    requester_norm = _norm_user_id(requester_id)
    module_norm = _norm_module(match_module)
    if not requester_norm:
        return None

    result = (
        supabase.table(TABLE_RELATIONSHIP_MATCH_REQUESTS)
        .select(_PENDING_REQUEST_SELECT)
        .eq("requester_id", requester_norm)
        .eq("match_module", module_norm)
        .eq("status", RME_REQUEST_STATUS_PENDING)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def has_pending_relationship_match_request(
    supabase,
    requester_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> bool:
    """True if requester has a pending_responder RME request for the module."""
    return get_pending_relationship_match_request(
        supabase,
        requester_id,
        match_module=match_module,
    ) is not None
