"""
Leylek Zeka support_context — yalnızca trip / normalize lifecycle (PII yok).
Saf mapper + minimal tags select (server active-tag ile uyumlu status listeleri).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from supabase_client import get_supabase

logger = logging.getLogger(__name__)

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)

# --- Saf lifecycle (tags satırı; yazma yok) ---


def infer_lifecycle_from_tag_row(row: Mapping[str, Any]) -> str:
    """
    Normalize lifecycle. Öncelik: terminal → ending → ilerleme → eşleşme öncesi.
    Beklenmeyen status → unknown.
    """
    try:
        st = str(row.get("status") or "").strip().lower()
        if not st:
            return "unknown"

        if st in ("cancelled", "expired"):
            return "cancelled"

        et = str(row.get("end_type") or "").strip().lower()
        if st == "completed":
            if et == "force":
                return "force_ended"
            return "completed"

        er = row.get("end_request")
        er_status: Optional[str] = None
        if isinstance(er, dict):
            raw_es = er.get("status")
            if raw_es is not None:
                er_status = str(raw_es).strip().lower()
        if er_status == "pending" and st in ("matched", "in_progress"):
            return "ending"

        if st == "in_progress":
            return "in_progress"

        if st == "matched":
            if row.get("boarding_confirmed_at"):
                return "in_progress"
            if row.get("boarding_qr_issued_at"):
                return "boarding"
            return "matched"

        if st == "offers_received":
            return "offer"

        if st in ("waiting", "pending"):
            return "tag_created"

        return "unknown"
    except Exception:
        logger.debug("infer_lifecycle_from_tag_row failed", exc_info=True)
        return "unknown"


def _iso_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _end_request_status_only(row: Mapping[str, Any]) -> Optional[str]:
    er = row.get("end_request")
    if not isinstance(er, dict):
        return None
    s = er.get("status")
    if s is None:
        return None
    out = str(s).strip()
    return out if out else None


def build_support_context_trip_payload(
    row: Optional[Mapping[str, Any]],
    *,
    generated_at: str,
) -> dict[str, Any]:
    """
    support_context kökü: schema_version + trip (PII yok).
    row None → aktif tag yok (authenticated user); lifecycle = none.
    """
    if row is None:
        trip: dict[str, Any] = {
            "tag_id": None,
            "tag_status_raw": None,
            "lifecycle": "none",
            "boarding_qr_issued_at": None,
            "boarding_confirmed_at": None,
            "started_at": None,
            "end_request_status": None,
            "end_type": None,
        }
    else:
        trip = {
            "tag_id": str(row["id"]).strip() if row.get("id") else None,
            "tag_status_raw": str(row.get("status") or "").strip().lower() or None,
            "lifecycle": infer_lifecycle_from_tag_row(row),
            "boarding_qr_issued_at": _iso_or_none(row.get("boarding_qr_issued_at")),
            "boarding_confirmed_at": _iso_or_none(row.get("boarding_confirmed_at")),
            "started_at": _iso_or_none(row.get("started_at")),
            "end_request_status": _end_request_status_only(row),
            "end_type": _iso_or_none(row.get("end_type")),
        }
    return {
        "schema_version": "1",
        "trip": trip,
        "generated_at": generated_at,
    }


def resolve_user_id_for_tags_sync(raw_user_id: str) -> str:
    """tags sorgusu için: UUID ise lower; değilse users.mongo_id ile tek select."""
    uid = (raw_user_id or "").strip()
    if not uid:
        return uid
    if _UUID_RE.match(uid):
        return uid.lower()
    sb = get_supabase()
    if not sb:
        return uid
    try:
        r = sb.table("users").select("id").eq("mongo_id", uid).limit(1).execute()
        if r.data:
            return str(r.data[0]["id"]).strip().lower()
    except Exception:
        logger.debug("resolve_user_id_for_tags_sync mongo lookup failed", exc_info=True)
    return uid


_TAG_COLS = "id,status,boarding_qr_issued_at,boarding_confirmed_at,started_at,end_request,end_type"


def fetch_active_tag_minimal_sync(resolved_jwt_sub: str) -> Optional[dict[str, Any]]:
    """
    Yolcu aktif tag (get_active_tag ile aynı status kümesi), yoksa sürücü matched/in_progress.
    Sync — asyncio.to_thread içinde çağrılmalı.
    """
    sb = get_supabase()
    if not sb:
        return None
    rid = resolve_user_id_for_tags_sync(resolved_jwt_sub)
    if not rid:
        return None
    try:
        r = (
            sb.table("tags")
            .select(_TAG_COLS)
            .eq("passenger_id", rid)
            .in_("status", ["waiting", "pending", "offers_received", "matched", "in_progress"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if r.data:
            return dict(r.data[0])
        r2 = (
            sb.table("tags")
            .select(_TAG_COLS)
            .eq("driver_id", rid)
            .in_("status", ["matched", "in_progress"])
            .order("matched_at", desc=True)
            .limit(1)
            .execute()
        )
        if r2.data:
            return dict(r2.data[0])
    except Exception:
        logger.warning("fetch_active_tag_minimal_sync failed", exc_info=True)
        return None
    return None


def utc_now_iso_z() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
