"""
Güven Al — trust_sessions tablosu iş kuralları (calls /voice akışından ayrı).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

TRUST_REQUEST_TTL_SEC = 120
TRUST_SESSION_MAX_SEC = 120  # Güven görüşmesi süresi (frontend geri sayım ile aynı)

MATCHABLE_TAG_STATUSES = ("matched", "in_progress")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_ts(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    s = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def expire_stale_sessions(supabase) -> List[Dict[str, Any]]:
    """
    Süresi dolmuş pending ve accepted kayıtları kapatır.
    Dönüş: socket ile trust_session_ended gönderilecek özet listeler.
    """
    ended: List[Dict[str, Any]] = []
    now = _utcnow()
    now_s = _iso(now)

    try:
        res = (
            supabase.table("trust_sessions")
            .select("*")
            .eq("status", "pending")
            .execute()
        )
        for row in res.data or []:
            ttl = _parse_ts(row.get("request_ttl_expires_at"))
            if ttl is None or ttl > now:
                continue
            tid = row.get("id")
            supabase.table("trust_sessions").update(
                {
                    "status": "expired",
                    "ended_at": now_s,
                    "end_reason": "expired",
                    "updated_at": now_s,
                }
            ).eq("id", tid).execute()
            ended.append(
                {
                    "trust_id": str(tid),
                    "tag_id": str(row.get("tag_id", "")),
                    "requester_id": str(row.get("requester_id", "")),
                    "target_id": str(row.get("target_id", "")),
                    "end_reason": "expired",
                }
            )
    except Exception as e:
        logger.warning("expire_stale_sessions pending: %s", e)

    try:
        res2 = (
            supabase.table("trust_sessions")
            .select("*")
            .eq("status", "accepted")
            .execute()
        )
        for row in res2.data or []:
            dl = _parse_ts(row.get("session_hard_deadline_at"))
            if dl is None or dl > now:
                continue
            tid = row.get("id")
            supabase.table("trust_sessions").update(
                {
                    "status": "ended",
                    "ended_at": now_s,
                    "end_reason": "auto_closed",
                    "updated_at": now_s,
                }
            ).eq("id", tid).execute()
            ended.append(
                {
                    "trust_id": str(tid),
                    "tag_id": str(row.get("tag_id", "")),
                    "requester_id": str(row.get("requester_id", "")),
                    "target_id": str(row.get("target_id", "")),
                    "end_reason": "auto_closed",
                }
            )
    except Exception as e:
        logger.warning("expire_stale_sessions accepted: %s", e)

    return ended


VOICE_STALE_RINGING_SEC = 90  # check_call_status ile uyumlu
VOICE_STALE_CONNECTED_SEC = 720  # CallScreen üst sınırından (600s) sonra


def cleanup_stale_voice_calls(supabase) -> Dict[str, Any]:
    """
    Uzun süre çalan / takılı connected kayıtlarını kapatır; meşgul (busy) yanlış pozitiflerini azaltır.
    Dönüş: güncellenen satır sayıları (log için).
    """
    summary: Dict[str, Any] = {"missed_ringing": 0, "ended_connected": 0}
    now = _utcnow()
    now_s = _iso(now)
    cut_ring = _iso(now - timedelta(seconds=VOICE_STALE_RINGING_SEC))
    cut_conn = _iso(now - timedelta(seconds=VOICE_STALE_CONNECTED_SEC))
    try:
        r1 = (
            supabase.table("calls")
            .update({"status": "missed", "ended_at": now_s})
            .eq("status", "ringing")
            .lt("created_at", cut_ring)
            .execute()
        )
        summary["missed_ringing"] = len(r1.data or [])
    except Exception as e:
        logger.warning("cleanup_stale_voice_calls ringing: %s", e)
    try:
        r2 = (
            supabase.table("calls")
            .update({"status": "ended", "ended_at": now_s})
            .eq("status", "connected")
            .lt("created_at", cut_conn)
            .execute()
        )
        summary["ended_connected"] = len(r2.data or [])
    except Exception as e:
        logger.warning("cleanup_stale_voice_calls connected: %s", e)
    return summary


def _norm_uid(uid: str) -> str:
    return str(uid or "").strip().lower()


def create_trust_request(supabase, requester_id: str, tag_id: str) -> Dict[str, Any]:
    """Yeni güven isteği. requester_id normalize UUID string."""
    rid = _norm_uid(requester_id)
    tid = str(tag_id).strip()
    if len(tid) == 36 and tid.count("-") == 4:
        tid = tid.lower()

    tr = supabase.table("tags").select("id,status,passenger_id,driver_id").eq("id", tid).limit(1).execute()
    if not tr.data:
        return {"success": False, "error": "tag_not_found"}
    tag = tr.data[0]
    st = (tag.get("status") or "").strip()
    if st not in MATCHABLE_TAG_STATUSES:
        return {"success": False, "error": "tag_not_matched", "detail": "Yalnızca eşleşmiş yolculukta kullanılabilir"}

    pid = _norm_uid(str(tag.get("passenger_id") or ""))
    did = _norm_uid(str(tag.get("driver_id") or ""))
    if not pid or not did:
        return {"success": False, "error": "tag_incomplete"}

    if rid not in (pid, did):
        return {"success": False, "error": "forbidden"}

    if rid == pid:
        requester_role, target_role = "passenger", "driver"
        target_id = did
    else:
        requester_role, target_role = "driver", "passenger"
        target_id = pid

    active = (
        supabase.table("trust_sessions")
        .select("id")
        .eq("tag_id", tid)
        .in_("status", ["pending", "accepted"])
        .limit(5)
        .execute()
    )
    if active.data:
        try:
            logger.info(
                "TRUST_REQUEST_BLOCK_REASON %s",
                json.dumps(
                    {
                        "reason": "trust_already_active",
                        "tag_id": tid,
                        "blocking_session_ids": [str(r.get("id", "")) for r in active.data],
                    },
                    default=str,
                ),
            )
        except Exception:
            logger.info(
                "TRUST_REQUEST_BLOCK_REASON trust_already_active tag_id=%s",
                tid,
            )
        return {"success": False, "error": "trust_already_active"}

    now = _utcnow()
    ttl = now + timedelta(seconds=TRUST_REQUEST_TTL_SEC)
    now_s = _iso(now)
    ttl_s = _iso(ttl)
    new_id = str(uuid.uuid4())

    ins = (
        supabase.table("trust_sessions")
        .insert(
            {
                "id": new_id,
                "tag_id": tid,
                "requester_id": rid,
                "target_id": target_id,
                "requester_role": requester_role,
                "target_role": target_role,
                "status": "pending",
                "requested_at": now_s,
                "request_ttl_expires_at": ttl_s,
                "created_at": now_s,
                "updated_at": now_s,
            }
        )
        .execute()
    )
    if not ins.data:
        return {"success": False, "error": "insert_failed"}

    return {
        "success": True,
        "trust_id": new_id,
        "tag_id": tid,
        "requester_id": rid,
        "target_id": target_id,
        "requester_role": requester_role,
        "request_ttl_expires_at": ttl_s,
    }


def respond_trust(
    supabase,
    user_id: str,
    trust_id: str,
    accept: bool,
) -> Dict[str, Any]:
    uid = _norm_uid(user_id)
    tslug = str(trust_id).strip()

    res = supabase.table("trust_sessions").select("*").eq("id", tslug).limit(1).execute()
    if not res.data:
        return {"success": False, "error": "not_found"}
    row = res.data[0]
    if row.get("status") != "pending":
        return {"success": False, "error": "invalid_state"}
    if _norm_uid(str(row.get("target_id", ""))) != uid:
        return {"success": False, "error": "forbidden"}

    ttl = _parse_ts(row.get("request_ttl_expires_at"))
    if ttl is not None and _utcnow() > ttl:
        now_s = _iso(_utcnow())
        supabase.table("trust_sessions").update(
            {
                "status": "expired",
                "ended_at": now_s,
                "end_reason": "expired",
                "updated_at": now_s,
            }
        ).eq("id", tslug).execute()
        return {
            "success": False,
            "error": "expired",
            "emit_ended": True,
            "trust_id": tslug,
            "tag_id": str(row.get("tag_id", "")),
            "requester_id": str(row.get("requester_id", "")),
            "target_id": str(row.get("target_id", "")),
        }

    now = _utcnow()
    now_s = _iso(now)

    if not accept:
        supabase.table("trust_sessions").update(
            {
                "status": "rejected",
                "responded_at": now_s,
                "ended_at": now_s,
                "end_reason": "rejected",
                "updated_at": now_s,
            }
        ).eq("id", tslug).execute()
        return {
            "success": True,
            "action": "rejected",
            "trust_id": tslug,
            "tag_id": str(row.get("tag_id", "")),
            "requester_id": str(row.get("requester_id", "")),
            "target_id": str(row.get("target_id", "")),
        }

    channel_name = f"trust_{uuid.uuid4().hex}"
    deadline = now + timedelta(seconds=TRUST_SESSION_MAX_SEC)
    deadline_s = _iso(deadline)

    supabase.table("trust_sessions").update(
        {
            "status": "accepted",
            "responded_at": now_s,
            "accepted_at": now_s,
            "channel_name": channel_name,
            "session_hard_deadline_at": deadline_s,
            "updated_at": now_s,
        }
    ).eq("id", tslug).execute()

    return {
        "success": True,
        "action": "accepted",
        "trust_id": tslug,
        "tag_id": str(row.get("tag_id", "")),
        "requester_id": str(row.get("requester_id", "")),
        "target_id": str(row.get("target_id", "")),
        "channel_name": channel_name,
        "session_hard_deadline_at": deadline_s,
    }


def end_trust_session(
    supabase,
    user_id: str,
    trust_id: str,
    reason: str = "user_ended",
) -> Dict[str, Any]:
    uid = _norm_uid(user_id)
    tid = str(trust_id).strip()
    res = supabase.table("trust_sessions").select("*").eq("id", tid).limit(1).execute()
    if not res.data:
        return {"success": False, "error": "not_found"}
    row = res.data[0]
    st = row.get("status")
    rid = _norm_uid(str(row.get("requester_id", "")))
    targ = _norm_uid(str(row.get("target_id", "")))
    if uid not in (rid, targ):
        return {"success": False, "error": "forbidden"}
    if st not in ("pending", "accepted"):
        return {"success": False, "error": "invalid_state"}

    now_s = _iso(_utcnow())
    if st == "pending":
        supabase.table("trust_sessions").update(
            {
                "status": "ended",
                "ended_at": now_s,
                "end_reason": "user_ended",
                "updated_at": now_s,
            }
        ).eq("id", tid).execute()
        final_reason = "user_ended"
    else:
        er = "auto_closed" if reason == "auto_closed" else "user_ended"
        supabase.table("trust_sessions").update(
            {
                "status": "ended",
                "ended_at": now_s,
                "end_reason": er,
                "updated_at": now_s,
            }
        ).eq("id", tid).execute()
        final_reason = er

    return {
        "success": True,
        "trust_id": tid,
        "tag_id": str(row.get("tag_id", "")),
        "requester_id": rid,
        "target_id": targ,
        "end_reason": final_reason,
    }


def get_active_trust(supabase, user_id: str, tag_id: Optional[str] = None) -> Dict[str, Any]:
    uid = _norm_uid(user_id)
    q1 = (
        supabase.table("trust_sessions")
        .select("*")
        .eq("requester_id", uid)
        .in_("status", ["pending", "accepted"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    q2 = (
        supabase.table("trust_sessions")
        .select("*")
        .eq("target_id", uid)
        .in_("status", ["pending", "accepted"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    merged = (q1.data or []) + (q2.data or [])
    seen = set()
    rows = []
    for r in merged:
        rid = str(r.get("id", ""))
        if not rid or rid in seen:
            continue
        seen.add(rid)
        rows.append(r)
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    if tag_id:
        tg = str(tag_id).strip().lower()
        rows = [r for r in rows if str(r.get("tag_id", "")).lower() == tg]
    if not rows:
        return {"success": True, "session": None}
    return {"success": True, "session": rows[0]}
