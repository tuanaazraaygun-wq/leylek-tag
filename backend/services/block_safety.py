"""
RME block/safety helpers — bilateral blocked_users checks.

Read-only on blocked_users. No HTTP layer; raises domain exceptions for orchestrators.
Not wired to endpoints until a later RME phase.
"""

from __future__ import annotations

from typing import Any, Optional, Set


class BlockedPairError(Exception):
    """Raised when actor and counterparty are bilaterally blocked."""

    code = "blocked_pair"
    message = "Bu kullanıcıyla işlem yapılamaz."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


def _norm_user_id(value: Any) -> str:
    return str(value or "").strip().lower()


def get_bilateral_blocked_user_ids(supabase, actor_id: str) -> Set[str]:
    """
    Bilateral blocked_users id set for actor.
    Includes users the actor blocked and users who blocked the actor.
    """
    actor_norm = _norm_user_id(actor_id)
    if not actor_norm:
        return set()

    blocked: Set[str] = set()

    blocked_result = (
        supabase.table("blocked_users")
        .select("blocked_user_id")
        .eq("user_id", actor_norm)
        .execute()
    )
    for row in blocked_result.data or []:
        bid = _norm_user_id(row.get("blocked_user_id"))
        if bid:
            blocked.add(bid)

    blocked_by_result = (
        supabase.table("blocked_users")
        .select("user_id")
        .eq("blocked_user_id", actor_norm)
        .execute()
    )
    for row in blocked_by_result.data or []:
        uid = _norm_user_id(row.get("user_id"))
        if uid:
            blocked.add(uid)

    return blocked


def is_pair_blocked(supabase, actor_id: str, counterparty_id: str) -> bool:
    """True if actor and counterparty are blocked in either direction."""
    actor_norm = _norm_user_id(actor_id)
    counterparty_norm = _norm_user_id(counterparty_id)
    if not actor_norm or not counterparty_norm:
        return False
    if actor_norm == counterparty_norm:
        return False
    return counterparty_norm in get_bilateral_blocked_user_ids(supabase, actor_norm)


def assert_pair_not_blocked(supabase, actor_id: str, counterparty_id: str) -> None:
    """Raise BlockedPairError when the pair is bilaterally blocked."""
    if is_pair_blocked(supabase, actor_id, counterparty_id):
        raise BlockedPairError()
