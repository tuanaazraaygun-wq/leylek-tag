"""
In-process idempotency ledger for Enterprise KYC decisions (Phase D1).

Production persistence is a follow-up migration; tests reset via clear_ledger().
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

_ledger: dict[str, dict[str, Any]] = {}


def _ledger_key(*, actor_id: str, idempotency_key: str) -> str:
    return f"{actor_id.strip()}::{idempotency_key.strip()}"


def fingerprint_decision_request(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def lookup_idempotent_decision(
    *,
    actor_id: str,
    idempotency_key: str,
) -> Optional[dict[str, Any]]:
    entry = _ledger.get(_ledger_key(actor_id=actor_id, idempotency_key=idempotency_key))
    if entry is None:
        return None
    return dict(entry["response"])


def idempotency_fingerprint_conflict(
    *,
    actor_id: str,
    idempotency_key: str,
    request_fingerprint: str,
) -> bool:
    entry = _ledger.get(_ledger_key(actor_id=actor_id, idempotency_key=idempotency_key))
    if entry is None:
        return False
    return entry["fingerprint"] != request_fingerprint


def store_idempotent_decision(
    *,
    actor_id: str,
    idempotency_key: str,
    request_fingerprint: str,
    response: dict[str, Any],
) -> None:
    _ledger[_ledger_key(actor_id=actor_id, idempotency_key=idempotency_key)] = {
        "fingerprint": request_fingerprint,
        "response": dict(response),
    }


def clear_decision_idempotency_ledger() -> None:
    _ledger.clear()
