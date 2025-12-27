"""
Call Service - Agora Arama Yönetimi
Backend merkezli arama lifecycle, Supabase Realtime ile senkronizasyon
"""

import os
import time
import hmac
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Optional
import logging
from supabase import create_client

logger = logging.getLogger(__name__)

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ujvploftywsxprlzejgc.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdnBsb2Z0eXdzeHBybHplamdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1NzExMTQsImV4cCI6MjA1MDE0NzExNH0.MM0zFnocqN4mpuqWVqxfLZJqDDC-2uaHa7TXCodDrCY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Agora credentials
AGORA_APP_ID = os.getenv("AGORA_APP_ID", "1d12c0c5a7d74b2fa80adbd04393b76a")
AGORA_APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE", "a83c535b0d6f4fd2a6e96d34e7fcb9a6")

# ==================== AGORA TOKEN GENERATION ====================

def generate_agora_token(channel_name: str, uid: int, role: int = 1, expire_seconds: int = 3600) -> str:
    """
    Agora RTC token oluştur
    role: 1 = publisher, 2 = subscriber
    """
    try:
        from agora_token_builder import RtcTokenBuilder
        
        current_timestamp = int(time.time())
        privilege_expired_ts = current_timestamp + expire_seconds
        
        token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channel_name,
            uid,
            role,
            privilege_expired_ts
        )
        return token
    except ImportError:
        # Fallback: basit token
        logger.warning("agora_token_builder not found, using simple token")
        return f"{AGORA_APP_ID}_{channel_name}_{uid}_{int(time.time())}"
    except Exception as e:
        logger.error(f"Token generation error: {e}")
        return ""

# ==================== CALL LIFECYCLE ====================

