"""
RME passenger one-active-match-intent guards.

Read-only checks across tags, quick_match_requests, relationship_match_requests.
Raises domain exceptions for orchestrators; not wired to endpoints until RME-3+.
"""

from __future__ import annotations

from typing import Any, Optional

from services.rme_request_queries import (
    MATCH_MODULE_TRUSTED_DIRECT,
    has_pending_relationship_match_request,
)

TAG_TYPE_NORMAL = "normal"

_PASSENGER_BLOCKING_TAG_STATUSES = (
    "waiting",
    "pending",
    "offers_received",
    "matched",
    "accepted",
    "driver_arriving",
    "passenger_onboard",
    "in_progress",
)

TABLE_TAGS = "tags"
TABLE_QUICK_MATCH_REQUESTS = "quick_match_requests"

QUICK_MATCH_STATUS_SEQUENCING = "sequencing"


class ActiveMatchIntentError(Exception):
    """Raised when passenger already has an active match intent in another channel."""

    code = "active_match_intent_exists"
    message = "Devam eden bir eşleşme isteğiniz var."

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.message)


def _norm_user_id(value: Any) -> str:
    return str(value or "").strip().lower()


def passenger_has_blocking_normal_tag(supabase, passenger_id: str) -> bool:
    """True if passenger has a normal tag in a blocking status."""
    uid = _norm_user_id(passenger_id)
    if not uid:
        return False

    result = (
        supabase.table(TABLE_TAGS)
        .select("id")
        .eq("type", TAG_TYPE_NORMAL)
        .eq("passenger_id", uid)
        .in_("status", list(_PASSENGER_BLOCKING_TAG_STATUSES))
        .limit(1)
        .execute()
    )
    return bool(result.data)


def passenger_has_active_quick_match(supabase, passenger_id: str) -> bool:
    """True if passenger has a quick_match_requests row in sequencing status."""
    uid = _norm_user_id(passenger_id)
    if not uid:
        return False

    result = (
        supabase.table(TABLE_QUICK_MATCH_REQUESTS)
        .select("id")
        .eq("passenger_id", uid)
        .eq("status", QUICK_MATCH_STATUS_SEQUENCING)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def passenger_has_pending_rme_request(
    supabase,
    passenger_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> bool:
    """True if passenger has a pending_responder relationship_match_requests row."""
    return has_pending_relationship_match_request(
        supabase,
        passenger_id,
        match_module=match_module,
    )


def assert_passenger_no_active_match_intent(
    supabase,
    passenger_id: str,
    match_module: str = MATCH_MODULE_TRUSTED_DIRECT,
) -> None:
    """
    Raise ActiveMatchIntentError if passenger has any blocking match intent.
    Checks normal tags, QM sequencing, and RME pending request (module-scoped).
    """
    uid = _norm_user_id(passenger_id)
    if not uid:
        return

    if passenger_has_blocking_normal_tag(supabase, uid):
        raise ActiveMatchIntentError()
    if passenger_has_active_quick_match(supabase, uid):
        raise ActiveMatchIntentError()
    if passenger_has_pending_rme_request(supabase, uid, match_module=match_module):
        raise ActiveMatchIntentError()
