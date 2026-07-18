"""
Enterprise KYC decision orchestration (Phase D1).

Mutates Leylek product DB via scoped service path only — never via Enterprise DB.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Literal, Optional

from contracts.enterprise_kyc_decision_contract import (
    is_kyc_enterprise_decision_kind,
    is_kyc_enterprise_rejection_reason_code,
)
from services.kyc_application_safe_detail_service import _record_version_iso
from services.kyc_driver_decision_core import (
    apply_kyc_approve_mutation,
    apply_kyc_reject_mutation,
    driver_active_until_iso,
    driver_details_as_dict,
    utc_now_iso,
)
from services.kyc_enterprise_decision_audit import append_kyc_decision_audit_event
from services.kyc_enterprise_decision_idempotency import (
    fingerprint_decision_request,
    idempotency_fingerprint_conflict,
    lookup_idempotent_decision,
    store_idempotent_decision,
)

logger = logging.getLogger("server")

NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
}

_IDEMPOTENCY_KEY_RE = re.compile(r"^[a-zA-Z0-9_.:@-]{8,128}$")
_MAX_REASON_TEXT_LEN = 2000


DecisionErrorCode = Literal[
    "invalid_request",
    "invalid_decision",
    "invalid_record_version",
    "invalid_idempotency_key",
    "rejection_required",
    "invalid_rejection_reason",
    "application_not_found",
    "not_pending",
    "vehicle_kind_missing",
    "stale_record_version",
    "idempotency_conflict",
    "upstream_unavailable",
]


class KycEnterpriseDecisionError(Exception):
    def __init__(self, *, code: DecisionErrorCode, http_status: int) -> None:
        self.code = code
        self.http_status = http_status
        super().__init__(code)


def sanitize_idempotency_key(raw: Optional[str]) -> str:
    if raw is None or not str(raw).strip():
        raise KycEnterpriseDecisionError(code="invalid_idempotency_key", http_status=400)
    key = str(raw).strip()
    if not _IDEMPOTENCY_KEY_RE.fullmatch(key):
        raise KycEnterpriseDecisionError(code="invalid_idempotency_key", http_status=400)
    return key


def sanitize_record_version(raw: object) -> str:
    if raw is None or not str(raw).strip():
        raise KycEnterpriseDecisionError(code="invalid_record_version", http_status=400)
    value = str(raw).strip()
    if len(value) > 64:
        raise KycEnterpriseDecisionError(code="invalid_record_version", http_status=400)
    return value


def parse_decision_request_body(body: object) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise KycEnterpriseDecisionError(code="invalid_request", http_status=400)

    decision = body.get("decision")
    if not is_kyc_enterprise_decision_kind(decision):
        raise KycEnterpriseDecisionError(code="invalid_decision", http_status=400)

    record_version = sanitize_record_version(body.get("record_version"))

    rejection_raw = body.get("rejection")
    rejection: dict[str, str] | None = None
    if decision == "reject":
        if not isinstance(rejection_raw, dict):
            raise KycEnterpriseDecisionError(code="rejection_required", http_status=400)
        reason_code = rejection_raw.get("reason_code")
        reason_text = rejection_raw.get("reason_text")
        if not is_kyc_enterprise_rejection_reason_code(reason_code):
            raise KycEnterpriseDecisionError(code="invalid_rejection_reason", http_status=400)
        if not isinstance(reason_text, str) or not reason_text.strip():
            raise KycEnterpriseDecisionError(code="invalid_rejection_reason", http_status=400)
        rejection = {
            "reason_code": str(reason_code).strip(),
            "reason_text": reason_text.strip()[:_MAX_REASON_TEXT_LEN],
        }
    elif rejection_raw is not None:
        raise KycEnterpriseDecisionError(code="invalid_request", http_status=400)

    return {
        "decision": decision,
        "record_version": record_version,
        "rejection": rejection,
    }


def _idempotency_payload(
    *,
    application_id: str,
    decision: str,
    record_version: str,
    rejection: dict[str, str] | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "application_id": application_id,
        "decision": decision,
        "record_version": record_version,
    }
    if rejection is not None:
        payload["rejection"] = rejection
    return payload


def _success_response(
    *,
    application_id: str,
    decision: str,
    kyc_status: str,
    record_version: str,
    idempotent_replay: bool,
) -> dict[str, Any]:
    return {
        "success": True,
        "result": {
            "application_id": application_id,
            "decision": decision,
            "kyc_status": kyc_status,
            "record_version": record_version,
            "idempotent_replay": idempotent_replay,
        },
    }


def _select_user_row(supabase_client: Any, application_id: str) -> Optional[dict[str, Any]]:
    result = (
        supabase_client.table("users")
        .select("id, name, push_token, updated_at, driver_details")
        .eq("id", application_id)
        .limit(1)
        .execute()
    )
    rows = list(result.data or [])
    if not rows:
        return None
    return rows[0]


def _optimistic_update_user(
    supabase_client: Any,
    *,
    application_id: str,
    expected_record_version: str,
    driver_details: dict[str, Any],
    driver_active_until: str | None,
) -> Optional[str]:
    now = utc_now_iso()
    update_payload: dict[str, Any] = {
        "driver_details": driver_details,
        "updated_at": now,
    }
    if driver_active_until is not None:
        update_payload["driver_active_until"] = driver_active_until

    query = (
        supabase_client.table("users")
        .update(update_payload)
        .eq("id", application_id)
        .eq("updated_at", expected_record_version)
    )
    result = query.execute()
    rows = list(result.data or [])
    if not rows:
        return None
    new_version = _record_version_iso(rows[0].get("updated_at")) or now
    return new_version


def execute_kyc_enterprise_decision(
    *,
    supabase_client: Any,
    application_id: str,
    actor_id: str,
    request_id: str,
    service_identity: str,
    idempotency_key: str,
    body: object,
) -> dict[str, Any]:
    parsed = parse_decision_request_body(body)
    decision = parsed["decision"]
    record_version = parsed["record_version"]
    rejection = parsed["rejection"]

    idem_payload = _idempotency_payload(
        application_id=application_id,
        decision=decision,
        record_version=record_version,
        rejection=rejection,
    )
    fingerprint = fingerprint_decision_request(idem_payload)

    if idempotency_fingerprint_conflict(
        actor_id=actor_id,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
    ):
        raise KycEnterpriseDecisionError(code="idempotency_conflict", http_status=409)

    replay = lookup_idempotent_decision(actor_id=actor_id, idempotency_key=idempotency_key)
    if replay is not None:
        replay_copy = dict(replay)
        result = dict(replay_copy.get("result") or {})
        result["idempotent_replay"] = True
        replay_copy["result"] = result
        return replay_copy

    row = _select_user_row(supabase_client, application_id)
    if row is None:
        append_kyc_decision_audit_event(
            {
                "event_type": "kyc.decision.denied",
                "actor_id": actor_id,
                "request_id": request_id,
                "application_id": application_id,
                "decision": decision,
                "reason_code": "application_not_found",
                "service_identity": service_identity,
            }
        )
        raise KycEnterpriseDecisionError(code="application_not_found", http_status=404)

    current_version = _record_version_iso(row.get("updated_at"))
    if current_version != record_version:
        append_kyc_decision_audit_event(
            {
                "event_type": "kyc.decision.denied",
                "actor_id": actor_id,
                "request_id": request_id,
                "application_id": application_id,
                "decision": decision,
                "reason_code": "stale_record_version",
                "service_identity": service_identity,
            }
        )
        raise KycEnterpriseDecisionError(code="stale_record_version", http_status=409)

    driver_details = driver_details_as_dict(row.get("driver_details"))
    if driver_details.get("kyc_status") != "pending":
        append_kyc_decision_audit_event(
            {
                "event_type": "kyc.decision.denied",
                "actor_id": actor_id,
                "request_id": request_id,
                "application_id": application_id,
                "decision": decision,
                "reason_code": "not_pending",
                "service_identity": service_identity,
            }
        )
        raise KycEnterpriseDecisionError(code="not_pending", http_status=409)

    driver_active_until: str | None = None
    try:
        if decision == "approve":
            updated_details = apply_kyc_approve_mutation(driver_details)
            result_status = "approved"
            driver_active_until = driver_active_until_iso(60)
        else:
            assert rejection is not None
            updated_details, result_status = apply_kyc_reject_mutation(
                driver_details,
                reason_text=rejection["reason_text"],
                reason_code=rejection["reason_code"],
            )
    except ValueError as exc:
        code_map = {
            "not_pending": "not_pending",
            "vehicle_kind_missing": "vehicle_kind_missing",
        }
        reason = code_map.get(str(exc), "invalid_request")
        append_kyc_decision_audit_event(
            {
                "event_type": "kyc.decision.denied",
                "actor_id": actor_id,
                "request_id": request_id,
                "application_id": application_id,
                "decision": decision,
                "reason_code": reason,
                "service_identity": service_identity,
            }
        )
        raise KycEnterpriseDecisionError(code=reason, http_status=409) from exc  # type: ignore[arg-type]

    new_version = _optimistic_update_user(
        supabase_client,
        application_id=application_id,
        expected_record_version=record_version,
        driver_details=updated_details,
        driver_active_until=driver_active_until,
    )
    if new_version is None:
        append_kyc_decision_audit_event(
            {
                "event_type": "kyc.decision.denied",
                "actor_id": actor_id,
                "request_id": request_id,
                "application_id": application_id,
                "decision": decision,
                "reason_code": "stale_record_version",
                "service_identity": service_identity,
            }
        )
        raise KycEnterpriseDecisionError(code="stale_record_version", http_status=409)

    response = _success_response(
        application_id=application_id,
        decision=decision,
        kyc_status=result_status,
        record_version=new_version,
        idempotent_replay=False,
    )

    append_kyc_decision_audit_event(
        {
            "event_type": "kyc.decision.applied",
            "actor_id": actor_id,
            "request_id": request_id,
            "application_id": application_id,
            "decision": decision,
            "kyc_status": result_status,
            "record_version": new_version,
            "service_identity": service_identity,
            "idempotency_key": idempotency_key,
        }
    )

    store_idempotent_decision(
        actor_id=actor_id,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
        response=response,
    )

    logger.info(
        "enterprise_kyc_decision: applied identity=%s actor=%s request_id=%s "
        "application_id=%s decision=%s status=%s",
        service_identity,
        actor_id[:16],
        request_id[:16],
        application_id[:8],
        decision,
        result_status,
    )

    return response
