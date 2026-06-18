"""
IBAN/havale transfer payment — Phase 2-D-1 claim/respond service.

Trusted Direct (match_channel=trusted) cash claims share the same JSON state machine.

No full IBAN in logs, socket payloads, or API status responses.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from services.driver_iban_service import is_iban_payments_enabled

logger = logging.getLogger(__name__)

TABLE_TAGS = "tags"
TABLE_REPORTS = "reports"

TRANSFER_STATUS_AWAITING = "awaiting_driver"
TRANSFER_STATUS_CONFIRMED = "confirmed"
TRANSFER_STATUS_DISPUTED = "disputed"

MATCH_CHANNEL_TRUSTED = "trusted"
TRANSFER_METHOD_IBAN = "iban"
TRANSFER_METHOD_CASH = "cash"
ALLOWED_TRANSFER_METHODS = frozenset({TRANSFER_METHOD_IBAN, TRANSFER_METHOD_CASH})

ALLOWED_TAG_STATUSES = frozenset({"matched", "in_progress"})
DISPUTE_NOTE_MAX_LEN = 500
REPORT_REASON_DISPUTE = "transfer_payment_not_received"

TAG_COLS_TRANSFER = (
    "id, passenger_id, driver_id, status, match_channel, boarding_confirmed_at, "
    "matched_bank_account_id, passenger_payment_method, transfer_payment, "
    "final_price, offered_price"
)

_ENV_TRANSFER_CONFIRM = "IBAN_TRANSFER_CONFIRM_REQUIRED"
_ENV_RME_ENABLED = "RME_ENABLED"
_ENV_TDM_ENABLED = "TDM_ENABLED"


class TransferPaymentDisabledError(Exception):
    """IBAN transfer confirm feature is off."""


class TransferPaymentForbiddenError(Exception):
    """Caller is not allowed for this tag/action."""


class TransferPaymentValidationError(Exception):
    """Preconditions not met (boarding, snapshot, status)."""


class TransferPaymentBadRequestError(Exception):
    """Invalid request (e.g. unsupported method)."""


class TransferPaymentStateError(Exception):
    """Invalid state transition (e.g. not awaiting_driver)."""


class TransferPaymentNotFoundError(Exception):
    """Tag not found."""


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def is_iban_transfer_confirm_required() -> bool:
    return is_iban_payments_enabled() and _env_flag(_ENV_TRANSFER_CONFIRM)


def is_trusted_direct_match_enabled() -> bool:
    return _env_flag(_ENV_RME_ENABLED) and _env_flag(_ENV_TDM_ENABLED)


def is_trusted_direct_tag(tag_row: dict) -> bool:
    return str(tag_row.get("match_channel") or "").strip().lower() == MATCH_CHANNEL_TRUSTED


def _require_transfer_feature() -> None:
    if not is_iban_payments_enabled():
        raise TransferPaymentDisabledError("IBAN payments disabled")
    if not _env_flag(_ENV_TRANSFER_CONFIRM):
        raise TransferPaymentDisabledError("IBAN transfer confirmation disabled")


def _require_transfer_feature_for_claim(tag_row: dict, method: str) -> None:
    if method == TRANSFER_METHOD_CASH and is_trusted_direct_tag(tag_row):
        if not is_trusted_direct_match_enabled():
            raise TransferPaymentDisabledError("Trusted Direct Match disabled")
        return
    _require_transfer_feature()


def _require_transfer_feature_for_respond(tag_row: dict, existing: Dict[str, Any]) -> None:
    method = _transfer_method_from_payload(existing)
    if method == TRANSFER_METHOD_CASH and is_trusted_direct_tag(tag_row):
        if not is_trusted_direct_match_enabled():
            raise TransferPaymentDisabledError("Trusted Direct Match disabled")
        return
    _require_transfer_feature()


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _norm_uid(value: Any) -> str:
    return str(value or "").strip().lower()


def _mask_log_id(value: Any) -> str:
    s = str(value or "").strip()
    if not s:
        return "n/a"
    if len(s) <= 8:
        return f"***{s[-2:]}"
    return f"{s[:4]}***{s[-4:]}"


def parse_transfer_payment(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return dict(raw)


def _normalize_transfer_method(raw: Optional[str], *, default: str = TRANSFER_METHOD_IBAN) -> str:
    method = str(raw or default).strip().lower()
    if method not in ALLOWED_TRANSFER_METHODS:
        raise TransferPaymentBadRequestError(
            f"Geçersiz katkı yöntemi: {raw!r}. Desteklenen: iban, cash."
        )
    return method


def _transfer_method_from_payload(tp: Dict[str, Any]) -> str:
    return str(tp.get("method") or TRANSFER_METHOD_IBAN).strip().lower()


def transfer_payment_status(tag_row: dict) -> Optional[str]:
    tp = parse_transfer_payment(tag_row.get("transfer_payment"))
    st = str(tp.get("status") or "").strip().lower()
    return st or None


def is_cash_qr_complete_allowed(booked_pm: Optional[str], confirmed_pm: Optional[str]) -> bool:
    return booked_pm == "cash" and confirmed_pm == "cash"


def should_reject_complete_qr(
    tag_row: dict,
    booked_pm: Optional[str],
    confirmed_pm: Optional[str],
) -> Optional[str]:
    """Return error message if passenger complete-qr must be blocked."""
    if not is_iban_transfer_confirm_required():
        return None
    if not str(tag_row.get("matched_bank_account_id") or "").strip():
        return None
    if is_cash_qr_complete_allowed(booked_pm, confirmed_pm):
        return None
    st = transfer_payment_status(tag_row)
    if st == TRANSFER_STATUS_CONFIRMED:
        return None
    return "Havale/EFT ile iletilen yol paylaşım katkısı sürücü onayı ile tamamlanır."


def fetch_tag_for_transfer(supabase, tag_id: str) -> Optional[dict]:
    tid = str(tag_id or "").strip()
    if not tid:
        return None
    res = supabase.table(TABLE_TAGS).select(TAG_COLS_TRANSFER).eq("id", tid).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _assert_active_tag_base(tag_row: dict) -> Tuple[str, str]:
    st = str(tag_row.get("status") or "").strip().lower()
    if st not in ALLOWED_TAG_STATUSES:
        raise TransferPaymentValidationError("Bu yolculuk aktif değil")
    if not tag_row.get("boarding_confirmed_at"):
        raise TransferPaymentValidationError("Biniş onayı gerekli")
    pid = _norm_uid(tag_row.get("passenger_id"))
    did = _norm_uid(tag_row.get("driver_id"))
    if not pid or not did:
        raise TransferPaymentValidationError("Yolculuk bilgisi eksik")
    return pid, did


def _assert_active_tag_with_snapshot(tag_row: dict) -> Tuple[str, str]:
    pid, did = _assert_active_tag_base(tag_row)
    if not str(tag_row.get("matched_bank_account_id") or "").strip():
        raise TransferPaymentValidationError("Bu yolculuk için IBAN snapshot yok")
    return pid, did


def _assert_claim_preconditions(tag_row: dict, method: str) -> Tuple[str, str]:
    if method == TRANSFER_METHOD_CASH:
        if not is_trusted_direct_tag(tag_row):
            raise TransferPaymentForbiddenError("Nakit katkı bildirimi bu yolculuk için kullanılamaz")
        return _assert_active_tag_base(tag_row)
    return _assert_active_tag_with_snapshot(tag_row)


def _assert_respond_preconditions(tag_row: dict, existing: Dict[str, Any]) -> Tuple[str, str]:
    method = _transfer_method_from_payload(existing)
    if method == TRANSFER_METHOD_CASH:
        if not is_trusted_direct_tag(tag_row):
            raise TransferPaymentStateError("Bekleyen katkı onayı yok")
        return _assert_active_tag_base(tag_row)
    return _assert_active_tag_with_snapshot(tag_row)


def _assert_viewer_authorized(pid: str, did: str, viewer_id: str) -> None:
    vid = _norm_uid(viewer_id)
    if vid not in (pid, did):
        raise TransferPaymentForbiddenError("Not authorized")


def _resolve_end_method_on_approve(tag_row: dict, method: str) -> str:
    if method == TRANSFER_METHOD_CASH and is_trusted_direct_tag(tag_row):
        return "trusted_cash"
    return "iban_transfer"


def _claim_result_payload(
    *,
    tag_id: str,
    pid: str,
    did: str,
    method: str,
    claimed_at: str,
    idempotent: bool,
) -> dict:
    return {
        "success": True,
        "idempotent": idempotent,
        "status": TRANSFER_STATUS_AWAITING,
        "method": method,
        "tag_id": str(tag_id),
        "driver_id": did,
        "passenger_id": pid,
        "claimed_at": claimed_at,
    }


def get_transfer_payment_status_public(tag_row: dict, viewer_id: str) -> dict:
    tp = parse_transfer_payment(tag_row.get("transfer_payment"))
    method = _transfer_method_from_payload(tp)
    st = transfer_payment_status(tag_row) or "idle"

    if method == TRANSFER_METHOD_CASH and is_trusted_direct_tag(tag_row):
        pid, did = _assert_active_tag_base(tag_row)
    elif st in (TRANSFER_STATUS_AWAITING, TRANSFER_STATUS_CONFIRMED, TRANSFER_STATUS_DISPUTED):
        pid, did = _assert_respond_preconditions(tag_row, tp)
    else:
        pid, did = _assert_active_tag_with_snapshot(tag_row)

    _assert_viewer_authorized(pid, did, viewer_id)

    out: Dict[str, Any] = {
        "success": True,
        "tag_id": str(tag_row.get("id") or ""),
        "status": st,
    }
    if st != "idle" or tp.get("method"):
        out["method"] = method
    if tp.get("claimed_at"):
        out["claimed_at"] = tp.get("claimed_at")
    if tp.get("confirmed_at"):
        out["confirmed_at"] = tp.get("confirmed_at")
    if tp.get("disputed_at"):
        out["disputed_at"] = tp.get("disputed_at")
    return out


def claim_transfer_payment(
    supabase,
    tag_id: str,
    passenger_id: str,
    *,
    method: str = TRANSFER_METHOD_IBAN,
) -> dict:
    method_norm = _normalize_transfer_method(method)
    tag_row = fetch_tag_for_transfer(supabase, tag_id)
    if not tag_row:
        raise TransferPaymentNotFoundError("Yolculuk bulunamadı")

    _require_transfer_feature_for_claim(tag_row, method_norm)
    pid, did = _assert_claim_preconditions(tag_row, method_norm)
    if _norm_uid(passenger_id) != pid:
        raise TransferPaymentForbiddenError("Sadece yolcu katkı bildirimi yapabilir")

    cur = transfer_payment_status(tag_row)
    if cur == TRANSFER_STATUS_CONFIRMED:
        raise TransferPaymentStateError("Katkı zaten onaylandı")
    if cur == TRANSFER_STATUS_DISPUTED:
        raise TransferPaymentStateError("Katkı uyuşmazlığı kayıtlı")

    now = _utcnow_iso()
    if cur == TRANSFER_STATUS_AWAITING:
        payload = parse_transfer_payment(tag_row.get("transfer_payment"))
        logger.info(
            "transfer_payment_claim_idempotent tag=%s passenger=%s method=%s",
            _mask_log_id(tag_id),
            _mask_log_id(passenger_id),
            payload.get("method") or method_norm,
        )
        return _claim_result_payload(
            tag_id=tag_id,
            pid=pid,
            did=did,
            method=str(payload.get("method") or method_norm),
            claimed_at=str(payload.get("claimed_at") or now),
            idempotent=True,
        )

    tp_payload = {
        "method": method_norm,
        "status": TRANSFER_STATUS_AWAITING,
        "claimed_at": now,
        "passenger_id": pid,
        "driver_id": did,
    }
    supabase.table(TABLE_TAGS).update({"transfer_payment": tp_payload}).eq("id", str(tag_id)).execute()
    logger.info(
        "transfer_payment_claim tag=%s passenger=%s driver=%s method=%s",
        _mask_log_id(tag_id),
        _mask_log_id(passenger_id),
        _mask_log_id(did),
        method_norm,
    )
    return _claim_result_payload(
        tag_id=tag_id,
        pid=pid,
        did=did,
        method=method_norm,
        claimed_at=now,
        idempotent=False,
    )


def _sanitize_dispute_note(raw: Optional[str]) -> str:
    note = str(raw or "").strip()
    if len(note) > DISPUTE_NOTE_MAX_LEN:
        note = note[:DISPUTE_NOTE_MAX_LEN]
    return note


def _insert_dispute_report(
    supabase,
    *,
    driver_id: str,
    passenger_id: str,
    tag_id: str,
    dispute_note: str,
    method: str = TRANSFER_METHOD_IBAN,
) -> Optional[str]:
    source = "trusted_cash_transfer_dispute" if method == TRANSFER_METHOD_CASH else "iban_transfer_dispute"
    try:
        driver_res = supabase.table("users").select("name, phone, driver_details").eq("id", driver_id).limit(1).execute()
        passenger_res = supabase.table("users").select("name, phone, driver_details").eq("id", passenger_id).limit(1).execute()
        driver_info = (driver_res.data or [{}])[0]
        passenger_info = (passenger_res.data or [{}])[0]
        details_parts = [f"[source={source}]"]
        if dispute_note:
            details_parts.append(dispute_note)
        report_data = {
            "reporter_id": driver_id,
            "reporter_name": driver_info.get("name") or "Sürücü",
            "reporter_phone": driver_info.get("phone") or "",
            "reported_user_id": passenger_id,
            "reported_user_name": passenger_info.get("name") or "Yolcu",
            "reported_user_phone": passenger_info.get("phone") or "",
            "reported_user_role": "passenger",
            "reason": REPORT_REASON_DISPUTE,
            "details": " ".join(details_parts).strip(),
            "tag_id": tag_id,
            "status": "pending",
            "created_at": _utcnow_iso(),
        }
        result = supabase.table(TABLE_REPORTS).insert(report_data).execute()
        rid = None
        if result.data:
            rid = str(result.data[0].get("id") or "") or None
        logger.info(
            "transfer_payment_dispute_report tag=%s driver=%s passenger=%s note_len=%s report=%s method=%s",
            _mask_log_id(tag_id),
            _mask_log_id(driver_id),
            _mask_log_id(passenger_id),
            len(dispute_note),
            _mask_log_id(rid),
            method,
        )
        return rid
    except Exception as exc:
        logger.warning(
            "transfer_payment_dispute_report_failed tag=%s err=%s",
            _mask_log_id(tag_id),
            type(exc).__name__,
        )
        return None


def respond_transfer_payment(
    supabase,
    tag_id: str,
    driver_id: str,
    *,
    approved: bool,
    dispute_note: Optional[str] = None,
) -> dict:
    tag_row = fetch_tag_for_transfer(supabase, tag_id)
    if not tag_row:
        raise TransferPaymentNotFoundError("Yolculuk bulunamadı")

    existing = parse_transfer_payment(tag_row.get("transfer_payment"))
    _require_transfer_feature_for_respond(tag_row, existing)
    pid, did = _assert_respond_preconditions(tag_row, existing)
    if _norm_uid(driver_id) != did:
        raise TransferPaymentForbiddenError("Sadece sürücü yanıt verebilir")

    cur = transfer_payment_status(tag_row)
    if cur != TRANSFER_STATUS_AWAITING:
        raise TransferPaymentStateError("Bekleyen katkı onayı yok")

    method = _transfer_method_from_payload(existing)
    now = _utcnow_iso()

    if approved:
        tp_payload = {
            **existing,
            "method": method,
            "status": TRANSFER_STATUS_CONFIRMED,
            "confirmed_at": now,
            "passenger_id": pid,
            "driver_id": did,
        }
        completed_at = now
        end_method = _resolve_end_method_on_approve(tag_row, method)
        update_body: Dict[str, Any] = {
            "status": "completed",
            "completed_at": completed_at,
            "transfer_payment": tp_payload,
        }
        try:
            update_body["end_method"] = end_method
            supabase.table(TABLE_TAGS).update(update_body).eq("id", str(tag_id)).execute()
        except Exception:
            update_body.pop("end_method", None)
            supabase.table(TABLE_TAGS).update(update_body).eq("id", str(tag_id)).execute()
        logger.info(
            "transfer_payment_confirmed tag=%s driver=%s passenger=%s method=%s end_method=%s",
            _mask_log_id(tag_id),
            _mask_log_id(driver_id),
            _mask_log_id(pid),
            method,
            end_method,
        )
        return {
            "success": True,
            "approved": True,
            "status": TRANSFER_STATUS_CONFIRMED,
            "method": method,
            "end_method": end_method,
            "tag_id": str(tag_id),
            "driver_id": did,
            "passenger_id": pid,
            "completed_at": completed_at,
            "show_rating": True,
        }

    note = _sanitize_dispute_note(dispute_note)
    report_id = _insert_dispute_report(
        supabase,
        driver_id=did,
        passenger_id=pid,
        tag_id=str(tag_id),
        dispute_note=note,
        method=method,
    )
    tp_payload = {
        **existing,
        "method": method,
        "status": TRANSFER_STATUS_DISPUTED,
        "disputed_at": now,
        "dispute_note": note,
        "passenger_id": pid,
        "driver_id": did,
    }
    if report_id:
        tp_payload["report_id"] = report_id
    supabase.table(TABLE_TAGS).update({"transfer_payment": tp_payload}).eq("id", str(tag_id)).execute()
    logger.info(
        "transfer_payment_disputed tag=%s driver=%s passenger=%s note_len=%s method=%s",
        _mask_log_id(tag_id),
        _mask_log_id(driver_id),
        _mask_log_id(pid),
        len(note),
        method,
    )
    return {
        "success": True,
        "approved": False,
        "status": TRANSFER_STATUS_DISPUTED,
        "method": method,
        "tag_id": str(tag_id),
        "driver_id": did,
        "passenger_id": pid,
        "report_id": report_id,
        "show_rating": False,
    }