async def start_call(
    caller_id: str,
    callee_id: str,
    call_type: str = "voice",  # voice | video
    tag_id: Optional[str] = None
) -> dict:
    """
    Yeni arama başlat - Backend merkezli
    
    1. Callee'nin meşgul olup olmadığını kontrol et
    2. calls tablosuna kayıt ekle (status: ringing)
    3. Agora token'ları oluştur
    4. Supabase Realtime ile callee'ye bildirim gider
    
    Returns:
        {
            "success": bool,
            "call_id": str,
            "channel_name": str,
            "token": str,
            "uid": int,
            "error": str | None
        }
    """
    try:
        # 1. Callee meşgul mu kontrol et
        active_call = supabase.table("calls").select("id").or_(
            f"caller_id.eq.{callee_id},callee_id.eq.{callee_id}"
        ).in_("status", ["ringing", "connected"]).execute()
        
        if active_call.data:
            return {
                "success": False,
                "error": "Kullanıcı başka bir aramada",
                "busy": True
            }
        
        # 2. Channel name ve UID oluştur
        channel_name = f"call_{caller_id[:8]}_{callee_id[:8]}_{int(time.time())}"
        caller_uid = int(time.time()) % 100000 + 1
        callee_uid = caller_uid + 1
        
        # 3. Calls tablosuna kayıt ekle
        call_data = {
            "caller_id": caller_id,
            "callee_id": callee_id,
            "tag_id": tag_id,
            "call_type": call_type,
            "channel_name": channel_name,
            "caller_uid": caller_uid,
            "callee_uid": callee_uid,
            "status": "ringing",
            "started_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("calls").insert(call_data).execute()
        call_id = result.data[0]["id"]
        
        # 4. Agora token oluştur (caller için)
        token = generate_agora_token(channel_name, caller_uid)
        
        logger.info(f"📞 Arama başlatıldı: {caller_id[:8]} -> {callee_id[:8]} | {call_id}")
        
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
    
    Returns:
        {
            "success": bool,
            "channel_name": str,
            "token": str,
            "uid": int
        }
    """
    try:
        # Call bilgisini al
        call_result = supabase.table("calls").select("*").eq("id", call_id).eq("callee_id", callee_id).eq("status", "ringing").execute()
        
        if not call_result.data:
            return {"success": False, "error": "Arama bulunamadı veya zaten cevaplandı"}
        
        call = call_result.data[0]
        
        # Status güncelle
        supabase.table("calls").update({
            "status": "connected",
            "answered_at": datetime.utcnow().isoformat()
        }).eq("id", call_id).execute()
        
        # Callee için token oluştur
        token = generate_agora_token(call["channel_name"], call["callee_uid"])
        
        logger.info(f"📞 Arama cevaplandı: {call_id}")
        
        return {
            "success": True,
            "channel_name": call["channel_name"],
            "token": token,
            "uid": call["callee_uid"],
            "app_id": AGORA_APP_ID
        }
        
    except Exception as e:
        logger.error(f"Answer call error: {e}")
        return {"success": False, "error": str(e)}


async def end_call(call_id: str, user_id: str, reason: str = "user_ended") -> dict:
    """
    Aramayı sonlandır - status: ended
    
    Bu fonksiyon çağrıldığında:
    1. calls tablosunda status = 'ended' olur
    2. Supabase Realtime ile diğer tarafa bildirim gider
    3. Frontend bu event'i alınca Agora cleanup yapar
    
    Args:
        call_id: Arama ID
        user_id: Kapatan kullanıcı
        reason: user_ended | timeout | missed | error
    """
    try:
        # Call var mı ve bu kullanıcı dahil mi kontrol et
        call_result = supabase.table("calls").select("*").eq("id", call_id).or_(
            f"caller_id.eq.{user_id},callee_id.eq.{user_id}"
        ).execute()
        
        if not call_result.data:
            return {"success": False, "error": "Arama bulunamadı"}
        
        call = call_result.data[0]
        
        # Zaten ended ise bir şey yapma
        if call["status"] == "ended":
            return {"success": True, "message": "Arama zaten sonlandırılmış"}
        
        # Status güncelle
        supabase.table("calls").update({
            "status": "ended",
            "ended_at": datetime.utcnow().isoformat(),
            "ended_by": user_id,
            "end_reason": reason
        }).eq("id", call_id).execute()
        
        logger.info(f"📞 Arama sonlandırıldı: {call_id} | {reason}")
        
        return {"success": True, "call_id": call_id}
        
    except Exception as e:
        logger.error(f"End call error: {e}")
        return {"success": False, "error": str(e)}


async def get_incoming_call(user_id: str) -> dict:
    """
    Kullanıcıya gelen aktif aramayı getir
    """
    try:
        result = supabase.table("calls").select(
            "*, caller:users!calls_caller_id_fkey(name, profile_photo)"
        ).eq("callee_id", user_id).eq("status", "ringing").order(
            "created_at", desc=True
        ).limit(1).execute()
        
        if result.data:
            call = result.data[0]
            return {
                "success": True,
                "call": {
                    "id": call["id"],
                    "caller_id": call["caller_id"],
                    "caller_name": call.get("caller", {}).get("name", "Bilinmeyen"),
                    "caller_photo": call.get("caller", {}).get("profile_photo"),
                    "call_type": call["call_type"],
                    "channel_name": call["channel_name"]
                }
            }
        
        return {"success": True, "call": None}
        
    except Exception as e:
        logger.error(f"Get incoming call error: {e}")
        return {"success": False, "call": None}


async def get_active_call(user_id: str) -> dict:
    """
    Kullanıcının aktif aramasını getir
    """
    try:
        result = supabase.table("calls").select("*").or_(
            f"caller_id.eq.{user_id},callee_id.eq.{user_id}"
        ).in_("status", ["ringing", "connected"]).order(
            "created_at", desc=True
        ).limit(1).execute()
        
        if result.data:
            return {"success": True, "call": result.data[0]}
        
        return {"success": True, "call": None}
        
    except Exception as e:
        logger.error(f"Get active call error: {e}")
        return {"success": False, "call": None}


async def cleanup_stale_calls():
    """
    30 saniyeden uzun süredir ringing olan aramaları temizle
    """
    try:
        stale_time = (datetime.utcnow() - timedelta(seconds=30)).isoformat()
        
        supabase.table("calls").update({
            "status": "ended",
            "end_reason": "timeout",
            "ended_at": datetime.utcnow().isoformat()
        }).eq("status", "ringing").lt("started_at", stale_time).execute()
        
    except Exception as e:
        logger.error(f"Cleanup stale calls error: {e}")
