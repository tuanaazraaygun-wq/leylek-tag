"""Call Service - Backend Merkezli Arama Yönetimi
Supabase Realtime ile senkronize, WhatsApp/Facebook mantığında
"""

import time
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


def _sb():
    """Arama modülü de ana backend ile aynı service role client'ı kullanır (anon yok)."""
    from supabase_client import get_supabase, init_supabase

    client = get_supabase()
    if client is None:
        init_supabase()
        client = get_supabase()
    return client

# Agora credentials
AGORA_APP_ID = os.getenv("AGORA_APP_ID", "43c07f0cef814fd4a5ae3283c8bd77de")
AGORA_APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE", "a83c535b0d6f4fd2a6e96d34e7fcb9a6")

# ==================== AGORA TOKEN ====================

def generate_agora_token(channel_name: str, uid: int, expire_seconds: int = 3600) -> str:
    """Agora RTC token oluştur"""
    try:
        from agora_token_builder import RtcTokenBuilder
        privilege_expired_ts = int(time.time()) + expire_seconds
        token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID, AGORA_APP_CERTIFICATE,
            channel_name, uid, 1, privilege_expired_ts
        )
        return token
    except ImportError:
        logger.warning("agora_token_builder not found")
        return f"{AGORA_APP_ID}_{channel_name}_{uid}"
    except Exception as e:
        logger.error(f"Token error: {e}")
        return ""

# ==================== CALL LIFECYCLE ====================

async def start_call(
    caller_id: str,
    callee_id: str,
    call_type: str = "voice",
    tag_id: Optional[str] = None
) -> dict:
    """
    Arama başlat - calls tablosuna INSERT
    Supabase Realtime ile callee'ye anında bildirim gider
    """
    try:
        # Meşgul kontrolü - aktif arama var mı?
        active = _sb().table("calls").select("id").or_(
            f"caller_id.eq.{callee_id},callee_id.eq.{callee_id}"
        ).in_("status", ["ringing", "connected"]).execute()
        
        if active.data:
            return {"success": False, "error": "busy", "message": "Kullanıcı başka aramada"}
        
        # Channel ve UID oluştur
        channel_name = f"call_{int(time.time())}_{caller_id[:8]}"
        caller_uid = int(time.time()) % 100000 + 1
        callee_uid = caller_uid + 1
        
        # calls tablosuna INSERT - Realtime ile callee'ye gider
        call_data = {
            "caller_id": caller_id,
            "callee_id": callee_id,
            "tag_id": tag_id,
            "call_type": call_type,
            "channel_name": channel_name,
            "caller_uid": caller_uid,
            "callee_uid": callee_uid,
            "status": "ringing",  # ringing | connected | ended
            "started_at": datetime.utcnow().isoformat()
        }
        
        result = _sb().table("calls").insert(call_data).execute()
        call_id = result.data[0]["id"]
        
        # Caller için token
        token = generate_agora_token(channel_name, caller_uid)
        
        logger.info(f"📞 ARAMA BAŞLADI: {caller_id[:8]} -> {callee_id[:8]}")
        
        return {
            "success": True,
            "call_id": call_id,
            "channel_name": channel_name,
            "token": token,
            "uid": caller_uid,
            "app_id": AGORA_APP_ID
        }
    except Exception as e:
        logger.error(f"Start call error: {e}")
        return {"success": False, "error": str(e)}


async def answer_call(call_id: str, callee_id: str) -> dict:
    """
    Aramayı cevapla - status: ringing -> connected
    Supabase Realtime ile caller'a bildirim gider
    """
    try:
        # Call'ı bul
        call = _sb().table("calls").select("*").eq("id", call_id).eq("callee_id", callee_id).eq("status", "ringing").execute()
        
        if not call.data:
            return {"success": False, "error": "Arama bulunamadı"}
        
        call_data = call.data[0]
        
        # Status güncelle - Realtime ile caller'a gider
        _sb().table("calls").update({
            "status": "connected",
            "answered_at": datetime.utcnow().isoformat()
        }).eq("id", call_id).execute()
        
        # Callee için token
        token = generate_agora_token(call_data["channel_name"], call_data["callee_uid"])
        
        logger.info(f"📞 ARAMA CEVAPLANDI: {call_id}")
        
        return {
            "success": True,
            "channel_name": call_data["channel_name"],
            "token": token,
            "uid": call_data["callee_uid"],
            "app_id": AGORA_APP_ID
        }
    except Exception as e:
        logger.error(f"Answer call error: {e}")
        return {"success": False, "error": str(e)}


async def end_call(call_id: str, user_id: str, reason: str = "user_ended") -> dict:
    """
    Aramayı sonlandır - status: ended
    KİM KAPATIRSA KAPATSIN bu çağrılır
    Supabase Realtime ile diğer tarafa ANINDA bildirim gider
    Client bu event'i alınca:
      - Agora leaveChannel()
      - Agora destroy()
      - UI reset
    """
    try:
        # Call var mı ve bu user dahil mi?
        call = _sb().table("calls").select("*").eq("id", call_id).or_(
            f"caller_id.eq.{user_id},callee_id.eq.{user_id}"
        ).execute()
        
        if not call.data:
            return {"success": False, "error": "Arama bulunamadı"}
        
        # Zaten ended ise skip
        if call.data[0]["status"] == "ended":
            return {"success": True, "message": "Zaten sonlandırılmış"}
        
        # Status güncelle - Realtime ile diğer tarafa ANINDA gider
        _sb().table("calls").update({
            "status": "ended",
            "ended_at": datetime.utcnow().isoformat(),
            "ended_by": user_id,
            "end_reason": reason
        }).eq("id", call_id).execute()
        
        logger.info(f"📞 ARAMA SONLANDI: {call_id} | {reason}")
        
        return {"success": True}
    except Exception as e:
        logger.error(f"End call error: {e}")
        return {"success": False, "error": str(e)}


async def reject_call(call_id: str, user_id: str) -> dict:
    """Aramayı reddet"""
    return await end_call(call_id, user_id, "rejected")


async def get_incoming_call(user_id: str) -> dict:
    """Gelen aramayı kontrol et"""
    try:
        result = _sb().table("calls").select(
            "*, caller:users!calls_caller_id_fkey(name, profile_photo)"
        ).eq("callee_id", user_id).eq("status", "ringing").order(
            "created_at", desc=True
        ).limit(1).execute()
        
        if result.data:
            call = result.data[0]
            return {
                "success": True,
                "has_incoming": True,
                "call": {
                    "id": call["id"],
                    "caller_id": call["caller_id"],
                    "caller_name": call.get("caller", {}).get("name", "Arayan"),
                    "call_type": call["call_type"],
                    "channel_name": call["channel_name"]
                }
            }
        return {"success": True, "has_incoming": False, "call": None}
    except Exception as e:
        logger.error(f"Get incoming error: {e}")
        return {"success": False, "has_incoming": False}


async def cleanup_stale_calls():
    """60 saniyeden uzun ringing olanları ended yap"""
    try:
        stale = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
        _sb().table("calls").update({
            "status": "ended",
            "end_reason": "timeout",
            "ended_at": datetime.utcnow().isoformat()
        }).eq("status", "ringing").lt("started_at", stale).execute()
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
