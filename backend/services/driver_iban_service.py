"""
Driver IBAN accounts — Phase 1-B service layer.

Full IBAN is returned only from driver CRUD (owner) and passenger payment-details.
Never log raw IBAN; use mask_iban_for_log.
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

TABLE_DRIVER_BANK_ACCOUNTS = "driver_bank_accounts"
TABLE_TAGS = "tags"

PAYMENT_DETAILS_ALLOWED_STATUSES = frozenset({"matched", "in_progress"})

_IBAN_ENV_MASTER = "IBAN_PAYMENTS_ENABLED"
_IBAN_ENV_SNAPSHOT = "IBAN_SNAPSHOT_ON_MATCH"


class IbanPaymentsDisabledError(Exception):
    """IBAN_PAYMENTS_ENABLED is off."""


class IbanValidationError(Exception):
    """IBAN or account holder validation failed."""


class IbanAccountNotFoundError(Exception):
    """Bank account missing or not owned by driver."""


class PaymentDetailsForbiddenError(Exception):
    """Viewer is not allowed to see payment details for this trip."""


class PaymentDetailsNotAvailableError(Exception):
    """Trip has no bank account snapshot or account row unavailable."""


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def is_iban_payments_enabled() -> bool:
    return _env_flag(_IBAN_ENV_MASTER)


def is_iban_snapshot_on_match_enabled() -> bool:
    return is_iban_payments_enabled() and _env_flag(_IBAN_ENV_SNAPSHOT)


def normalize_iban(raw: str) -> str:
    s = re.sub(r"[\s\-]", "", str(raw or "").strip()).upper()
    return s


def _iban_to_numeric(iban: str) -> str:
    out: List[str] = []
    for ch in iban:
        if ch.isdigit():
            out.append(ch)
        elif "A" <= ch <= "Z":
            out.append(str(ord(ch) - 55))
        else:
            raise IbanValidationError("Geçersiz IBAN karakteri")
    return "".join(out)


def validate_iban_format(iban: str) -> None:
    normalized = normalize_iban(iban)
    if len(normalized) < 15:
        raise IbanValidationError("IBAN çok kısa")
    if len(normalized) > 34:
        raise IbanValidationError("IBAN çok uzun")
    if not re.match(r"^[A-Z]{2}[0-9]{2}[A-Z0-9]+$", normalized):
        raise IbanValidationError("IBAN formatı geçersiz")
    if normalized.startswith("TR") and len(normalized) != 26:
        raise IbanValidationError("TR IBAN 26 karakter olmalı")
    rearranged = normalized[4:] + normalized[:4]
    try:
        numeric = _iban_to_numeric(rearranged)
    except IbanValidationError:
        raise
    if int(numeric) % 97 != 1:
        raise IbanValidationError("IBAN kontrol basamağı geçersiz")


def validate_account_holder_name(name: str) -> None:
    cleaned = str(name or "").strip()
    if len(cleaned) < 2:
        raise IbanValidationError("Hesap sahibi adı en az 2 karakter olmalı")


def mask_iban_for_log(iban: str) -> str:
    normalized = normalize_iban(iban)
    if len(normalized) <= 6:
        return "***"
    return f"{normalized[:2]}{'*' * (len(normalized) - 6)}{normalized[-4:]}"


def mask_iban_for_list(iban: str) -> str:
    normalized = normalize_iban(iban)
    if len(normalized) <= 8:
        return "***"
    return f"{normalized[:4]}****{normalized[-4:]}"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _norm_user_id(user_id: str) -> str:
    s = str(user_id or "").strip()
    if len(s) == 36 and s.count("-") == 4:
        return s.lower()
    return s


def _require_payments_enabled() -> None:
    if not is_iban_payments_enabled():
        raise IbanPaymentsDisabledError("IBAN payments disabled")


def _account_row_to_dict(row: dict, *, include_full_iban: bool) -> dict:
    iban_raw = str(row.get("iban") or "")
    out = {
        "id": str(row.get("id") or ""),
        "driver_id": str(row.get("driver_id") or ""),
        "account_holder_name": row.get("account_holder_name"),
        "label": row.get("label"),
        "is_default": bool(row.get("is_default")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "deleted_at": row.get("deleted_at"),
    }
    if include_full_iban:
        out["iban"] = normalize_iban(iban_raw)
    else:
        out["iban_masked"] = mask_iban_for_list(iban_raw)
    return out


def _fetch_account_for_driver(
    supabase,
    driver_id: str,
    account_id: str,
    *,
    active_only: bool = True,
) -> dict:
    did = _norm_user_id(driver_id)
    aid = str(account_id or "").strip()
    q = (
        supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
        .select("*")
        .eq("id", aid)
        .eq("driver_id", did)
    )
    if active_only:
        q = q.is_("deleted_at", "null")
    res = q.limit(1).execute()
    if not res.data:
        raise IbanAccountNotFoundError("Bank account not found")
    return res.data[0]


def _clear_other_defaults(
    supabase,
    driver_id: str,
    except_id: Optional[str] = None,
) -> None:
    did = _norm_user_id(driver_id)
    now = _utcnow_iso()
    q = (
        supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
        .update({"is_default": False, "updated_at": now})
        .eq("driver_id", did)
        .eq("is_default", True)
        .is_("deleted_at", "null")
    )
    if except_id:
        q = q.neq("id", str(except_id).strip())
    q.execute()


def list_driver_bank_accounts(supabase, driver_id: str) -> List[dict]:
    _require_payments_enabled()
    did = _norm_user_id(driver_id)
    res = (
        supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
        .select("*")
        .eq("driver_id", did)
        .is_("deleted_at", "null")
        .order("is_default", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    rows = res.data or []
    return [_account_row_to_dict(r, include_full_iban=False) for r in rows]


def get_driver_bank_account(supabase, driver_id: str, account_id: str) -> dict:
    _require_payments_enabled()
    row = _fetch_account_for_driver(supabase, driver_id, account_id, active_only=True)
    return _account_row_to_dict(row, include_full_iban=True)


def create_driver_bank_account(
    supabase,
    driver_id: str,
    iban: str,
    account_holder_name: str,
    label: Optional[str] = None,
    is_default: bool = False,
) -> dict:
    _require_payments_enabled()
    did = _norm_user_id(driver_id)
    normalized = normalize_iban(iban)
    validate_iban_format(normalized)
    validate_account_holder_name(account_holder_name)
    now = _utcnow_iso()
    if is_default:
        _clear_other_defaults(supabase, did)
    payload = {
        "driver_id": did,
        "iban": normalized,
        "account_holder_name": str(account_holder_name).strip(),
        "label": (str(label).strip() if label else None) or None,
        "is_default": bool(is_default),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    res = supabase.table(TABLE_DRIVER_BANK_ACCOUNTS).insert(payload).execute()
    if not res.data:
        raise IbanValidationError("Bank account could not be created")
    row = res.data[0]
    logger.info(
        "driver_bank_account_created driver_id=%s account_id=%s iban=%s default=%s",
        did[:13],
        str(row.get("id", ""))[:13],
        mask_iban_for_log(normalized),
        bool(is_default),
    )
    return _account_row_to_dict(row, include_full_iban=True)


def update_driver_bank_account(
    supabase,
    driver_id: str,
    account_id: str,
    *,
    iban: Optional[str] = None,
    account_holder_name: Optional[str] = None,
    label: Optional[str] = None,
    is_default: Optional[bool] = None,
) -> dict:
    _require_payments_enabled()
    row = _fetch_account_for_driver(supabase, driver_id, account_id, active_only=True)
    aid = str(row.get("id"))
    did = _norm_user_id(driver_id)
    patch: Dict[str, Any] = {"updated_at": _utcnow_iso()}
    if iban is not None:
        normalized = normalize_iban(iban)
        validate_iban_format(normalized)
        patch["iban"] = normalized
    if account_holder_name is not None:
        validate_account_holder_name(account_holder_name)
        patch["account_holder_name"] = str(account_holder_name).strip()
    if label is not None:
        patch["label"] = str(label).strip() or None
    if is_default is True:
        _clear_other_defaults(supabase, did, except_id=aid)
        patch["is_default"] = True
    elif is_default is False:
        patch["is_default"] = False
    res = (
        supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
        .update(patch)
        .eq("id", aid)
        .eq("driver_id", did)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise IbanAccountNotFoundError("Bank account not found")
    updated = res.data[0]
    log_iban = patch.get("iban") or row.get("iban") or ""
    logger.info(
        "driver_bank_account_updated driver_id=%s account_id=%s iban=%s",
        did[:13],
        aid[:13],
        mask_iban_for_log(str(log_iban)),
    )
    return _account_row_to_dict(updated, include_full_iban=True)


def soft_delete_driver_bank_account(
    supabase,
    driver_id: str,
    account_id: str,
) -> dict:
    _require_payments_enabled()
    row = _fetch_account_for_driver(supabase, driver_id, account_id, active_only=True)
    aid = str(row.get("id"))
    did = _norm_user_id(driver_id)
    now = _utcnow_iso()
    res = (
        supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
        .update({"deleted_at": now, "updated_at": now, "is_default": False})
        .eq("id", aid)
        .eq("driver_id", did)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise IbanAccountNotFoundError("Bank account not found")
    logger.info(
        "driver_bank_account_deleted driver_id=%s account_id=%s",
        did[:13],
        aid[:13],
    )
    return {
        "id": aid,
        "driver_id": did,
        "deleted_at": now,
        "success": True,
    }


def set_default_driver_bank_account(
    supabase,
    driver_id: str,
    account_id: str,
) -> dict:
    _require_payments_enabled()
    row = _fetch_account_for_driver(supabase, driver_id, account_id, active_only=True)
    aid = str(row.get("id"))
    did = _norm_user_id(driver_id)
    _clear_other_defaults(supabase, did, except_id=aid)
    now = _utcnow_iso()
    res = (
        supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
        .update({"is_default": True, "updated_at": now})
        .eq("id", aid)
        .eq("driver_id", did)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise IbanAccountNotFoundError("Bank account not found")
    logger.info(
        "driver_bank_account_set_default driver_id=%s account_id=%s",
        did[:13],
        aid[:13],
    )
    return _account_row_to_dict(res.data[0], include_full_iban=True)


def resolve_matched_bank_account_id_for_driver(
    supabase,
    driver_id: str,
) -> Optional[str]:
    if not is_iban_snapshot_on_match_enabled():
        return None
    did = _norm_user_id(driver_id)
    if not did:
        return None
    try:
        res = (
            supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
            .select("id")
            .eq("driver_id", did)
            .eq("is_default", True)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        account_id = res.data[0].get("id")
        return str(account_id) if account_id else None
    except Exception as exc:
        logger.warning(
            "resolve_matched_bank_account_id failed driver_id=%s err=%s",
            did[:13],
            type(exc).__name__,
        )
        return None


def build_snapshot_fields_for_tag_update(supabase, driver_id: str) -> dict:
    if not is_iban_snapshot_on_match_enabled():
        return {}
    try:
        account_id = resolve_matched_bank_account_id_for_driver(supabase, driver_id)
        if not account_id:
            logger.info(
                "iban_snapshot_none driver_id=%s",
                _norm_user_id(driver_id)[:13],
            )
            return {}
        logger.info(
            "iban_snapshot_set driver_id=%s account_id=%s",
            _norm_user_id(driver_id)[:13],
            account_id[:13],
        )
        return {"matched_bank_account_id": account_id}
    except Exception as exc:
        logger.warning(
            "build_snapshot_fields fail_open driver_id=%s err=%s",
            _norm_user_id(driver_id)[:13],
            type(exc).__name__,
        )
        return {}


def _load_tag_for_payment_details(supabase, tag_id: str) -> dict:
    tid = str(tag_id or "").strip()
    if len(tid) == 36 and tid.count("-") == 4:
        tid = tid.lower()
    res = (
        supabase.table(TABLE_TAGS)
        .select(
            "id, passenger_id, driver_id, status, boarding_confirmed_at, matched_bank_account_id"
        )
        .eq("id", tid)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise PaymentDetailsNotAvailableError("Trip not found")
    return res.data[0]


def _assert_passenger_payment_access(tag_row: dict, passenger_id: str) -> None:
    viewer = _norm_user_id(passenger_id)
    tag_passenger = _norm_user_id(str(tag_row.get("passenger_id") or ""))
    if not viewer or not tag_passenger or viewer != tag_passenger:
        raise PaymentDetailsForbiddenError("Not authorized for this trip")


def _load_bank_account_by_id(supabase, account_id: str) -> dict:
    aid = str(account_id or "").strip()
    res = (
        supabase.table(TABLE_DRIVER_BANK_ACCOUNTS)
        .select("id, iban, account_holder_name, label, deleted_at")
        .eq("id", aid)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise PaymentDetailsNotAvailableError("Bank account snapshot unavailable")
    return res.data[0]


def get_trip_payment_details_for_passenger(
    supabase,
    tag_id: str,
    passenger_id: str,
) -> dict:
    _require_payments_enabled()
    tag = _load_tag_for_payment_details(supabase, tag_id)
    _assert_passenger_payment_access(tag, passenger_id)
    status = str(tag.get("status") or "").strip().lower()
    if status not in PAYMENT_DETAILS_ALLOWED_STATUSES:
        raise PaymentDetailsForbiddenError("Trip status does not allow payment details")
    if not tag.get("boarding_confirmed_at"):
        raise PaymentDetailsForbiddenError("Boarding not confirmed")
    snapshot_id = tag.get("matched_bank_account_id")
    if not snapshot_id:
        raise PaymentDetailsNotAvailableError("No bank account snapshot on trip")
    account = _load_bank_account_by_id(supabase, str(snapshot_id))
    iban_full = normalize_iban(str(account.get("iban") or ""))
    logger.info(
        "trip_payment_details tag_id=%s passenger_id=%s account_id=%s iban=%s",
        str(tag_id)[:13],
        _norm_user_id(passenger_id)[:13],
        str(account.get("id", ""))[:13],
        mask_iban_for_log(iban_full),
    )
    return {
        "success": True,
        "tag_id": str(tag.get("id") or tag_id),
        "account_id": str(account.get("id") or ""),
        "iban": iban_full,
        "account_holder_name": account.get("account_holder_name"),
        "label": account.get("label"),
    }
