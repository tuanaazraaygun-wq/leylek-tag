"""
IBAN/havale transfer payment — Phase 2-D-1 claim/respond service.

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

ALLOWED_TAG_STATUSES = frozenset({"matched", "in_progress"})
DISPUTE_NOTE_MAX_LEN = 500
REPORT_REASON_DISPUTE = "transfer_payment_not_received"

TAG_COLS_TRANSFER = (
    "id, passenger_id, driver_id, status, boarding_confirmed_at, "
    "matched_bank_account_id, passenger_payment_method, transfer_payment, "
    "final_price, offered_price"
)

_ENV_TRANSFER_CONFIRM = "IBAN_TRANSFER_CONFIRM_REQUIRED"


class TransferPaymentDisabledError(Exception):
    """IBAN transfer confirm feature is off."""


class TransferPaymentForbiddenError(Exception):
    """Caller is not allowed for this tag/action."""


class TransferPaymentValidationError(Exception):
    """Preconditions not met (boarding, snapshot, status)."""


class TransferPaymentStateError(Exception):
    """Invalid state transition (e.g. not awaiting_driver)."""


class TransferPaymentNotFoundError(Exception):
    """Tag not found."""


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def is_iban_transfer_confirm_required() -> bool:
    return is_iban_payments_enabled() and _env_flag(_ENV_TRANSFER_CONFIRM)


def _require_transfer_feature() -> None:
    if not is_iban_payments_enabled():
        raise TransferPaymentDisabledError("IBAN payments disabled")
    if not _env_flag(_ENV_TRANSFER_CONFIRM):
        raise TransferPaymentDisabledError("IBAN transfer confirmation disabled")


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
    return "IBAN/havale yolculuğu sürücü ödeme onayı ile tamamlanır."


def fetch_tag_for_transfer(supabase, tag_id: str) -> Optional[dict]:
    tid = str(tag_id or "").strip()
    if not tid:
        return None
    res = supabase.table(TABLE_TAGS).select(TAG_COLS_TRANSFER).eq("id", tid).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _assert_active_tag_with_snapshot(tag_row: dict) -> Tuple[str, str]:
    st = str(tag_row.get("status") or "").strip().lower()
    if st not in ALLOWED_TAG_STATUSES:
        raise TransferPaymentValidationError("Bu yolculuk aktif değil")
    if not tag_row.get("boarding_confirmed_at"):
        raise TransferPaymentValidationError("Biniş onayı gerekli")
    if not str(tag_row.get("matched_bank_account_id") or "").strip():
        raise TransferPaymentValidationError("Bu yolculuk için IBAN snapshot yok")
    pid = _norm_uid(tag_row.get("passenger_id"))
    did = _norm_uid(tag_row.get("driver_id"))
    if not pid or not did:
        raise TransferPaymentValidationError("Yolculuk bilgisi eksik")
    return pid, did


def get_transfer_payment_status_public(tag_row: dict, viewer_id: str) -> dict:
    pid, did = _assert_active_tag_with_snapshot(tag_row)
    vid = _norm_uid(viewer_id)
    if vid not in (pid, did):
        raise TransferPaymentForbiddenError("Not authorized")
    tp = parse_transfer_payment(tag_row.get("transfer_payment"))
    st = transfer_payment_status(tag_row) or "idle"
    out: Dict[str, Any] = {
        "success": True,
        "tag_id": str(tag_row.get("id") or ""),
        "status": st,
    }
    if tp.get("claimed_at"):
        out["claimed_at"] = tp.get("claimed_at")
    if tp.get("confirmed_at"):
        out["confirmed_at"] = tp.get("confirmed_at")
    if tp.get("disputed_at"):
        out["disputed_at"] = tp.get("disputed_at")
    return out


def claim_transfer_payment(supabase, tag_id: str, passenger_id: str) -> dict:
    _require_transfer_feature()
    tag_row = fetch_tag_for_transfer(supabase, tag_id)
    if not tag_row:
        raise TransferPaymentNotFoundError("Yolculuk bulunamadı")
    pid, did = _assert_active_tag_with_snapshot(tag_row)
    if _norm_uid(passenger_id) != pid:
        raise TransferPaymentForbiddenError("Sadece yolcu ödeme bildirimi yapabilir")

    cur = transfer_payment_status(tag_row)
    if cur == TRANSFER_STATUS_CONFIRMED:
        raise TransferPaymentStateError("Ödeme zaten onaylandı")
    if cur == TRANSFER_STATUS_DISPUTED:
        raise TransferPaymentStateError("Ödeme uyuşmazlığı kayıtlı")

    now = _utcnow_iso()
    if cur == TRANSFER_STATUS_AWAITING:
        payload = parse_transfer_payment(tag_row.get("transfer_payment"))
        logger.info(
            "transfer_payment_claim_idempotent tag=%s passenger=%s",
            _mask_log_id(tag_id),
            _mask_log_id(passenger_id),
        )
        return {
            "success": True,
            "idempotent": True,
            "status": TRANSFER_STATUS_AWAITING,
            "tag_id": str(tag_id),
            "driver_id": did,
            "passenger_id": pid,
            "claimed_at": payload.get("claimed_at") or now,
        }

    tp_payload = {
        "status": TRANSFER_STATUS_AWAITING,
        "claimed_at": now,
        "passenger_id": pid,
        "driver_id": did,
    }
    supabase.table(TABLE_TAGS).update({"transfer_payment": tp_payload}).eq("id", str(tag_id)).execute()
    logger.info(
        "transfer_payment_claim tag=%s passenger=%s driver=%s",
        _mask_log_id(tag_id),
        _mask_log_id(passenger_id),
        _mask_log_id(did),
    )
    return {
        "success": True,
        "idempotent": False,
        "status": TRANSFER_STATUS_AWAITING,
        "tag_id": str(tag_id),
        "driver_id": did,
        "passenger_id": pid,
        "claimed_at": now,
    }


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
) -> Optional[str]:
    try:
        driver_res = supabase.table("users").select("name, phone, driver_details").eq("id", driver_id).limit(1).execute()
        passenger_res = supabase.table("users").select("name, phone, driver_details").eq("id", passenger_id).limit(1).execute()
        driver_info = (driver_res.data or [{}])[0]
        passenger_info = (passenger_res.data or [{}])[0]
        details_parts = ["[source=iban_transfer_dispute]"]
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
            "transfer_payment_dispute_report tag=%s driver=%s passenger=%s note_len=%s report=%s",
            _mask_log_id(tag_id),
            _mask_log_id(driver_id),
            _mask_log_id(passenger_id),
            len(dispute_note),
            _mask_log_id(rid),
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
    _require_transfer_feature()
    tag_row = fetch_tag_for_transfer(supabase, tag_id)
    if not tag_row:
        raise TransferPaymentNotFoundError("Yolculuk bulunamadı")
    pid, did = _assert_active_tag_with_snapshot(tag_row)
    if _norm_uid(driver_id) != did:
        raise TransferPaymentForbiddenError("Sadece sürücü yanıt verebilir")

    cur = transfer_payment_status(tag_row)
    if cur != TRANSFER_STATUS_AWAITING:
        raise TransferPaymentStateError("Bekleyen ödeme onayı yok")

    now = _utcnow_iso()
    existing = parse_transfer_payment(tag_row.get("transfer_payment"))

    if approved:
        tp_payload = {
            **existing,
            "status": TRANSFER_STATUS_CONFIRMED,
            "confirmed_at": now,
            "passenger_id": pid,
            "driver_id": did,
        }
        completed_at = now
        update_body: Dict[str, Any] = {
            "status": "completed",
            "completed_at": completed_at,
            "transfer_payment": tp_payload,
        }
        try:
            update_body["end_method"] = "iban_transfer"
            supabase.table(TABLE_TAGS).update(update_body).eq("id", str(tag_id)).execute()
        except Exception:
            update_body.pop("end_method", None)
            supabase.table(TABLE_TAGS).update(update_body).eq("id", str(tag_id)).execute()
        logger.info(
            "transfer_payment_confirmed tag=%s driver=%s passenger=%s",
            _mask_log_id(tag_id),
            _mask_log_id(driver_id),
            _mask_log_id(pid),
        )
        return {
            "success": True,
            "approved": True,
            "status": TRANSFER_STATUS_CONFIRMED,
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
    )
    tp_payload = {
        **existing,
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
        "transfer_payment_disputed tag=%s driver=%s passenger=%s note_len=%s",
        _mask_log_id(tag_id),
        _mask_log_id(driver_id),
        _mask_log_id(pid),
        len(note),
    )
    return {
        "success": True,
        "approved": False,
        "status": TRANSFER_STATUS_DISPUTED,
        "tag_id": str(tag_id),
        "driver_id": did,
        "passenger_id": pid,
        "report_id": report_id,
        "show_rating": False,
    }
