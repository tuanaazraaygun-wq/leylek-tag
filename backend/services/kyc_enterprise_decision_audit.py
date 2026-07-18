"""
Append-only in-process audit log for Enterprise KYC decisions (Phase D1).
"""
from __future__ import annotations

from typing import Any

_audit_events: list[dict[str, Any]] = []


def append_kyc_decision_audit_event(event: dict[str, Any]) -> None:
    _audit_events.append(dict(event))


def list_kyc_decision_audit_events() -> list[dict[str, Any]]:
    return [dict(e) for e in _audit_events]


def clear_kyc_decision_audit_events() -> None:
    _audit_events.clear()
