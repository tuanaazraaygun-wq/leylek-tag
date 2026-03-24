"""
Leylek TAG - Supabase Backend
Full PostgreSQL Backend with Supabase + Socket.IO
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import logging
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
import secrets
import base64
import hashlib
import httpx
import json
import time
import asyncio

# Socket.IO
import socketio

# Supabase — tek service role client: backend/supabase_client.py
from supabase import Client
import supabase_client as _supabase_core

# Agora Token Builder
from agora_token_builder import RtcTokenBuilder

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

# ==================== SOCKET.IO SERVER ====================
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
)

# Aktif kullanıcılar: {user_id: socket_id}
connected_users = {}

@sio.event
async def connect(sid, environ):
    print("🔥 SOCKET CLIENT CONNECTED:", sid)
    logger.info(f"🔌 Socket bağlandı: {sid}")
    logger.info(f"🔌 Toplam bağlı: {len(connected_users) + 1}")

@sio.event
async def disconnect(sid):
    print("❌ SOCKET CLIENT DISCONNECTED:", sid)
    # Aynı sid'e kayıtlı tüm key'leri kaldır (orijinal + normalized user_id)
    to_remove = [uid for uid, s in connected_users.items() if s == sid]
    for uid in to_remove:
        del connected_users[uid]
    if to_remove:
        logger.info(f"🔌 Socket ayrıldı: {sid} (user: {to_remove})")
    else:
        logger.info(f"🔌 Socket ayrıldı: {sid}")

def _normalize_user_room(user_id: str) -> str:
    """UUID/user_id için tutarlı room adı (büyük/küçük harf uyumsuzluğunu önler)."""
    if not user_id:
        return ""
    return f"user_{str(user_id).strip().lower()}"


@sio.event
async def register(sid, data):
    """Kullanıcı kaydı - user_id ile socket_id eşleştir VE ROOM'A JOIN ET"""
    user_id = data.get('user_id')
    if user_id:
        connected_users[user_id] = sid
        # Aynı kullanıcı normalized id ile de bulunabilsin (emit'te kullanılıyor)
        connected_users[str(user_id).strip().lower()] = sid
        
        # 🔥 KRİTİK: Kullanıcıyı kendi room'una join et (normalized = her zaman aynı room)
        room_name = _normalize_user_room(user_id)
        await sio.enter_room(sid, room_name)
        
        logger.info(f"📱 Kullanıcı kayıtlı: {user_id} -> {sid} (room: {room_name})")
        await sio.emit('registered', {'success': True, 'user_id': user_id, 'room': room_name}, room=sid)

@sio.event
async def call_user(sid, data):
    """Arama başlat - karşı tarafa bildir"""
    caller_id = data.get('caller_id')
    receiver_id = data.get('receiver_id')
    call_id = data.get('call_id')
    channel_name = data.get('channel_name')
    agora_token = data.get('agora_token')
    call_type = data.get('call_type', 'audio')
    caller_name = data.get('caller_name', 'Bilinmeyen')
    
    logger.info(f"📞 Arama isteği: {caller_id} -> {receiver_id} (call_id: {call_id})")
    logger.info(f"📱 Bağlı kullanıcılar: {list(connected_users.keys())}")
    
    # Karşı tarafın socket_id'sini bul
    receiver_sid = connected_users.get(receiver_id)
    
    if receiver_sid:
        # Karşı tarafa gelen arama bildirimi gönder
        await sio.emit('incoming_call', {
            'call_id': call_id,
            'caller_id': caller_id,
            'caller_name': caller_name,
            'channel_name': channel_name,
            'agora_token': agora_token,
            'call_type': call_type
        }, room=receiver_sid)
        logger.info(f"📲 Gelen arama bildirimi gönderildi: {receiver_id} (sid: {receiver_sid})")
        await sio.emit('call_ringing', {'success': True, 'receiver_online': True}, room=sid)
    else:
        logger.warning(f"⚠️ Alıcı çevrimdışı veya kayıtlı değil: {receiver_id}")
        logger.warning(f"⚠️ Kayıtlı kullanıcılar: {connected_users}")
        try:
            asyncio.create_task(send_push_notification(
                receiver_id,
                f"📞 {caller_name}",
                "Size gelen bir arama var.",
                {
                    "type": "incoming_call",
                    "call_id": call_id,
                    "caller_id": caller_id,
                    "caller_name": caller_name,
                    "channel_name": channel_name,
                    "agora_token": agora_token,
                    "call_type": call_type,
                }
            ))
        except Exception as push_err:
            logger.warning(f"⚠️ Offline arama push gönderilemedi: {push_err}")
        await sio.emit('call_ringing', {'success': False, 'receiver_online': False, 'reason': 'user_offline'}, room=sid)

@sio.event
async def accept_call(sid, data):
    """Aramayı kabul et"""
    call_id = data.get('call_id')
    caller_id = data.get('caller_id')
    receiver_id = data.get('receiver_id')
    
    logger.info(f"✅ Arama kabul edildi: {call_id}")
    
    # Arayana bildir
    caller_sid = connected_users.get(caller_id)
    if caller_sid:
        await sio.emit('call_accepted', {
            'call_id': call_id,
            'accepted_by': receiver_id
        }, room=caller_sid)

@sio.event
async def reject_call(sid, data):
    """Aramayı reddet"""
    call_id = data.get('call_id')
    caller_id = data.get('caller_id')
    receiver_id = data.get('receiver_id')
    
    logger.info(f"❌ Arama reddedildi: {call_id}")
    
    # Arayana bildir
    caller_sid = connected_users.get(caller_id)
    if caller_sid:
        await sio.emit('call_rejected', {
            'call_id': call_id,
            'rejected_by': receiver_id
        }, room=caller_sid)

@sio.event
async def end_call(sid, data):
    """Aramayı sonlandır"""
    call_id = data.get('call_id')
    caller_id = data.get('caller_id')
    receiver_id = data.get('receiver_id')
    ended_by = data.get('ended_by')
    
    logger.info(f"📴 Arama sonlandırıldı: {call_id} (by: {ended_by})")
    
    # Her iki tarafa da bildir
    for user_id in [caller_id, receiver_id]:
        if user_id and user_id != ended_by:
            user_sid = connected_users.get(user_id)
            if user_sid:
                await sio.emit('call_ended', {
                    'call_id': call_id,
                    'ended_by': ended_by
                }, room=user_sid)

# ==================== PUAN SİSTEMİ ====================
# 100 puan = 5 yıldız
# Her kullanıcı 100 puanla başlar
# Tek taraflı bitirme = -3 puan

def points_to_rating(points: int) -> float:
    """Puanı yıldıza çevir (100 puan = 5 yıldız)"""
    if points >= 100:
        return 5.0
    elif points <= 0:
        return 1.0
    else:
        # 0-100 arası = 1-5 yıldız
        return 1.0 + (points / 100) * 4.0

async def deduct_points(user_id: str, points: int, reason: str):
    """Kullanıcıdan puan düş"""
    try:
        # Mevcut puanı al
        result = supabase.table("users").select("points, rating").eq("id", user_id).execute()
        if result.data:
            current_points = result.data[0].get("points", 100)
            new_points = max(0, current_points - points)
            new_rating = points_to_rating(new_points)
            
            # Güncelle
            supabase.table("users").update({
                "points": new_points,
                "rating": new_rating,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()
            
            logger.info(f"📉 Puan düşürüldü: {user_id} -{points} puan ({reason}). Yeni: {new_points} puan, {new_rating:.1f} yıldız")
            return new_points, new_rating
    except Exception as e:
        logger.error(f"Puan düşürme hatası: {e}")
    return None, None

# ==================== TRIP END SOCKET EVENTS ====================

@sio.event
async def force_end_trip(sid, data):
    """Yolculuğu ANINDA bitir - İki tarafa da bildir, bitiren -3 puan alır"""
    tag_id = data.get('tag_id')
    ender_id = data.get('ender_id')
    ender_type = data.get('ender_type')  # 'passenger' veya 'driver'
    passenger_id = data.get('passenger_id')
    driver_id = data.get('driver_id')
    
    logger.info(f"🔚 FORCE END TRIP: {tag_id} by {ender_id} ({ender_type})")
    
    try:
        # Trip'i tamamla
        supabase.table("tags").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
            "ended_by": ender_id,
            "end_type": "force"
        }).eq("id", tag_id).execute()
        
        # Bitiren kişiden -3 puan düş
        new_points, new_rating = await deduct_points(ender_id, 3, "Tek taraflı yolculuk bitirme")
        
        # Karşı tarafa PUSH bildirim gönder
        other_user_id = driver_id if ender_type == 'passenger' else passenger_id
        ender_role = "Yolcu" if ender_type == 'passenger' else "Sürücü"
        
        if other_user_id:
            asyncio.create_task(send_push_notification(
                other_user_id,
                "⚠️ Yolculuk Sonlandırıldı!",
                f"{ender_role} yolculuğu tek taraflı sonlandırdı. Şikayet etmek için tıklayın.",
                {"type": "force_ended", "tag_id": tag_id, "ender_type": ender_type, "can_report": True}
            ))
        
        # Her iki tarafa da ANINDA bildir (Socket)
        for user_id in [passenger_id, driver_id]:
            if user_id:
                user_sid = connected_users.get(user_id)
                if user_sid:
                    await sio.emit('trip_force_ended', {
                        'tag_id': tag_id,
                        'ended_by': ender_id,
                        'ender_type': ender_type,
                        'completed_at': datetime.utcnow().isoformat(),
                        'points_deducted': 3 if user_id == ender_id else 0,
                        'new_points': new_points if user_id == ender_id else None,
                        'new_rating': new_rating if user_id == ender_id else None
                    }, room=user_sid)
        
        # İsteği gönderene onay
        await sio.emit('trip_end_confirmed', {
            'success': True,
            'tag_id': tag_id,
            'points_deducted': 3,
            'new_points': new_points,
            'new_rating': new_rating
        }, room=sid)
        
        logger.info(f"✅ Trip force ended: {tag_id}, {ender_type} lost 3 points")
        
    except Exception as e:
        logger.error(f"Force end trip error: {e}")
        await sio.emit('trip_end_confirmed', {'success': False, 'error': str(e)}, room=sid)

@sio.event
async def request_trip_end_socket(sid, data):
    """Socket üzerinden trip sonlandırma isteği - ANINDA bildirim"""
    tag_id = data.get('tag_id')
    requester_id = data.get('requester_id')
    requester_type = data.get('requester_type')  # 'passenger' veya 'driver'
    target_user_id = data.get('target_user_id')  # Karşı tarafın ID'si
    
    logger.info(f"🔚 Socket trip end request: {tag_id} by {requester_id} ({requester_type})")
    
    # Supabase'e kaydet
    try:
        supabase.table("tags").update({
            "end_request": {
                "requester_id": requester_id,
                "user_type": requester_type,
                "requested_at": datetime.utcnow().isoformat(),
                "status": "pending"
            }
        }).eq("id", tag_id).execute()
    except Exception as e:
        logger.error(f"Trip end request save error: {e}")
    
    # Karşı tarafa ANINDA bildirim gönder
    target_sid = connected_users.get(target_user_id)
    if target_sid:
        await sio.emit('trip_end_request', {
            'tag_id': tag_id,
            'requester_id': requester_id,
            'requester_type': requester_type
        }, room=target_sid)
        logger.info(f"📲 Trip end request sent to: {target_user_id}")
        await sio.emit('trip_end_request_sent', {'success': True}, room=sid)
    else:
        logger.warning(f"⚠️ Target user offline: {target_user_id}")
        await sio.emit('trip_end_request_sent', {'success': True, 'target_offline': True}, room=sid)

@sio.event
async def respond_trip_end_socket(sid, data):
    """Socket üzerinden trip sonlandırma isteğine cevap - ANINDA"""
    tag_id = data.get('tag_id')
    responder_id = data.get('responder_id')
    approved = data.get('approved', True)
    requester_id = data.get('requester_id')  # İsteği yapan kişi
    
    logger.info(f"🔚 Socket trip end response: {tag_id} approved={approved}")
    
    try:
        if approved:
            # Trip'i tamamla
            supabase.table("tags").update({
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "end_request": None,
                "end_type": "mutual"
            }).eq("id", tag_id).execute()
            
            # Her iki tarafa da bildir
            for user_id in [responder_id, requester_id]:
                user_sid = connected_users.get(user_id)
                if user_sid:
                    await sio.emit('trip_completed', {
                        'tag_id': tag_id,
                        'completed_at': datetime.utcnow().isoformat(),
                        'mutual': True
                    }, room=user_sid)
            
            logger.info(f"✅ Trip completed via socket (mutual): {tag_id}")
        else:
            # İsteği reddet
            result = supabase.table("tags").select("end_request").eq("id", tag_id).execute()
            if result.data and result.data[0].get("end_request"):
                end_request = result.data[0]["end_request"]
                end_request["status"] = "rejected"
                supabase.table("tags").update({"end_request": end_request}).eq("id", tag_id).execute()
            
            # İsteği yapana reddi bildir
            requester_sid = connected_users.get(requester_id)
            if requester_sid:
                await sio.emit('trip_end_rejected', {
                    'tag_id': tag_id,
                    'rejected_by': responder_id
                }, room=requester_sid)
            
            logger.info(f"❌ Trip end rejected: {tag_id}")
    except Exception as e:
        logger.error(f"Trip end response error: {e}")


# Agora Token Builder - import sonra yap
AGORA_TOKEN_AVAILABLE = False
RtcTokenBuilder = None
try:
    from agora_token_builder import RtcTokenBuilder as _RtcTokenBuilder
    RtcTokenBuilder = _RtcTokenBuilder
    AGORA_TOKEN_AVAILABLE = True
    logger.info("✅ Agora token builder yüklendi")
except ImportError as e:
    logger.warning(f"⚠️ agora_token_builder yüklenemedi: {e}")

# ==================== DAILY.CO CONFIG ====================
DAILY_API_KEY = os.getenv("DAILY_API_KEY", "")
DAILY_API_URL = "https://api.daily.co/v1"
logger.info("✅ Daily.co API yapılandırıldı")

# ==================== SÜRÜCÜ AÇILIŞ PAKETLERİ ====================
# DRIVER_UNLIMITED_FREE_PERIOD=True: Paket zorunluluğu yok; onaylı tüm sürücüler ücretsiz kullanır.
# False yapıldığında: driver_active_until ile paket süresi ve aşağıdaki DRIVER_PACKAGES devreye girer.
DRIVER_UNLIMITED_FREE_PERIOD = True
DRIVER_PACKAGES = {
    "24_hours": {"hours": 24, "price_tl": 400, "name": "Günlük Paket"},
}
logger.info(
    "✅ Sürücü paketleri: %s",
    "şu an sınırsız ücretsiz dönem" if DRIVER_UNLIMITED_FREE_PERIOD else "paket süresi + günlük paket",
)


def _apply_driver_active_until_filter(query, now_iso: str):
    """Ücretsiz dönemde driver_active_until > now filtresi uygulanmaz (online yeterli)."""
    if DRIVER_UNLIMITED_FREE_PERIOD:
        return query
    return query.gt("driver_active_until", now_iso)


def _has_active_package_for_dispatch(driver_active_until, now_iso: str) -> bool:
    """Debug / admin için: ücretsiz dönemde her zaman True sayılır."""
    if DRIVER_UNLIMITED_FREE_PERIOD:
        return True
    return bool(driver_active_until and driver_active_until > now_iso)


def _canonical_vehicle_kind(value) -> Optional[str]:
    """
    Supabase users.driver_details içi değerler: 'car' | 'motorcycle' kabul edilir.
    'motor' takma adı motorcycle sayılır. Tanınmayan/boş -> None (yolcu tercihi yoksa filtre yok).
    """
    if value is None or value == "":
        return None
    s = str(value).strip().lower()
    if s == "car":
        return "car"
    if s in ("motorcycle", "motor"):
        return "motorcycle"
    return None


def _driver_details_as_dict(user_row: dict) -> dict:
    """users.driver_details: JSONB dict veya nadiren JSON string -> dict."""
    dd = user_row.get("driver_details")
    if isinstance(dd, dict):
        return dd
    if isinstance(dd, str) and dd.strip():
        try:
            import json
            parsed = json.loads(dd)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


def _driver_vehicle_kind_from_row(user_row: dict) -> Optional[str]:
    """Sürücü tipi: users.driver_details->>'vehicle_kind' (canonical car|motorcycle veya None)."""
    dd = _driver_details_as_dict(user_row)
    return _canonical_vehicle_kind(dd.get("vehicle_kind"))


def _passenger_preferred_vehicle_from_row(user_row: dict) -> Optional[str]:
    """Yolcu tercihi: users.driver_details->>'passenger_preferred_vehicle'."""
    dd = _driver_details_as_dict(user_row)
    return _canonical_vehicle_kind(dd.get("passenger_preferred_vehicle"))


def _effective_driver_vehicle_kind(driver_row: dict) -> Optional[str]:
    """
    Sürücü kayıtlı tipi; yoksa eski hesaplar için 'car' (motor özelliği öncesi tüm sürücüler araç sayılır).
    Motor talebinde yalnızca motorcycle kayıtlı sürücüler kalır.
    """
    dv = _driver_vehicle_kind_from_row(driver_row)
    if dv is not None:
        return dv
    return "car"


def _driver_matches_passenger_vehicle_pref(driver_eff: str, passenger_pref: str) -> bool:
    """
    Katı eşleşme: yolcu car → yalnızca car sürücü; yolcu motorcycle → yalnızca motorcycle sürücü.
    (Sürücüde vehicle_kind yoksa _effective_driver_vehicle_kind -> car.)
    """
    pp = _canonical_vehicle_kind(passenger_pref) or "car"
    de = _canonical_vehicle_kind(driver_eff) or "car"
    return pp == de


def _trip_passenger_vehicle_pref(
    tag_row: dict, passenger_join_row: Optional[dict] = None
) -> str:
    """
    Tek sefer tercihi: tags.passenger_preferred_vehicle (tercih), yoksa join/users satırındaki profil.
    """
    pref = _canonical_vehicle_kind(tag_row.get("passenger_preferred_vehicle"))
    if pref is not None:
        return pref
    if passenger_join_row:
        p2 = _passenger_preferred_vehicle_from_row(passenger_join_row)
        if p2 is not None:
            return p2
    return "car"


# ==================== DISPATCH QUEUE CONFIG ====================
DISPATCH_CONFIG = {
    "matching_radius_km": 20,        # Sürücü arama yarıçapı (km) - 20 km
    "max_driver_dispatch": 10,       # Maksimum kaç sürücüye teklif gönderilsin
    "driver_offer_timeout": 10,      # Sürücü yanıt süresi (saniye) - 10 sn
    "enabled": True,                 # Dispatch queue aktif mi
}

# Yolcu teklifi broadcast: aynı anda en yakın N sürücü; hepsi 20 sn içinde kabul edebilir (ilk kabul kazanır)
BROADCAST_MAX_RECIPIENTS = 5
BROADCAST_RADIUS_KM = 20
BROADCAST_ACCEPT_WINDOW_SECONDS = 20

# Sürücü Aktiflik Kuralları
DRIVER_ACTIVATION_CONFIG = {
    "min_active_hours": 3,           # Minimum aktif kalma süresi (saat)
}

# Aktif dispatch task'ları (tag_id -> asyncio.Task)
active_dispatch_tasks: dict = {}

# Dispatch Queue In-Memory State (Supabase'e de yazılacak)
dispatch_queues: dict = {}  # tag_id -> list of driver entries

# Sıralı dispatch: tag bazında tam teklif bağlamı (DB tag satırında olmayan alanlar)
dispatch_tag_context: dict = {}


def clear_dispatch_in_memory_state():
    """
    Bellekteki sürücü/dispatch listeleri: kuyruk, tag bağlamı, timeout task'ları.
    Process restart zaten sıfırlar; startup'ta da çağrılır (deploy sonrası kalıntı olmaması için).
    """
    global dispatch_queues, dispatch_tag_context, active_dispatch_tasks
    global rolling_dispatch_tasks, rolling_dispatch_index
    for _key, task in list(active_dispatch_tasks.items()):
        try:
            if task is not None and not task.done():
                task.cancel()
        except Exception:
            pass
    active_dispatch_tasks.clear()
    dispatch_queues.clear()
    dispatch_tag_context.clear()
    for _tid, task in list(rolling_dispatch_tasks.items()):
        try:
            if task is not None and not task.done():
                task.cancel()
        except Exception:
            pass
    rolling_dispatch_tasks.clear()
    rolling_dispatch_index.clear()
    logger.info("🧹 Dispatch bellek durumu temizlendi (queues, tag_context, active_dispatch_tasks, rolling_dispatch)")


# Sıralı eşleşme yarıçapı — şimdilik sabit 20 km (config override edilmez)
SEQUENTIAL_DISPATCH_RADIUS_KM = 20

# Araç tipi eşleşmesi her zaman açık: yolcu car → yalnız car sürücü; yolcu motorcycle → yalnız motorcycle.
# Eski DISPATCH_VEHICLE_FILTER_DISABLED prod'da yanlışlıkla açılınca motor talepleri araç sürücüsüne gidiyordu; artık yok sayılır.
if os.getenv("DISPATCH_VEHICLE_FILTER_DISABLED", "").strip().lower() in ("1", "true", "yes", "on"):
    logger.warning(
        "DISPATCH_VEHICLE_FILTER_DISABLED ortamda ayarlı; artık kullanılmıyor — araç tipi eşleşmesi zorunlu."
    )

# Rolling batch dispatch (yalnızca bellek; DB dispatch_queue / Supabase kuyruk yok)
BATCH_SIZE = 5
DISPATCH_TIMEOUT = 20
DISPATCH_RADIUS_KM = 20

# tag_id -> asyncio.Task (20s zamanlayıcı)
rolling_dispatch_tasks: dict = {}
# tag_id -> {"cursor": int, "drivers": list, "full_tag": dict, "current_batch": list[str]}
rolling_dispatch_index: dict = {}

# dispatch_queue tablosu (sql_migrations/schema_updates.sql) — bilinmeyen kolonla insert tüm kaydı düşürürdü
DISPATCH_QUEUE_DB_KEYS = frozenset(
    {
        "id",
        "tag_id",
        "driver_id",
        "priority",
        "status",
        "created_at",
        "sent_at",
        "responded_at",
    }
)

# ==================== PROMOSYON KODU SİSTEMİ ====================
import random
import string

def generate_promo_code(length: int = 8) -> str:
    """Rastgele promosyon kodu üret"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

async def get_dispatch_config() -> dict:
    """Config tablosundan dispatch ayarlarını oku, yoksa default kullan"""
    try:
        result = supabase.table("config").select("*").eq("key", "dispatch_config").execute()
        if result.data:
            import json
            return json.loads(result.data[0].get("value", "{}"))
    except:
        pass
    return DISPATCH_CONFIG

async def find_eligible_drivers(
    pickup_lat: float,
    pickup_lng: float,
    exclude_ids: list = None,
    passenger_vehicle_kind: Optional[str] = None,
    radius_km: Optional[float] = None,
) -> list:
    """
    Uygun sürücüleri bul ve öncelik sırasına göre sırala
    Kriterler: online, aktif paket, mesafe içinde
    Araç talebi (car) / motorcycle katı eşleşmesi; sürücüde vehicle_kind yoksa eff=car.
    Sıralama: mesafe (yakın), rating (yüksek)
    """
    try:
        r_km = float(radius_km) if radius_km is not None else float(SEQUENTIAL_DISPATCH_RADIUS_KM)
        pref = _canonical_vehicle_kind(passenger_vehicle_kind) or "car"
        
        # Online ve aktif paketi olan sürücüleri getir
        now = datetime.utcnow().isoformat()
        query = supabase.table("users").select(
            "id, name, rating, latitude, longitude, driver_active_until, driver_online, driver_details"
        ).eq("driver_online", True)
        query = _apply_driver_active_until_filter(query, now)
        
        result = query.execute()
        
        if not result.data:
            return []
        
        eligible_drivers = []
        exclude_set = {str(x).strip().lower() for x in (exclude_ids or []) if x is not None}
        
        for driver in result.data:
            # Exclude listesinde mi? (UUID string karşılaştırması)
            if str(driver["id"]).strip().lower() in exclude_set:
                continue
            
            # Konum var mı?
            if not driver.get("latitude") or not driver.get("longitude"):
                continue

            eff = _driver_vehicle_kind_from_row(driver)
            if eff is None:
                eff = "car"
            if not _driver_matches_passenger_vehicle_pref(eff, pref):
                continue
            
            # Mesafe hesapla
            from math import radians, sin, cos, sqrt, atan2
            R = 6371  # Dünya yarıçapı (km)
            
            lat1, lon1 = radians(pickup_lat), radians(pickup_lng)
            lat2, lon2 = radians(driver["latitude"]), radians(driver["longitude"])
            
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance_km = R * c
            
            # Yarıçap içinde mi?
            if distance_km <= r_km:
                eligible_drivers.append({
                    "driver_id": str(driver["id"]).strip().lower(),
                    "driver_name": driver.get("name", "Sürücü"),
                    "distance_km": round(distance_km, 2),
                    "rating": driver.get("rating", 5.0) or 5.0,
                })
        
        # Sırala: önce mesafe (yakın), sonra rating (yüksek)
        eligible_drivers.sort(key=lambda x: (x["distance_km"], -x["rating"]))
        
        logger.info(f"🔍 Dispatch: {len(eligible_drivers)} uygun sürücü (yolcu tercihi={pref})")
        return eligible_drivers
        
    except Exception as e:
        logger.error(f"❌ Find eligible drivers error: {e}")
        return []

async def create_dispatch_queue(tag_id: str, tag_data: dict) -> bool:
    """
    Tag için dispatch queue oluştur
    Uygun sürücüleri bul, sırala ve queue'ya ekle
    """
    try:
        config = await get_dispatch_config()
        max_drivers = config.get("max_driver_dispatch", 5)
        
        pref = _canonical_vehicle_kind(tag_data.get("passenger_preferred_vehicle"))
        if pref is None and tag_data.get("passenger_id"):
            try:
                pr = (
                    supabase.table("users")
                    .select("driver_details")
                    .eq("id", tag_data["passenger_id"])
                    .limit(1)
                    .execute()
                )
                if pr.data:
                    pref = _passenger_preferred_vehicle_from_row(pr.data[0])
            except Exception as ex:
                logger.warning(f"Yolcu araç tercihi okunamadı: {ex}")
        pref = pref or "car"
        
        # Yolcunun kendisi sürücü listesine girmesin (aynı hesap / test)
        excl = []
        if tag_data.get("passenger_id"):
            excl.append(tag_data["passenger_id"])
        
        # Uygun sürücüleri bul
        drivers = await find_eligible_drivers(
            tag_data.get("pickup_lat", 0),
            tag_data.get("pickup_lng", 0),
            exclude_ids=excl,
            passenger_vehicle_kind=pref,
        )
        
        if not drivers:
            logger.warning(f"⚠️ Dispatch: Tag {tag_id} için uygun sürücü bulunamadı")
            return False
        
        # En iyi N sürücüyü seç
        selected_drivers = drivers[:max_drivers]
        
        # Queue'ya ekle
        queue_entries = []
        for idx, driver in enumerate(selected_drivers):
            entry = {
                "id": str(uuid.uuid4()),
                "tag_id": tag_id,
                "driver_id": driver["driver_id"],
                "driver_name": driver["driver_name"],
                "priority": idx + 1,
                "distance_km": driver["distance_km"],
                "status": "waiting",
                "created_at": datetime.utcnow().isoformat(),
                "sent_at": None,
                "responded_at": None,
            }
            queue_entries.append(entry)
        
        # Supabase'e kaydet — yalnızca tabloda gerçekten olan kolonlar (şemada driver_name/distance_km yok;
        # eski kod bilinmeyen kolonlarla insert atınca tüm kayıt düşer; socket çoklu worker'da kaçarsa polling de kurtarmazdı.)
        try:
            for entry in queue_entries:
                db_row = {k: entry[k] for k in DISPATCH_QUEUE_DB_KEYS if k in entry}
                supabase.table("dispatch_queue").insert(db_row).execute()
        except Exception as db_err:
            logger.error(
                f"Dispatch queue DB kayıt hatası — teklif socket ile gidebilir ama "
                f"dispatch-pending-offer (polling) çalışmaz; tablo/FK kontrol edin: {db_err}"
            )
        
        # In-memory'de tut
        dispatch_queues[tag_id] = queue_entries
        
        logger.info(f"✅ Dispatch queue oluşturuldu: tag={tag_id}, {len(queue_entries)} sürücü")
        return True
        
    except Exception as e:
        logger.error(f"❌ Create dispatch queue error: {e}")
        return False


async def emit_new_passenger_offer_to_driver(driver_id, offer_data: dict) -> None:
    """
    Teklif socket event'i: önce doğrudan sid (connected_users), yoksa user room.
    UUID büyük/küçük harf ve register anahtarı uyumsuzluğunu azaltır.
    """
    try:
        raw = str(driver_id).strip().lower() if driver_id is not None else ""
        if not raw:
            logger.warning("emit_new_passenger_offer_to_driver: boş driver_id")
            return
        try:
            resolved = await resolve_user_id(raw)
            if resolved:
                raw = str(resolved).strip().lower()
        except Exception:
            pass
        room = _normalize_user_room(raw)
        sid = connected_users.get(raw) or connected_users.get(str(driver_id).strip())
        if sid:
            await sio.emit("new_passenger_offer", offer_data, to=sid)
            logger.info(
                f"📤 new_passenger_offer to=sid driver={raw[:13]}… tag={offer_data.get('tag_id')}"
            )
        else:
            await sio.emit("new_passenger_offer", offer_data, room=room)
            logger.warning(
                f"📤 new_passenger_offer room-only (bu sürücü socket register yok?) "
                f"driver={raw[:13]}… room={room} tag={offer_data.get('tag_id')}"
            )
    except Exception as e:
        logger.error(f"new_passenger_offer emit hatası: {e}")


async def emit_passenger_offer_revoked(driver_id: str, tag_id: str):
    """Önceki sürücü teklifi artık göremesin (sıralı dispatch)."""
    try:
        raw = str(driver_id).strip().lower() if driver_id else ""
        sid = connected_users.get(raw) or connected_users.get(str(driver_id).strip()) if driver_id else None
        payload = {"tag_id": tag_id}
        if sid:
            await sio.emit("passenger_offer_revoked", payload, to=sid)
        else:
            await sio.emit("passenger_offer_revoked", payload, room=_normalize_user_room(raw or str(driver_id)))
    except Exception as e:
        logger.warning(f"passenger_offer_revoked emit hatası: {e}")


async def emit_socket_event_to_user(user_id, event_name: str, payload: dict) -> None:
    """Tek kullanıcıya socket event: önce connected_users sid, yoksa user_<uuid> room."""
    try:
        if user_id is None:
            return
        raw = str(user_id).strip().lower()
        if not raw:
            return
        try:
            resolved = await resolve_user_id(raw)
            if resolved:
                raw = str(resolved).strip().lower()
        except Exception:
            pass
        room = _normalize_user_room(raw)
        sid = connected_users.get(raw) or connected_users.get(str(user_id).strip())
        if sid:
            await sio.emit(event_name, payload, to=sid)
            logger.info(f"📤 {event_name} to=sid user={raw[:13]}…")
        else:
            await sio.emit(event_name, payload, room=room)
            logger.info(f"📤 {event_name} room={room} (sid yok)")
    except Exception as e:
        logger.warning(f"{event_name} emit hatası: {e}")


async def dispatch_offer_to_next_driver(tag_id: str, tag_data: dict):
    """
    Sıradaki sürücüye teklif gönder
    Timeout sonrası otomatik olarak sonrakine geç
    """
    try:
        config = await get_dispatch_config()
        timeout = config.get("driver_offer_timeout", 10)
        merged = {**(dispatch_tag_context.get(tag_id) or {}), **(tag_data or {})}
        dispatch_tag_context[tag_id] = merged

        queue = dispatch_queues.get(tag_id, [])
        
        # Bekleyen sürücü bul
        next_entry = None
        for entry in queue:
            if entry["status"] == "waiting":
                next_entry = entry
                break
        
        if not next_entry:
            logger.info(f"📭 Dispatch: Tag {tag_id} - Kuyruk bitti, yayın yok (sıralı mod)")
            dispatch_tag_context.pop(tag_id, None)
            dispatch_queues.pop(tag_id, None)
            passenger_id = merged.get("passenger_id")
            if passenger_id:
                try:
                    await sio.emit(
                        "dispatch_exhausted",
                        {"tag_id": tag_id, "message": "Yakında uygun sürücü bulunamadı"},
                        room=_normalize_user_room(passenger_id),
                    )
                except Exception as emit_err:
                    logger.warning(f"dispatch_exhausted emit: {emit_err}")
            return
        
        driver_id = next_entry["driver_id"]
        driver_name = next_entry["driver_name"]
        
        # Status'u sent yap
        next_entry["status"] = "sent"
        next_entry["sent_at"] = datetime.utcnow().isoformat()
        
        # Supabase güncelle
        try:
            supabase.table("dispatch_queue").update({
                "status": "sent",
                "sent_at": next_entry["sent_at"]
            }).eq("id", next_entry["id"]).execute()
        except:
            pass
        
        # Socket ile sürücüye teklif gönder
        offer_data = {
            "tag_id": tag_id,
            "passenger_id": merged.get("passenger_id"),
            "passenger_name": merged.get("passenger_name", "Yolcu"),
            "pickup_location": merged.get("pickup_location"),
            "pickup_lat": merged.get("pickup_lat"),
            "pickup_lng": merged.get("pickup_lng"),
            "dropoff_location": merged.get("dropoff_location"),
            "dropoff_lat": merged.get("dropoff_lat"),
            "dropoff_lng": merged.get("dropoff_lng"),
            "offered_price": merged.get("final_price") or merged.get("offered_price"),
            "distance_km": merged.get("distance_km", 0),
            "estimated_minutes": merged.get("estimated_minutes", 0),
            "distance_to_pickup": next_entry.get("distance_km", 0),
            "dispatch_timeout": timeout,
            "is_dispatch": True,  # Bu bir dispatch teklifi
            "passenger_vehicle_kind": merged.get("passenger_preferred_vehicle") or "car",
        }
        
        await emit_new_passenger_offer_to_driver(driver_id, offer_data)
        logger.info(f"📤 Dispatch teklif gönderildi: tag={tag_id}, sürücü={driver_name} (priority={next_entry['priority']})")
        # Sadece aktif sıradaki sürücüye push
        price = merged.get("final_price") or merged.get("offered_price", 0)
        distance_km = merged.get("distance_km") or merged.get("trip_distance_km") or 0
        price_int = int(price) if price else 0
        distance_str = f"{round(float(distance_km), 0):.0f} km" if distance_km else "— km"
        body = f"{price_int} TL • {distance_str} - {timeout} sn içinde kabul et"
        try:
            await send_trip_push_and_log(
                driver_id,
                "new_ride_request",
                "Yeni yolculuk teklifi",
                body,
                {
                    "type": "new_offer",
                    "tag_id": tag_id,
                    "price": price,
                    "distance_km": distance_km,
                    "timeout": timeout,
                    "action": "accept",
                    "is_dispatch": True,
                },
            )
        except Exception as push_err:
            logger.warning(f"⚠️ Dispatch push gönderilemedi: {driver_id} - {push_err}")
        
        # Timeout task başlat
        expired_driver_id = driver_id

        async def timeout_handler():
            await asyncio.sleep(timeout)
            
            # Tag hala waiting durumunda mı?
            tag_result = supabase.table("tags").select("status").eq("id", tag_id).execute()
            if tag_result.data and tag_result.data[0].get("status") == "waiting":
                # Bu sürücü yanıt vermedi, expired yap
                next_entry["status"] = "expired"
                try:
                    supabase.table("dispatch_queue").update({"status": "expired"}).eq("id", next_entry["id"]).execute()
                except Exception:
                    pass
                
                logger.info(f"⏱️ Dispatch timeout: tag={tag_id}, sürücü={driver_name}")
                await emit_passenger_offer_revoked(expired_driver_id, tag_id)
                
                # Sonraki sürücüye geç
                fresh = dispatch_tag_context.get(tag_id, merged)
                await dispatch_offer_to_next_driver(tag_id, fresh)
        
        # Task'ı kaydet
        task = asyncio.create_task(timeout_handler())
        active_dispatch_tasks[f"{tag_id}_{driver_id}"] = task
        
    except Exception as e:
        logger.error(f"❌ Dispatch offer error: {e}")

async def broadcast_offer_to_all(tag_id: str, tag_data: dict) -> int:
    """
    20 km içinde uygun online sürücülere (yolcu araç tercihi ile aynı tipteki sürücüler)
    mesafeye göre en yakın N kişiye aynı anda socket (`new_passenger_offer`) + push.
    İlk kabul eden kazanır (accept_ride atomik).
    Dönüş: bildirilen sürücü sayısı (0 = kimse yok / hata).
    """
    try:
        pickup_lat = tag_data.get("pickup_lat")
        pickup_lng = tag_data.get("pickup_lng")
        
        if not pickup_lat or not pickup_lng:
            logger.warning(f"📢 Broadcast atlandı: konum bilgisi yok")
            return 0

        pref = _canonical_vehicle_kind(tag_data.get("passenger_preferred_vehicle"))
        if pref is None and tag_data.get("passenger_id"):
            try:
                pr = (
                    supabase.table("users")
                    .select("driver_details")
                    .eq("id", tag_data["passenger_id"])
                    .limit(1)
                    .execute()
                )
                if pr.data:
                    pref = _passenger_preferred_vehicle_from_row(pr.data[0])
            except Exception:
                pass
        pref = pref or "car"
        
        now = datetime.utcnow().isoformat()
        q = supabase.table("users").select(
            "id, latitude, longitude, driver_details"
        ).eq("driver_online", True)
        drivers_result = _apply_driver_active_until_filter(q, now).execute()
        
        if not drivers_result.data:
            logger.info(f"📢 Broadcast: Uygun sürücü yok")
            return 0
        
        passenger_pid = tag_data.get("passenger_id")
        # (driver_id, distance_km) — yarıçap + araç tipi
        with_distance: list = []
        for driver in drivers_result.data:
            d_lat = driver.get("latitude")
            d_lng = driver.get("longitude")
            if not d_lat or not d_lng:
                continue
            if passenger_pid and str(driver["id"]) == str(passenger_pid):
                continue
            eff = _effective_driver_vehicle_kind(driver)
            if not _driver_matches_passenger_vehicle_pref(eff, pref):
                continue
            dist_km = haversine_distance(pickup_lat, pickup_lng, d_lat, d_lng)
            if dist_km <= BROADCAST_RADIUS_KM:
                with_distance.append((driver["id"], dist_km))
        
        if not with_distance:
            logger.info(f"📢 Broadcast: {BROADCAST_RADIUS_KM} km içinde sürücü yok")
            return 0
        
        with_distance.sort(key=lambda x: x[1])
        top = with_distance[:BROADCAST_MAX_RECIPIENTS]
        eligible_drivers = [d[0] for d in top]
        
        timeout_sec = BROADCAST_ACCEPT_WINDOW_SECONDS
        
        offer_data = {
            "tag_id": tag_id,
            "passenger_id": tag_data.get("passenger_id"),
            "passenger_name": tag_data.get("passenger_name", "Yolcu"),
            "pickup_location": tag_data.get("pickup_location"),
            "pickup_lat": pickup_lat,
            "pickup_lng": pickup_lng,
            "dropoff_location": tag_data.get("dropoff_location"),
            "dropoff_lat": tag_data.get("dropoff_lat"),
            "dropoff_lng": tag_data.get("dropoff_lng"),
            "offered_price": tag_data.get("final_price") or tag_data.get("offered_price"),
            "distance_km": tag_data.get("distance_km", 0),
            "estimated_minutes": tag_data.get("estimated_minutes", 0),
            "dispatch_timeout": timeout_sec,
            "is_broadcast": True,
            "passenger_vehicle_kind": pref,
        }
        
        price = tag_data.get("final_price") or tag_data.get("offered_price", 0)
        trip_distance_km = tag_data.get("distance_km") or tag_data.get("trip_distance_km") or 0
        price_int = int(price) if price else 0
        distance_str = f"{round(float(trip_distance_km), 0):.0f} km" if trip_distance_km else "— km"
        body = f"{price_int} TL • {distance_str} - {timeout_sec} sn içinde kabul et"
        for driver_id in eligible_drivers:
            await emit_new_passenger_offer_to_driver(str(driver_id).strip().lower(), offer_data)
            try:
                await send_trip_push_and_log(
                    driver_id,
                    "new_ride_request",
                    "Yeni yolculuk teklifi",
                    body,
                    {"type": "new_offer", "tag_id": tag_id, "price": price, "distance_km": trip_distance_km, "timeout": timeout_sec, "action": "accept", "is_broadcast": True}
                )
            except Exception as push_err:
                logger.warning(f"⚠️ Broadcast push sürücüye gönderilemedi: {driver_id} - {push_err}")
        
        logger.info(
            f"📢 Broadcast: tag={tag_id}, en yakın {len(eligible_drivers)}/{BROADCAST_MAX_RECIPIENTS} sürücü "
            f"({BROADCAST_RADIUS_KM} km, {timeout_sec}s pencere, yolcu_araç_tipi={pref})"
        )
        return len(eligible_drivers)
    except Exception as e:
        logger.error(f"Broadcast error: {e}")
        return 0


# ==================== ROLLING BATCH DISPATCH (in-memory; no DB dispatch_queue) ====================


async def rolling_dispatch_stop(
    tag_id: str,
    *,
    revoke_offers: bool = True,
    except_driver_id: Optional[str] = None,
) -> None:
    """Zamanlayıcıyı durdur, rolling state'i sil; isteğe bağlı batch'e remove_offer."""
    old = rolling_dispatch_tasks.pop(tag_id, None)
    if old is not None and not old.done():
        try:
            old.cancel()
        except Exception:
            pass
    st = rolling_dispatch_index.pop(tag_id, None)
    if revoke_offers and st:
        ex = str(except_driver_id).strip().lower() if except_driver_id else None
        for did in st.get("current_batch") or []:
            if ex and str(did).strip().lower() == ex:
                continue
            try:
                await emit_socket_event_to_user(did, "remove_offer", {"tag_id": tag_id})
            except Exception:
                pass


async def rolling_dispatch_batch(tag_id: str) -> None:
    """Önceki batch'e remove_offer; sonraki 5'e new_passenger_offer; 20s sonra waiting ise tekrar."""
    state = rolling_dispatch_index.get(tag_id)
    if not state:
        return

    old = rolling_dispatch_tasks.pop(tag_id, None)
    if old is not None and not old.done():
        try:
            old.cancel()
        except Exception:
            pass

    for did in state.get("current_batch") or []:
        try:
            await emit_socket_event_to_user(did, "remove_offer", {"tag_id": tag_id})
        except Exception:
            pass
    state["current_batch"] = []

    drivers = state.get("drivers") or []
    tag_data = state.get("full_tag") or {}
    n = len(drivers)
    if n == 0:
        await rolling_dispatch_stop(tag_id, revoke_offers=False)
        return

    start = int(state.get("cursor", 0))
    if start >= n:
        start = 0
    end = min(start + BATCH_SIZE, n)
    batch_entries = drivers[start:end]
    next_idx = end
    if next_idx >= n:
        next_idx = 0
    state["cursor"] = next_idx

    if not batch_entries:
        return

    state["current_batch"] = [e["driver_id"] for e in batch_entries]

    pref = _canonical_vehicle_kind(tag_data.get("passenger_preferred_vehicle")) or "car"
    if tag_data.get("passenger_id"):
        try:
            pr = (
                supabase.table("users")
                .select("driver_details")
                .eq("id", tag_data["passenger_id"])
                .limit(1)
                .execute()
            )
            if pr.data:
                pref = _passenger_preferred_vehicle_from_row(pr.data[0]) or pref
        except Exception:
            pass
    pref = pref or "car"

    price = tag_data.get("final_price") or tag_data.get("offered_price", 0)
    trip_distance_km = tag_data.get("distance_km") or tag_data.get("trip_distance_km") or 0
    price_int = int(price) if price else 0
    distance_str = f"{round(float(trip_distance_km), 0):.0f} km" if trip_distance_km else "— km"
    body = f"{price_int} TL • {distance_str} - {DISPATCH_TIMEOUT} sn içinde kabul et"

    offer_base = {
        "tag_id": tag_id,
        "passenger_id": tag_data.get("passenger_id"),
        "passenger_name": tag_data.get("passenger_name", "Yolcu"),
        "pickup_location": tag_data.get("pickup_location"),
        "pickup_lat": tag_data.get("pickup_lat"),
        "pickup_lng": tag_data.get("pickup_lng"),
        "dropoff_location": tag_data.get("dropoff_location"),
        "dropoff_lat": tag_data.get("dropoff_lat"),
        "dropoff_lng": tag_data.get("dropoff_lng"),
        "offered_price": tag_data.get("final_price") or tag_data.get("offered_price"),
        "distance_km": tag_data.get("distance_km", 0),
        "estimated_minutes": tag_data.get("estimated_minutes", 0),
        "dispatch_timeout": DISPATCH_TIMEOUT,
        "is_rolling_batch": True,
        "passenger_vehicle_kind": pref,
    }

    for entry in batch_entries:
        d_id = entry["driver_id"]
        offer_data = {**offer_base, "distance_to_pickup": entry.get("distance_km", 0)}
        await emit_new_passenger_offer_to_driver(d_id, offer_data)
        try:
            await send_trip_push_and_log(
                d_id,
                "new_ride_request",
                "Yeni yolculuk teklifi",
                body,
                {
                    "type": "new_offer",
                    "tag_id": tag_id,
                    "price": price,
                    "distance_km": trip_distance_km,
                    "timeout": DISPATCH_TIMEOUT,
                    "action": "accept",
                    "is_rolling_batch": True,
                },
            )
        except Exception as push_err:
            logger.warning(f"⚠️ Rolling batch push: {d_id} - {push_err}")

    logger.info(
        f"📦 rolling_dispatch_batch tag={tag_id} batch={len(batch_entries)} "
        f"idx {start}-{end - 1}/{n} next_cursor={next_idx}"
    )

    async def _timeout_tick():
        try:
            await asyncio.sleep(DISPATCH_TIMEOUT)
            if tag_id not in rolling_dispatch_index:
                return
            tr = supabase.table("tags").select("status").eq("id", tag_id).limit(1).execute()
            if not tr.data or tr.data[0].get("status") != "waiting":
                await rolling_dispatch_stop(tag_id, revoke_offers=False)
                return
            await rolling_dispatch_batch(tag_id)
        except asyncio.CancelledError:
            raise
        except Exception as ex:
            logger.warning(f"rolling_dispatch_batch timer tag={tag_id}: {ex}")

    rolling_dispatch_tasks[tag_id] = asyncio.create_task(_timeout_tick())


async def rolling_dispatch_start(tag_id: str) -> int:
    """DB'den tag; 20 km + vehicle_kind + mesafe sırası; ilk batch + timer. Dönüş: eligible sayısı."""
    await rolling_dispatch_stop(tag_id, revoke_offers=False)
    tr = supabase.table("tags").select("*").eq("id", tag_id).limit(1).execute()
    if not tr.data:
        logger.warning(f"rolling_dispatch_start: tag yok veya okunamadı tag_id={tag_id}")
        return 0
    row = tr.data[0]
    if row.get("status") != "waiting":
        logger.warning(
            f"rolling_dispatch_start: tag status≠waiting (status={row.get('status')!r}) tag_id={tag_id}"
        )
        return 0
    passenger_id = row.get("passenger_id")
    if passenger_id:
        passenger_id = await resolve_user_id(passenger_id)
    passenger_name = row.get("passenger_name") or "Yolcu"
    passenger_pref = _canonical_vehicle_kind(row.get("passenger_preferred_vehicle"))
    prow_row = None
    if passenger_id:
        try:
            prow = (
                supabase.table("users")
                .select("name, driver_details")
                .eq("id", passenger_id)
                .limit(1)
                .execute()
            )
            if prow.data:
                prow_row = prow.data[0]
                passenger_name = prow_row.get("name") or passenger_name
                if passenger_pref is None:
                    passenger_pref = _passenger_preferred_vehicle_from_row(prow_row)
        except Exception:
            pass
    passenger_pref = passenger_pref or "car"

    pickup_lat = row.get("pickup_lat")
    pickup_lng = row.get("pickup_lng")
    if pickup_lat is None or pickup_lng is None:
        logger.warning(
            f"rolling_dispatch_start: pickup koordinat eksik tag_id={tag_id} lat={pickup_lat} lng={pickup_lng}"
        )
        return 0

    full_tag_data = {
        "passenger_id": passenger_id,
        "passenger_name": passenger_name,
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "pickup_location": row.get("pickup_location"),
        "dropoff_lat": row.get("dropoff_lat"),
        "dropoff_lng": row.get("dropoff_lng"),
        "dropoff_location": row.get("dropoff_location"),
        "final_price": row.get("final_price"),
        "offered_price": row.get("final_price"),
        "distance_km": row.get("distance_km", 0),
        "estimated_minutes": row.get("estimated_minutes", 0),
        "passenger_preferred_vehicle": passenger_pref,
    }

    eligible = await find_eligible_drivers(
        float(pickup_lat),
        float(pickup_lng),
        exclude_ids=[passenger_id] if passenger_id else [],
        passenger_vehicle_kind=passenger_pref,
        radius_km=DISPATCH_RADIUS_KM,
    )
    if not eligible:
        logger.warning(
            f"rolling_dispatch_start: 0 uygun sürücü tag_id={tag_id} "
            f"radius={DISPATCH_RADIUS_KM}km pref={passenger_pref!r} pickup=({pickup_lat},{pickup_lng}). "
            f"Kontrol: users.driver_online=true, lat/lng dolu, mesafe≤{DISPATCH_RADIUS_KM}km, "
            f"araç tipi eşleşmesi (yolcu {passenger_pref!r}), "
            f"backend tek worker (socket_app + --workers 1)."
        )
        return 0

    rolling_dispatch_index[tag_id] = {
        "cursor": 0,
        "drivers": eligible,
        "full_tag": full_tag_data,
        "current_batch": [],
    }
    logger.info(
        f"rolling_dispatch_start tag={tag_id} eligible={len(eligible)} "
        f"batch={BATCH_SIZE} timeout={DISPATCH_TIMEOUT}s radius={DISPATCH_RADIUS_KM}km"
    )
    await rolling_dispatch_batch(tag_id)
    return len(eligible)


async def handle_dispatch_accept(tag_id: str, driver_id: str):
    """
    Sürücü dispatch teklifini kabul etti
    Queue'daki diğer kayıtları expire yap ve task'ları iptal et
    """
    try:
        queue = dispatch_queues.get(tag_id, [])
        did_norm = str(driver_id).strip().lower()

        for entry in queue:
            if str(entry.get("driver_id", "")).strip().lower() == did_norm:
                entry["status"] = "accepted"
                entry["responded_at"] = datetime.utcnow().isoformat()
            elif entry["status"] in ["waiting", "sent"]:
                entry["status"] = "expired"
        
        # Supabase güncelle
        try:
            supabase.table("dispatch_queue").update({"status": "accepted", "responded_at": datetime.utcnow().isoformat()}).eq("tag_id", tag_id).eq("driver_id", driver_id).execute()
            supabase.table("dispatch_queue").update({"status": "expired"}).eq("tag_id", tag_id).neq("driver_id", driver_id).in_("status", ["waiting", "sent"]).execute()
        except:
            pass
        
        # Bekleyen task'ları iptal et
        for key in list(active_dispatch_tasks.keys()):
            if key.startswith(f"{tag_id}_"):
                task = active_dispatch_tasks.pop(key, None)
                if task and not task.done():
                    task.cancel()
        
        # Queue'yu temizle
        dispatch_queues.pop(tag_id, None)
        dispatch_tag_context.pop(tag_id, None)
        
        logger.info(f"✅ Dispatch accept: tag={tag_id}, sürücü={driver_id}")
        
    except Exception as e:
        logger.error(f"Handle dispatch accept error: {e}")

async def handle_dispatch_reject(tag_id: str, driver_id: str):
    """Sürücü dispatch teklifini reddetti, sonrakine geç"""
    try:
        queue = dispatch_queues.get(tag_id, [])
        
        for entry in queue:
            if entry["driver_id"] == driver_id:
                entry["status"] = "rejected"
                entry["responded_at"] = datetime.utcnow().isoformat()
                break
        
        # Supabase güncelle
        try:
            supabase.table("dispatch_queue").update({
                "status": "rejected",
                "responded_at": datetime.utcnow().isoformat()
            }).eq("tag_id", tag_id).eq("driver_id", driver_id).execute()
        except:
            pass
        
        # Bekleyen task'ı iptal et
        task_key = f"{tag_id}_{driver_id}"
        task = active_dispatch_tasks.pop(task_key, None)
        if task and not task.done():
            task.cancel()
        
        # Tag durumunu kontrol et
        tag_result = supabase.table("tags").select("status, passenger_id, passenger_name, pickup_lat, pickup_lng, pickup_location, dropoff_lat, dropoff_lng, dropoff_location, final_price").eq("id", tag_id).execute()
        
        if tag_result.data and tag_result.data[0].get("status") == "waiting":
            # Sonraki sürücüye teklif gönder
            tag_row = tag_result.data[0]
            merged = {**(dispatch_tag_context.get(tag_id) or {}), **tag_row}
            await dispatch_offer_to_next_driver(tag_id, merged)
        
        logger.info(f"❌ Dispatch reject: tag={tag_id}, sürücü={driver_id}")
        
    except Exception as e:
        logger.error(f"Handle dispatch reject error: {e}")

logger.info("✅ Dispatch Queue sistemi yapılandırıldı")

# ==================== CONFIG ====================
MAX_DISTANCE_KM = 50
ADMIN_PHONE_NUMBERS = ["5326497412", "5354169632"]  # Ana admin numaraları
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
EXPO_ACCESS_TOKEN = os.getenv("EXPO_ACCESS_TOKEN", "")  # Expo Push API 403 önlemek için: Authorization Bearer

# Sahte/geçersiz numara kalıpları
FAKE_NUMBER_PATTERNS = [
    "1111111111", "2222222222", "3333333333", "4444444444", "5555555555",
    "6666666666", "7777777777", "8888888888", "9999999999", "0000000000",
    "1234567890", "0987654321", "1122334455", "5544332211", "1212121212",
    "1231231234", "1234512345", "1111122222", "1112223334", "1234554321",
]

def validate_turkish_phone(phone: str) -> tuple[bool, str]:
    """
    Türk telefon numarası doğrulama
    Geçerli formatlar: 5XXXXXXXXX (10 hane, 5 ile başlar)
    """
    import re
    
    # Temizle: +90, 0, boşluk, tire kaldır
    cleaned = re.sub(r'[\s\-\+]', '', phone)
    if cleaned.startswith('90'):
        cleaned = cleaned[2:]
    if cleaned.startswith('0'):
        cleaned = cleaned[1:]
    
    # 10 haneli olmalı
    if len(cleaned) != 10:
        return False, "Telefon numarası 10 haneli olmalı"
    
    # Sadece rakam olmalı
    if not cleaned.isdigit():
        return False, "Telefon numarası sadece rakamlardan oluşmalı"
    
    # 5 ile başlamalı (mobil)
    if not cleaned.startswith('5'):
        return False, "Geçerli bir mobil numara girin (5XX ile başlamalı)"
    
    # Sahte numara kontrolü
    if cleaned in FAKE_NUMBER_PATTERNS:
        return False, "Geçersiz telefon numarası"
    
    # Ardışık veya tekrarlayan kontrol
    # Örn: 5000000000, 5111111111
    if len(set(cleaned[1:])) <= 2:  # İlk rakam hariç çok az farklı rakam varsa
        return False, "Geçersiz telefon numarası"
    
    return True, cleaned

# Initialize Supabase (global `supabase` = _supabase_core.get_supabase(), service role only)
supabase: Client = None


def init_supabase():
    global supabase
    _supabase_core.init_supabase()
    supabase = _supabase_core.get_supabase()
    if supabase:
        logger.info("✅ Supabase bağlantısı başarılı (tek client, SERVICE_ROLE_KEY)")
    else:
        logger.error(
            "❌ Supabase başlatılamadı: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY "
            "(veya SUPABASE_SERVICE_KEY) .env içinde olmalı; anon key kullanılmaz."
        )

# Şehirler
TURKEY_CITIES = [
    "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya",
    "Gaziantep", "Şanlıurfa", "Kocaeli", "Mersin", "Diyarbakır", "Hatay",
    "Manisa", "Kayseri", "Samsun", "Balıkesir", "Kahramanmaraş", "Van",
    "Aydın", "Denizli", "Sakarya", "Tekirdağ", "Muğla", "Eskişehir",
    "Mardin", "Trabzon", "Malatya", "Erzurum", "Sivas", "Batman",
    "Adıyaman", "Elazığ", "Afyonkarahisar", "Şırnak", "Tokat", "Kütahya",
    "Osmaniye", "Çorum", "Aksaray", "Giresun", "Niğde", "Isparta", "Ordu",
    "Siirt", "Zonguldak", "Düzce", "Yozgat", "Edirne", "Ağrı", "Muş",
    "Kastamonu", "Rize", "Amasya", "Bolu", "Kırıkkale", "Uşak",
    "Karabük", "Bingöl", "Çanakkale", "Karaman", "Kırşehir", "Bitlis",
    "Nevşehir", "Hakkari", "Sinop", "Artvin", "Yalova", "Bartın", "Bilecik",
    "Çankırı", "Erzincan", "Iğdır", "Kars", "Kilis", "Gümüşhane", "Tunceli",
    "Ardahan", "Bayburt"
]

# Create FastAPI app (app alias keeps all existing routes working)
fastapi_app = FastAPI(title="Leylek TAG API - Supabase", version="3.0.0")
app = fastapi_app
api_router = APIRouter(prefix="/api")

# ==================== SOCKET.IO ASGI APP ====================
# Socket.IO'yu /api/socket.io path'inde çalıştır
# NOT: socket_app dosyanın sonunda oluşturulacak (route'lar eklendikten sonra)
SOCKET_SERVER_PORT = int(os.getenv("PORT", "8001"))

# Son temizlik zamanı (global)
last_cleanup_time = None

@app.on_event("startup")
async def startup():
    global last_cleanup_time
    clear_dispatch_in_memory_state()
    init_supabase()
    last_cleanup_time = datetime.utcnow()
    print("🚀 SOCKET SERVER RUNNING ON PORT:", SOCKET_SERVER_PORT)
    logger.info("✅ Server started with Supabase + Socket.IO (path: /socket.io)")

# Otomatik temizlik - her 10 dakikada bir inaktif TAG'leri temizle
async def auto_cleanup_inactive_tags():
    """30 dakikadan fazla inaktif TAG'leri otomatik bitir"""
    global last_cleanup_time
    
    # Son temizlikten en az 10 dakika geçmişse tekrar çalıştır
    if last_cleanup_time and (datetime.utcnow() - last_cleanup_time).total_seconds() < 600:
        return 0  # Henüz 10 dakika geçmedi
    
    try:
        max_inactive_minutes = 30
        cutoff_time = (datetime.utcnow() - timedelta(minutes=max_inactive_minutes)).isoformat()
        
        # Aktif TAG'leri bul (matched veya in_progress)
        result = supabase.table("tags").select("id, passenger_id, driver_id, status, last_activity, matched_at, created_at").in_("status", ["matched", "in_progress"]).execute()
        
        cleaned_count = 0
        for tag in result.data:
            last_activity = tag.get("last_activity") or tag.get("matched_at") or tag.get("created_at")
            
            if last_activity:
                try:
                    activity_time = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                    now = datetime.now(activity_time.tzinfo)
                    
                    if (now - activity_time).total_seconds() > max_inactive_minutes * 60:
                        # TAG'i iptal et
                        supabase.table("tags").update({
                            "status": "cancelled",
                            "cancelled_at": datetime.utcnow().isoformat(),
                            "cancel_reason": "inactivity_timeout"
                        }).eq("id", tag["id"]).execute()
                        
                        cleaned_count += 1
                        logger.info(f"🧹 Auto-cleanup: İnaktif TAG temizlendi: {tag['id']}")
                except Exception as e:
                    logger.error(f"Auto-cleanup error for {tag['id']}: {e}")
        
        last_cleanup_time = datetime.utcnow()
        
        if cleaned_count > 0:
            logger.info(f"🧹 Auto-cleanup tamamlandı: {cleaned_count} TAG temizlendi")
        
        return cleaned_count
    except Exception as e:
        logger.error(f"Auto cleanup error: {e}")
        return 0

# ==================== HELPER FUNCTIONS ====================

def hash_pin(pin: str) -> str:
    """PIN hash'le"""
    return hashlib.sha256(pin.encode()).hexdigest()

def verify_pin(pin: str, pin_hash: str) -> bool:
    """PIN doğrula"""
    return hash_pin(pin) == pin_hash

async def resolve_user_id(user_id: str) -> str:
    """
    MongoDB ID'yi Supabase UUID'ye dönüştür
    Eğer zaten UUID ise olduğu gibi döndür
    """
    if not user_id:
        return None
    
    # UUID formatı kontrolü (8-4-4-4-12)
    import re
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
    
    if uuid_pattern.match(user_id):
        # UUID tek biçimde (socket room / dispatch_queue ile uyum)
        return str(user_id).strip().lower()
    
    # MongoDB ID olabilir, mongo_id ile ara
    try:
        result = supabase.table("users").select("id").eq("mongo_id", user_id).execute()
        if result.data:
            return str(result.data[0]["id"]).strip().lower()
    except Exception as e:
        logger.warning(f"User ID resolve error: {e}")
    
    # Bulunamadıysa orijinal değeri döndür
    return user_id

# OSRM API (TAMAMEN ÜCRETSİZ - LİMİTSİZ)
# OpenStreetMap'in routing servisi - Daha güvenilir ve limitsiz

async def get_route_info(origin_lat, origin_lng, dest_lat, dest_lng):
    """Google Directions API ile rota bilgisi al - EN DOĞRU SONUÇ"""
    try:
        # Önce Google Directions API dene
        road_info = await get_road_distance(
            float(origin_lat), float(origin_lng),
            float(dest_lat), float(dest_lng)
        )
        
        if road_info:
            return {
                "distance_km": road_info["distance_km"],
                "duration_min": road_info["duration_min"],
                "distance_text": f"{road_info['distance_km']} km",
                "duration_text": f"{road_info['duration_min']} dk"
            }
        
        # Google başarısız olursa OSRM dene
        url = f"https://router.project-osrm.org/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=false"
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            data = response.json()
            
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                distance_m = route.get("distance", 0)
                duration_s = route.get("duration", 0)
                
                distance_km = distance_m / 1000
                duration_min = duration_s / 60
                
                logger.info(f"✅ OSRM rota: {distance_km:.1f} km, {duration_min:.0f} dk")
                
                return {
                    "distance_km": round(distance_km, 1),
                    "duration_min": round(duration_min, 0),
                    "distance_text": f"{round(distance_km, 1)} km",
                    "duration_text": f"{int(duration_min)} dk"
                }
    except Exception as e:
        logger.warning(f"Route info error: {e}")
    
    # Fallback: Düz çizgi mesafesi hesapla
    try:
        from math import radians, sin, cos, sqrt, atan2
        R = 6371  # Dünya yarıçapı km
        lat1, lon1 = radians(float(origin_lat)), radians(float(origin_lng))
        lat2, lon2 = radians(float(dest_lat)), radians(float(dest_lng))
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance_km = R * c * 1.3  # Gerçek yol mesafesi için %30 ekle
        duration_min = distance_km / 40 * 60  # 40 km/saat ortalama
        return {
            "distance_km": round(distance_km, 1),
            "duration_min": round(duration_min, 0),
            "distance_text": f"{round(distance_km, 1)} km",
            "duration_text": f"{int(duration_min)} dk"
        }
    except:
        pass
    
    return None

# ==================== AUTH ENDPOINTS ====================

# Pydantic modelleri
class CheckUserRequest(BaseModel):
    phone: str
    device_id: Optional[str] = None

class SendOtpRequest(BaseModel):
    phone: str

@api_router.get("/cities")
async def get_cities():
    """Türkiye şehirlerini getir"""
    return {"success": True, "cities": sorted(TURKEY_CITIES)}

# Frontend uyumluluğu için alias
@api_router.get("/auth/cities")
async def get_cities_alias():
    """Türkiye şehirlerini getir (alias)"""
    return {"success": True, "cities": sorted(TURKEY_CITIES)}

# Yardımcı fonksiyon - Bir numara bir cihaz: aynı cihazda OTP yok, farklı cihazda OTP gerekir
async def _check_user_logic(phone: str, device_id: str = None):
    """Kullanıcı var mı kontrol et - device_id eşleşirse doğrulama kodu gönderilmez"""
    try:
        result = None
        for candidate in _phone_lookup_candidates(phone):
            result = supabase.table("users").select("*").eq("phone", candidate).execute()
            if result.data:
                break
        
        if result and result.data:
            user = result.data[0]
            has_pin = bool(user.get("pin_hash"))
            # Bir numara–bir cihaz: last_device_id (veya bound_device_id) ile eşleşirse aynı cihaz
            bound = user.get("bound_device_id") or user.get("last_device_id")
            is_same_device = bool(device_id and bound and str(bound).strip() == str(device_id).strip())
            is_valid_adm, res_adm = validate_turkish_phone(phone)
            is_admin = (
                _phone_10_for_admin_check(normalize_turkish_phone(res_adm)) in ADMIN_PHONE_NUMBERS
                if is_valid_adm
                else False
            )
            
            return {
                "success": True,
                "user_exists": True,
                "exists": True,
                "has_pin": has_pin,
                "device_verified": is_same_device,
                "is_device_verified": is_same_device,
                "user_id": user["id"],
                "user_name": user.get("name"),
                "is_admin": is_admin
            }
        
        return {"success": True, "user_exists": False, "exists": False, "has_pin": False}
    except Exception as e:
        logger.error(f"Check user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Frontend body'den okuyan endpoint
@api_router.post("/auth/check-user")
async def check_user_body(request: CheckUserRequest):
    """Kullanıcı var mı kontrol et (body JSON)"""
    return await _check_user_logic(request.phone, request.device_id)

# Query param ile çalışan endpoint
@api_router.post("/auth/check")
async def check_user_query(phone: str, device_id: str = None):
    """Kullanıcı var mı kontrol et (query param)"""
    return await _check_user_logic(phone, device_id)

# Send OTP - body'den oku
class SendOtpBodyRequest(BaseModel):
    phone: str

# ==================== NETGSM SMS GÖNDERİMİ ====================
import base64
import httpx
import random
import time

# OTP storage with rate limiting
# code/expires: son *başarılı* SMS ile set edilir (SMS hata verirse eski geçerli kod korunur)
# last_api_attempt: her /send-otp çağrısında (çift tıklama / flood önleme)
# last_sms_ok: son başarılı NetGSM yanıtı (NetGSM 85 / maliyet için soğuma)
otp_storage: dict = {}

# Başarılı OTP gönderimleri arası minimum süre (NetGSM aynı numara limiti + maliyet)
OTP_SUCCESS_COOLDOWN_SECONDS = 60
# İki deneme arası (başarısız SMS sonrası tekrar için kısa; sadece çift isteği keser)
OTP_MIN_ATTEMPT_INTERVAL = 12
# OTP TTL: 3 minutes
OTP_TTL_SECONDS = 180

def normalize_turkish_phone(phone: str) -> str:
    """
    Normalize Turkish phone number to format: 905XXXXXXXXX
    Handles: 5XX, 05XX, 905XX, +905XX, 0090XXX formats
    """
    # Remove all non-digit characters
    phone = ''.join(filter(str.isdigit, phone))
    
    # Handle different formats
    if phone.startswith("0090"):
        phone = "90" + phone[4:]
    elif phone.startswith("90") and len(phone) == 12:
        pass  # Already correct format
    elif phone.startswith("0") and len(phone) == 11:
        phone = "90" + phone[1:]
    elif len(phone) == 10 and phone.startswith("5"):
        phone = "90" + phone
    
    # Final validation
    if len(phone) == 12 and phone.startswith("905"):
        return phone
    
    # Fallback: just prepend 90 if needed
    if not phone.startswith("90"):
        phone = "90" + phone
    
    return phone


def _phone_lookup_candidates(phone: str):
    """DB'de telefon bazen 905XX bazen 5XX kayıtlı; ikisini de dene."""
    if not phone:
        return []
    raw = "".join(c for c in str(phone) if c.isdigit())
    if not raw:
        return []
    candidates = []
    # 05XXXXXXXXX (11 hane) — yalnızca "541..." dijitle aranırsa bulunamıyordu
    if len(raw) == 11 and raw.startswith("05") and raw[1:].startswith("5"):
        ten = raw[1:]
        candidates.append(ten)
        candidates.append("90" + ten)
        return list(dict.fromkeys(candidates))
    if len(raw) == 12 and raw.startswith("90"):
        candidates.append(raw)
        candidates.append(raw[2:])  # 5XX
    elif len(raw) == 10 and raw.startswith("5"):
        candidates.append(raw)
        candidates.append("90" + raw)
    else:
        candidates.append(raw)
        if raw.startswith("90") and len(raw) == 12:
            candidates.append(raw[2:])
        elif len(raw) == 10 and raw.startswith("5"):
            candidates.append("90" + raw)
    return list(dict.fromkeys(candidates))  # sırayı koru, tekrarsız


def _auth_normalize_or_raise(phone: Optional[str]) -> str:
    """Tüm auth uçlarında tek tip: 905XXXXXXXXX (geçersizse 400/422)."""
    if not phone or not str(phone).strip():
        raise HTTPException(status_code=422, detail="Telefon numarası gerekli")
    is_valid, result = validate_turkish_phone(phone)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    return normalize_turkish_phone(result)


def _users_get_by_phone_flexible(canonical_905: str):
    """users.phone alanı 905... veya 5... olabilir; her iki formatta ara."""
    for cand in _phone_lookup_candidates(canonical_905):
        r = supabase.table("users").select("*").eq("phone", cand).limit(1).execute()
        if r.data:
            return r.data[0]
    return None


def _phone_10_for_admin_check(canonical_905: str) -> str:
    if len(canonical_905) == 12 and canonical_905.startswith("90"):
        return canonical_905[2:]
    return canonical_905


def normalize_phone_e164(phone: str, default_country_code: str = "90") -> str:
    """
    Normalize phone to E.164 format (with + prefix).
    Removes spaces and non-digits, then formats Turkish numbers as +905XXXXXXXXX.
    Example: 5326427412 -> +905326427412, 905326427412 -> +905326427412
    """
    if not phone:
        return ""
    raw = (phone or "").strip().replace(" ", "").replace("\t", "").replace("-", "").replace("(", "").replace(")", "")
    digits = "".join(c for c in raw if c.isdigit())
    if not digits:
        return ""
    # 0090... -> +90... (digits[2:14] = 12 chars: 905326427412)
    if digits.startswith("0090") and len(digits) >= 12:
        return "+" + digits[2:14]
    # 90... (12 digits) -> +90...
    if len(digits) == 12 and digits.startswith("90"):
        return "+" + digits
    # 0 5XX... (11 digits) -> +90 5XX...
    if len(digits) == 11 and digits.startswith("0") and digits[1] == "5":
        return f"+{default_country_code}{digits[1:]}"
    # 5XX... (10 digits, Turkish mobile) -> +90 5XX...
    if len(digits) == 10 and digits.startswith("5"):
        return f"+{default_country_code}{digits}"
    # Longer string starting with 90: take first 12 digits
    if len(digits) >= 12 and digits.startswith("90"):
        return "+" + digits[:12]
    if len(digits) >= 10 and digits.startswith("5"):
        return f"+{default_country_code}{digits[:10]}"
    return "+" + digits


def netgsm_gsmno_param(phone: str) -> str:
    """
    Netgsm HTTP GET çoğu entegrasyonda gsmno = 5XXXXXXXXX (10 hane) bekler.
    905XXXXXXXXX gönderimi bazı hesaplarda 70/param hatası veya iletim sorunu çıkarır.
    """
    p = normalize_turkish_phone(phone)
    if len(p) == 12 and p.startswith("905"):
        return p[2:]
    if len(p) == 10 and p.startswith("5"):
        return p
    return p


def _netgsm_sync_http_get(url: str) -> str:
    """
    NetGSM GET API — senkron, yalnızca HTTP/1.1 (stdlib urllib).
    Bazı sunucularda httpx/TLS veya HTTP/2 ALPN 'ConnectError' / reset üretir; urllib stabil çalışır.
    """
    import ssl
    import urllib.error
    import urllib.request

    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "LeylekTAG/1.0 (NetGSM)",
            "Accept": "*/*",
            "Connection": "close",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
            return resp.read().decode("utf-8", errors="replace").strip()
    except urllib.error.HTTPError as e:
        # Bazı hatalarda gövde yine NetGSM kod metni olabilir
        try:
            body = e.read().decode("utf-8", errors="replace").strip()
        except Exception:
            body = ""
        if body:
            return body
        raise


def _netgsm_sync_http_get_with_retries(url: str) -> str:
    """Geçici TLS/bağlantı hatalarında birkaç kez dene (stdlib urllib)."""
    import time as time_mod
    import urllib.error

    max_attempts = max(1, int(os.getenv("NETGSM_MAX_RETRIES", "3")))
    delay = 0.9
    last_err: Optional[Exception] = None
    for attempt in range(max_attempts):
        try:
            return _netgsm_sync_http_get(url)
        except urllib.error.HTTPError:
            raise
        except Exception as e:
            last_err = e
            if attempt < max_attempts - 1:
                logger.warning(
                    f"⚠️ NETGSM istek denemesi {attempt + 1}/{max_attempts} başarısız: {type(e).__name__}: {e!r}"
                )
                time_mod.sleep(delay * (attempt + 1))
    assert last_err is not None
    raise last_err


async def send_sms_via_netgsm(phone: str, message: str) -> dict:
    """
    NETGSM API ile SMS gönder - HTTP GET API
    Env: NETGSM_USERCODE (veya NETGSM_USERNAME), NETGSM_PASSWORD, NETGSM_MSGHEADER
    NETGSM_FILTER: ticari olmayan bilgilendirme/OTP için genelde "0" (varsayılan 0).
                 Boş string verilirse filter parametresi eklenmez (eski hesap uyumu).
    Returns: {"success": bool, "response": dict, "error": str}
    """
    result = {"success": False, "response": None, "error": None}
    
    try:
        usercode = (os.getenv("NETGSM_USERCODE") or os.getenv("NETGSM_USERNAME") or "").strip()
        password = (os.getenv("NETGSM_PASSWORD") or "").strip()
        # Yaygın yazım hatası: MNGHEADER
        msgheader = (
            os.getenv("NETGSM_MSGHEADER")
            or os.getenv("NETGSM_MNGHEADER")
            or ""
        ).strip()
        # Ticari içerik yok: İYS şartı için çoğu OTP akışında filter=0 gerekir
        filter_raw = os.getenv("NETGSM_FILTER", "0")
        filter_param = filter_raw.strip() if filter_raw is not None else ""
        if filter_param.lower() in ("-", "none", "skip"):
            filter_param = ""
        
        if not usercode or not password:
            logger.error("❌ NETGSM credentials eksik!")
            result["error"] = "NETGSM credentials missing"
            return result
        
        normalized_phone = normalize_turkish_phone(phone)
        gsmno = netgsm_gsmno_param(phone)
        logger.info(f"📱 Phone internal: {phone} -> {normalized_phone}, Netgsm gsmno: {gsmno}")
        
        # Use msgheader or usercode as sender
        sender = msgheader if msgheader else usercode
        
        # NETGSM HTTP GET API - https://www.netgsm.com.tr/dokuman/
        import urllib.parse
        
        # URL encode the message
        encoded_message = urllib.parse.quote(message)
        
        # Build API URL
        url = (
            f"https://api.netgsm.com.tr/sms/send/get?"
            f"usercode={urllib.parse.quote(usercode)}"
            f"&password={urllib.parse.quote(password)}"
            f"&gsmno={urllib.parse.quote(gsmno)}"
            f"&message={encoded_message}"
            f"&msgheader={urllib.parse.quote(sender)}"
            f"&dil=TR"
        )
        if filter_param:
            url += f"&filter={urllib.parse.quote(filter_param)}"
        
        logger.info(f"📱 NETGSM Request - gsmno: {gsmno}, Sender: {sender}, filter: {filter_param or '(yok)'}")
        
        # Önce urllib (HTTP/1.1) — VPS'te httpx ConnectError / TLS reset sorunlarını aşar.
        response_text = None
        try:
            import asyncio
            response_text = await asyncio.to_thread(_netgsm_sync_http_get_with_retries, url)
        except Exception as urllib_err:
            logger.warning(f"⚠️ NETGSM urllib isteği başarısız: {urllib_err!r}, httpx (http2=False) deneniyor")
            try:
                async with httpx.AsyncClient(timeout=45.0, http2=False) as client:
                    response = await client.get(
                        url,
                        headers={"Connection": "close", "Accept": "*/*"},
                    )
                    response_text = response.text.strip()
            except Exception as httpx_err:
                logger.exception(f"❌ NETGSM httpx de başarısız: {httpx_err!r}")
                raise httpx_err from urllib_err
        
        if response_text is None:
            response_text = ""

        # Log response
        logger.info(f"📱 NETGSM Response: {response_text}")
        result["response"] = {"raw": response_text}

        # Parse response - NETGSM returns codes like:
        # 00 XXXXXXXX = Success (with job ID)
        parts = response_text.split()
        code = parts[0] if parts else response_text

        if code in ["00", "01", "02"]:
            job_id = parts[1] if len(parts) > 1 else "N/A"
            logger.info(f"✅ SMS gönderildi: gsmno={gsmno}, JobID: {job_id}")
            result["success"] = True
            result["response"]["job_id"] = job_id
        else:
            error_desc = {
                "20": "Mesaj metni / karakter sınırı hatası",
                "30": "Kimlik doğrulama veya API izni / IP kısıtı",
                "40": "Mesaj başlığı (msgheader) tanımlı veya onaylı değil",
                "50": "IYS kontrollü gönderim hesabı uyumsuz",
                "51": "IYS marka bilgisi eksik",
                "70": "Parametre hatası (gsmno formatı, filter, vb.)",
                "80": "Gönderim limiti aşıldı",
                "85": "Aynı numaraya 1 dk içinde çok fazla istek",
            }.get(code, f"Bilinmeyen hata: {code}")

            logger.error(f"❌ SMS gönderilemedi: gsmno={gsmno} - Code: {code}, Desc: {error_desc}")
            result["error"] = f"Code: {code}, Desc: {error_desc}"

    except Exception as e:
        logger.exception(f"❌ NETGSM exception: {type(e).__name__}: {e!r}")
        result["error"] = str(e) or type(e).__name__
    
    return result

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOtpBodyRequest = None, phone: str = None):
    """
    OTP gönder - NETGSM ile gerçek SMS

    - Kod yalnızca NetGSM başarılı yanıtından sonra kaydedilir (SMS hata verirse eski geçerli kod silinmez).
    - Başarılı gönderimler arası 60 sn (NetGSM 85 / kota); istekler arası min 12 sn (çift tıklama).
    - TTL: 3 dk. Telefon: 905XXXXXXXXX normalize.
    """
    # Get phone from body or query param
    phone_number = None
    if request and request.phone:
        phone_number = request.phone
    elif phone:
        phone_number = phone
    
    if not phone_number:
        raise HTTPException(status_code=422, detail="Telefon numarası gerekli")
    
    # Validate Turkish phone
    is_valid, result = validate_turkish_phone(phone_number)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    
    # Normalize to 905XXXXXXXXX format
    cleaned_phone = normalize_turkish_phone(result)
    logger.info(f"📱 OTP request for: {cleaned_phone}")
    
    current_time = time.time()
    entry = dict(otp_storage.get(cleaned_phone) or {})

    # Süresi dolmuş kodu sil (diğer alanlar: last_sms_ok, last_api_attempt kalabilir)
    if entry.get("code") and entry.get("expires") and current_time > entry["expires"]:
        entry.pop("code", None)
        entry.pop("expires", None)

    # Çok sık API çağrısı (çift tıklama)
    last_attempt = entry.get("last_api_attempt")
    if last_attempt is not None and (current_time - last_attempt) < OTP_MIN_ATTEMPT_INTERVAL:
        remaining = int(OTP_MIN_ATTEMPT_INTERVAL - (current_time - last_attempt)) + 1
        logger.warning(f"⚠️ OTP attempt throttle: {cleaned_phone}, wait {remaining}s")
        raise HTTPException(
            status_code=429,
            detail=f"Çok hızlı tekrar denendi. {remaining} saniye sonra tekrar deneyin.",
        )

    # Son *başarılı* SMS'ten beri kısa süre (NetGSM 85 / kota)
    last_ok = entry.get("last_sms_ok")
    if last_ok is not None and (current_time - last_ok) < OTP_SUCCESS_COOLDOWN_SECONDS:
        remaining = int(OTP_SUCCESS_COOLDOWN_SECONDS - (current_time - last_ok)) + 1
        logger.warning(f"⚠️ OTP success cooldown: {cleaned_phone}, wait {remaining}s")
        raise HTTPException(
            status_code=429,
            detail=f"Yeni kod için {remaining} saniye bekleyin (son SMS gönderiminden sonra).",
        )

    # Deneme zamanı — kodu henüz yazma; SMS başarısız olursa eski geçerli kod korunur
    entry["last_api_attempt"] = current_time
    otp_storage[cleaned_phone] = entry

    otp_code = str(random.randint(100000, 999999))
    message = f"Leylek TAG dogrulama kodunuz: {otp_code}"
    sms_result = await send_sms_via_netgsm(cleaned_phone, message)

    if sms_result["success"]:
        otp_storage[cleaned_phone] = {
            "code": otp_code,
            "expires": current_time + OTP_TTL_SECONDS,
            "last_sms_ok": current_time,
            "last_api_attempt": current_time,
        }
        logger.info(f"✅ OTP gönderildi: {cleaned_phone}")
        return {"success": True, "message": "OTP gönderildi"}
    else:
        logger.error(f"❌ SMS failed for {cleaned_phone}: {sms_result['error']}")
        fallback = os.getenv("OTP_SMS_FALLBACK_TEST", "").strip().lower() in ("1", "true", "yes")
        if fallback:
            logger.warning(f"⚠️ OTP_SMS_FALLBACK_TEST: {cleaned_phone} -> 123456")
            otp_storage[cleaned_phone] = {
                "code": "123456",
                "expires": current_time + OTP_TTL_SECONDS,
                "last_sms_ok": current_time,
                "last_api_attempt": current_time,
            }
            return {
                "success": True,
                "message": "OTP gönderildi (test fallback)",
                "warning": "SMS delivery issue, using test code 123456",
            }
        err_txt = sms_result.get("error") or "Bilinmeyen hata"
        hint = ""
        if "Connect" in err_txt or "Connection" in err_txt or "timed out" in err_txt.lower():
            hint = " Ağ geçici olarak yanıt vermedi; birkaç saniye sonra tekrar deneyin."
        elif err_txt.startswith("Code: 85"):
            hint = " Aynı numaraya çok sık istek gitti; bir süre bekleyip tekrar deneyin."
        raise HTTPException(
            status_code=502,
            detail=(
                f"SMS gönderilemedi (NetGSM). {err_txt}.{hint} "
                f"Sunucu NETGSM_USERCODE/NETGSM_PASSWORD/NETGSM_MSGHEADER ve gerekirse NETGSM_FILTER kontrol edin."
            ),
        )

class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    device_id: Optional[str] = None

@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOtpRequest = None, phone: str = None, otp: str = None, device_id: str = None):
    """OTP doğrula ve kullanıcı bilgilerini döndür"""
    # Body veya query param'dan al
    phone_number = request.phone if request else phone
    otp_code = request.otp if request else otp
    
    if not phone_number or not otp_code:
        raise HTTPException(status_code=422, detail="Phone ve OTP gerekli")
    
    # send-otp ile aynı anahtar: mutlaka 905XXXXXXXXX (aksi halde OTP deposu eşleşmez)
    phone_number = _auth_normalize_or_raise(phone_number)
    logger.info(f"📱 OTP verify for: {phone_number}")
    
    # OTP kontrolü (sadece başarılı SMS sonrası yazılan "code" ile)
    stored_otp = otp_storage.get(phone_number)
    
    if stored_otp and stored_otp.get("code"):
        # Süre kontrolü
        if time.time() > stored_otp.get("expires", 0):
            del otp_storage[phone_number]
            raise HTTPException(status_code=400, detail="OTP süresi doldu, yeni kod isteyin")
        
        # Kod kontrolü
        if otp_code != stored_otp["code"]:
            raise HTTPException(status_code=400, detail="Geçersiz OTP")
        
        # Başarılı - OTP'yi sil
        del otp_storage[phone_number]
        logger.info(f"✅ OTP verified for: {phone_number}")
    else:
        # Fallback: Test modu için 123456 kabul et
        if otp_code != "123456":
            raise HTTPException(
                status_code=400,
                detail="Geçersiz OTP veya önce doğrulama kodu istenmedi. Kod gelmediyse tekrar 'Kod gönder' deneyin.",
            )
        logger.warning(f"⚠️ Test OTP used for: {phone_number}")
    
    # Cihaz ID (bir numara–bir cihaz için)
    dev_id = (request.device_id if request else device_id) or None
    
    # Kullanıcı var mı kontrol et (DB'de 905XX veya 5XX kayıtlı olabilir)
    result = None
    for candidate in _phone_lookup_candidates(phone_number):
        result = supabase.table("users").select("*").eq("phone", candidate).execute()
        if result.data:
            break
    
    if result and result.data:
        user = result.data[0]
        has_pin = bool(user.get("pin_hash"))
        
        # Bu cihazı numaraya bağla (bir numara–bir cihaz)
        try:
            upd = {"last_login": datetime.utcnow().isoformat()}
            if dev_id:
                upd["last_device_id"] = dev_id
            supabase.table("users").update(upd).eq("id", user["id"]).execute()
        except Exception as upd_err:
            logger.warning(f"verify_otp device update (ignored): {upd_err}")
        
        return {
            "success": True,
            "message": "OTP doğrulandı",
            "user_exists": True,
            "has_pin": has_pin,
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "name": user.get("name", ""),
                "role": user.get("role", "passenger"),
                "rating": float(user.get("rating", 5.0)),
                "total_ratings": user.get("total_ratings", 0),
                "is_admin": user.get("is_admin", False)
            }
        }
    else:
        # Yeni kullanıcı
        return {
            "success": True,
            "message": "OTP doğrulandı",
            "user_exists": False,
            "has_pin": False,
            "user": None
        }

class SetPinRequest(BaseModel):
    phone: str
    pin: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    city: Optional[str] = None
    device_id: Optional[str] = None

@api_router.post("/auth/set-pin")
async def set_pin(request: SetPinRequest = None, phone: str = None, pin: str = None, first_name: str = None, last_name: str = None, city: str = None, device_id: str = None):
    """PIN oluştur veya güncelle"""
    try:
        # Body veya query param'dan al
        phone_val = request.phone if request else phone
        pin_val = request.pin if request else pin
        first_name_val = request.first_name if request else first_name
        last_name_val = request.last_name if request else last_name
        city_val = request.city if request else city
        dev_id = (request.device_id if request else device_id) or None
        
        if not phone_val or not pin_val:
            raise HTTPException(status_code=422, detail="Phone ve PIN gerekli")
        
        canonical = _auth_normalize_or_raise(phone_val)
        pin_hash = hash_pin(pin_val)
        
        user_row = _users_get_by_phone_flexible(canonical)
        
        if user_row:
            # Güncelle + cihaz bağla; DB'de 5XX kaldıysa 905'e çek
            upd = {
                "pin_hash": pin_hash,
                "first_name": first_name_val,
                "last_name": last_name_val,
                "city": city_val,
                "name": f"{first_name_val or ''} {last_name_val or ''}".strip(),
                "updated_at": datetime.utcnow().isoformat()
            }
            if dev_id:
                upd["last_device_id"] = dev_id
            if user_row.get("phone") != canonical:
                upd["phone"] = canonical
            supabase.table("users").update(upd).eq("id", user_row["id"]).execute()
        else:
            # Yeni kullanıcı — tek canonical format
            insert_data = {
                "phone": canonical,
                "pin_hash": pin_hash,
                "first_name": first_name_val,
                "last_name": last_name_val,
                "city": city_val,
                "name": f"{first_name_val or ''} {last_name_val or ''}".strip(),
                "rating": 5.0,
                "total_ratings": 0,
                "total_trips": 0,
                "is_active": True
            }
            if dev_id:
                insert_data["last_device_id"] = dev_id
            supabase.table("users").insert(insert_data).execute()
        
        logger.info(f"✅ PIN ayarlandı: {canonical}")
        return {"success": True, "message": "PIN ayarlandı"}
    except Exception as e:
        logger.error(f"Set PIN error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# verify-pin endpoint - Frontend uyumluluğu için
@api_router.post("/auth/verify-pin")
async def verify_pin_endpoint(request: Request, phone: str = None, pin: str = None, device_id: str = None):
    """PIN doğrulama - login ile aynı işlevi görür"""
    try:
        if not phone or not pin:
            raise HTTPException(status_code=422, detail="Phone ve PIN gerekli")
        
        canonical = _auth_normalize_or_raise(phone)
        
        # IP adresi al
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not client_ip:
            client_ip = request.headers.get("x-real-ip", "")
        if not client_ip and request.client:
            client_ip = request.client.host
        
        user = _users_get_by_phone_flexible(canonical)
        
        if not user:
            # Login log - başarısız
            try:
                supabase.table("login_logs").insert({
                    "id": str(uuid.uuid4()),
                    "phone": canonical,
                    "ip_address": client_ip,
                    "device_id": device_id,
                    "success": False,
                    "fail_reason": "USER_NOT_FOUND",
                    "country": "TR",
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
            except: pass
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        if not verify_pin(pin, user.get("pin_hash", "")):
            # Login log - başarısız PIN
            try:
                supabase.table("login_logs").insert({
                    "id": str(uuid.uuid4()),
                    "user_id": user["id"],
                    "phone": canonical,
                    "ip_address": client_ip,
                    "device_id": device_id,
                    "success": False,
                    "fail_reason": "WRONG_PIN",
                    "country": "TR",
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
            except: pass
            raise HTTPException(status_code=401, detail="Yanlış PIN")
        
        # Son giriş zamanını ve IP/cihaz bilgisini güncelle
        try:
            supabase.table("users").update({
                "last_login": datetime.utcnow().isoformat(),
                "last_ip": client_ip,
                "last_device_id": device_id,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", user["id"]).execute()
        except Exception as update_err:
            logger.warning(f"Last login update error (ignored): {update_err}")
        
        # Login log - başarılı
        try:
            supabase.table("login_logs").insert({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "phone": canonical,
                "ip_address": client_ip,
                "device_id": device_id,
                "success": True,
                "country": "TR",
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        except: pass
        
        is_admin = _phone_10_for_admin_check(canonical) in ADMIN_PHONE_NUMBERS
        
        logger.info(f"✅ PIN doğrulandı: {canonical}, Admin: {is_admin}, IP: {client_ip}")
        
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "name": user["name"],
                "first_name": user.get("first_name"),
                "last_name": user.get("last_name"),
                "city": user.get("city"),
                "rating": float(user.get("rating", 5.0)),
                "total_trips": user.get("total_trips", 0),
                "profile_photo": user.get("profile_photo"),
                "driver_details": user.get("driver_details"),
                "is_admin": is_admin
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify PIN error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class LoginRequest(BaseModel):
    phone: str
    pin: str
    device_id: Optional[str] = None

@api_router.post("/auth/login")
async def login(request: LoginRequest = None, phone: str = None, pin: str = None, device_id: str = None):
    """PIN ile giriş"""
    try:
        # Body veya query param'dan al
        phone_val = request.phone if request else phone
        pin_val = request.pin if request else pin
        device_val = request.device_id if request else device_id
        
        if not phone_val or not pin_val:
            raise HTTPException(status_code=422, detail="Phone ve PIN gerekli")
        
        canonical = _auth_normalize_or_raise(phone_val)
        user = _users_get_by_phone_flexible(canonical)
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        if not verify_pin(pin_val, user.get("pin_hash", "")):
            raise HTTPException(status_code=401, detail="Yanlış PIN")
        
        # Son giriş güncelle
        supabase.table("users").update({
            "last_login": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user["id"]).execute()
        
        # 🔔 GİRİŞ BİLDİRİMİ - Güvenlik için (arka planda gönder)
        try:
            import asyncio
            asyncio.ensure_future(send_push_notification(
                user["id"],
                "🔐 Hesabınıza Giriş Yapıldı",
                "Siz değilseniz hemen hesabınızı güvene alın!",
                {"type": "login_alert", "timestamp": datetime.utcnow().isoformat()}
            ))
            logger.info(f"🔔 Giriş bildirimi gönderildi: {user['name']}")
        except Exception as notif_err:
            logger.warning(f"⚠️ Giriş bildirimi gönderilemedi: {notif_err}")
        
        is_admin = _phone_10_for_admin_check(canonical) in ADMIN_PHONE_NUMBERS
        
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "name": user["name"],
                "first_name": user.get("first_name"),
                "last_name": user.get("last_name"),
                "city": user.get("city"),
                "rating": float(user.get("rating", 5.0)),
                "total_trips": user.get("total_trips", 0),
                "profile_photo": user.get("profile_photo"),
                "driver_details": user.get("driver_details"),
                "is_admin": is_admin
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin kontrolü endpoint
@api_router.get("/admin/check")
async def check_admin(phone: str = None):
    """Telefon numarasının admin olup olmadığını kontrol et"""
    try:
        if not phone:
            return {"success": False, "is_admin": False}
        
        # TR numara temizle
        cleaned_phone = phone.replace("+90", "").replace("90", "", 1).replace(" ", "").replace("-", "")
        if cleaned_phone.startswith("0"):
            cleaned_phone = cleaned_phone[1:]
        
        is_admin = cleaned_phone in ADMIN_PHONE_NUMBERS
        logger.info(f"🔍 Admin check: {cleaned_phone} -> {is_admin}")
        
        return {"success": True, "is_admin": is_admin, "phone": cleaned_phone}
    except Exception as e:
        logger.error(f"Admin check error: {e}")
        return {"success": False, "is_admin": False}

# Şifremi Unuttum - OTP doğrulandıktan sonra yeni PIN belirleme
class ResetPinRequest(BaseModel):
    phone: str
    new_pin: str

@api_router.post("/auth/reset-pin")
async def reset_pin(request: ResetPinRequest):
    """Şifremi unuttum - Yeni PIN belirle (OTP doğrulandıktan sonra çağrılır)"""
    try:
        canonical = _auth_normalize_or_raise(request.phone)
        
        # PIN uzunluk kontrolü
        if len(request.new_pin) != 6 or not request.new_pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN 6 haneli rakamlardan oluşmalı")
        
        user_row = _users_get_by_phone_flexible(canonical)
        if not user_row:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = user_row
        pin_hash = hash_pin(request.new_pin)
        
        # PIN'i güncelle (+ telefonu canonical yap)
        upd = {
            "pin_hash": pin_hash,
            "updated_at": datetime.utcnow().isoformat()
        }
        if user.get("phone") != canonical:
            upd["phone"] = canonical
        supabase.table("users").update(upd).eq("id", user["id"]).execute()
        
        logger.info(f"🔑 PIN sıfırlandı: {canonical}")
        return {"success": True, "message": "Şifreniz başarıyla güncellendi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset PIN error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin Ekleme endpoint
class AddAdminRequest(BaseModel):
    admin_phone: str  # İşlemi yapan admin
    new_admin_phone: str  # Yeni admin olacak kişi

@api_router.post("/admin/add-admin")
async def add_admin(request: AddAdminRequest):
    """Yeni admin ekle"""
    try:
        # İşlemi yapan admin mi?
        if request.admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        canonical_new = _auth_normalize_or_raise(request.new_admin_phone)
        
        user = _users_get_by_phone_flexible(canonical_new)
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı. Önce kayıt olmalı.")
        
        # is_admin true yap
        supabase.table("users").update({
            "is_admin": True,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user["id"]).execute()
        
        logger.info(f"👑 Yeni admin eklendi: {canonical_new} by {request.admin_phone}")
        return {"success": True, "message": f"{user.get('name', canonical_new)} admin olarak eklendi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add admin error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin Listesi
@api_router.get("/admin/list-admins")
async def list_admins(admin_phone: str):
    """Tüm adminleri listele"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # Veritabanındaki adminler
        result = supabase.table("users").select("id, phone, name, created_at").eq("is_admin", True).execute()
        
        admins = result.data or []
        
        # Hardcoded adminleri de ekle
        for phone in ADMIN_PHONE_NUMBERS:
            if not any(a.get("phone") == phone for a in admins):
                admins.append({"phone": phone, "name": "Sistem Admin", "is_hardcoded": True})
        
        return {"success": True, "admins": admins}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List admins error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Register endpoint - Yeni kullanıcı kaydı
class RegisterRequest(BaseModel):
    phone: str
    name: Optional[str] = None
    city: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    pin: Optional[str] = None
    device_id: Optional[str] = None

@api_router.post("/auth/register")
async def register_user(request: RegisterRequest):
    """Yeni kullanıcı kaydı - KİŞİYE ÖZEL QR KOD İLE - Telefon normalize, cihaz bağlama"""
    try:
        phone_normalized = _auth_normalize_or_raise(request.phone)
        
        # Kullanıcı var mı (905... veya 5XX kayıt)
        existing = None
        for cand in _phone_lookup_candidates(phone_normalized):
            existing = supabase.table("users").select("id").eq("phone", cand).limit(1).execute()
            if existing.data:
                break
        if existing and existing.data:
            raise HTTPException(status_code=400, detail="Bu telefon numarası zaten kayıtlı")
        
        # İsmi oluştur
        first_name = request.first_name or ""
        last_name = request.last_name or ""
        
        if request.name:
            name = request.name
            name_parts = request.name.split()
            if not first_name and name_parts:
                first_name = name_parts[0]
            if not last_name and len(name_parts) > 1:
                last_name = " ".join(name_parts[1:])
        else:
            name = f"{first_name} {last_name}".strip() or "Kullanıcı"
        
        # PIN hash
        pin_hash = None
        if request.pin:
            pin_hash = hash_pin(request.pin)
        
        # 🆕 KİŞİYE ÖZEL SABİT QR KOD OLUŞTUR
        import uuid
        unique_qr_code = f"LEYLEK-{uuid.uuid4().hex[:12].upper()}"
        
        # Yeni kullanıcı oluştur (bir numara–bir cihaz: device_id kaydet)
        user_data = {
            "phone": phone_normalized,
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "city": request.city,
            "pin_hash": pin_hash,
            "points": 100,
            "rating": 5.0,
            "total_ratings": 0,
            "total_trips": 0,
            "is_active": True,
            "personal_qr_code": unique_qr_code
        }
        if request.device_id:
            user_data["last_device_id"] = request.device_id
        
        result = supabase.table("users").insert(user_data).execute()
        
        if result.data:
            user = result.data[0]
            logger.info(f"✅ Yeni kullanıcı kaydedildi: {phone_normalized}, QR: {unique_qr_code}")
            
            return {
                "success": True,
                "user": {
                    "id": user["id"],
                    "phone": user["phone"],
                    "name": user["name"],
                    "first_name": user.get("first_name"),
                    "last_name": user.get("last_name"),
                    "city": user.get("city"),
                    "rating": 5.0,
                    "total_trips": 0,
                    "personal_qr_code": unique_qr_code,
                    "is_admin": _phone_10_for_admin_check(phone_normalized) in ADMIN_PHONE_NUMBERS
                }
            }
        
        raise HTTPException(status_code=500, detail="Kayıt oluşturulamadı")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== USER ENDPOINTS ====================

@api_router.get("/user/{user_id}")
async def get_user(user_id: str):
    """Kullanıcı bilgilerini getir"""
    try:
        result = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = result.data[0]
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "name": user["name"],
                "first_name": user.get("first_name"),
                "last_name": user.get("last_name"),
                "city": user.get("city"),
                "rating": float(user.get("rating", 5.0)),
                "total_trips": user.get("total_trips", 0),
                "profile_photo": user.get("profile_photo"),
                "driver_details": user.get("driver_details")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/user/update-location")
async def update_location(user_id: str, latitude: float, longitude: float):
    """Kullanıcı konumunu güncelle"""
    try:
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(user_id)
        
        supabase.table("users").update({
            "latitude": latitude,
            "longitude": longitude,
            "last_location_update": datetime.utcnow().isoformat()
        }).eq("id", resolved_id).execute()
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Update location error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/user/register-driver")
async def register_driver(
    user_id: str,
    vehicle_model: str,
    vehicle_color: str,
    plate_number: str,
    license_number: str = None
):
    """Şoför kaydı"""
    try:
        driver_details = {
            "vehicle_model": vehicle_model,
            "vehicle_color": vehicle_color,
            "plate_number": plate_number,
            "license_number": license_number,
            "is_verified": False,
            "registered_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("users").update({
            "driver_details": driver_details,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"🚗 Şoför kaydı: {user_id}")
        return {"success": True, "message": "Şoför kaydı tamamlandı"}
    except Exception as e:
        logger.error(f"Register driver error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SÜRÜCÜ KYC SİSTEMİ ====================

class DriverKYCSubmit(BaseModel):
    user_id: str
    vehicle_photo_base64: Optional[str] = None  # Araç fotoğrafı (otomobil)
    license_photo_base64: str  # Ehliyet fotoğrafı
    selfie_photo_base64: Optional[str] = None  # Selfie (yüz görünür) — motor için zorunlu (API validasyonu)
    plate_number: Optional[str] = None
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_kind: Optional[str] = "car"  # car | motorcycle | motor
    motorcycle_photo_base64: Optional[str] = None  # Motor fotoğrafı

@api_router.post("/driver/kyc/submit")
async def submit_driver_kyc(data: DriverKYCSubmit):
    """Sürücü KYC belgelerini gönder"""
    try:
        import base64
        import uuid
        
        user_id = data.user_id
        vk_raw = (data.vehicle_kind or "car").strip().lower()
        is_motorcycle = vk_raw in ("motorcycle", "motor")
        
        # Motor KYC: marka, model, ehliyet, motor foto, selfie zorunlu; plaka opsiyonel
        if is_motorcycle:
            if not (data.vehicle_brand and str(data.vehicle_brand).strip()):
                raise HTTPException(status_code=422, detail="Motor markası gerekli")
            if not (data.vehicle_model and str(data.vehicle_model).strip()):
                raise HTTPException(status_code=422, detail="Motor modeli gerekli")
            if not data.motorcycle_photo_base64:
                raise HTTPException(status_code=422, detail="Motor fotoğrafı gerekli")
            if not data.selfie_photo_base64:
                raise HTTPException(status_code=422, detail="Selfie (yüz fotoğrafı) gerekli")
        else:
            if not (data.plate_number and str(data.plate_number).strip()):
                raise HTTPException(status_code=422, detail="Plaka numarası gerekli")
            if not data.vehicle_photo_base64:
                raise HTTPException(status_code=422, detail="Araç fotoğrafı gerekli")
        
        # Kullanıcıyı kontrol et
        user_result = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user_result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = user_result.data[0]
        
        # driver_details'i güvenli al
        driver_details = user.get("driver_details") or {}
        
        # Zaten onaylı sürücü mü?
        if driver_details.get("kyc_status") == "approved":
            return {"success": False, "message": "Zaten onaylı sürücüsünüz", "kyc_status": "approved"}
        
        # Bekleyen başvuru var mı?
        if driver_details.get("kyc_status") == "pending":
            return {"success": False, "message": "Başvurunuz inceleniyor", "kyc_status": "pending"}
        
        # Fotoğrafları Supabase Storage'a yükle
        license_photo_data = base64.b64decode(data.license_photo_base64.split(",")[-1] if "," in data.license_photo_base64 else data.license_photo_base64)
        
        license_filename = f"kyc/{user_id}/license_{uuid.uuid4().hex[:8]}.jpg"
        
        def _upload(bucket: str, path: str, raw: bytes) -> None:
            try:
                supabase.storage.from_(bucket).upload(path, raw, {"content-type": "image/jpeg"})
            except Exception as e:
                logger.warning(f"Storage upload error: {e}")
                try:
                    supabase.storage.create_bucket(bucket, {"public": True})
                except Exception:
                    pass
                supabase.storage.from_(bucket).upload(path, raw, {"content-type": "image/jpeg"})
        
        _upload("vehicle-photos", license_filename, license_photo_data)
        license_url = supabase.storage.from_("vehicle-photos").get_public_url(license_filename)
        
        vehicle_url = None
        motorcycle_url = None
        if is_motorcycle:
            motor_data = base64.b64decode(
                data.motorcycle_photo_base64.split(",")[-1]
                if "," in data.motorcycle_photo_base64
                else data.motorcycle_photo_base64
            )
            motor_filename = f"kyc/{user_id}/motorcycle_{uuid.uuid4().hex[:8]}.jpg"
            _upload("vehicle-photos", motor_filename, motor_data)
            motorcycle_url = supabase.storage.from_("vehicle-photos").get_public_url(motor_filename)
        else:
            vehicle_photo_data = base64.b64decode(
                data.vehicle_photo_base64.split(",")[-1]
                if "," in data.vehicle_photo_base64
                else data.vehicle_photo_base64
            )
            vehicle_filename = f"kyc/{user_id}/vehicle_{uuid.uuid4().hex[:8]}.jpg"
            _upload("vehicle-photos", vehicle_filename, vehicle_photo_data)
            vehicle_url = supabase.storage.from_("vehicle-photos").get_public_url(vehicle_filename)
        
        selfie_url = None
        if data.selfie_photo_base64:
            selfie_data = base64.b64decode(data.selfie_photo_base64.split(",")[-1] if "," in data.selfie_photo_base64 else data.selfie_photo_base64)
            selfie_filename = f"kyc/{user_id}/selfie_{uuid.uuid4().hex[:8]}.jpg"
            _upload("vehicle-photos", selfie_filename, selfie_data)
            selfie_url = supabase.storage.from_("vehicle-photos").get_public_url(selfie_filename)
        
        driver_details = user.get("driver_details") or {}
        driver_details.update({
            "vehicle_kind": "motorcycle" if is_motorcycle else "car",
            "kyc_vehicle_kind": "motorcycle" if is_motorcycle else "car",
            "plate_number": (data.plate_number or "").strip().upper() if data.plate_number else None,
            "license_photo_url": license_url,
            "vehicle_brand": data.vehicle_brand,
            "vehicle_model": data.vehicle_model,
            "vehicle_year": data.vehicle_year,
            "vehicle_color": data.vehicle_color,
            "kyc_status": "pending",
            "kyc_submitted_at": datetime.utcnow().isoformat(),
            "is_verified": False,
        })
        if vehicle_url:
            driver_details["vehicle_photo_url"] = vehicle_url
        if motorcycle_url:
            driver_details["motorcycle_photo_url"] = motorcycle_url
            driver_details.pop("vehicle_photo_url", None)
        if selfie_url:
            driver_details["selfie_url"] = selfie_url
        
        supabase.table("users").update({
            "driver_details": driver_details,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"🚗 KYC başvurusu: {user_id} - kind={'motor' if is_motorcycle else 'car'} plaka={data.plate_number!r}")
        return {
            "success": True, 
            "message": "Başvurunuz alındı. İnceleme sonrası bilgilendirileceksiniz.",
            "kyc_status": "pending"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"KYC submit error: {e}")
        logger.error(f"KYC traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/driver/kyc/status")
async def get_driver_kyc_status(user_id: str):
    """Sürücü KYC durumunu kontrol et. Admin numaraları KYC olmadan sürücü sayılır."""
    try:
        result = supabase.table("users").select("phone, driver_details").eq("id", user_id).execute()
        if not result.data:
            return {"kyc_status": "none", "is_driver": False}
        
        user = result.data[0]
        phone = (user.get("phone") or "").replace("+90", "").replace(" ", "").replace("-", "")
        # Admin numaraları KYC olmadan sürücü olarak girebilir
        if phone in ADMIN_PHONE_NUMBERS:
            return {
                "kyc_status": "approved",
                "is_driver": True,
                "is_verified": True,
                "rejection_reason": None,
                "submitted_at": None
            }
        
        driver_details = user.get("driver_details") or {}
        kyc_status = driver_details.get("kyc_status", "none")
        is_verified = driver_details.get("is_verified", False)
        
        return {
            "kyc_status": kyc_status,
            "is_driver": kyc_status == "approved" and is_verified,
            "is_verified": is_verified,
            "rejection_reason": driver_details.get("kyc_rejection_reason"),
            "submitted_at": driver_details.get("kyc_submitted_at")
        }
    except Exception as e:
        logger.error(f"KYC status error: {e}")
        return {"kyc_status": "none", "is_driver": False}

@api_router.get("/admin/kyc/pending")
async def get_pending_kyc_requests(admin_phone: str):
    """Admin: Bekleyen KYC başvurularını getir"""
    # Admin kontrolü
    if admin_phone.replace("+90", "").replace(" ", "") not in ["5326497412"]:
        raise HTTPException(status_code=403, detail="Yetkisiz erişim")
    
    try:
        # Bekleyen KYC'leri getir
        result = supabase.table("users").select("id, name, phone, driver_details, created_at").not_.is_("driver_details", "null").execute()
        
        pending_kycs = []
        for user in result.data:
            driver_details = user.get("driver_details") or {}
            if driver_details.get("kyc_status") == "pending":
                pending_kycs.append({
                    "user_id": user["id"],
                    "name": user["name"],
                    "phone": user["phone"],
                    "plate_number": driver_details.get("plate_number"),
                    "vehicle_brand": driver_details.get("vehicle_brand"),
                    "vehicle_model": driver_details.get("vehicle_model"),
                    "vehicle_year": driver_details.get("vehicle_year"),
                    "vehicle_color": driver_details.get("vehicle_color"),
                    "vehicle_kind": driver_details.get("vehicle_kind"),
                    "vehicle_photo_url": driver_details.get("vehicle_photo_url"),
                    "motorcycle_photo_url": driver_details.get("motorcycle_photo_url"),
                    "license_photo_url": driver_details.get("license_photo_url"),
                    "selfie_url": driver_details.get("selfie_url"),
                    "submitted_at": driver_details.get("kyc_submitted_at")
                })
        
        return {"success": True, "pending_count": len(pending_kycs), "requests": pending_kycs}
    except Exception as e:
        logger.error(f"Get pending KYC error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/kyc/approve")
async def approve_driver_kyc(admin_phone: str, user_id: str):
    """Admin: Sürücü KYC'yi onayla. Tüm yeni kayıtlara 2 ay ücretsiz driver_active_until atanır."""
    if admin_phone.replace("+90", "").replace(" ", "") not in ["5326497412", "5354169632"]:
        raise HTTPException(status_code=403, detail="Yetkisiz erişim")
    
    try:
        result = supabase.table("users").select("driver_details, name, push_token").eq("id", user_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = result.data[0]
        driver_details = user.get("driver_details") or {}
        driver_details.update({
            "kyc_status": "approved",
            "is_verified": True,
            "kyc_approved_at": datetime.utcnow().isoformat()
        })
        
        # Yeni kayıtlar: 2 ay ücretsiz (tüm onaylanan sürücülere)
        now = datetime.utcnow()
        active_until = (now + timedelta(days=60)).isoformat()
        
        supabase.table("users").update({
            "driver_details": driver_details,
            "driver_active_until": active_until,
            "updated_at": now.isoformat()
        }).eq("id", user_id).execute()
        
        # Push bildirim gönder
        push_token = user.get("push_token")
        if push_token:
            try:
                await send_push_notification(
                    user_id,
                    "✅ Sürücü Kaydınız Onaylandı!",
                    "Artık sürücü olarak çalışabilirsiniz. Yolcuları bekliyoruz!",
                    {"type": "kyc_approved"}
                )
            except:
                pass
        
        logger.info(f"✅ KYC onaylandı: {user_id} - {user.get('name')}")
        return {"success": True, "message": "Sürücü kaydı onaylandı"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Approve KYC error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/kyc/reject")
async def reject_driver_kyc(admin_phone: str, user_id: str, reason: str = "Belgeler uygun değil"):
    """Admin: Sürücü KYC'yi reddet"""
    if admin_phone.replace("+90", "").replace(" ", "") not in ["5326497412"]:
        raise HTTPException(status_code=403, detail="Yetkisiz erişim")
    
    try:
        result = supabase.table("users").select("driver_details, name, push_token").eq("id", user_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = result.data[0]
        driver_details = user.get("driver_details") or {}
        driver_details.update({
            "kyc_status": "rejected",
            "is_verified": False,
            "kyc_rejection_reason": reason,
            "kyc_rejected_at": datetime.utcnow().isoformat()
        })
        
        supabase.table("users").update({
            "driver_details": driver_details,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        # Push bildirim gönder
        push_token = user.get("push_token")
        if push_token:
            try:
                await send_push_notification(
                    user_id,
                    "❌ Sürücü Başvurunuz Reddedildi",
                    f"Sebep: {reason}. Lütfen tekrar başvurun.",
                    {"type": "kyc_rejected"}
                )
            except:
                pass
        
        logger.info(f"❌ KYC reddedildi: {user_id} - Sebep: {reason}")
        return {"success": True, "message": "Sürücü kaydı reddedildi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reject KYC error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/kyc/all")
async def get_all_kyc_requests(admin_phone: str):
    """Admin: Tüm KYC başvurularını getir (pending, approved, rejected)"""
    if admin_phone.replace("+90", "").replace(" ", "") not in ["5326497412"]:
        raise HTTPException(status_code=403, detail="Yetkisiz erişim")
    
    try:
        result = supabase.table("users").select("id, name, phone, driver_details, created_at").not_.is_("driver_details", "null").execute()
        
        pending_kycs = []
        approved_kycs = []
        rejected_kycs = []
        
        for user in result.data:
            driver_details = user.get("driver_details") or {}
            kyc_status = driver_details.get("kyc_status")
            
            if kyc_status in ["pending", "approved", "rejected"]:
                kyc_data = {
                    "user_id": user["id"],
                    "name": user["name"],
                    "phone": user["phone"],
                    "plate_number": driver_details.get("plate_number"),
                    "vehicle_brand": driver_details.get("vehicle_brand"),
                    "vehicle_model": driver_details.get("vehicle_model"),
                    "vehicle_year": driver_details.get("vehicle_year"),
                    "vehicle_color": driver_details.get("vehicle_color"),
                    "vehicle_photo_url": driver_details.get("vehicle_photo_url"),
                    "license_photo_url": driver_details.get("license_photo_url"),
                    "selfie_url": driver_details.get("selfie_url"),
                    "submitted_at": driver_details.get("kyc_submitted_at"),
                    "kyc_status": kyc_status
                }
                
                if kyc_status == "pending":
                    pending_kycs.append(kyc_data)
                elif kyc_status == "approved":
                    kyc_data["approved_at"] = driver_details.get("kyc_approved_at")
                    approved_kycs.append(kyc_data)
                elif kyc_status == "rejected":
                    kyc_data["rejected_at"] = driver_details.get("kyc_rejected_at")
                    kyc_data["rejection_reason"] = driver_details.get("kyc_rejection_reason")
                    rejected_kycs.append(kyc_data)
        
        return {
            "success": True,
            "pending": pending_kycs,
            "approved": approved_kycs,
            "rejected": rejected_kycs,
            "counts": {
                "pending": len(pending_kycs),
                "approved": len(approved_kycs),
                "rejected": len(rejected_kycs)
            }
        }
    except Exception as e:
        logger.error(f"Get all KYC error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== BLOCKING SYSTEM ====================

@api_router.post("/user/block")
async def block_user(user_id: str, blocked_user_id: str, reason: str = None):
    """Kullanıcı engelle"""
    try:
        supabase.table("blocked_users").insert({
            "user_id": user_id,
            "blocked_user_id": blocked_user_id,
            "reason": reason
        }).execute()
        
        return {"success": True, "message": "Kullanıcı engellendi"}
    except Exception as e:
        if "duplicate" in str(e).lower():
            return {"success": True, "message": "Zaten engellenmiş"}
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/user/unblock")
async def unblock_user(user_id: str, blocked_user_id: str):
    """Engeli kaldır"""
    try:
        supabase.table("blocked_users").delete().eq("user_id", user_id).eq("blocked_user_id", blocked_user_id).execute()
        return {"success": True, "message": "Engel kaldırıldı"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/user/blocked-list")
async def get_blocked_list(user_id: str):
    """Engellenen kullanıcılar listesi"""
    try:
        result = supabase.table("blocked_users").select("blocked_user_id").eq("user_id", user_id).execute()
        blocked_ids = [r["blocked_user_id"] for r in result.data]
        return {"success": True, "blocked_users": blocked_ids}
    except Exception as e:
        logger.error(f"Get blocked list error: {e}")
        return {"success": False, "blocked_users": []}

# ==================== REPORT (ŞİKAYET) SYSTEM ====================

@api_router.post("/user/report")
async def report_user(user_id: str, reported_user_id: str, reason: str = "other", details: str = None, tag_id: str = None):
    """Kullanıcı şikayet et - Supabase'e kaydet, Admin görsün"""
    try:
        # Şikayet eden kullanıcı bilgisi
        reporter_result = supabase.table("users").select("name, phone").eq("id", user_id).execute()
        reporter_info = reporter_result.data[0] if reporter_result.data else {}
        
        # Şikayet edilen kullanıcı bilgisi
        reported_result = supabase.table("users").select("name, phone, driver_details").eq("id", reported_user_id).execute()
        reported_info = reported_result.data[0] if reported_result.data else {}
        
        # Role belirleme
        reported_role = "driver" if reported_info.get("driver_details") else "passenger"
        
        # Şikayeti kaydet
        report_data = {
            "reporter_id": user_id,
            "reporter_name": reporter_info.get("name", "Bilinmeyen"),
            "reporter_phone": reporter_info.get("phone", ""),
            "reported_user_id": reported_user_id,
            "reported_user_name": reported_info.get("name", "Bilinmeyen"),
            "reported_user_phone": reported_info.get("phone", ""),
            "reported_user_role": reported_role,
            "reason": reason,
            "details": details,
            "tag_id": tag_id,
            "status": "pending",  # pending, reviewed, resolved, dismissed
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("reports").insert(report_data).execute()
        
        logger.info(f"⚠️ Şikayet kaydedildi: {user_id} -> {reported_user_id} ({reason})")
        return {"success": True, "message": "Şikayetiniz alındı. Admin inceleyecek.", "report_id": result.data[0]["id"] if result.data else None}
    except Exception as e:
        logger.error(f"Report user error: {e}")
        # Tablo yoksa oluşturmayı dene
        if "reports" in str(e).lower() and "does not exist" in str(e).lower():
            return {"success": True, "message": "Şikayetiniz alındı. (Tablo oluşturulacak)"}
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/reports")
async def get_all_reports(status: str = None, limit: int = 50):
    """Admin: Tüm şikayetleri getir"""
    try:
        query = supabase.table("reports").select("*").order("created_at", desc=True).limit(limit)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return {"success": True, "reports": result.data}
    except Exception as e:
        logger.error(f"Get reports error: {e}")
        return {"success": True, "reports": []}

@api_router.post("/admin/reports/{report_id}/update")
async def update_report_status(report_id: str, status: str, admin_notes: str = None):
    """Admin: Şikayet durumunu güncelle"""
    try:
        update_data = {
            "status": status,
            "reviewed_at": datetime.utcnow().isoformat()
        }
        if admin_notes:
            update_data["admin_notes"] = admin_notes
        
        supabase.table("reports").update(update_data).eq("id", report_id).execute()
        return {"success": True, "message": "Şikayet durumu güncellendi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        return {"success": False, "blocked_users": []}

# ==================== PASSENGER ENDPOINTS ====================

class CreateTagRequest(BaseModel):
    passenger_id: Optional[str] = None
    user_id: Optional[str] = None
    pickup_location: str
    pickup_lat: float
    pickup_lng: float
    dropoff_location: str
    dropoff_lat: float
    dropoff_lng: float
    notes: Optional[str] = None
    destination: Optional[str] = None  # alias for dropoff_location

@api_router.post("/passenger/create-tag")
async def create_tag(request: CreateTagRequest, user_id: str = None):
    """Yolcu TAG oluştur"""
    try:
        # Query param, body veya request'ten user_id al
        pid = user_id or request.passenger_id or request.user_id
        if not pid:
            raise HTTPException(status_code=422, detail="passenger_id veya user_id gerekli")
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(pid)
        
        # Kullanıcı bilgisi
        user_result = supabase.table("users").select("name, city").eq("id", resolved_id).execute()
        user = user_result.data[0] if user_result.data else {}
        
        # Share link oluştur
        share_link = f"leylek://trip/{secrets.token_urlsafe(8)}"
        
        tag_data = {
            "passenger_id": resolved_id,
            "passenger_name": user.get("name"),
            "pickup_location": request.pickup_location,
            "pickup_lat": request.pickup_lat,
            "pickup_lng": request.pickup_lng,
            "dropoff_location": request.dropoff_location or request.destination,
            "dropoff_lat": request.dropoff_lat,
            "dropoff_lng": request.dropoff_lng,
            "notes": request.notes,
            "city": user.get("city"),
            "status": "pending",
            "share_link": share_link
        }
        
        result = supabase.table("tags").insert(tag_data).execute()
        
        if result.data:
            logger.info(f"🏷️ TAG oluşturuldu: {result.data[0]['id']}")
            return {
                "success": True,
                "tag": result.data[0],
                "share_link": share_link
            }
        
        raise HTTPException(status_code=500, detail="TAG oluşturulamadı")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create tag error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Geçmiş Yolculuklar endpoint'i
@api_router.get("/passenger/history")
async def get_passenger_history(user_id: str, limit: int = 20):
    """Yolcunun geçmiş yolculuklarını getir"""
    try:
        resolved_id = await resolve_user_id(user_id)
        
        result = supabase.table("tags").select("*").eq("passenger_id", resolved_id).in_("status", ["completed", "cancelled"]).order("created_at", desc=True).limit(limit).execute()
        
        trips = []
        for tag in result.data:
            trips.append({
                "id": tag["id"],
                "pickup": tag.get("pickup_location", ""),
                "dropoff": tag.get("dropoff_location", ""),
                "driver_name": tag.get("driver_name", "Bilinmiyor"),
                "price": tag.get("final_price", 0),
                "status": tag.get("status"),
                "date": tag.get("completed_at") or tag.get("cancelled_at") or tag.get("created_at"),
                "rating": tag.get("passenger_rating", 0)
            })
        
        return {"success": True, "trips": trips}
    except Exception as e:
        logger.error(f"Get history error: {e}")
        return {"success": False, "trips": []}

@api_router.get("/driver/history")
async def get_driver_history(user_id: str, limit: int = 20):
    """Şoförün geçmiş yolculuklarını getir"""
    try:
        resolved_id = await resolve_user_id(user_id)
        
        result = supabase.table("tags").select("*").eq("driver_id", resolved_id).in_("status", ["completed", "cancelled"]).order("created_at", desc=True).limit(limit).execute()
        
        trips = []
        for tag in result.data:
            trips.append({
                "id": tag["id"],
                "pickup": tag.get("pickup_location", ""),
                "dropoff": tag.get("dropoff_location", ""),
                "passenger_name": tag.get("passenger_name", "Bilinmiyor"),
                "price": tag.get("final_price", 0),
                "status": tag.get("status"),
                "date": tag.get("completed_at") or tag.get("cancelled_at") or tag.get("created_at"),
                "rating": tag.get("driver_rating", 0)
            })
        
        return {"success": True, "trips": trips}
    except Exception as e:
        logger.error(f"Get driver history error: {e}")
        return {"success": False, "trips": []}

# Profil Güncelleme endpoint'i
class UpdateProfileRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    city: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

@api_router.post("/user/update-profile")
async def update_user_profile(request: UpdateProfileRequest):
    """Kullanıcı profilini güncelle"""
    try:
        resolved_id = await resolve_user_id(request.user_id)
        
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        
        if request.name:
            update_data["name"] = request.name
            # İsim-soyisim ayır
            name_parts = request.name.split()
            if len(name_parts) >= 2:
                update_data["first_name"] = name_parts[0]
                update_data["last_name"] = " ".join(name_parts[1:])
            else:
                update_data["first_name"] = request.name
        
        if request.first_name:
            update_data["first_name"] = request.first_name
        if request.last_name:
            update_data["last_name"] = request.last_name
        if request.city:
            update_data["city"] = request.city
        
        supabase.table("users").update(update_data).eq("id", resolved_id).execute()
        
        logger.info(f"✅ Profil güncellendi: {resolved_id}")
        return {"success": True, "message": "Profil güncellendi"}
    except Exception as e:
        logger.error(f"Update profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/user/set-ride-vehicle-kind")
async def set_ride_vehicle_kind(user_id: str, role: str, vehicle_kind: str):
    """
    Rol ekranı: yolcu tercihi (araç/motor) veya sürücü kullandığı araç tipi.
    driver_details JSON içinde saklanır (yolcu için passenger_preferred_vehicle, sürücü için vehicle_kind).
    """
    try:
        if vehicle_kind not in ("car", "motorcycle"):
            raise HTTPException(status_code=422, detail="vehicle_kind: car veya motorcycle olmalı")
        if role not in ("passenger", "driver"):
            raise HTTPException(status_code=422, detail="role: passenger veya driver olmalı")
        resolved_id = await resolve_user_id(user_id)
        res = supabase.table("users").select("driver_details").eq("id", resolved_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        row = res.data[0]
        dd = row.get("driver_details")
        if not isinstance(dd, dict):
            dd = {}
        if role == "driver":
            dd["vehicle_kind"] = vehicle_kind
        else:
            dd["passenger_preferred_vehicle"] = vehicle_kind
        supabase.table("users").update({
            "driver_details": dd,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", resolved_id).execute()
        logger.info(f"✅ ride vehicle kind: user={resolved_id} role={role} kind={vehicle_kind}")
        return {"success": True, "driver_details": dd}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"set_ride_vehicle_kind error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Frontend uyumluluğu için alias
@api_router.post("/passenger/create-request")
async def create_request_alias(request: CreateTagRequest, user_id: str = None):
    """Yolcu TAG oluştur (alias)"""
    return await create_tag(request, user_id)

@api_router.get("/trip/{tag_id}")
async def get_trip_status(tag_id: str):
    """Yolculuk durumunu al - polling için"""
    try:
        result = supabase.table("tags").select("*").eq("id", tag_id).execute()
        if result.data:
            return {"success": True, "tag": result.data[0]}
        return {"success": False, "error": "Trip bulunamadı"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@api_router.get("/passenger/active-tag")
async def get_active_tag(passenger_id: str = None, user_id: str = None):
    """Aktif TAG getir - önce aktif tag'leri kontrol et"""
    try:
        # Arka planda inaktif TAG'leri temizle
        await auto_cleanup_inactive_tags()
        
        # passenger_id veya user_id kabul et
        uid = passenger_id or user_id
        if not uid:
            return {"success": False, "tag": None, "detail": "user_id gerekli"}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(uid)
        
        # ÖNCELİK 1: Aktif tag'leri ara (waiting, matched, in_progress)
        result = supabase.table("tags").select("*").eq("passenger_id", resolved_id).in_("status", ["waiting", "pending", "offers_received", "matched", "in_progress"]).order("created_at", desc=True).limit(1).execute()
        
        if result.data:
            tag = result.data[0]
            
            # Eğer şoför atandıysa, şoförün konumunu al
            driver_location = None
            if tag.get("driver_id"):
                driver_result = supabase.table("users").select("latitude, longitude, name").eq("id", tag["driver_id"]).execute()
                if driver_result.data and driver_result.data[0].get("latitude"):
                    driver_location = {
                        "latitude": float(driver_result.data[0]["latitude"]),
                        "longitude": float(driver_result.data[0]["longitude"])
                    }
            
            # TAG'e driver_location ekle
            tag["driver_location"] = driver_location
            
            return {"success": True, "tag": tag}
        
        # ÖNCELİK 2: Aktif tag yoksa, son 10 saniyede cancelled olmuş TAG kontrol et
        # (Sadece trip bittiğinde bir kez uyarı göstermek için)
        from datetime import timedelta
        ten_seconds_ago = (datetime.utcnow() - timedelta(seconds=10)).isoformat()
        
        cancelled_result = supabase.table("tags").select("*").eq("passenger_id", resolved_id).eq("status", "cancelled").gte("cancelled_at", ten_seconds_ago).order("cancelled_at", desc=True).limit(1).execute()
        
        if cancelled_result.data:
            cancelled_tag = cancelled_result.data[0]
            logger.info(f"🛑 Cancelled TAG bulundu (10sn içinde): {cancelled_tag['id']}")
            return {"success": True, "tag": cancelled_tag, "was_cancelled": True}
        
        return {"success": True, "tag": None}
    except Exception as e:
        logger.error(f"Get active tag error: {e}")
        return {"success": False, "tag": None}

@api_router.get("/passenger/offers")
async def get_offers_for_passenger(passenger_id: str = None, user_id: str = None, tag_id: str = None):
    """TAG için gelen teklifleri getir - mesafe ve süre bilgileriyle birlikte"""
    try:
        pid = passenger_id or user_id
        if not pid or not tag_id:
            return {"success": False, "offers": [], "detail": "user_id ve tag_id gerekli"}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(pid)
        
        # Engellenen kullanıcıları al
        blocked_result = supabase.table("blocked_users").select("blocked_user_id").eq("user_id", resolved_id).execute()
        blocked_ids = [r["blocked_user_id"] for r in blocked_result.data]
        
        # Beni engelleyenleri al
        blocked_by_result = supabase.table("blocked_users").select("user_id").eq("blocked_user_id", resolved_id).execute()
        blocked_by_ids = [r["user_id"] for r in blocked_by_result.data]
        
        all_blocked = list(set(blocked_ids + blocked_by_ids))
        
        # Teklifleri getir
        query = supabase.table("offers").select("*, users!offers_driver_id_fkey(name, rating, profile_photo, driver_details)").eq("tag_id", tag_id).eq("status", "pending")
        
        result = query.execute()
        
        offers = []
        for offer in result.data:
            # Engelli kontrolü
            if offer.get("driver_id") in all_blocked:
                continue
            
            driver_info = offer.get("users", {}) or {}
            offers.append({
                "id": offer["id"],
                "driver_id": offer["driver_id"],
                "driver_name": driver_info.get("name", "Şoför"),
                "driver_rating": float(driver_info.get("rating", 5.0)),
                "driver_photo": driver_info.get("profile_photo"),
                "price": float(offer["price"]),
                "status": offer["status"],
                "vehicle_model": driver_info.get("driver_details", {}).get("vehicle_model") if driver_info.get("driver_details") else None,
                "vehicle_color": driver_info.get("driver_details", {}).get("vehicle_color") if driver_info.get("driver_details") else None,
                # Mesafe ve süre bilgileri - ŞOFÖRÜN GÖNDERDİĞİ DEĞERLERİ KULLAN
                "distance_to_passenger_km": float(offer.get("distance_to_passenger_km")) if offer.get("distance_to_passenger_km") else None,
                "estimated_arrival_min": int(offer.get("estimated_arrival_min")) if offer.get("estimated_arrival_min") else None,
                "trip_distance_km": float(offer.get("trip_distance_km")) if offer.get("trip_distance_km") else None,
                "trip_duration_min": int(offer.get("trip_duration_min")) if offer.get("trip_duration_min") else None,
                "notes": offer.get("notes"),
                "created_at": offer["created_at"]
            })
        
        return {"success": True, "offers": offers}
    except Exception as e:
        logger.error(f"Get offers error: {e}")
        return {"success": False, "offers": []}

# Path parameter ile offers endpoint'i (frontend uyumluluğu)
@api_router.get("/passenger/offers/{tag_id}")
async def get_offers_for_passenger_by_path(tag_id: str, passenger_id: str = None, user_id: str = None):
    """TAG için gelen teklifleri getir (path param)"""
    return await get_offers_for_passenger(passenger_id, user_id, tag_id)

class AcceptOfferRequest(BaseModel):
    tag_id: Optional[str] = None
    offer_id: str

@api_router.post("/passenger/accept-offer")
async def accept_offer(request: AcceptOfferRequest = None, user_id: str = None, passenger_id: str = None, offer_id: str = None, driver_id: str = None, tag_id: str = None):
    """Teklifi kabul et - driver_id+tag_id ile çalışır (offer_id opsiyonel)"""
    try:
        # Body veya query param'dan al
        oid = request.offer_id if request else offer_id
        did = driver_id
        tid = tag_id
        
        logger.info(f"🔍 Accept offer request: offer_id={oid}, driver_id={did}, tag_id={tid}")
        
        offer = None
        
        # 1. ÖNCE driver_id + tag_id ile bul (en güvenilir yol)
        if did and tid:
            logger.info(f"🔍 Teklif aranıyor: driver_id={did}, tag_id={tid}")
            offer_result = supabase.table("offers").select("*").eq("driver_id", did).eq("tag_id", tid).eq("status", "pending").execute()
            if offer_result.data:
                offer = offer_result.data[0]
                oid = offer["id"]
                logger.info(f"✅ Teklif bulundu (driver+tag): {oid}")
        
        # 2. driver_id + tag_id ile bulunamazsa, sadece tag_id ile en son teklifi bul
        if not offer and tid:
            logger.info(f"🔍 Son teklif aranıyor: tag_id={tid}")
            offer_result = supabase.table("offers").select("*").eq("tag_id", tid).eq("status", "pending").order("created_at", desc=True).limit(1).execute()
            if offer_result.data:
                offer = offer_result.data[0]
                oid = offer["id"]
                logger.info(f"✅ Son teklif bulundu (tag): {oid}")
        
        # 3. Hala bulunamazsa ve offer_id UUID formatındaysa dene
        if not offer and oid and not oid.startswith("offer_"):
            try:
                offer_result = supabase.table("offers").select("*").eq("id", oid).execute()
                if offer_result.data:
                    offer = offer_result.data[0]
                    logger.info(f"✅ Teklif bulundu (uuid): {oid}")
            except:
                pass
        
        if not offer:
            logger.error(f"❌ Teklif bulunamadı: offer_id={oid}, driver_id={did}, tag_id={tid}")
            raise HTTPException(status_code=404, detail="Teklif bulunamadı")
        
        tag_id_final = offer["tag_id"]
        driver_id_final = offer["driver_id"]
        real_offer_id = offer["id"]
        
        # TAG'i çek (passenger_id, pickup_lat/lng vs. için gerekli - önceden yoktu, bildirim hataya düşüyordu)
        tag_result = supabase.table("tags").select("*").eq("id", tag_id_final).limit(1).execute()
        tag = tag_result.data[0] if tag_result.data else {}
        
        # Şoför bilgisi
        driver_result = supabase.table("users").select("name").eq("id", driver_id_final).execute()
        driver_name = driver_result.data[0]["name"] if driver_result.data else "Şoför"
        passenger_id_final = tag.get("passenger_id")
        passenger_name = "Yolcu"
        if passenger_id_final:
            passenger_result = supabase.table("users").select("name").eq("id", passenger_id_final).execute()
            if passenger_result.data:
                passenger_name = passenger_result.data[0].get("name", "Yolcu")
        
        # Teklifi kabul et
        supabase.table("offers").update({"status": "accepted"}).eq("id", real_offer_id).execute()
        
        # Diğer teklifleri reddet
        supabase.table("offers").update({"status": "rejected"}).eq("tag_id", tag_id_final).neq("id", real_offer_id).execute()
        
        # TAG'i güncelle
        supabase.table("tags").update({
            "status": "matched",
            "driver_id": driver_id_final,
            "driver_name": driver_name,
            "accepted_offer_id": real_offer_id,
            "final_price": offer["price"],
            "matched_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id_final).execute()

        match_payload = {
            "tag_id": tag_id_final,
            "offer_id": real_offer_id,
            "passenger_id": passenger_id_final,
            "passenger_name": passenger_name,
            "driver_id": driver_id_final,
            "driver_name": driver_name,
            "pickup_location": tag.get("pickup_location"),
            "dropoff_location": tag.get("dropoff_location"),
            "pickup_lat": tag.get("pickup_lat"),
            "pickup_lng": tag.get("pickup_lng"),
            "dropoff_lat": tag.get("dropoff_lat"),
            "dropoff_lng": tag.get("dropoff_lng"),
            "offered_price": offer.get("price"),
            "status": "matched",
        }

        # Eşleşme bildirimini her iki tarafa da socket ile anında gönder (sid veya normalized room)
        try:
            driver_room = _normalize_user_room(driver_id_final)
            driver_sid = connected_users.get(str(driver_id_final).strip().lower()) or connected_users.get(driver_id_final)
            driver_target = driver_sid if driver_sid else driver_room
            passenger_target = None
            if driver_target:
                await sio.emit("offer_accepted", match_payload, room=driver_target)
                await sio.emit("tag_matched", match_payload, room=driver_target)
            if passenger_id_final:
                passenger_room = _normalize_user_room(passenger_id_final)
                passenger_sid = connected_users.get(str(passenger_id_final).strip().lower()) or connected_users.get(passenger_id_final)
                passenger_target = passenger_sid if passenger_sid else passenger_room
                if passenger_target:
                    await sio.emit("tag_matched", match_payload, room=passenger_target)
            logger.info(f"✅ Eşleşme socket: driver={driver_target or 'yok'}, passenger={passenger_target or 'yok'}")
        except Exception as socket_err:
            logger.warning(f"⚠️ Eşleşme socket emit hatası: {socket_err}")

        # Eşleşme tam bu anda – güncel tag'den sürücü/yolcu id'leri ile ikisine bildirim (teklif bildirimiyle aynı yol)
        push_result = await send_match_notification_to_both(tag_id_final, driver_id_final, passenger_id_final)

        logger.info(f"✅ Teklif kabul edildi: {real_offer_id} - Driver: {driver_id_final}")
        resp = {"success": True, "message": "Teklif kabul edildi", "driver_id": driver_id_final, "offer_id": real_offer_id}
        resp["push_sent"] = {"driver": push_result["driver"], "passenger": push_result["passenger"]}
        return resp
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Accept offer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class CancelTagRequest(BaseModel):
    tag_id: str

@api_router.delete("/passenger/cancel-tag")
async def cancel_tag_delete(tag_id: str, passenger_id: str = None, user_id: str = None):
    """TAG iptal et (DELETE)"""
    try:
        pid = passenger_id or user_id
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(pid) if pid else None

        tag_check = supabase.table("tags").select("created_at").eq("id", tag_id).limit(1).execute()
        tag = tag_check.data[0] if tag_check.data else {}
        created_at = tag.get("created_at")
        if created_at:
            created = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if (now - created).total_seconds() < 20:
                logger.info("AUTO_CANCEL_BLOCKED (<20s)")
                return {"success": False, "message": "Too early cancel blocked"}
        
        update_query = supabase.table("tags").update({
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id)
        
        if resolved_id:
            update_query = update_query.eq("passenger_id", resolved_id)
        
        update_query.execute()

        try:
            q_mem = dispatch_queues.get(tag_id, [])
            for e in q_mem:
                if e.get("status") == "sent":
                    await emit_passenger_offer_revoked(e["driver_id"], tag_id)
            for key in list(active_dispatch_tasks.keys()):
                if key.startswith(f"{tag_id}_"):
                    tsk = active_dispatch_tasks.pop(key, None)
                    if tsk and not tsk.done():
                        tsk.cancel()
            dispatch_queues.pop(tag_id, None)
            dispatch_tag_context.pop(tag_id, None)
            supabase.table("dispatch_queue").delete().eq("tag_id", tag_id).execute()
        except Exception:
            pass
        try:
            await rolling_dispatch_stop(tag_id, revoke_offers=True)
        except Exception:
            pass
        
        return {"success": True, "message": "TAG iptal edildi"}
    except Exception as e:
        logger.error(f"Cancel tag error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# POST method için alias (frontend uyumluluğu)
@api_router.post("/passenger/cancel-tag")
async def cancel_tag_post(request: CancelTagRequest = None, tag_id: str = None, passenger_id: str = None, user_id: str = None):
    """TAG iptal et (POST) - TÜM SÜRÜCÜLERE ANINDA BİLDİR"""
    try:
        tid = request.tag_id if request else tag_id
        pid = passenger_id or user_id
        
        if not tid:
            raise HTTPException(status_code=422, detail="tag_id gerekli")
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(pid) if pid else None

        tag_check = supabase.table("tags").select("created_at").eq("id", tid).limit(1).execute()
        tag = tag_check.data[0] if tag_check.data else {}
        created_at = tag.get("created_at")
        if created_at:
            created = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if (now - created).total_seconds() < 20:
                logger.info("AUTO_CANCEL_BLOCKED (<20s)")
                return {"success": False, "message": "Too early cancel blocked"}
        
        # 1. TAG'i iptal et
        update_query = supabase.table("tags").update({
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat()
        }).eq("id", tid)
        
        if resolved_id:
            update_query = update_query.eq("passenger_id", resolved_id)
        
        update_query.execute()
        
        # 2. Aktif teklifleri de iptal et
        supabase.table("offers").update({"status": "rejected"}).eq("tag_id", tid).eq("status", "pending").execute()
        
        # 3. 🔥 Dispatch queue'dan sil - SÜRÜCÜLERDEN HEMEN KALDIR
        try:
            q_mem = dispatch_queues.get(tid, [])
            for e in q_mem:
                if e.get("status") == "sent":
                    await emit_passenger_offer_revoked(e["driver_id"], tid)
            for key in list(active_dispatch_tasks.keys()):
                if key.startswith(f"{tid}_"):
                    tsk = active_dispatch_tasks.pop(key, None)
                    if tsk and not tsk.done():
                        tsk.cancel()
            dispatch_queues.pop(tid, None)
            dispatch_tag_context.pop(tid, None)
            supabase.table("dispatch_queue").delete().eq("tag_id", tid).execute()
            logger.info(f"🗑️ Dispatch queue temizlendi: {tid}")
        except Exception as dq_err:
            logger.warning(f"Dispatch queue temizleme hatası: {dq_err}")
        try:
            await rolling_dispatch_stop(tid, revoke_offers=True)
        except Exception:
            pass
        
        # 4. 🔔 Socket ile tüm sürücülere bildir - TAG iptal edildi
        try:
            await sio.emit("tag_cancelled", {"tag_id": tid}, room="drivers")
            logger.info(f"📢 Tüm sürücülere iptal bildirimi gönderildi: {tid}")
        except Exception as socket_err:
            logger.warning(f"Socket emit hatası: {socket_err}")
        
        logger.info(f"✅ TAG iptal edildi: {tid}")
        return {"success": True, "message": "TAG iptal edildi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel tag error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== DRIVER ENDPOINTS ====================

@api_router.get("/driver/requests")
async def get_driver_requests(driver_id: str = None, user_id: str = None, latitude: float = None, longitude: float = None):
    """Şoför için yakındaki istekleri getir - ŞEHİR BAZLI (aynı şehirdeki tüm teklifler)"""
    try:
        # driver_id veya user_id kabul et
        did = driver_id or user_id
        if not did:
            return {"success": False, "requests": [], "detail": "driver_id veya user_id gerekli"}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        # 10 DAKİKADAN ESKİ TAG'LERİ OTOMATİK İPTAL ET
        ten_min_ago = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
        try:
            supabase.table("tags").update({"status": "expired"}).in_("status", ["pending", "offers_received"]).lt("created_at", ten_min_ago).execute()
        except:
            pass  # Hata olursa devam et
        
        # Sürücünün şehrini al
        driver_result = supabase.table("users").select("city, latitude, longitude, driver_details").eq("id", resolved_id).execute()
        driver_city = None
        driver_lat = latitude
        driver_lng = longitude
        
        if driver_result.data:
            driver_city = driver_result.data[0].get("city")
            if not driver_lat:
                driver_lat = driver_result.data[0].get("latitude")
            if not driver_lng:
                driver_lng = driver_result.data[0].get("longitude")
        
        # Engellenen kullanıcıları al
        blocked_result = supabase.table("blocked_users").select("blocked_user_id").eq("user_id", resolved_id).execute()
        blocked_ids = [r["blocked_user_id"] for r in blocked_result.data]
        blocked_by_result = supabase.table("blocked_users").select("user_id").eq("blocked_user_id", resolved_id).execute()
        blocked_by_ids = [r["user_id"] for r in blocked_by_result.data]
        all_blocked = list(set(blocked_ids + blocked_by_ids))
        
        # Pending TAG'leri getir - SADECE SON 10 DAKİKA İÇİNDEKİLER
        result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, rating, profile_photo, city, driver_details)").in_("status", ["pending", "offers_received"]).gte("created_at", ten_min_ago).order("created_at", desc=True).limit(100).execute()
        
        driver_eff = _effective_driver_vehicle_kind(
            driver_result.data[0] if driver_result.data else {}
        )
        requests = []
        for tag in result.data:
            # Engelli kontrolü
            if tag.get("passenger_id") in all_blocked:
                continue
            
            passenger_info = tag.get("users", {}) or {}
            trip_pref = _trip_passenger_vehicle_pref(tag, passenger_info)
            if not _driver_matches_passenger_vehicle_pref(driver_eff, trip_pref):
                continue
            passenger_city = passenger_info.get("city")
            
            # ŞEHİR KONTROLÜ - Sadece aynı şehirdeki teklifleri göster
            if driver_city and passenger_city:
                if driver_city.lower().strip() != passenger_city.lower().strip():
                    continue
            
            # Mesafe hesapla (OSRM)
            distance_km = None
            duration_min = None
            
            target_lat = float(tag["pickup_lat"]) if tag.get("pickup_lat") else None
            target_lng = float(tag["pickup_lng"]) if tag.get("pickup_lng") else None
            
            if driver_lat and driver_lng and target_lat and target_lng:
                route_info = await get_route_info(driver_lat, driver_lng, target_lat, target_lng)
                if route_info:
                    distance_km = route_info["distance_km"]
                    duration_min = route_info["duration_min"]
            
            # Yolculuk mesafesi (pickup -> dropoff)
            trip_distance_km = None
            trip_duration_min = None
            if tag.get("pickup_lat") and tag.get("dropoff_lat"):
                trip_route = await get_route_info(
                    float(tag["pickup_lat"]), float(tag["pickup_lng"]),
                    float(tag["dropoff_lat"]), float(tag["dropoff_lng"])
                )
                if trip_route:
                    trip_distance_km = trip_route["distance_km"]
                    trip_duration_min = trip_route["duration_min"]
            
            requests.append({
                "id": tag["id"],
                "passenger_id": tag["passenger_id"],
                "passenger_name": passenger_info.get("name", tag.get("passenger_name", "Yolcu")),
                "passenger_rating": float(passenger_info.get("rating", 5.0)),
                "passenger_photo": passenger_info.get("profile_photo"),
                "passenger_city": passenger_city,
                "pickup_location": tag["pickup_location"],
                "pickup_lat": float(tag["pickup_lat"]) if tag.get("pickup_lat") else None,
                "pickup_lng": float(tag["pickup_lng"]) if tag.get("pickup_lng") else None,
                "dropoff_location": tag["dropoff_location"],
                "dropoff_lat": float(tag["dropoff_lat"]) if tag.get("dropoff_lat") else None,
                "dropoff_lng": float(tag["dropoff_lng"]) if tag.get("dropoff_lng") else None,
                "notes": tag.get("notes"),
                "status": tag["status"],
                "distance_to_passenger_km": round(distance_km, 1) if distance_km else None,
                "time_to_passenger_min": round(duration_min) if duration_min else None,
                "trip_distance_km": round(trip_distance_km, 1) if trip_distance_km else None,
                "trip_duration_min": round(trip_duration_min) if trip_duration_min else None,
                "distance_km": round(distance_km, 1) if distance_km else None,
                "duration_min": round(duration_min) if duration_min else None,
                "created_at": tag["created_at"]
            })
        
        return {"success": True, "requests": requests}
    except Exception as e:
        logger.error(f"Get driver requests error: {e}")
        return {"success": False, "requests": []}

class SendOfferRequest(BaseModel):
    tag_id: str
    price: float
    notes: Optional[str] = None
    estimated_time: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@api_router.post("/driver/send-offer")
async def send_offer(
    request: SendOfferRequest = None,
    user_id: str = None,
    driver_id: str = None,
    tag_id: str = None,
    price: float = None,
    notes: str = None,
    latitude: float = None,
    longitude: float = None
):
    """Teklif gönder - HIZLI VE MESAFE BİLGİLİ"""
    try:
        # Body veya query param'dan al
        did = user_id or driver_id
        tid = request.tag_id if request else tag_id
        p = request.price if request else price
        n = request.notes if request else notes
        lat = request.latitude if request else latitude
        lng = request.longitude if request else longitude
        
        if not did:
            raise HTTPException(status_code=422, detail="user_id veya driver_id gerekli")
        if not tid:
            raise HTTPException(status_code=422, detail="tag_id gerekli")
        if not p:
            raise HTTPException(status_code=422, detail="price gerekli")
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        # COOLDOWN KALDIRILDI - Şoför istediği kadar teklif verebilir
        
        # Şoför bilgisi
        driver_result = supabase.table("users").select("name, rating, profile_photo, driver_details, latitude, longitude").eq("id", resolved_id).execute()
        if not driver_result.data:
            raise HTTPException(status_code=404, detail="Şoför bulunamadı")
        
        driver = driver_result.data[0]
        
        # Şoför konumu (request'ten veya DB'den)
        driver_lat = lat or driver.get("latitude")
        driver_lng = lng or driver.get("longitude")
        
        # TAG bilgisi
        tag_result = supabase.table("tags").select("*").eq("id", tid).execute()
        if not tag_result.data:
            raise HTTPException(status_code=404, detail="TAG bulunamadı")
        
        tag = tag_result.data[0]

        trip_pref = _canonical_vehicle_kind(tag.get("passenger_preferred_vehicle"))
        if trip_pref is None and tag.get("passenger_id"):
            try:
                pid = await resolve_user_id(tag["passenger_id"])
                pu = (
                    supabase.table("users")
                    .select("driver_details")
                    .eq("id", pid)
                    .limit(1)
                    .execute()
                )
                if pu.data:
                    trip_pref = _passenger_preferred_vehicle_from_row(pu.data[0])
            except Exception:
                pass
        trip_pref = trip_pref or "car"
        driver_eff = _effective_driver_vehicle_kind(driver)
        if not _driver_matches_passenger_vehicle_pref(driver_eff, trip_pref):
            raise HTTPException(
                status_code=403,
                detail="Bu talep için araç tipiniz uygun değil",
            )
        
        # ⚡ ÖNCE TEKLİFİ KAYDET - MESAFE SONRA HESAPLANACAK (ANINDA YANIT)
        offer_data = {
            "tag_id": tid,
            "driver_id": resolved_id,
            "driver_name": driver["name"],
            "driver_rating": float(driver.get("rating", 5.0)),
            "driver_photo": driver.get("profile_photo"),
            "price": p,
            "notes": n or "Teklif gönderildi",
            "status": "pending",
            "distance_to_passenger_km": None,
            "estimated_arrival_min": None,
            "trip_distance_km": None,
            "trip_duration_min": None
        }
        
        # Araç bilgisi ekle
        if driver.get("driver_details"):
            offer_data["vehicle_model"] = driver["driver_details"].get("vehicle_model")
            offer_data["vehicle_color"] = driver["driver_details"].get("vehicle_color")
            offer_data["vehicle_photo"] = driver["driver_details"].get("vehicle_photo")
        
        # 1. TEKLİFİ ANINDA KAYDET
        result = supabase.table("offers").insert(offer_data).execute()
        offer_id = result.data[0]["id"]
        
        # 2. TAG durumunu güncelle
        supabase.table("tags").update({"status": "offers_received"}).eq("id", tid).execute()
        
        logger.info(f"📤 Teklif ANINDA gönderildi: {resolved_id} -> {tid}")

        passenger_id = tag.get("passenger_id")
        if passenger_id:
            offer_event_payload = {
                "offer_id": offer_id,
                "tag_id": tid,
                "driver_id": resolved_id,
                "driver_name": driver["name"],
                "price": p,
                "status": "pending"
            }
            try:
                await sio.emit("new_offer", offer_event_payload, room=_normalize_user_room(passenger_id))
            except Exception as socket_err:
                logger.warning(f"⚠️ new_offer socket emit hatası: {socket_err}")
        
        # 3. ARKA PLANDA mesafe hesapla ve güncelle (kullanıcı beklemez)
        import asyncio

        if passenger_id:
            try:
                asyncio.create_task(send_push_notification(
                    passenger_id,
                    "💰 Yeni teklif geldi",
                    f"{driver['name']} teklifinize ₺{int(p)} önerdi.",
                    {
                        "type": "new_offer",
                        "tag_id": tid,
                        "offer_id": offer_id,
                        "driver_id": resolved_id,
                        "driver_name": driver["name"],
                        "price": p,
                    }
                ))
            except Exception as notif_err:
                logger.warning(f"⚠️ Teklif push bildirimi gönderilemedi: {notif_err}")
        
        async def update_distances():
            try:
                distance_to_passenger = None
                estimated_arrival = None
                trip_distance = None
                trip_duration = None
                
                if driver_lat and driver_lng and tag.get("pickup_lat"):
                    # Route hesapla
                    route1 = await get_route_info(
                        float(driver_lat), float(driver_lng),
                        float(tag["pickup_lat"]), float(tag["pickup_lng"])
                    )
                    if route1:
                        distance_to_passenger = route1.get("distance_km")
                        estimated_arrival = route1.get("duration_min")
                    
                    if tag.get("dropoff_lat"):
                        route2 = await get_route_info(
                            float(tag["pickup_lat"]), float(tag["pickup_lng"]),
                            float(tag["dropoff_lat"]), float(tag["dropoff_lng"])
                        )
                        if route2:
                            trip_distance = route2.get("distance_km")
                            trip_duration = route2.get("duration_min")
                
                # Teklifi güncelle
                supabase.table("offers").update({
                    "distance_to_passenger_km": round(distance_to_passenger, 1) if distance_to_passenger else None,
                    "estimated_arrival_min": int(estimated_arrival) if estimated_arrival else None,
                    "trip_distance_km": round(trip_distance, 1) if trip_distance else None,
                    "trip_duration_min": int(trip_duration) if trip_duration else None,
                    "notes": f"{int(estimated_arrival or 15)} dk'da gelirim" if estimated_arrival else None
                }).eq("id", offer_id).execute()
                
                logger.info(f"📍 Mesafeler güncellendi: {offer_id}")
            except Exception as e:
                logger.error(f"Mesafe güncelleme hatası: {e}")
        
        # Arka planda çalıştır - kullanıcı beklemez
        asyncio.create_task(update_distances())
        
        return {
            "success": True, 
            "offer_id": offer_id,
            "message": "Teklif gönderildi, mesafe bilgisi güncelleniyor..."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send offer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DriverAcceptOfferRequest(BaseModel):
    tag_id: str
    driver_id: Optional[str] = None


@api_router.post("/driver/accept-offer")
async def driver_accept_offer_http(
    request: DriverAcceptOfferRequest = None,
    tag_id: str = None,
    driver_id: str = None,
    user_id: str = None,
):
    """
    Sürücü teklifi HTTP ile kabul: tag matched + dispatch temizlik + tag_matched socket.
    """
    try:
        tid = (request.tag_id if request else None) or tag_id
        did = (
            (request.driver_id if request and request.driver_id else None)
            or driver_id
            or user_id
        )
        if not tid or not did:
            raise HTTPException(status_code=422, detail="tag_id ve user_id/driver_id gerekli")
        if not supabase:
            raise HTTPException(status_code=500, detail="Veritabanı yapılandırması eksik")

        resolved_driver_id = await resolve_user_id(str(did).strip())
        if not resolved_driver_id:
            raise HTTPException(status_code=400, detail="Geçersiz sürücü")

        tid = str(tid).strip()
        if len(tid) == 36 and tid.count("-") == 4:
            tid = tid.lower()

        tag_result = supabase.table("tags").select("*").eq("id", tid).limit(1).execute()
        if not tag_result.data:
            raise HTTPException(status_code=404, detail="Teklif bulunamadı")

        tag_row_pre = tag_result.data[0]
        drv_chk = (
            supabase.table("users")
            .select("name, driver_details")
            .eq("id", resolved_driver_id)
            .limit(1)
            .execute()
        )
        driver_eff_acc = _effective_driver_vehicle_kind(drv_chk.data[0] if drv_chk.data else {})
        pu_row_acc = None
        pid_acc = tag_row_pre.get("passenger_id")
        if pid_acc:
            try:
                pid_r_acc = await resolve_user_id(str(pid_acc).strip())
                pu_acc = (
                    supabase.table("users")
                    .select("driver_details")
                    .eq("id", pid_r_acc)
                    .limit(1)
                    .execute()
                )
                if pu_acc.data:
                    pu_row_acc = pu_acc.data[0]
            except Exception:
                pass
        trip_pref_acc = _trip_passenger_vehicle_pref(tag_row_pre, pu_row_acc)
        if not _driver_matches_passenger_vehicle_pref(driver_eff_acc, trip_pref_acc):
            raise HTTPException(
                status_code=403, detail="Bu talep için araç tipiniz uygun değil"
            )

        driver_name = (
            drv_chk.data[0]["name"]
            if drv_chk and drv_chk.data and drv_chk.data[0].get("name")
            else "Sürücü"
        )

        matched_at = datetime.now(timezone.utc).isoformat()
        update_data = {
            "status": "matched",
            "driver_id": resolved_driver_id,
            "driver_name": driver_name,
            "matched_at": matched_at,
        }

        matchable_statuses = ["waiting", "offers_received", "pending"]
        ur = (
            supabase.table("tags")
            .update(update_data)
            .eq("id", tid)
            .in_("status", matchable_statuses)
            .select("*")
            .execute()
        )
        updated_tag = ur.data[0] if ur.data else None

        if not updated_tag:
            ref = supabase.table("tags").select("*").eq("id", tid).limit(1).execute()
            row = ref.data[0] if ref.data else {}
            st = (row.get("status") or "").lower()
            did_row = str(row.get("driver_id") or "").strip().lower()
            if st == "matched" and did_row == str(resolved_driver_id).strip().lower():
                updated_tag = row
            else:
                raise HTTPException(
                    status_code=409, detail="Bu teklif artık mevcut değil veya eşleştirilemez"
                )

        try:
            await rolling_dispatch_stop(
                tid, revoke_offers=True, except_driver_id=resolved_driver_id
            )
        except Exception as _rds:
            logger.warning(
                f"rolling_dispatch_stop after driver/accept-offer HTTP (non-fatal): {_rds}"
            )
        try:
            await handle_dispatch_accept(tid, resolved_driver_id)
        except Exception as _hda:
            logger.warning(
                f"handle_dispatch_accept after driver/accept-offer HTTP (non-fatal): {_hda}"
            )

        passenger_id = updated_tag.get("passenger_id")
        if passenger_id:
            passenger_id = await resolve_user_id(str(passenger_id).strip())
        passenger_name = "Yolcu"
        if passenger_id:
            pr = (
                supabase.table("users")
                .select("name")
                .eq("id", passenger_id)
                .limit(1)
                .execute()
            )
            if pr.data and pr.data[0].get("name"):
                passenger_name = pr.data[0]["name"]

        payload = {
            "trip_id": tid,
            "tag_id": tid,
            "driver_id": resolved_driver_id,
            "driver_name": driver_name,
            "passenger_id": passenger_id,
            "passenger_name": passenger_name,
            "pickup_location": updated_tag.get("pickup_location"),
            "dropoff_location": updated_tag.get("dropoff_location"),
            "pickup_lat": updated_tag.get("pickup_lat"),
            "pickup_lng": updated_tag.get("pickup_lng"),
            "dropoff_lat": updated_tag.get("dropoff_lat"),
            "dropoff_lng": updated_tag.get("dropoff_lng"),
            "offered_price": updated_tag.get("offered_price")
            or updated_tag.get("final_price"),
            "final_price": updated_tag.get("final_price"),
            "distance_km": updated_tag.get("distance_km"),
            "estimated_minutes": updated_tag.get("estimated_minutes"),
            "status": "matched",
            "matched_at": updated_tag.get("matched_at") or matched_at,
        }
        try:
            driver_sid = connected_users.get(
                str(resolved_driver_id).strip().lower()
            ) or connected_users.get(resolved_driver_id)
            driver_room = _normalize_user_room(resolved_driver_id)
            driver_target = driver_sid or driver_room
            if driver_target:
                await sio.emit("tag_matched", payload, room=driver_target)
            if passenger_id:
                passenger_sid = connected_users.get(
                    str(passenger_id).strip().lower()
                ) or connected_users.get(passenger_id)
                passenger_room = _normalize_user_room(passenger_id)
                passenger_target = passenger_sid or passenger_room
                if passenger_target:
                    await sio.emit("tag_matched", payload, room=passenger_target)
        except Exception as sock_e:
            logger.warning(f"driver/accept-offer HTTP tag_matched emit: {sock_e}")

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"driver/accept-offer HTTP error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/driver/active-trip")
async def get_driver_active_trip(driver_id: str = None, user_id: str = None):
    """Şoförün aktif yolculuğu - öncelikle aktif tag'leri kontrol et"""
    try:
        # driver_id veya user_id kabul et
        did = driver_id or user_id
        if not did:
            return {"success": True, "trip": None, "tag": None}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        # ÖNCELİK 1: Aktif tag'leri ara (matched veya in_progress)
        result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone, rating, profile_photo, latitude, longitude)").eq("driver_id", resolved_id).in_("status", ["matched", "in_progress"]).order("matched_at", desc=True).limit(1).execute()
        
        if result.data:
            tag = result.data[0]
            passenger_info = tag.get("users", {}) or {}
            
            # Yolcu konumu
            passenger_location = None
            if passenger_info.get("latitude") and passenger_info.get("longitude"):
                passenger_location = {
                    "latitude": float(passenger_info["latitude"]),
                    "longitude": float(passenger_info["longitude"])
                }
            
            tag_data = {
                "id": tag["id"],
                "passenger_id": tag["passenger_id"],
                "passenger_name": passenger_info.get("name"),
                "passenger_phone": passenger_info.get("phone"),
                "passenger_rating": float(passenger_info.get("rating", 5.0)),
                "passenger_photo": passenger_info.get("profile_photo"),
                "passenger_location": passenger_location,
                "pickup_location": tag["pickup_location"],
                "pickup_lat": float(tag["pickup_lat"]) if tag.get("pickup_lat") else None,
                "pickup_lng": float(tag["pickup_lng"]) if tag.get("pickup_lng") else None,
                "dropoff_location": tag["dropoff_location"],
                "dropoff_lat": float(tag["dropoff_lat"]) if tag.get("dropoff_lat") else None,
                "dropoff_lng": float(tag["dropoff_lng"]) if tag.get("dropoff_lng") else None,
                "status": tag["status"],
                "final_price": float(tag["final_price"]) if tag.get("final_price") else None
            }
            
            return {
                "success": True,
                "trip": tag_data,
                "tag": tag_data
            }
        
        # ÖNCELİK 2: Aktif tag yoksa, son 10 saniyede cancelled olmuş TAG kontrol et
        from datetime import timedelta
        ten_seconds_ago = (datetime.utcnow() - timedelta(seconds=10)).isoformat()
        
        cancelled_result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone, rating, profile_photo, latitude, longitude)").eq("driver_id", resolved_id).eq("status", "cancelled").gte("cancelled_at", ten_seconds_ago).order("cancelled_at", desc=True).limit(1).execute()
        
        if cancelled_result.data:
            cancelled_tag = cancelled_result.data[0]
            passenger_info = cancelled_tag.get("users", {}) or {}
            
            tag_data = {
                "id": cancelled_tag["id"],
                "passenger_id": cancelled_tag["passenger_id"],
                "passenger_name": passenger_info.get("name"),
                "status": "cancelled",
                "final_price": float(cancelled_tag["final_price"]) if cancelled_tag.get("final_price") else None
            }
            
            logger.info(f"🛑 Sürücü için cancelled TAG bulundu: {cancelled_tag['id']}")
            return {"success": True, "trip": tag_data, "tag": tag_data, "was_cancelled": True}
        
        return {"success": True, "trip": None, "tag": None}
    except Exception as e:
        logger.error(f"Get driver active trip error: {e}")
        return {"success": False, "trip": None, "tag": None}

# Frontend uyumluluğu için alias
@api_router.get("/driver/active-tag")
async def get_driver_active_tag(driver_id: str = None, user_id: str = None):
    """Şoförün aktif TAG'i (alias)"""
    return await get_driver_active_trip(driver_id, user_id)


@api_router.get("/driver/dispatch-pending-offer")
async def get_driver_dispatch_pending_offer(user_id: str = None, driver_id: str = None):
    """
    Sıralı dispatch: Bu sürücüye 'sent' durumunda bekleyen Martı teklifi (uygulama resume).
    """
    try:
        did = driver_id or user_id
        if not did:
            return {"success": False, "offer": None, "detail": "user_id gerekli"}
        resolved_id = await resolve_user_id(did)
        dq = (
            supabase.table("dispatch_queue")
            .select("*")
            .eq("driver_id", resolved_id)
            .eq("status", "sent")
            .execute()
        )
        if not dq.data:
            return {"success": True, "offer": None}
        cfg = await get_dispatch_config()
        timeout = int(cfg.get("driver_offer_timeout", 10))
        for row in dq.data:
            tid = row.get("tag_id")
            if not tid:
                continue
            tr = (
                supabase.table("tags")
                .select("*")
                .eq("id", tid)
                .eq("status", "waiting")
                .limit(1)
                .execute()
            )
            if not tr.data:
                continue
            tag = tr.data[0]
            fp = tag.get("final_price")
            pu_row = None
            pid = tag.get("passenger_id")
            if pid:
                try:
                    pid_r = await resolve_user_id(pid)
                    pu = (
                        supabase.table("users")
                        .select("driver_details")
                        .eq("id", pid_r)
                        .limit(1)
                        .execute()
                    )
                    if pu.data:
                        pu_row = pu.data[0]
                except Exception:
                    pass
            pvk = _trip_passenger_vehicle_pref(tag, pu_row)
            drv = (
                supabase.table("users")
                .select("driver_details")
                .eq("id", resolved_id)
                .limit(1)
                .execute()
            )
            driver_eff = _effective_driver_vehicle_kind(drv.data[0] if drv.data else {})
            if not _driver_matches_passenger_vehicle_pref(driver_eff, pvk):
                continue
            offer_payload = {
                "tag_id": tid,
                "passenger_id": tag.get("passenger_id"),
                "passenger_name": tag.get("passenger_name") or "Yolcu",
                "pickup_location": tag.get("pickup_location"),
                "pickup_lat": tag.get("pickup_lat"),
                "pickup_lng": tag.get("pickup_lng"),
                "dropoff_location": tag.get("dropoff_location"),
                "dropoff_lat": tag.get("dropoff_lat"),
                "dropoff_lng": tag.get("dropoff_lng"),
                "offered_price": fp,
                "distance_km": tag.get("distance_km") or 0,
                "estimated_minutes": tag.get("estimated_minutes") or 0,
                "distance_to_pickup": row.get("distance_km") or 0,
                "dispatch_timeout": timeout,
                "is_dispatch": True,
                "passenger_vehicle_kind": pvk,
            }
            return {"success": True, "offer": offer_payload}
        return {"success": True, "offer": None}
    except Exception as e:
        logger.error(f"dispatch-pending-offer error: {e}")
        return {"success": False, "offer": None, "detail": str(e)}


@api_router.post("/driver/start-trip")
async def start_trip(driver_id: str = None, user_id: str = None, tag_id: str = None):
    """Yolculuğu başlat"""
    try:
        did = driver_id or user_id
        if not did or not tag_id:
            raise HTTPException(status_code=422, detail="user_id ve tag_id gerekli")
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        supabase.table("tags").update({
            "status": "in_progress",
            "started_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id).eq("driver_id", resolved_id).execute()
        
        # Trip lifecycle push: TRIP_STARTED → yolcu + sürücü
        tag_row = supabase.table("tags").select("passenger_id, driver_id").eq("id", tag_id).limit(1).execute()
        if tag_row.data:
            p_id = tag_row.data[0].get("passenger_id")
            d_id = tag_row.data[0].get("driver_id")
            try:
                if p_id:
                    asyncio.create_task(send_trip_push_and_log(
                        p_id, "trip_started", "Yolculuk başladı", "İyi yolculuklar.",
                        {"type": "trip_started", "tag_id": tag_id}
                    ))
                if d_id:
                    asyncio.create_task(send_trip_push_and_log(
                        d_id, "trip_started", "Yolculuk başladı", "Güvenli sürüşler.",
                        {"type": "trip_started", "tag_id": tag_id}
                    ))
            except Exception as notif_err:
                logger.warning(f"⚠️ Trip started push gönderilemedi: {notif_err}")
        
        return {"success": True, "message": "Yolculuk başladı"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Start trip error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Path param ile start-tag (frontend uyumluluğu)
@api_router.post("/driver/start-tag/{tag_id}")
async def start_tag_path(tag_id: str, driver_id: str = None, user_id: str = None):
    """Yolculuğu başlat (path param)"""
    return await start_trip(driver_id, user_id, tag_id)

@api_router.post("/driver/complete-trip")
async def complete_trip(driver_id: str = None, user_id: str = None, tag_id: str = None):
    """Yolculuğu tamamla"""
    try:
        did = driver_id or user_id
        if not did or not tag_id:
            raise HTTPException(status_code=422, detail="user_id ve tag_id gerekli")
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        # TAG'i güncelle
        supabase.table("tags").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id).eq("driver_id", resolved_id).execute()
        
        # TAG bilgisini al
        tag_result = supabase.table("tags").select("passenger_id").eq("id", tag_id).execute()
        if tag_result.data:
            passenger_id = tag_result.data[0]["passenger_id"]
            
            # Her iki kullanıcının trip sayısını artır
            for uid in [resolved_id, passenger_id]:
                user_result = supabase.table("users").select("total_trips").eq("id", uid).execute()
                if user_result.data:
                    current = user_result.data[0].get("total_trips", 0) or 0
                    supabase.table("users").update({"total_trips": current + 1}).eq("id", uid).execute()
        
        # 🆕 Trip bittiğinde chat mesajlarını sil
        try:
            delete_result = supabase.table("chat_messages").delete().eq("tag_id", tag_id).execute()
            logger.info(f"🗑️ Chat mesajları silindi: tag_id={tag_id}")
        except Exception as chat_err:
            logger.warning(f"⚠️ Chat mesajları silinemedi: {chat_err}")
        
        # 🔔 PUSH NOTIFICATIONS - TRIP_COMPLETED (trip lifecycle)
        tag_info = supabase.table("tags").select("final_price, offered_price, passenger_id, driver_id").eq("id", tag_id).execute()
        if tag_info.data:
            tag_data = tag_info.data[0]
            price = tag_data.get("final_price") or tag_data.get("offered_price", 0)
            fare_amount = int(price) if price else 0
            p_id = tag_data.get("passenger_id")
            d_id = tag_data.get("driver_id")
            try:
                if p_id:
                    asyncio.create_task(send_trip_push_and_log(
                        p_id, "trip_completed",
                        "Yolculuk tamamlandı",
                        "Bizi tercih ettiğiniz için teşekkür ederiz.",
                        {"type": "trip_completed", "tag_id": tag_id, "price": price}
                    ))
                if d_id:
                    asyncio.create_task(send_trip_push_and_log(
                        d_id, "trip_completed",
                        "Yolculuk tamamlandı",
                        f"Kazancınız: {fare_amount} TL. Yeni teklif almak için bekleme ekranına geçebilirsiniz.",
                        {"type": "trip_completed", "tag_id": tag_id, "earnings": price}
                    ))
            except Exception as notif_err:
                logger.warning(f"⚠️ Trip completed push gönderilemedi: {notif_err}")
        
        logger.info(f"✅ Yolculuk tamamlandı: {tag_id}")
        return {"success": True, "message": "Yolculuk tamamlandı"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Complete trip error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Path param ile complete-tag (frontend uyumluluğu)
@api_router.post("/driver/complete-tag/{tag_id}")
async def complete_tag_path(tag_id: str, driver_id: str = None, user_id: str = None):
    """Yolculuğu tamamla (path param)"""
    return await complete_trip(driver_id, user_id, tag_id)


# ==================== DRIVER ON THE WAY / ARRIVED (trip lifecycle push) ====================

@api_router.post("/driver/on-the-way")
async def driver_on_the_way(driver_id: str = None, user_id: str = None, tag_id: str = None):
    """Sürücü 'yolcuya git' dedi – yolcuya push: 'Eşleştiniz, sürücü yola çıktı' + tahmini varış süresi (gerçekçi yol tarifi)."""
    try:
        did = driver_id or user_id
        if not did or not tag_id:
            raise HTTPException(status_code=422, detail="user_id ve tag_id gerekli")
        resolved_id = await resolve_user_id(did)
        tag_result = supabase.table("tags").select("passenger_id, driver_id, status, pickup_lat, pickup_lng").eq("id", tag_id).eq("driver_id", resolved_id).limit(1).execute()
        if not tag_result.data or tag_result.data[0].get("status") not in ("matched", "in_progress"):
            raise HTTPException(status_code=400, detail="Aktif yolculuk bulunamadı")
        row = tag_result.data[0]
        passenger_id = row.get("passenger_id")
        eta_min = 0
        try:
            driver_loc = supabase.table("users").select("latitude, longitude").eq("id", resolved_id).limit(1).execute()
            p_lat, p_lng = row.get("pickup_lat"), row.get("pickup_lng")
            if driver_loc.data and p_lat is not None and p_lng is not None:
                d = driver_loc.data[0]
                eta_min = _eta_minutes(d.get("latitude"), d.get("longitude"), float(p_lat), float(p_lng))
        except Exception:
            pass
        title = "Eşleştiniz, sürücü yola çıktı"
        body = f"Tahmini varış: {eta_min} dk" if eta_min else "Sürücünüz size doğru geliyor."
        if passenger_id:
            asyncio.create_task(send_trip_push_and_log(
                passenger_id, "driver_on_the_way",
                title,
                body,
                {"type": "driver_on_the_way", "tag_id": tag_id, "eta_min": eta_min}
            ))
        return {"success": True, "message": "Bildirim gönderildi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"driver_on_the_way error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/driver/arrived")
async def driver_arrived(driver_id: str = None, user_id: str = None, tag_id: str = None):
    """Sürücü vardı – yolcuya ve sürücüye push (trip lifecycle metinleri)."""
    try:
        did = driver_id or user_id
        if not did or not tag_id:
            raise HTTPException(status_code=422, detail="user_id ve tag_id gerekli")
        resolved_id = await resolve_user_id(did)
        tag_result = supabase.table("tags").select("passenger_id, driver_id, status").eq("id", tag_id).eq("driver_id", resolved_id).limit(1).execute()
        if not tag_result.data or tag_result.data[0].get("status") not in ("matched", "in_progress"):
            raise HTTPException(status_code=400, detail="Aktif yolculuk bulunamadı")
        row = tag_result.data[0]
        passenger_id = row.get("passenger_id")
        try:
            if passenger_id:
                asyncio.create_task(send_trip_push_and_log(
                    passenger_id, "driver_arrived",
                    "Sürücü sizi bekliyor",
                    "Sürücünüz bulunduğunuz konuma ulaştı.",
                    {"type": "driver_arrived", "tag_id": tag_id}
                ))
            asyncio.create_task(send_trip_push_and_log(
                resolved_id, "driver_arrived",
                "Yolcuya ulaştınız",
                "Yolcuyu aldığınızda yolculuğu başlatabilirsiniz.",
                {"type": "driver_arrived", "tag_id": tag_id}
            ))
        except Exception as notif_err:
            logger.warning(f"⚠️ driver_arrived push gönderilemedi: {notif_err}")
        return {"success": True, "message": "Bildirimler gönderildi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"driver_arrived error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DRIVER DISMISS REQUEST ====================

@api_router.post("/driver/dismiss-request")
async def dismiss_request(user_id: str, tag_id: str):
    """Talebi 10 dakika boyunca gizle"""
    try:
        # Bu işlem için basit bir in-memory cache kullanıyoruz
        # Production'da Redis veya veritabanı kullanılmalı
        # Şimdilik sadece başarılı yanıt döndürüyoruz
        logger.info(f"🙈 Talep gizlendi: {tag_id} by {user_id}")
        return {"success": True, "message": "Talep 10 dakika boyunca gizlendi"}
    except Exception as e:
        logger.error(f"Dismiss request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== TRIP FORCE END ====================

@api_router.post("/trip/force-end")
async def force_end_trip(tag_id: str, user_id: str):
    """Yolculuğu zorla bitir (-5 puan)"""
    try:
        # TAG'i getir
        tag_result = supabase.table("tags").select("*").eq("id", tag_id).execute()
        if not tag_result.data:
            raise HTTPException(status_code=404, detail="TAG bulunamadı")
        
        tag = tag_result.data[0]
        
        # Karşı tarafı belirle
        resolved_id = await resolve_user_id(user_id)
        if resolved_id == tag.get("passenger_id"):
            other_user_id = tag.get("driver_id")
            user_type = "passenger"
        else:
            other_user_id = tag.get("passenger_id")
            user_type = "driver"
        
        # Zorla bitiren kullanıcının puanını -5 düşür (AĞIR CEZA)
        user_result = supabase.table("users").select("rating").eq("id", resolved_id).execute()
        if user_result.data:
            current_rating = float(user_result.data[0].get("rating", 5.0))
            new_rating = max(1.0, current_rating - 5.0)  # Min 1.0, -5 puan ceza
            supabase.table("users").update({"rating": new_rating}).eq("id", resolved_id).execute()
        
        # TAG'i tamamla - sadece mevcut sütunları kullan
        supabase.table("tags").update({
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id).execute()
        
        # 🆕 Trip bittiğinde chat mesajlarını sil
        try:
            delete_result = supabase.table("chat_messages").delete().eq("tag_id", tag_id).execute()
            logger.info(f"🗑️ Chat mesajları silindi (force-end): tag_id={tag_id}")
        except Exception as chat_err:
            logger.warning(f"⚠️ Chat mesajları silinemedi: {chat_err}")
        
        # 🆕 Socket ile karşı tarafa bildir
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://socket.leylektag.com/emit",
                    json={
                        "event": "force_end_trip",
                        "data": {
                            "tag_id": tag_id,
                            "driver_id": tag.get("driver_id"),
                            "passenger_id": tag.get("passenger_id"),
                            "ended_by": user_type
                        }
                    },
                    timeout=5
                )
        except Exception as socket_err:
            logger.warning(f"⚠️ Socket bildirim gönderilemedi: {socket_err}")
        
        logger.info(f"⚠️ Force end: TAG {tag_id} by {user_type} ({resolved_id}) - 5 PUAN CEZA")
        
        return {"success": True, "message": "Yolculuk zorla bitirildi. Puanınız -5 düştü."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Force end error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== RATING SYSTEM ====================

@api_router.post("/trip/rate")
async def rate_user(rater_id: str, rated_user_id: str, rating: int, tag_id: str = None):
    """Kullanıcıyı puanla"""
    try:
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail="Puan 1-5 arasında olmalı")
        
        # Mevcut rating bilgisi
        user_result = supabase.table("users").select("rating, total_ratings").eq("id", rated_user_id).execute()
        if not user_result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = user_result.data[0]
        current_rating = float(user.get("rating", 5.0))
        total_ratings = user.get("total_ratings", 0) or 0
        
        # Yeni ortalama hesapla
        new_total = total_ratings + 1
        new_rating = ((current_rating * total_ratings) + rating) / new_total
        
        # Güncelle
        supabase.table("users").update({
            "rating": round(new_rating, 2),
            "total_ratings": new_total
        }).eq("id", rated_user_id).execute()
        
        return {"success": True, "new_rating": round(new_rating, 2)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rate user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PUSH NOTIFICATIONS ====================

def build_call_push_payload(
    notification_type: str,
    caller_id: str,
    caller_name: str,
    call_type: str,
    *,
    call_id: str = None,
    channel_name: str = None,
    agora_token: str = None,
    room_url: str = None,
    room_name: str = None,
    tag_id: str = None,
):
    payload = {
        "type": notification_type,
        "caller_id": caller_id,
        "caller_name": caller_name,
        "call_type": call_type,
    }

    if call_id:
        payload["call_id"] = call_id
    if channel_name:
        payload["channel_name"] = channel_name
    if agora_token:
        payload["agora_token"] = agora_token
    if room_url:
        payload["room_url"] = room_url
    if room_name:
        payload["room_name"] = room_name
    if tag_id:
        payload["tag_id"] = tag_id

    return payload

class ExpoPushService:
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
    
    @staticmethod
    def is_valid_token(token: str) -> bool:
        """
        Expo push token formatı:
        - Eski:  ExponentPushToken[...]
        - Yeni:  ExpoPushToken[...]
        Her iki formatı da kabul et.
        """
        if not token:
            return False
        return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")
    
    @staticmethod
    async def send(tokens: list, title: str, body: str, data: dict = None) -> dict:
        if not tokens:
            return {"sent": 0, "failed": 0}
        
        valid_tokens = [t for t in tokens if ExpoPushService.is_valid_token(t)]
        if not valid_tokens:
            return {"sent": 0, "failed": len(tokens)}
        
        messages = [{"to": t, "sound": "default", "title": title, "body": body, "data": data or {}} for t in valid_tokens]
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(ExpoPushService.EXPO_PUSH_URL, json=messages, timeout=30)
                result = response.json()
                
                sent = sum(1 for t in result.get("data", []) if t.get("status") == "ok")
                return {"sent": sent, "failed": len(valid_tokens) - sent}
        except Exception as e:
            logger.error(f"Push error: {e}")
            return {"sent": 0, "failed": len(valid_tokens)}

class PushTokenRequest(BaseModel):
    user_id: str
    push_token: str
    platform: Optional[str] = "android"

@api_router.post("/user/register-push-token")
async def register_push_token_endpoint(
    request: PushTokenRequest = None,
    user_id: str = None,
    push_token: str = None
):
    """Push token kaydet - JSON body veya query params kabul eder"""
    try:
        # JSON body veya query params'tan al
        _user_id = request.user_id if request else user_id
        _push_token = request.push_token if request else push_token
        _platform = request.platform if request else "android"
        
        logger.info(f"📱 Push token kayıt isteği: user_id={_user_id}, platform={_platform}, token={_push_token[:40] if _push_token else 'NONE'}...")
        
        # Validasyonlar
        if not _user_id:
            return {"success": False, "detail": "user_id gerekli"}
        
        if not _push_token:
            return {"success": False, "detail": "push_token gerekli"}
        
        if not ExpoPushService.is_valid_token(_push_token):
            return {"success": False, "detail": "Sadece Expo push token desteklenir"}
        
        # Kullanıcı var mı kontrol et
        user_check = supabase.table("users").select("id, name").eq("id", _user_id).execute()
        if not user_check.data:
            logger.warning(f"❌ Kullanıcı bulunamadı: {_user_id}")
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        user_name = user_check.data[0].get("name", "Unknown")
        
        # Users tablosuna kaydet (push_token_type kolonu yoksa sadece token kaydet)
        try:
            supabase.table("users").update({
                "push_token": _push_token,
                "push_token_type": "expo",
                "push_token_updated_at": datetime.utcnow().isoformat()
            }).eq("id", _user_id).execute()
        except Exception as col_err:
            # push_token_type kolonu yoksa sadece token'ı kaydet
            logger.warning(f"⚠️ push_token_type kolonu yok, sadece token kaydediliyor: {col_err}")
            supabase.table("users").update({
                "push_token": _push_token,
                "push_token_updated_at": datetime.utcnow().isoformat()
            }).eq("id", _user_id).execute()
        
        logger.info(f"✅ Push token kaydedildi: {user_name} ({_user_id}) - {_platform} - expo")
        return {"success": True, "message": f"Token kaydedildi: {user_name}", "platform": _platform, "token_type": "expo"}
    except Exception as e:
        logger.error(f"❌ Push token kayıt hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"success": False, "detail": str(e)}

@api_router.delete("/user/remove-push-token")
async def remove_push_token(user_id: str):
    """Push token sil"""
    try:
        supabase.table("users").update({
            "push_token": None,
            "push_token_updated_at": None
        }).eq("id", user_id).execute()
        
        return {"success": True}
    except Exception as e:
        return {"success": False}

# Test endpoint - Push bildirim sistemini test et
@api_router.post("/test/push-notification")
async def test_push_notification(user_id: str, title: str = "Test Bildirimi", body: str = "Bu bir test bildirimidir"):
    """Push bildirim sistemini test et - DEBUG için"""
    try:
        logger.info(f"🧪 TEST: Push bildirim testi başlıyor: {user_id}")
        
        # Kullanıcı ve token bilgisi
        user_result = supabase.table("users").select("id, name, phone, push_token, push_token_updated_at").eq("id", user_id).execute()
        
        if not user_result.data:
            return {"success": False, "error": "Kullanıcı bulunamadı", "user_id": user_id}
        
        user = user_result.data[0]
        token = user.get("push_token")
        
        token_type = "expo" if token and ExpoPushService.is_valid_token(token) else "invalid"
        
        debug_info = {
            "user_id": user_id,
            "user_name": user.get("name"),
            "phone": user.get("phone"),
            "has_push_token": bool(token),
            "token_type": token_type,
            "token_preview": token[:40] + "..." if token else None,
            "token_updated_at": user.get("push_token_updated_at")
        }
        
        if not token:
            return {"success": False, "error": "Push token yok", "debug": debug_info}
        
        # Bildirimi gönder
        logger.info(f"🧪 TEST: Token tipi: {token_type}, gönderiliyor...")
        result = await send_push_notification(user_id, title, body, {"type": "test", "timestamp": datetime.utcnow().isoformat()})
        
        return {
            "success": result,
            "message": "Bildirim gönderildi" if result else "Bildirim gönderilemedi",
            "debug": debug_info
        }
    except Exception as e:
        logger.error(f"🧪 TEST: Hata: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@api_router.post("/test/match-notification")
async def test_match_notification(
    passenger_id: str,
    driver_id: str,
    eta_min: int = 5,
    tag_id: str = None,
):
    """
    Eşleşme bildirimlerini test et: yolcuya ve sürücüye gerçek metinlerle push gönderir.
    Örnek: POST /api/test/match-notification?passenger_id=UUID&driver_id=UUID&eta_min=3
    """
    try:
        tag_id = tag_id or str(uuid.uuid4())
        passenger_title = "Paylaşımlı yolculuk başladı"
        passenger_body = "Sürücüye yazmak için tıklayın."
        driver_body = f"Yolcuya {eta_min} dk. Yolcuya git için tıklayın." if eta_min else "Yolcuya git için tıklayın."
        results = {}
        # Yolcu
        ok_p = await send_trip_push_and_log(
            passenger_id,
            "matched",
            passenger_title,
            passenger_body,
            {"type": "match_found", "tag_id": tag_id, "driver_name": "Test Sürücü", "eta_min": eta_min},
        )
        results["passenger"] = {"success": ok_p, "title": passenger_title, "body": passenger_body}
        # Sürücü
        ok_d = await send_trip_push_and_log(
            driver_id,
            "matched",
            "Eşleşme sağlandı",
            driver_body,
            {"type": "match_confirmed", "tag_id": tag_id, "passenger_name": "Test Yolcu", "price": 0, "eta_min": eta_min},
        )
        results["driver"] = {"success": ok_d, "title": "Eşleşme sağlandı", "body": driver_body}
        return {
            "success": True,
            "message": "Eşleşme test bildirimleri gönderildi",
            "results": results,
        }
    except Exception as e:
        logger.error(f"🧪 TEST match-notification: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@api_router.post("/test/push-notification-by-phone")
async def test_push_notification_by_phone(
    admin_phone: str,
    phone: str,
    title: str = "Test Bildirimi",
    body: str = "Leylek TAG bildirim sistemi testi – başarılı."
):
    """Admin: Telefon numarasına göre test push bildirimi gönder (sadece admin)."""
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    clean_phone = phone.replace("+90", "").replace("90", "", 1).replace(" ", "").replace("-", "")
    try:
        user_result = supabase.table("users").select("id, name, push_token").eq("phone", clean_phone).execute()
        if not user_result.data:
            return {"success": False, "error": "Bu numaraya kayıtlı kullanıcı bulunamadı", "phone": clean_phone}
        user = user_result.data[0]
        user_id = user.get("id")
        token = user.get("push_token")
        if not token or not ExpoPushService.is_valid_token(token):
            logger.warning(f"Test push: geçersiz veya boş token user_id={user_id}, token_preview={str(token)[:80] if token else 'NONE'}")
            return {
                "success": False,
                "error": "Kullanıcının kayıtlı push token'ı yok veya geçersiz. Uygulama açılıp bildirim izni verilmiş olmalı.",
                "user_id": user_id,
            }
        success, receipt = await _send_expo_and_get_receipt(
            token, title, body, {"type": "test", "timestamp": datetime.utcnow().isoformat()}
        )
        return {
            "success": success,
            "message": "Test bildirimi gönderildi" if success else "Bildirim gönderilemedi",
            "user_id": user_id,
            "expo_receipt": receipt,
        }
    except Exception as e:
        logger.error(f"Test push by phone error: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@api_router.get("/test/push-user-by-phone")
async def test_push_user_by_phone(phone: str):
    """
    Telefon numarasına göre kullanıcı ve push token bilgisini döner (debug).
    Örnek: GET /api/test/push-user-by-phone?phone=5326427412
    """
    try:
        phone_e164 = normalize_phone_e164(phone)
        if not phone_e164:
            return {"found": False, "error": "Geçersiz telefon", "phone_raw": phone}
        digits_only = "".join(c for c in phone_e164 if c.isdigit())
        ten_digit = digits_only[-10:] if len(digits_only) >= 10 else digits_only
        candidates = [phone_e164, digits_only, ten_digit, "0" + ten_digit if len(ten_digit) == 10 else None]
        for candidate in candidates:
            if not candidate:
                continue
            r = supabase.table("users").select("id, name, phone, push_token").eq("phone", candidate).limit(1).execute()
            if r.data:
                row = r.data[0]
                token = row.get("push_token")
                return {
                    "found": True,
                    "user_id": row.get("id"),
                    "name": row.get("name"),
                    "phone_stored": row.get("phone"),
                    "has_push_token": bool(token and len(str(token)) > 10),
                    "token_preview": (token[:40] + "...") if token else None,
                    "tried_phone": candidate,
                }
        # Son deneme: phone içinde bu 10 rakam geçen kullanıcı (boşluk/tire ile kayıtlı olabilir)
        core = ten_digit
        if len(core) >= 10:
            r = supabase.table("users").select("id, name, phone, push_token").like("phone", f"%{core}%").limit(5).execute()
            if r.data:
                for row in r.data:
                    stored = (row.get("phone") or "")
                    if core in "".join(c for c in stored if c.isdigit()):
                        token = row.get("push_token")
                        return {
                            "found": True,
                            "user_id": row.get("id"),
                            "name": row.get("name"),
                            "phone_stored": stored,
                            "has_push_token": bool(token and len(str(token)) > 10),
                            "token_preview": (token[:40] + "...") if token else None,
                            "tried_phone": f"like(%{core}%)",
                        }
        return {"found": False, "tried_candidates": [c for c in candidates if c], "phone_e164": phone_e164}
    except Exception as e:
        return {"found": False, "error": str(e)}


@api_router.post("/test/match-push-by-ids")
async def test_match_push_by_ids(driver_id: str, passenger_id: str, tag_id: str = None):
    """
    Eşleşme bildirimini UUID ile test et (gerçek eşleşmedeki gibi).
    Son eşleşen tag'in driver_id/passenger_id ile çağrılabilir.
    Örnek: POST /api/test/match-push-by-ids?driver_id=UUID&passenger_id=UUID
    """
    try:
        tid = tag_id or "test"
        match_data = {"event": "match", "trip_id": tid, "type": "matched", "tag_id": tid}
        driver_ok = await send_push_notification(
            driver_id, "Eşleşme sağlandı", "Yolcuya gitmek için tıklayın.", match_data,
        )
        passenger_ok = await send_push_notification(
            passenger_id, "Sürücü bulundu", "Sürücünüz yola çıktı.", match_data,
        )
        return {
            "success": True,
            "driver_push_sent": driver_ok,
            "passenger_push_sent": passenger_ok,
            "message": "İkisine de gönderildi" if (driver_ok and passenger_ok) else "Bazı bildirimler gönderilemedi",
        }
    except Exception as e:
        logger.exception(f"test/match-push-by-ids: {e}")
        return {"success": False, "error": str(e)}


@api_router.post("/test/match-push-by-phone")
async def test_match_push_by_phone(
    driver_phone: str,
    passenger_phone: str,
    admin_phone: str = None,
):
    """
    Eşleşme bildirimini TELEFON ile test et: sürücü ve yolcu numaralarına
    aynı metinlerle push gönderir (E.164 normalize). Admin gerekmez; sadece debug.
    Örnek: POST /api/test/match-push-by-phone?driver_phone=5326427412&passenger_phone=5361112233
    """
    try:
        match_data = {"event": "match", "trip_id": "test", "type": "matched", "tag_id": "test"}
        driver_ok = await send_push_notification(
            driver_phone,
            "Eşleşme sağlandı",
            "Yolcuya gitmek için tıklayın.",
            match_data,
        )
        passenger_ok = await send_push_notification(
            passenger_phone,
            "Sürücü bulundu",
            "Sürücünüz yola çıktı.",
            match_data,
        )
        return {
            "success": True,
            "driver_push_sent": driver_ok,
            "passenger_push_sent": passenger_ok,
            "message": "İkisine de gönderildi" if (driver_ok and passenger_ok) else "Bazı bildirimler gönderilemedi (token/ kullanıcı kontrolü)",
        }
    except Exception as e:
        logger.exception(f"test/match-push-by-phone: {e}")
        return {"success": False, "error": str(e)}


# ==================== ADMIN BİLDİRİM SİSTEMİ ====================

class AdminNotificationRequest(BaseModel):
    phone: str  # Admin phone
    title: str
    body: str
    target: str = "all"  # "all", "drivers", "passengers"
    data: dict = None

@api_router.post("/admin/send-notification")
async def admin_send_notification(request: AdminNotificationRequest):
    """Admin panelinden toplu bildirim gönder"""
    if not is_admin(request.phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        # Hedef kullanıcıları belirle
        query = supabase.table("users").select("id, name, push_token")
        
        if request.target == "drivers":
            # Sürücü bilgisi olanlar
            query = query.not_.is_("driver_details", "null")
        elif request.target == "passengers":
            # Sürücü olmayanlar veya hiç sürücü bilgisi girmemişler
            query = query.is_("driver_details", "null")
        
        result = query.execute()
        users = result.data if result.data else []
        
        valid_user_ids = [
            user["id"]
            for user in users
            if user.get("id") and ExpoPushService.is_valid_token(user.get("push_token"))
        ]
        if not valid_user_ids:
            return {"success": False, "error": "Bildirim gönderilebilecek kullanıcı bulunamadı", "total_users": len(users), "valid_tokens": 0}
        
        push_result = await send_push_notifications_to_users(
            user_ids=valid_user_ids,
            title=request.title,
            body=request.body,
            data=request.data or {"type": "admin_notification"}
        )
        
        logger.info(f"📢 Admin bildirim: '{request.title}' - {push_result['sent']}/{push_result['total']} gönderildi")
        
        return {
            "success": True,
            "total_users": len(users),
            "valid_tokens": len(valid_user_ids),
            "sent": push_result["sent"],
            "failed": push_result["failed"]
        }
        
    except Exception as e:
        logger.error(f"❌ Admin notification error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/admin/push-stats")
async def admin_push_stats(phone: str):
    """Push token istatistikleri"""
    if not is_admin(phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        # Toplam kullanıcı
        total_result = supabase.table("users").select("id", count="exact").execute()
        total_users = total_result.count if total_result.count else 0
        
        # Push token olan kullanıcılar
        with_token_result = supabase.table("users").select("id", count="exact").not_.is_("push_token", "null").execute()
        with_token = with_token_result.count if with_token_result.count else 0
        
        # Sürücüler
        drivers_result = supabase.table("users").select("id, push_token").not_.is_("driver_details", "null").execute()
        drivers = drivers_result.data if drivers_result.data else []
        drivers_with_token = sum(1 for d in drivers if d.get("push_token"))
        
        return {
            "success": True,
            "total_users": total_users,
            "users_with_push_token": with_token,
            "total_drivers": len(drivers),
            "drivers_with_push_token": drivers_with_token,
            "passengers_with_push_token": with_token - drivers_with_token
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@api_router.get("/admin/push-debug")
async def admin_push_debug(admin_phone: str, limit: int = 50):
    """Bildirim testi: Hangi kullanıcıların push token'ı var, format geçerli mi listele."""
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    try:
        result = supabase.table("users").select("id, phone, name, push_token, push_token_updated_at").not_.is_("push_token", "null").limit(limit).execute()
        users = result.data or []
        list_ = []
        for u in users:
            token = u.get("push_token") or ""
            list_.append({
                "id": u.get("id"),
                "phone_masked": ("*" * max(0, len((u.get("phone") or "")) - 4) + (u.get("phone") or "")[-4:]) if (u.get("phone") or "") else "",
                "name": u.get("name"),
                "has_push_token": bool(token),
                "token_valid_format": ExpoPushService.is_valid_token(token),
                "token_preview": token[:50] + "..." if len(token) > 50 else token,
                "push_token_updated_at": u.get("push_token_updated_at"),
            })
        return {"success": True, "users": list_, "total": len(list_)}
    except Exception as e:
        logger.error(f"Push debug error: {e}")
        return {"success": False, "error": str(e)}


@api_router.get("/admin/push-test")
async def admin_push_test(admin_phone: str):
    """
    İlk push_token dolu kullanıcıya test bildirimi gönderir, Expo API yanıtını JSON döner.
    push_token yoksa sebebini loglar ve response'ta döner.
    """
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    try:
        # İlk push_token'ı dolu kullanıcıyı al (created_at sırasına göre)
        result = supabase.table("users").select("id, phone, name, push_token").not_.is_("push_token", "null").order("created_at", desc=True).limit(1).execute()
        users = result.data or []
        if not users:
            logger.warning("push_test: Veritabanında push_token dolu hiç kullanıcı yok. Kullanıcılar giriş yapıp bildirim izni vermeli.")
            return {
                "success": False,
                "reason": "no_user_with_push_token",
                "message": "Veritabanında push_token dolu kullanıcı yok. Kullanıcılar uygulamadan giriş yapıp bildirim izni vermeli.",
                "expo_response": None,
            }
        user = users[0]
        token = (user.get("push_token") or "").strip()
        if not token:
            logger.warning("push_test: İlk kullanıcının push_token alanı boş.")
            return {
                "success": False,
                "reason": "push_token_empty",
                "message": "İlk kullanıcının push_token alanı boş.",
                "user_id": user.get("id"),
                "expo_response": None,
            }
        if not ExpoPushService.is_valid_token(token):
            logger.warning(f"push_test: Geçersiz token formatı: {token[:80]}... (ExpoPushToken[...] veya ExponentPushToken[...] olmalı)")
            return {
                "success": False,
                "reason": "invalid_token_format",
                "message": "push_token geçerli Expo formatında değil (ExpoPushToken[...] veya ExponentPushToken[...] olmalı).",
                "user_id": user.get("id"),
                "token_preview": token[:60] + "..." if len(token) > 60 else token,
                "expo_response": None,
            }
        # Expo Push API'ye istek at, tam yanıtı döndür
        message = {
            "to": token,
            "sound": "default",
            "title": "Leylek TAG Test",
            "body": "Push test bildirimi – endpoint /api/admin/push-test",
            "data": {"type": "admin_push_test", "ts": datetime.utcnow().isoformat()},
            "priority": "high",
            "channelId": "default",
        }
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {EXPO_ACCESS_TOKEN}"
        logger.info(f"push_test: Expo'ya gönderiliyor – user_id={user.get('id')}, token={token[:30]}...")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=[message],
                headers=headers,
            )
        response_body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"raw_text": response.text[:1000]}
        logger.info(f"push_test: Expo yanıtı status={response.status_code}, body={response_body}")
        return {
            "success": response.status_code == 200 and (response_body.get("data") or [{}])[0].get("status") != "error",
            "user_id": user.get("id"),
            "phone_masked": ("*" * max(0, len((user.get("phone") or "")) - 4) + (user.get("phone") or "")[-4:]) if (user.get("phone") or "") else "",
            "expo_response": response_body,
            "expo_http_status": response.status_code,
        }
    except Exception as e:
        logger.error(f"push_test hatası: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc(), "expo_response": None}


@api_router.get("/admin/push-test-by-phone")
async def admin_push_test_by_phone(admin_phone: str, phone: str):
    """
    Belirtilen telefon numarasındaki kullanıcıya 'Yeni yolculuk teklifi' test push gönderir.
    Aynı zamanda sürücünün dispatch kuyruğuna neden giremeyebileceğini görmek için
    driver_online, driver_active_until, latitude, longitude bilgilerini döner.
    Örnek: GET /api/admin/push-test-by-phone?admin_phone=5XX&phone=5326497412
    """
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    if not phone or not phone.strip():
        raise HTTPException(status_code=422, detail="phone parametresi gerekli")
    try:
        clean = phone.strip().replace("+90", "").replace("90", "", 1).replace(" ", "").replace("-", "")
        if not clean.isdigit():
            return {"success": False, "error": "Geçersiz telefon numarası", "phone": phone}
        # Önce 5 ile başlayan, sonra 0 ile başlayan dene
        for candidate in [clean, "0" + clean if not clean.startswith("0") else clean]:
            user_result = supabase.table("users").select(
                "id, name, phone, push_token, driver_online, driver_active_until, latitude, longitude, driver_details"
            ).eq("phone", candidate).limit(1).execute()
            if user_result.data:
                break
        else:
            return {"success": False, "error": "Bu numaraya kayıtlı kullanıcı bulunamadı", "phone": clean}
        user = user_result.data[0]
        user_id = user.get("id")
        token = (user.get("push_token") or "").strip()
        now_iso = datetime.utcnow().isoformat()
        driver_active_until = user.get("driver_active_until")
        has_active_package = _has_active_package_for_dispatch(driver_active_until, now_iso)
        driver_online = user.get("driver_online") is True
        has_location = user.get("latitude") is not None and user.get("longitude") is not None
        # Dispatch'e girebilmesi için: driver_online, aktif paket, konum
        dispatch_eligible = driver_online and has_active_package and has_location
        debug = {
            "user_id": user_id,
            "name": user.get("name"),
            "phone_masked": ("*" * 6 + (user.get("phone") or "")[-4:]),
            "has_push_token": bool(token),
            "token_valid_format": ExpoPushService.is_valid_token(token),
            "driver_online": driver_online,
            "driver_active_until": driver_active_until,
            "has_active_package": has_active_package,
            "has_location": has_location,
            "latitude": user.get("latitude"),
            "longitude": user.get("longitude"),
            "dispatch_eligible": dispatch_eligible,
            "reason_not_eligible": []
        }
        if not driver_online:
            debug["reason_not_eligible"].append("driver_online değil")
        if not has_active_package:
            debug["reason_not_eligible"].append("aktif paket yok (driver_active_until geçmiş)")
        if not has_location:
            debug["reason_not_eligible"].append("konum yok (latitude/longitude)")
        if not token:
            debug["reason_not_eligible"].append("push_token yok")
        if not ExpoPushService.is_valid_token(token):
            debug["reason_not_eligible"].append("push_token formatı geçersiz")
        if not token or not ExpoPushService.is_valid_token(token):
            return {"success": False, "debug": debug, "message": "Push gönderilemedi: token yok veya geçersiz", "expo_receipt": None}
        test_title = "Yeni yolculuk teklifi"
        test_body = "Yakınınızda yeni bir yolculuk isteği var."
        test_data = {"type": "new_offer", "tag_id": "test", "test": "true"}
        try:
            supabase.table("notifications_log").insert({
                "type": "new_ride_request",
                "user_id": user_id,
                "title": test_title,
                "body": test_body,
                "created_at": datetime.utcnow().isoformat(),
            }).execute()
        except Exception as log_err:
            logger.warning(f"push-test notifications_log: {log_err}")
        success, receipt = await _send_expo_and_get_receipt(
            token, test_title, test_body, test_data
        )
        return {
            "success": success,
            "debug": debug,
            "message": "Test bildirimi gönderildi" if success else "Gönderim başarısız",
            "expo_receipt": receipt,
        }
    except Exception as e:
        logger.error(f"push-test-by-phone hatası: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@api_router.get("/admin/driver-status")
async def admin_driver_status(admin_phone: str, phone: str):
    """
    Sürücü durumunu kontrol et (push göndermez): online mı, paket var mı, teklif kuyruğuna girebilir mi?
    Örnek: GET /api/admin/driver-status?admin_phone=5XX&phone=5326497412
    """
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    if not phone or not phone.strip():
        raise HTTPException(status_code=422, detail="phone parametresi gerekli")
    try:
        clean = phone.strip().replace("+90", "").replace("90", "", 1).replace(" ", "").replace("-", "")
        if not clean.isdigit():
            return {"success": False, "error": "Geçersiz telefon numarası"}
        for candidate in [clean, "0" + clean if not clean.startswith("0") else clean]:
            user_result = supabase.table("users").select(
                "id, name, phone, driver_online, driver_active_until, latitude, longitude, driver_details"
            ).eq("phone", candidate).limit(1).execute()
            if user_result.data:
                break
        else:
            return {"success": False, "error": "Bu numaraya kayıtlı kullanıcı bulunamadı", "phone": clean}
        user = user_result.data[0]
        now_iso = datetime.utcnow().isoformat()
        driver_active_until = user.get("driver_active_until")
        has_active_package = _has_active_package_for_dispatch(driver_active_until, now_iso)
        driver_online = user.get("driver_online") is True
        has_location = user.get("latitude") is not None and user.get("longitude") is not None
        dispatch_eligible = driver_online and has_active_package and has_location
        raw_vk = _driver_details_as_dict(user).get("vehicle_kind")
        effective_vk = _effective_driver_vehicle_kind(user)
        passenger_pref = _passenger_preferred_vehicle_from_row(user)
        return {
            "success": True,
            "phone_masked": ("*" * 6 + (user.get("phone") or "")[-4:]),
            "name": user.get("name"),
            "user_id": user.get("id"),
            "driver_online": driver_online,
            "driver_active_until": driver_active_until,
            "aktif_paket_var": has_active_package,
            "konum_var": has_location,
            "latitude": user.get("latitude"),
            "longitude": user.get("longitude"),
            "teklif_kuyruguna_girebilir": dispatch_eligible,
            "aciklama": "Sürücü aktif ve paket geçerli" if dispatch_eligible else (
                "Sürücü online değil" if not driver_online else
                "Aktif paket yok veya süresi dolmuş" if not has_active_package else
                "Konum yok"
            ),
            # Dispatch araç filtresi: users.driver_details.vehicle_kind (yoksa car)
            "driver_details_vehicle_kind_raw": raw_vk,
            "dispatch_vehicle_kind_effective": effective_vk,
            "passenger_preferred_vehicle": passenger_pref,
            "dispatch_filter_note": "Katı: yolcu car → sadece car sürücü; motorcycle → sadece motorcycle. Eksik vehicle_kind -> car.",
        }
    except Exception as e:
        logger.error(f"driver-status error: {e}")
        return {"success": False, "error": str(e)}


@api_router.post("/admin/driver-set-online")
@api_router.get("/admin/driver-set-online")
async def admin_driver_set_online(admin_phone: str, phone: str, hours: int = 24):
    """
    Admin: Belirtilen telefon numarasındaki sürücüyü online yap ve paket süresi ver (test için).
    Böylece sürücü teklif kuyruğuna girer ve eşleşince bildirim alır.
    Örnek: POST /api/admin/driver-set-online?admin_phone=5XX&phone=5326497412&hours=24
    """
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    if not phone or not phone.strip():
        raise HTTPException(status_code=422, detail="phone parametresi gerekli")
    try:
        clean = phone.strip().replace("+90", "").replace("90", "", 1).replace(" ", "").replace("-", "")
        if not clean.isdigit():
            return {"success": False, "error": "Geçersiz telefon numarası"}
        for candidate in [clean, "0" + clean if not clean.startswith("0") else clean]:
            user_result = supabase.table("users").select("id, name, phone, driver_details").eq("phone", candidate).limit(1).execute()
            if user_result.data:
                break
        else:
            return {"success": False, "error": "Bu numaraya kayıtlı kullanıcı bulunamadı"}
        user = user_result.data[0]
        user_id = user.get("id")
        now = datetime.utcnow()
        active_until = (now + timedelta(hours=max(1, min(hours, 720)))).isoformat()
        supabase.table("users").update({
            "driver_online": True,
            "driver_active_until": active_until,
            "updated_at": now.isoformat(),
        }).eq("id", user_id).execute()
        logger.info(f"✅ Admin: Sürücü online yapıldı: {user.get('name')} ({phone}) -> {hours}h paket")
        return {
            "success": True,
            "message": f"Sürücü online yapıldı, {hours} saat paket atandı.",
            "user_id": user_id,
            "name": user.get("name"),
            "phone_masked": ("*" * 6 + (user.get("phone") or "")[-4:]),
            "driver_online": True,
            "driver_active_until": active_until,
        }
    except Exception as e:
        logger.error(f"admin_driver_set_online error: {e}")
        return {"success": False, "error": str(e)}


@api_router.post("/admin/cleanup-invalid-tokens")
async def cleanup_invalid_tokens(admin_phone: str):
    """Geçersiz/test push token'ları temizle"""
    if not is_admin(admin_phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        # Token'ı olan tüm kullanıcıları al
        result = supabase.table("users").select("id, name, push_token").not_.is_("push_token", "null").execute()
        
        cleaned = 0
        for user in result.data or []:
            token = user.get("push_token", "")
            # Test token'ları veya geçersiz formatları temizle
            if "TEST" in token or "test" in token or not token.startswith("ExponentPushToken["):
                supabase.table("users").update({"push_token": None}).eq("id", user["id"]).execute()
                cleaned += 1
                logger.info(f"🧹 Geçersiz token temizlendi: {user['name']} - {token[:30]}...")
        
        return {
            "success": True,
            "cleaned": cleaned,
            "message": f"{cleaned} geçersiz token temizlendi"
        }
    except Exception as e:
        logger.error(f"Token cleanup error: {e}")
        return {"success": False, "error": str(e)}


# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/dashboard")
async def admin_dashboard(admin_phone: str):
    """Admin dashboard istatistikleri"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # Kullanıcı sayıları
        users_result = supabase.table("users").select("id, driver_details", count="exact").execute()
        total_users = users_result.count or 0
        
        drivers = sum(1 for u in users_result.data if u.get("driver_details"))
        passengers = total_users - drivers
        
        # TAG istatistikleri
        completed_result = supabase.table("tags").select("id", count="exact").eq("status", "completed").execute()
        active_result = supabase.table("tags").select("id", count="exact").in_("status", ["pending", "offers_received", "matched", "in_progress"]).execute()
        
        return {
            "success": True,
            "stats": {
                "total_users": total_users,
                "total_drivers": drivers,
                "total_passengers": passengers,
                "completed_trips": completed_result.count or 0,
                "active_trips": active_result.count or 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/users")
async def admin_get_users(admin_phone: str, page: int = 1, limit: int = 20, search: str = None):
    """Admin - Kullanıcı listesi"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        offset = (page - 1) * limit
        
        query = supabase.table("users").select("*", count="exact")
        
        if search:
            query = query.or_(f"phone.ilike.%{search}%,name.ilike.%{search}%")
        
        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        users = []
        for u in result.data:
            users.append({
                "id": u["id"],
                "phone": u["phone"],
                "name": u["name"],
                "city": u.get("city"),
                "rating": float(u.get("rating", 5.0)),
                "total_trips": u.get("total_trips", 0),
                "is_active": u.get("is_active", True),
                "is_driver": bool(u.get("driver_details")),
                "created_at": u.get("created_at")
            })
        
        return {
            "success": True,
            "users": users,
            "total": result.count or 0,
            "page": page,
            "limit": limit
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin get users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/settings")
async def admin_get_settings(admin_phone: str):
    """Admin ayarlarını getir"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        result = supabase.table("app_settings").select("*").eq("type", "global").execute()
        
        if result.data:
            settings = result.data[0]
            return {
                "success": True,
                "settings": {
                    "driver_radius_km": settings.get("driver_radius_km", 50),
                    "max_call_duration_minutes": settings.get("max_call_duration_minutes", 30)
                }
            }
        
        return {"success": True, "settings": {"driver_radius_km": 50, "max_call_duration_minutes": 30}}
    except Exception as e:
        logger.error(f"Admin get settings error: {e}")
        return {"success": False, "settings": {}}

@api_router.post("/admin/settings")
async def admin_update_settings(admin_phone: str, driver_radius_km: int = None, max_call_duration_minutes: int = None):
    """Admin ayarlarını güncelle"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        updates = {"updated_at": datetime.utcnow().isoformat()}
        if driver_radius_km is not None:
            updates["driver_radius_km"] = driver_radius_km
        if max_call_duration_minutes is not None:
            updates["max_call_duration_minutes"] = max_call_duration_minutes
        
        supabase.table("app_settings").update(updates).eq("type", "global").execute()
        
        return {"success": True, "message": "Ayarlar güncellendi"}
    except Exception as e:
        logger.error(f"Admin update settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/send-notification")
async def admin_send_notification(admin_phone: str, title: str, message: str, target: str = "all", user_id: str = None):
    """Push bildirim gönder ve kaydet"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        target_user_ids = []
        token_user_ids = []
        target_count = 0
        
        if target == "all":
            result = supabase.table("users").select("id, push_token").execute()
            target_count = len(result.data)
            target_user_ids = [r["id"] for r in result.data if r.get("id")]
            token_user_ids = [r["id"] for r in result.data if r.get("id") and ExpoPushService.is_valid_token(r.get("push_token"))]
        elif target == "drivers":
            result = supabase.table("users").select("id, push_token, driver_details").execute()
            drivers = [r for r in result.data if r.get("driver_details")]
            target_count = len(drivers)
            target_user_ids = [r["id"] for r in drivers if r.get("id")]
            token_user_ids = [r["id"] for r in drivers if r.get("id") and ExpoPushService.is_valid_token(r.get("push_token"))]
        elif target == "passengers":
            result = supabase.table("users").select("id, push_token, driver_details").execute()
            passengers = [r for r in result.data if not r.get("driver_details")]
            target_count = len(passengers)
            target_user_ids = [r["id"] for r in passengers if r.get("id")]
            token_user_ids = [r["id"] for r in passengers if r.get("id") and ExpoPushService.is_valid_token(r.get("push_token"))]
        elif target == "user" and user_id:
            result = supabase.table("users").select("id, push_token").eq("id", user_id).execute()
            target_count = 1
            if result.data and result.data[0].get("id"):
                target_user_ids = [result.data[0]["id"]]
                if ExpoPushService.is_valid_token(result.data[0].get("push_token")):
                    token_user_ids = [result.data[0]["id"]]
        
        sent_count = 0
        failed_count = 0
        
        # Push bildirim gönder (tokenı uygun kullanıcılar)
        if token_user_ids:
            try:
                push_result = await send_push_notifications_to_users(
                    user_ids=token_user_ids,
                    title=title,
                    body=message,
                    data={"type": "admin_notification", "target": target}
                )
                sent_count = push_result.get("sent", 0)
                failed_count = push_result.get("failed", 0)
            except Exception as e:
                logger.error(f"Push notification error: {e}")
                failed_count = len(token_user_ids)
        
        # Admin bilgisini al
        admin_result = supabase.table("users").select("id").eq("phone", admin_phone).execute()
        admin_id = admin_result.data[0]["id"] if admin_result.data else None
        
        # Bildirimi veritabanına kaydet
        try:
            supabase.table("notifications").insert({
                "title": title,
                "message": message,
                "target_type": target,
                "target_user_id": user_id if target == "user" else None,
                "sent_by": admin_id,
                "sent_by_phone": admin_phone,
                "status": "sent",
                "metadata": {
                    "target_count": target_count,
                    "push_sent": sent_count,
                    "push_failed": failed_count,
                    "tokens_available": len(token_user_ids),
                    "target_user_ids_count": len(target_user_ids)
                }
            }).execute()
        except Exception as e:
            logger.error(f"Notification save error: {e}")
        
        logger.info(f"📢 Bildirim gönderildi: {title} -> {target} ({sent_count} başarılı)")
        
        return {
            "success": True,
            "target_count": target_count,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "message": f"{target_count} kişiye bildirim gönderildi"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin send notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/notifications")
async def admin_get_notifications(admin_phone: str, limit: int = 50):
    """Gönderilen bildirimleri listele"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        result = supabase.table("notifications").select("*").order("created_at", desc=True).limit(limit).execute()
        
        return {"success": True, "notifications": result.data, "total": len(result.data)}
    except Exception as e:
        logger.error(f"Admin get notifications error: {e}")
        return {"success": False, "notifications": []}

@api_router.post("/admin/cleanup-inactive-tags")
async def admin_cleanup_inactive_tags(admin_phone: str = None, max_inactive_minutes: int = 30):
    """30 dakikadan fazla inaktif TAG'leri otomatik bitir"""
    try:
        # Admin değilse de çalışabilir (cron job için)
        if admin_phone and admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        cutoff_time = (datetime.utcnow() - timedelta(minutes=max_inactive_minutes)).isoformat()
        
        # Aktif TAG'leri bul (matched veya in_progress)
        result = supabase.table("tags").select("id, passenger_id, driver_id, status, last_activity").in_("status", ["matched", "in_progress"]).execute()
        
        cleaned_count = 0
        for tag in result.data:
            last_activity = tag.get("last_activity") or tag.get("matched_at") or tag.get("created_at")
            
            if last_activity:
                try:
                    activity_time = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                    now = datetime.now(activity_time.tzinfo)
                    
                    if (now - activity_time).total_seconds() > max_inactive_minutes * 60:
                        # TAG'i iptal et
                        supabase.table("tags").update({
                            "status": "cancelled",
                            "cancelled_at": datetime.utcnow().isoformat()
                        }).eq("id", tag["id"]).execute()
                        
                        cleaned_count += 1
                        logger.info(f"🧹 İnaktif TAG temizlendi: {tag['id']}")
                except Exception as e:
                    logger.error(f"TAG cleanup error for {tag['id']}: {e}")
        
        return {
            "success": True,
            "cleaned_count": cleaned_count,
            "message": f"{cleaned_count} inaktif TAG temizlendi"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup inactive tags error: {e}")
        return {"success": False, "cleaned_count": 0}

@api_router.post("/admin/toggle-user")
async def admin_toggle_user(admin_phone: str, user_id: str, is_active: bool):
    """Kullanıcıyı aktif/pasif yap"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        supabase.table("users").update({"is_active": is_active}).eq("id", user_id).execute()
        
        return {"success": True, "message": f"Kullanıcı {'aktif' if is_active else 'pasif'} yapıldı"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/delete-user")
async def admin_delete_user(admin_phone: str, user_id: str):
    """Kullanıcıyı sil"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        supabase.table("users").delete().eq("id", user_id).execute()
        
        return {"success": True, "message": "Kullanıcı silindi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - ARAMALAR ====================

@api_router.get("/admin/calls")
async def admin_get_calls(admin_phone: str, limit: int = 100):
    """Tüm aramaları getir - Admin için"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        result = supabase.table("calls").select("*").order("created_at", desc=True).limit(limit).execute()
        
        calls = []
        for call in result.data:
            # Arayan ve aranan bilgisi
            caller_name = "Bilinmiyor"
            receiver_name = "Bilinmiyor"
            
            try:
                if call.get("caller_id"):
                    caller_result = supabase.table("users").select("name, phone").eq("id", call["caller_id"]).execute()
                    if caller_result.data:
                        caller_name = f"{caller_result.data[0].get('name', 'Bilinmiyor')} ({caller_result.data[0].get('phone', '')})"
                
                if call.get("receiver_id"):
                    receiver_result = supabase.table("users").select("name, phone").eq("id", call["receiver_id"]).execute()
                    if receiver_result.data:
                        receiver_name = f"{receiver_result.data[0].get('name', 'Bilinmiyor')} ({receiver_result.data[0].get('phone', '')})"
            except:
                pass
            
            # Süre hesapla
            duration = None
            if call.get("answered_at") and call.get("ended_at"):
                try:
                    answered = datetime.fromisoformat(call["answered_at"].replace("Z", "+00:00"))
                    ended = datetime.fromisoformat(call["ended_at"].replace("Z", "+00:00"))
                    duration = int((ended - answered).total_seconds())
                except:
                    pass
            
            calls.append({
                "id": call.get("id"),
                "call_id": call.get("call_id"),
                "caller_id": call.get("caller_id"),
                "caller_name": caller_name,
                "receiver_id": call.get("receiver_id"),
                "receiver_name": receiver_name,
                "call_type": call.get("call_type", "voice"),
                "status": call.get("status"),
                "duration_seconds": duration,
                "created_at": call.get("created_at"),
                "answered_at": call.get("answered_at"),
                "ended_at": call.get("ended_at"),
                "tag_id": call.get("tag_id")
            })
        
        return {"success": True, "calls": calls, "total": len(calls)}
    except Exception as e:
        logger.error(f"Admin get calls error: {e}")
        return {"success": False, "calls": [], "error": str(e)}

@api_router.get("/admin/tags")
async def admin_get_tags(admin_phone: str, limit: int = 100, status: str = None):
    """Tüm TAG'leri (yolculukları) getir - Admin için"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        query = supabase.table("tags").select("*")
        
        if status:
            query = query.eq("status", status)
        
        result = query.order("created_at", desc=True).limit(limit).execute()
        
        tags = []
        for tag in result.data:
            # Yolcu ve şoför bilgisi
            passenger_name = "Bilinmiyor"
            driver_name = "Bilinmiyor"
            passenger_phone = ""
            driver_phone = ""
            
            try:
                if tag.get("passenger_id"):
                    p_result = supabase.table("users").select("name, phone").eq("id", tag["passenger_id"]).execute()
                    if p_result.data:
                        passenger_name = p_result.data[0].get("name", "Bilinmiyor")
                        passenger_phone = p_result.data[0].get("phone", "")
                
                if tag.get("driver_id"):
                    d_result = supabase.table("users").select("name, phone").eq("id", tag["driver_id"]).execute()
                    if d_result.data:
                        driver_name = d_result.data[0].get("name", "Bilinmiyor")
                        driver_phone = d_result.data[0].get("phone", "")
            except:
                pass
            
            tags.append({
                "id": tag.get("id"),
                "status": tag.get("status"),
                "passenger_id": tag.get("passenger_id"),
                "passenger_name": passenger_name,
                "passenger_phone": passenger_phone,
                "driver_id": tag.get("driver_id"),
                "driver_name": driver_name,
                "driver_phone": driver_phone,
                "pickup_location": tag.get("pickup_location"),
                "dropoff_location": tag.get("dropoff_location"),
                "final_price": tag.get("final_price"),
                "city": tag.get("city"),
                "created_at": tag.get("created_at"),
                "matched_at": tag.get("matched_at"),
                "started_at": tag.get("started_at"),
                "completed_at": tag.get("completed_at"),
                "cancelled_at": tag.get("cancelled_at")
            })
        
        return {"success": True, "tags": tags, "total": len(tags)}
    except Exception as e:
        logger.error(f"Admin get tags error: {e}")
        return {"success": False, "tags": [], "error": str(e)}

@api_router.get("/admin/user-detail")
async def admin_get_user_detail(admin_phone: str, user_id: str):
    """Kullanıcı detayı - tüm TAG'leri ve aramaları ile"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # Kullanıcı bilgisi
        user_result = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user_result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = user_result.data[0]
        
        # Kullanıcının TAG'leri (yolcu veya şoför olarak)
        tags_result = supabase.table("tags").select("*").or_(f"passenger_id.eq.{user_id},driver_id.eq.{user_id}").order("created_at", desc=True).limit(50).execute()
        
        # Kullanıcının aramaları
        calls_result = supabase.table("calls").select("*").or_(f"caller_id.eq.{user_id},receiver_id.eq.{user_id}").order("created_at", desc=True).limit(50).execute()
        
        # Kullanıcının şikayetleri (yapılan ve alınan)
        reports_made = supabase.table("reports").select("*").eq("reporter_id", user_id).execute()
        reports_received = supabase.table("reports").select("*").eq("reported_id", user_id).execute()
        
        # Engelleme bilgisi
        blocked_by_user = supabase.table("blocked_users").select("blocked_user_id").eq("user_id", user_id).execute()
        blocked_user = supabase.table("blocked_users").select("user_id").eq("blocked_user_id", user_id).execute()
        
        return {
            "success": True,
            "user": {
                "id": user.get("id"),
                "name": user.get("name"),
                "phone": user.get("phone"),
                "role": user.get("role"),
                "city": user.get("city"),
                "rating": user.get("rating"),
                "total_ratings": user.get("total_ratings"),
                "is_active": user.get("is_active"),
                "is_premium": user.get("is_premium"),
                "is_admin": user.get("is_admin"),
                "created_at": user.get("created_at"),
                "driver_details": user.get("driver_details")
            },
            "stats": {
                "total_tags": len(tags_result.data),
                "total_calls": len(calls_result.data),
                "reports_made": len(reports_made.data),
                "reports_received": len(reports_received.data),
                "users_blocked": len(blocked_by_user.data),
                "blocked_by_users": len(blocked_user.data)
            },
            "tags": tags_result.data,
            "calls": calls_result.data,
            "reports_made": reports_made.data,
            "reports_received": reports_received.data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin get user detail error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== STORAGE ENDPOINTS ====================

@api_router.post("/storage/upload-profile-photo")
async def upload_profile_photo(user_id: str, file: UploadFile = File(...)):
    """Profil fotoğrafı yükle"""
    try:
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Max 5MB")
        
        file_path = f"{user_id}/profile.jpg"
        
        # Supabase Storage'a yükle
        result = supabase.storage.from_("profile-photos").upload(
            path=file_path,
            file=contents,
            file_options={"content-type": file.content_type or "image/jpeg", "upsert": "true"}
        )
        
        public_url = supabase.storage.from_("profile-photos").get_public_url(file_path)
        
        # MongoDB'de güncelle
        supabase.table("users").update({"profile_photo": public_url}).eq("id", user_id).execute()
        
        return {"success": True, "url": public_url}
    except Exception as e:
        logger.error(f"Upload profile photo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/storage/upload-vehicle-photo")
async def upload_vehicle_photo(user_id: str, file: UploadFile = File(...)):
    """Araç fotoğrafı yükle"""
    try:
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Max 5MB")
        
        file_path = f"{user_id}/vehicle.jpg"
        
        result = supabase.storage.from_("vehicle-photos").upload(
            path=file_path,
            file=contents,
            file_options={"content-type": file.content_type or "image/jpeg", "upsert": "true"}
        )
        
        public_url = supabase.storage.from_("vehicle-photos").get_public_url(file_path)
        
        # Driver details güncelle
        user_result = supabase.table("users").select("driver_details").eq("id", user_id).execute()
        if user_result.data:
            driver_details = user_result.data[0].get("driver_details") or {}
            driver_details["vehicle_photo"] = public_url
            supabase.table("users").update({"driver_details": driver_details}).eq("id", user_id).execute()
        
        return {"success": True, "url": public_url}
    except Exception as e:
        logger.error(f"Upload vehicle photo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== REALTIME INFO ====================

@api_router.get("/realtime/channel-info")
async def get_realtime_channel_info(trip_id: str = None, user_id: str = None):
    """Realtime kanal bilgileri"""
    channels = {}
    if trip_id:
        channels["trip"] = f"leylek_trip_{trip_id}"
    if user_id:
        channels["location"] = f"leylek_location_{user_id}"
    
    return {
        "success": True,
        "supabase_url": _supabase_core.SUPABASE_URL,
        "channels": channels
    }

# ==================== VOICE/VIDEO CALL ENDPOINTS ====================

# Agora credentials - HARDCODED (güvenli değil ama çalışır)
AGORA_APP_ID = "86eb50030f954355bc57696d45b343bd"
AGORA_APP_CERTIFICATE = "39bbddeb0cd94cd89acf6ed9196b8fcd"

def generate_agora_token(channel_name: str, uid: int = 0, expiration_seconds: int = 86400) -> str:
    """Agora RTC token üret - 24 saat geçerli"""
    if not AGORA_APP_CERTIFICATE:
        logger.warning("⚠️ Agora token üretilemiyor - certificate eksik")
        return ""
    
    try:
        # Token süresi (Unix timestamp) - 24 saat
        privilege_expired_ts = int(time.time()) + expiration_seconds
        
        # Role = 1 (Publisher), 2 (Subscriber)
        ROLE_PUBLISHER = 1
        
        # Token üret
        token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channel_name,
            uid,
            ROLE_PUBLISHER,
            privilege_expired_ts
        )
        logger.info(f"🎫 Agora token üretildi: {channel_name}")
        return token
    except Exception as e:
        logger.error(f"Agora token üretme hatası: {e}")
        return ""

@api_router.get("/voice/get-token")
async def get_agora_token(channel_name: str, uid: int = 0):
    """Agora RTC token al"""
    try:
        token = generate_agora_token(channel_name, uid)
        return {
            "success": True,
            "token": token,
            "app_id": AGORA_APP_ID,
            "channel_name": channel_name,
            "uid": uid
        }
    except Exception as e:
        logger.error(f"Get token error: {e}")
        return {"success": False, "token": "", "detail": str(e)}

# Frontend uyumluluğu için alias - /api/agora/token
@api_router.get("/agora/token")
async def get_agora_token_alias(channel_name: str, uid: int = 0):
    """Agora RTC token al (alias endpoint)"""
    try:
        token = generate_agora_token(channel_name, uid)
        logger.info(f"🎫 Token istendi: channel={channel_name}, uid={uid}, token_length={len(token) if token else 0}")
        return {
            "success": True,
            "token": token,
            "app_id": AGORA_APP_ID,
            "channel_name": channel_name,
            "uid": uid
        }
    except Exception as e:
        logger.error(f"Get token error: {e}")
        return {"success": False, "token": "", "detail": str(e)}

# ==================== SUPABASE REALTIME ARAMA SİSTEMİ ====================
# Tüm aramalar Supabase'de saklanır - in-memory yapı YOK
# Backend sadece denetleyici, veriler tamamen Supabase'de
# Tablo adı: calls

class StartCallRequest(BaseModel):
    caller_id: str
    receiver_id: Optional[str] = None
    call_type: str = "voice"
    tag_id: Optional[str] = None
    caller_name: Optional[str] = None

@api_router.post("/voice/start-call")
async def start_call(request: StartCallRequest):
    """Arama başlat - Supabase'e kaydet"""
    try:
        call_id = f"call_{secrets.token_urlsafe(8)}"
        channel_name = f"leylek_{call_id}"
        
        # Son 5 saniyede arama yapılmış mı kontrol et (cooldown)
        five_seconds_ago = (datetime.utcnow() - timedelta(seconds=5)).isoformat()
        try:
            recent_call = supabase.table("calls").select("id").eq("caller_id", request.caller_id).gte("created_at", five_seconds_ago).execute()
            if recent_call.data:
                return {"success": False, "detail": "Lütfen 5 saniye bekleyin"}
        except:
            pass  # Tablo yoksa devam et
        
        # receiver_id yoksa tag_id'den bul
        receiver_id = request.receiver_id
        if not receiver_id and request.tag_id:
            tag_result = supabase.table("tags").select("passenger_id, driver_id").eq("id", request.tag_id).execute()
            if tag_result.data:
                tag = tag_result.data[0]
                if tag.get("passenger_id") == request.caller_id:
                    receiver_id = tag.get("driver_id")
                else:
                    receiver_id = tag.get("passenger_id")
        
        if not receiver_id:
            return {"success": False, "detail": "Alıcı bulunamadı"}
        
        # Önceki aktif aramaları iptal et
        try:
            supabase.table("calls").update({
                "status": "cancelled",
                "ended_at": datetime.utcnow().isoformat()
            }).eq("status", "ringing").or_(f"caller_id.eq.{request.caller_id},receiver_id.eq.{request.caller_id}").execute()
        except:
            pass
        
        # Agora token üret
        token = generate_agora_token(channel_name, 0)
        
        # Arayan bilgisi
        caller_name = request.caller_name
        if not caller_name:
            try:
                caller_result = supabase.table("users").select("name").eq("id", request.caller_id).execute()
                caller_name = caller_result.data[0]["name"] if caller_result.data else "Kullanıcı"
            except:
                caller_name = "Kullanıcı"
        
        # Yeni arama kaydı oluştur - SUPABASE'E KAYDET
        call_data = {
            "call_id": call_id,
            "channel_name": channel_name,
            "caller_id": request.caller_id,
            "receiver_id": receiver_id,
            "tag_id": request.tag_id,
            "call_type": request.call_type,
            "status": "ringing",
            "agora_token": token
        }
        
        result = supabase.table("calls").insert(call_data).execute()
        
        if not result.data:
            return {"success": False, "detail": "Arama kaydedilemedi"}
        
        logger.info(f"📞 SUPABASE: Arama başlatıldı: {call_id} - {request.caller_id} -> {receiver_id}")
        try:
            asyncio.create_task(send_push_notification(
                receiver_id,
                f"📞 {caller_name}",
                "Size gelen bir arama var.",
                build_call_push_payload(
                    "incoming_call",
                    request.caller_id,
                    caller_name,
                    request.call_type,
                    call_id=call_id,
                    channel_name=channel_name,
                    agora_token=token,
                    tag_id=request.tag_id,
                )
            ))
        except Exception as push_err:
            logger.warning(f"⚠️ Voice call push gönderilemedi: {push_err}")
        
        return {
            "success": True,
            "call_id": call_id,
            "channel_name": channel_name,
            "agora_app_id": AGORA_APP_ID,
            "agora_token": token,
            "caller_name": caller_name,
            "receiver_id": receiver_id
        }
    except Exception as e:
        logger.error(f"Start call error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.get("/voice/check-incoming")
async def check_incoming_call(user_id: str):
    """Gelen arama var mı kontrol et - Supabase'den oku"""
    try:
        # Bu kullanıcıya gelen aktif (ringing) arama var mı?
        result = supabase.table("calls").select("*").eq("receiver_id", user_id).eq("status", "ringing").order("created_at", desc=True).limit(1).execute()
        
        if result.data:
            call = result.data[0]
            
            # 90 saniyeden eski aramayı otomatik "missed" yap
            created_at = datetime.fromisoformat(call["created_at"].replace("Z", "+00:00"))
            if datetime.now(created_at.tzinfo) - created_at > timedelta(seconds=90):
                supabase.table("calls").update({
                    "status": "missed",
                    "ended_at": datetime.utcnow().isoformat()
                }).eq("call_id", call["call_id"]).execute()
                return {"success": True, "has_incoming": False, "call": None}
            
            # Arayan bilgisi
            caller_name = "Kullanıcı"
            caller_photo = None
            try:
                caller_result = supabase.table("users").select("name, profile_photo").eq("id", call["caller_id"]).execute()
                if caller_result.data:
                    caller_name = caller_result.data[0].get("name", "Kullanıcı")
                    caller_photo = caller_result.data[0].get("profile_photo")
            except:
                pass
            
            return {
                "success": True,
                "has_incoming": True,
                "call": {
                    "call_id": call["call_id"],
                    "caller_id": call["caller_id"],
                    "caller_name": caller_name,
                    "caller_photo": caller_photo,
                    "call_type": call["call_type"],
                    "channel_name": call["channel_name"],
                    "agora_app_id": AGORA_APP_ID,
                    "agora_token": call.get("agora_token")
                }
            }
        
        # Son iptal edilen aramayı kontrol et - ARAYAN İPTAL ETTİ Mİ?
        cancelled_result = supabase.table("calls").select("*").eq("receiver_id", user_id).in_("status", ["cancelled", "ended", "rejected"]).order("ended_at", desc=True).limit(1).execute()
        
        if cancelled_result.data:
            cancelled_call = cancelled_result.data[0]
            ended_at = cancelled_call.get("ended_at")
            if ended_at:
                ended_time = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
                # Son 15 saniye içinde iptal edilmiş aramayı bildir (daha geniş pencere)
                if datetime.now(ended_time.tzinfo) - ended_time < timedelta(seconds=15):
                    logger.info(f"📵 Arama iptal edildi bildiriliyor: {cancelled_call['call_id']} - {cancelled_call['status']}")
                    return {
                        "success": True,
                        "has_incoming": False,
                        "call": None,
                        "call_cancelled": True,
                        "call_ended": True,
                        "end_reason": cancelled_call.get("status"),
                        "call_id": cancelled_call.get("call_id")
                    }
        
        return {"success": True, "has_incoming": False, "call": None}
    except Exception as e:
        logger.error(f"Check incoming call error: {e}")
        return {"success": True, "has_incoming": False, "call": None}

@api_router.post("/voice/accept-call")
async def accept_call(user_id: str, call_id: str):
    """Aramayı kabul et - Supabase'de güncelle"""
    try:
        # Aramayı bul ve güncelle
        result = supabase.table("calls").update({
            "status": "connected",
            "answered_at": datetime.utcnow().isoformat()
        }).eq("call_id", call_id).eq("receiver_id", user_id).eq("status", "ringing").execute()
        
        if result.data:
            call = result.data[0]
            logger.info(f"✅ SUPABASE: Arama kabul edildi: {call_id}")
            return {
                "success": True,
                "channel_name": call["channel_name"],
                "agora_app_id": AGORA_APP_ID,
                "agora_token": call.get("agora_token")
            }
        
        return {"success": False, "detail": "Arama bulunamadı veya zaten cevaplanmış"}
    except Exception as e:
        logger.error(f"Accept call error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/voice/reject-call")
async def reject_call(user_id: str, call_id: str = None, tag_id: str = None):
    """Aramayı reddet - Supabase'de güncelle"""
    try:
        # call_id yoksa tag_id'den en son ringing aramayı bul
        if not call_id and tag_id:
            call_result = supabase.table("calls").select("call_id").eq("tag_id", tag_id).eq("status", "ringing").order("created_at", desc=True).limit(1).execute()
            if call_result.data:
                call_id = call_result.data[0]["call_id"]
        
        # call_id yoksa kullanıcının en son ringing aramasını bul
        if not call_id:
            call_result = supabase.table("calls").select("call_id").eq("receiver_id", user_id).eq("status", "ringing").order("created_at", desc=True).limit(1).execute()
            if call_result.data:
                call_id = call_result.data[0]["call_id"]
        
        if not call_id:
            return {"success": False, "detail": "Aktif arama bulunamadı"}
        
        result = supabase.table("calls").update({
            "status": "rejected",
            "ended_at": datetime.utcnow().isoformat(),
            "ended_by": user_id
        }).eq("call_id", call_id).eq("status", "ringing").execute()
        
        if result.data:
            logger.info(f"📵 SUPABASE: Arama reddedildi: {call_id}")
        
        return {"success": True, "call_id": call_id}
    except Exception as e:
        logger.error(f"Reject call error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.get("/voice/check-call-status")
async def check_call_status(user_id: str, call_id: str):
    """Arayan için arama durumunu kontrol et - Supabase'den oku"""
    try:
        result = supabase.table("calls").select("*").eq("call_id", call_id).execute()
        
        if not result.data:
            return {"success": True, "status": "ended", "should_close": True}
        
        call = result.data[0]
        status = call.get("status")
        
        if status == "connected":
            return {
                "success": True,
                "status": "accepted",
                "should_close": False,
                "channel_name": call["channel_name"]
            }
        elif status == "rejected":
            return {
                "success": True,
                "status": "rejected",
                "should_close": True
            }
        elif status in ["ended", "cancelled", "missed"]:
            return {
                "success": True,
                "status": "ended",
                "should_close": True
            }
        elif status == "ringing":
            # 90 saniyeden fazla çalıyorsa timeout (1.5 dakika)
            created_at = datetime.fromisoformat(call["created_at"].replace("Z", "+00:00"))
            if datetime.now(created_at.tzinfo) - created_at > timedelta(seconds=90):
                # Timeout - missed olarak işaretle
                supabase.table("calls").update({
                    "status": "missed",
                    "ended_at": datetime.utcnow().isoformat()
                }).eq("call_id", call_id).execute()
                return {"success": True, "status": "ended", "should_close": True}
            
            return {
                "success": True,
                "status": "ringing",
                "should_close": False
            }
        
        return {"success": True, "status": status, "should_close": False}
    except Exception as e:
        logger.error(f"Check call status error: {e}")
        return {"success": True, "status": "ended", "should_close": True}

@api_router.post("/voice/end-call")
async def end_call(user_id: str, call_id: str = None):
    """Aramayı sonlandır - Supabase'de güncelle"""
    try:
        if call_id:
            # Belirli aramayı sonlandır
            result = supabase.table("calls").update({
                "status": "ended",
                "ended_at": datetime.utcnow().isoformat(),
                "ended_by": user_id
            }).eq("call_id", call_id).in_("status", ["ringing", "connected"]).execute()
            
            if result.data:
                logger.info(f"📴 SUPABASE: Arama sonlandırıldı: {call_id} by {user_id}")
        else:
            # Bu kullanıcının tüm aktif aramalarını sonlandır
            supabase.table("calls").update({
                "status": "ended",
                "ended_at": datetime.utcnow().isoformat(),
                "ended_by": user_id
            }).or_(f"caller_id.eq.{user_id},receiver_id.eq.{user_id}").in_("status", ["ringing", "connected"]).execute()
            
            logger.info(f"📴 SUPABASE: Kullanıcının tüm aramaları sonlandırıldı: {user_id}")
        
        return {"success": True}
    except Exception as e:
        logger.error(f"End call error: {e}")
        return {"success": False}

@api_router.post("/voice/cancel-call")
async def cancel_call(user_id: str, call_id: str = None):
    """Aramayı iptal et (henüz cevaplanmadan) - Supabase'de güncelle"""
    try:
        if call_id:
            # call_id "call_xxx" formatındaysa düzelt
            if not call_id.startswith("call_"):
                call_id = f"call_{call_id}"
            
            result = supabase.table("calls").update({
                "status": "cancelled",
                "ended_at": datetime.utcnow().isoformat(),
                "ended_by": user_id
            }).eq("call_id", call_id).eq("caller_id", user_id).eq("status", "ringing").execute()
            
            if result.data:
                logger.info(f"📵 SUPABASE: Arama iptal edildi: {call_id}")
        else:
            # Kullanıcının aktif ringing aramalarını iptal et
            supabase.table("calls").update({
                "status": "cancelled",
                "ended_at": datetime.utcnow().isoformat(),
                "ended_by": user_id
            }).eq("caller_id", user_id).eq("status", "ringing").execute()
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Cancel call error: {e}")
        return {"success": False}

# Arama geçmişi endpoint'i
@api_router.get("/voice/history")
async def get_call_history(user_id: str, limit: int = 20):
    """Kullanıcının arama geçmişini getir"""
    try:
        result = supabase.table("calls").select("*").or_(f"caller_id.eq.{user_id},receiver_id.eq.{user_id}").order("created_at", desc=True).limit(limit).execute()
        
        calls = []
        for call in result.data:
            # Karşı tarafın bilgisini al
            other_id = call["receiver_id"] if call["caller_id"] == user_id else call["caller_id"]
            other_name = "Kullanıcı"
            try:
                other_result = supabase.table("users").select("name").eq("id", other_id).execute()
                if other_result.data:
                    other_name = other_result.data[0].get("name", "Kullanıcı")
            except:
                pass
            
            calls.append({
                "call_id": call["call_id"],
                "other_user_id": other_id,
                "other_user_name": other_name,
                "call_type": call["call_type"],
                "status": call["status"],
                "is_outgoing": call["caller_id"] == user_id,
                "created_at": call["created_at"],
                "ended_at": call.get("ended_at"),
                "duration_seconds": None
            })
        
        return {"success": True, "calls": calls}
    except Exception as e:
        logger.error(f"Get call history error: {e}")
        return {"success": False, "calls": []}

# ==================== DRIVER LOCATION TRACKING ====================

@api_router.get("/passenger/driver-location/{driver_id}")
async def get_driver_location(driver_id: str):
    """Şoför konumunu getir"""
    try:
        result = supabase.table("users").select("latitude, longitude, last_location_update, name").eq("id", driver_id).execute()
        
        if result.data:
            user = result.data[0]
            return {
                "success": True,
                "location": {
                    "latitude": float(user["latitude"]) if user.get("latitude") else None,
                    "longitude": float(user["longitude"]) if user.get("longitude") else None,
                    "updated_at": user.get("last_location_update"),
                    "driver_name": user.get("name")
                }
            }
        
        return {"success": False, "location": None}
    except Exception as e:
        logger.error(f"Get driver location error: {e}")
        return {"success": False, "location": None}

@api_router.get("/driver/passenger-location/{passenger_id}")
async def get_passenger_location(passenger_id: str):
    """Yolcu konumunu getir (şoför için)"""
    try:
        result = supabase.table("users").select("latitude, longitude, last_location_update, name").eq("id", passenger_id).execute()
        
        if result.data:
            user = result.data[0]
            return {
                "success": True,
                "location": {
                    "latitude": float(user["latitude"]) if user.get("latitude") else None,
                    "longitude": float(user["longitude"]) if user.get("longitude") else None,
                    "updated_at": user.get("last_location_update"),
                    "passenger_name": user.get("name")
                }
            }
        
        return {"success": False, "location": None}
    except Exception as e:
        logger.error(f"Get passenger location error: {e}")
        return {"success": False, "location": None}

# ==================== TRIP END REQUEST ====================

# Aktif trip sonlandırma istekleri
trip_end_requests = {}

@api_router.post("/trip/request-end")
async def request_trip_end(tag_id: str, user_id: str = None, requester_id: str = None, user_type: str = None):
    """Yolculuk sonlandırma isteği - Supabase'de sakla"""
    try:
        rid = user_id or requester_id
        if not rid:
            raise HTTPException(status_code=422, detail="user_id gerekli")
        
        # Supabase'de tags tablosunda end_request alanını güncelle
        update_data = {
            "end_request": {
                "requester_id": rid,
                "user_type": user_type or "unknown",
                "requested_at": datetime.utcnow().isoformat(),
                "status": "pending"
            }
        }
        
        result = supabase.table("tags").update(update_data).eq("id", tag_id).execute()
        
        logger.info(f"🔚 Sonlandırma isteği: {tag_id} by {rid} ({user_type})")
        return {"success": True, "message": "Sonlandırma isteği gönderildi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Request end error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.get("/trip/check-end-request")
async def check_end_request(tag_id: str, user_id: str):
    """Sonlandırma isteği var mı kontrol et - Supabase'den oku"""
    try:
        result = supabase.table("tags").select("end_request").eq("id", tag_id).execute()
        
        if result.data and len(result.data) > 0:
            request = result.data[0].get("end_request")
            
            if request and request.get("status") == "pending" and request.get("requester_id") != user_id:
                return {
                    "success": True,
                    "has_request": True,
                    "requester_id": request["requester_id"],
                    "requester_type": request.get("user_type", "unknown")
                }
        
        return {"success": True, "has_request": False}
    except Exception as e:
        logger.error(f"Check end request error: {e}")
        return {"success": False, "has_request": False}

@api_router.post("/trip/respond-end-request")
async def respond_end_request(tag_id: str, user_id: str, approved: bool = True):
    """Sonlandırma isteğine cevap ver"""
    try:
        if approved:
            # Trip'i tamamla ve end_request'i temizle
            supabase.table("tags").update({
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "end_request": None
            }).eq("id", tag_id).execute()
            
            logger.info(f"✅ Yolculuk tamamlandı (karşılıklı): {tag_id}")
            return {"success": True, "approved": True, "message": "Yolculuk tamamlandı"}
        else:
            # İsteği reddet - end_request içindeki status'u güncelle
            result = supabase.table("tags").select("end_request").eq("id", tag_id).execute()
            if result.data and result.data[0].get("end_request"):
                end_request = result.data[0]["end_request"]
                end_request["status"] = "rejected"
                supabase.table("tags").update({"end_request": end_request}).eq("id", tag_id).execute()
            
            return {"success": True, "approved": False, "message": "Sonlandırma isteği reddedildi"}
    except Exception as e:
        logger.error(f"Respond end request error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/trip/approve-end")
async def approve_trip_end(tag_id: str, user_id: str):
    """Sonlandırma isteğini onayla"""
    try:
        if tag_id in trip_end_requests:
            del trip_end_requests[tag_id]
        
        # Trip'i tamamla
        supabase.table("tags").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id).execute()
        
        return {"success": True, "message": "Yolculuk tamamlandı"}
    except Exception as e:
        return {"success": False, "detail": str(e)}

# ==================== QR KOD SİSTEMİ ====================

import hashlib
import time
import math

# ==================== HIZLI QR SİSTEMİ ====================
# In-memory cache for QR verifications (1000+ concurrent users support)
from typing import Dict, Tuple

# Simple in-memory cache with TTL
_qr_cache: Dict[str, Tuple[dict, float]] = {}
_user_cache: Dict[str, Tuple[dict, float]] = {}
_user_qr_codes: Dict[str, str] = {}  # user_id -> qr_code mapping

def generate_user_qr_code(user_id: str) -> str:
    """Kullanıcı için benzersiz QR kodu oluştur (hash tabanlı, sabit)"""
    # Her kullanıcı için sabit QR - user_id'den türetilir
    hash_input = f"LEYLEK_QR_SECRET_{user_id}"
    hash_code = hashlib.md5(hash_input.encode()).hexdigest()[:10].upper()
    return f"LYK-{hash_code}"

async def get_cached_tag(tag_id: str) -> dict | None:
    """Cache'den tag al veya DB'den çek"""
    cache_key = f"tag:{tag_id}"
    current_time = time.time()
    
    if cache_key in _qr_cache:
        data, expiry = _qr_cache[cache_key]
        if current_time < expiry:
            return data
        else:
            del _qr_cache[cache_key]
    
    result = supabase.table("tags").select("id,passenger_id,driver_id,status").eq("id", tag_id).execute()
    if result.data:
        tag = result.data[0]
        _qr_cache[cache_key] = (tag, current_time + 30)
        return tag
    return None

async def get_cached_user(user_id: str) -> dict | None:
    """Cache'den user al veya DB'den çek"""
    cache_key = f"user:{user_id}"
    current_time = time.time()
    
    if cache_key in _user_cache:
        data, expiry = _user_cache[cache_key]
        if current_time < expiry:
            return data
        else:
            del _user_cache[cache_key]
    
    result = supabase.table("users").select("id,name,rating,total_trips,points").eq("id", user_id).execute()
    if result.data:
        user = result.data[0]
        _user_cache[cache_key] = (user, current_time + 60)
        return user
    return None

def invalidate_tag_cache(tag_id: str):
    """Tag cache'ini temizle"""
    cache_key = f"tag:{tag_id}"
    if cache_key in _qr_cache:
        del _qr_cache[cache_key]

def calculate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """İki konum arasındaki mesafeyi metre olarak hesapla (Haversine)"""
    R = 6371000  # Dünya yarıçapı metre
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# ==================== KONUM KONTROLÜ ====================

@api_router.post("/qr/check-proximity")
async def check_proximity_for_trip_end(
    user_id: str,
    tag_id: str,
    latitude: float,
    longitude: float
):
    """⚡ Yolculuk bitirmeden önce yakınlık kontrolü - HIZLI"""
    try:
        # 1. Tag'i kontrol et
        tag = await get_cached_tag(tag_id)
        if not tag or tag.get("status") not in ["matched", "in_progress"]:
            return {"success": False, "detail": "Aktif yolculuk bulunamadı", "can_end": False}
        
        passenger_id = tag.get("passenger_id")
        driver_id = tag.get("driver_id")
        
        # 2. Kullanıcının bu yolculuğa ait olduğunu kontrol et
        if user_id not in [passenger_id, driver_id]:
            return {"success": False, "detail": "Bu yolculuğa erişim yetkiniz yok", "can_end": False}
        
        # 3. Diğer kullanıcının konumunu al (users tablosundan - HIZLI)
        other_user_id = driver_id if user_id == passenger_id else passenger_id
        
        # Aktif konum kontrolü - users tablosundan
        try:
            other_user = supabase.table("users").select("latitude,longitude").eq("id", other_user_id).execute()
            
            if other_user.data:
                other_lat = other_user.data[0].get("latitude")
                other_lng = other_user.data[0].get("longitude")
                
                if other_lat and other_lng:
                    # Mesafe hesapla
                    distance = calculate_distance_meters(latitude, longitude, other_lat, other_lng)
                    
                    # 1 KM içinde mi?
                    if distance <= 1000:
                        return {
                            "success": True,
                            "can_end": True,
                            "distance_meters": round(distance),
                            "message": "Yakınlık doğrulandı"
                        }
                    else:
                        return {
                            "success": True,
                            "can_end": False,
                            "distance_meters": round(distance),
                            "message": f"Yol paylaşımını bitirmek için bir araya gelmelisiniz! Mesafe: {round(distance/1000, 1)}km"
                        }
        except Exception as loc_err:
            logger.warning(f"Konum kontrolü hatası: {loc_err}")
        
        # Konum bulunamadıysa yine de izin ver (edge case)
        return {
            "success": True,
            "can_end": True,
            "distance_meters": 0,
            "message": "Konum doğrulanamadı, devam edilebilir"
        }
        
    except Exception as e:
        logger.error(f"Proximity check error: {e}")
        return {"success": False, "detail": str(e), "can_end": False}

# ==================== DİNAMİK TRIP QR KOD SİSTEMİ ====================
# Her yolculuk için unique QR kod oluşturur

import secrets
import hmac

# Aktif trip QR kodları cache'i: {qr_token: {trip_id, driver_id, passenger_id, timestamp, expires}}
active_trip_qr_codes: dict = {}

def generate_trip_qr_token(tag_id: str, driver_id: str, passenger_id: str) -> str:
    """Trip için güvenli QR token oluştur"""
    timestamp = int(time.time())
    # Unique token: tag_id + timestamp + random
    raw = f"{tag_id}:{driver_id}:{passenger_id}:{timestamp}:{secrets.token_hex(8)}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
    return f"TRP-{token}"

@api_router.get("/qr/trip-code")
async def get_trip_qr_code(tag_id: str, user_id: str):
    """⚡ Yolculuk için dinamik QR kod oluştur - ŞOFÖR KULLANIR"""
    try:
        # 1. Tag'i kontrol et
        tag = await get_cached_tag(tag_id)
        if not tag or tag.get("status") not in ["matched", "in_progress"]:
            return {"success": False, "detail": "Aktif yolculuk bulunamadı"}
        
        passenger_id = tag.get("passenger_id")
        driver_id = tag.get("driver_id")
        
        # 2. Sadece şoför QR kod oluşturabilir
        if user_id != driver_id:
            return {"success": False, "detail": "Sadece sürücü QR kod oluşturabilir"}
        
        # 3. QR token oluştur
        timestamp = int(time.time())
        qr_token = generate_trip_qr_token(tag_id, driver_id, passenger_id)
        
        # 4. Cache'e kaydet (5 dakika geçerli)
        active_trip_qr_codes[qr_token] = {
            "tag_id": tag_id,
            "driver_id": driver_id,
            "passenger_id": passenger_id,
            "timestamp": timestamp,
            "expires": timestamp + 300  # 5 dakika
        }
        
        # 5. Kullanıcı adını al
        user = await get_cached_user(driver_id)
        user_name = user.get("first_name") or user.get("name", "Sürücü").split()[0] if user else "Sürücü"
        
        # 6. QR string formatı - Yolcu bu kodu tarayacak
        qr_string = f"leylektag://trip?t={qr_token}&tag={tag_id}"
        
        logger.info(f"✅ Trip QR oluşturuldu: {qr_token} for tag={tag_id}")
        
        return {
            "success": True,
            "qr_code": qr_token,
            "qr_string": qr_string,
            "user_name": user_name,
            "expires_in": 300,
            "tag_id": tag_id
        }
    except Exception as e:
        logger.error(f"Trip QR oluşturma hatası: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/qr/verify-trip")
async def verify_trip_qr(
    qr_token: str,
    scanner_user_id: str,
    latitude: float = 0,
    longitude: float = 0
):
    """⚡ SÜPER HIZLI - Yolcu şoförün trip QR'ını tarar, yolculuk biter"""
    start_time = time.time()
    
    try:
        # 1. QR token'ı kontrol et
        qr_data = active_trip_qr_codes.get(qr_token)
        if not qr_data:
            return {"success": False, "detail": "Geçersiz veya süresi dolmuş QR kod"}
        
        # 2. Süre kontrolü
        if time.time() > qr_data["expires"]:
            del active_trip_qr_codes[qr_token]
            return {"success": False, "detail": "QR kod süresi dolmuş, yeni kod isteyin"}
        
        tag_id = qr_data["tag_id"]
        driver_id = qr_data["driver_id"]
        passenger_id = qr_data["passenger_id"]
        
        # 3. Tarayan kişi yolcu mu?
        if scanner_user_id != passenger_id:
            return {"success": False, "detail": "Sadece yolcu QR kodu tarayabilir"}
        
        # 4. Tag'i kontrol et
        tag = await get_cached_tag(tag_id)
        if not tag or tag.get("status") not in ["matched", "in_progress"]:
            return {"success": False, "detail": "Bu yolculuk artık aktif değil"}
        
        # 5. HIZLI: Yolculuğu bitir
        completed_at = datetime.utcnow().isoformat()
        
        supabase.table("tags").update({
            "status": "completed",
            "completed_at": completed_at,
            "end_method": "qr_dynamic"
        }).eq("id", tag_id).execute()
        
        # Cache temizle
        invalidate_tag_cache(tag_id)
        del active_trip_qr_codes[qr_token]
        
        # 6. Kullanıcı isimlerini al
        driver_user = await get_cached_user(driver_id)
        passenger_user = await get_cached_user(scanner_user_id)
        driver_name = driver_user.get("first_name") or driver_user.get("name", "Sürücü").split()[0] if driver_user else "Sürücü"
        passenger_name = passenger_user.get("first_name") or passenger_user.get("name", "Yolcu").split()[0] if passenger_user else "Yolcu"
        
        # 7. Socket.IO ile İKİ TARAFA DA puanlama modalı gönder
        try:
            # Yolcuya: Şoförü puanla
            await sio.emit("show_rating_modal", {
                "tag_id": tag_id,
                "rate_user_id": driver_id,
                "rate_user_name": driver_name,
                "message": "Yolculuk tamamlandı! Sürücüyü puanlayın."
            }, room=_normalize_user_room(passenger_id))
            
            # Şoföre: Yolcuyu puanla
            await sio.emit("show_rating_modal", {
                "tag_id": tag_id,
                "rate_user_id": passenger_id,
                "rate_user_name": passenger_name,
                "message": "Yolculuk tamamlandı! Yolcuyu puanlayın."
            }, room=_normalize_user_room(driver_id))
            
            logger.info(f"✅ Puanlama modalları gönderildi: yolcu={passenger_id}, şoför={driver_id}")
        except Exception as socket_err:
            logger.warning(f"Socket emit hatası: {socket_err}")
        
        # 8. Trip log kaydet (arka planda)
        asyncio.create_task(log_trip_completion(tag_id, driver_id, passenger_id, latitude, longitude, completed_at, "qr_dynamic"))
        
        elapsed = (time.time() - start_time) * 1000
        logger.info(f"✅ Trip QR tamamlandı {elapsed:.0f}ms: tag={tag_id}")
        
        return {
            "success": True,
            "message": "Yolculuk tamamlandı!",
            "tag_id": tag_id,
            "driver_name": driver_name,
            "show_rating": True,
            "elapsed_ms": round(elapsed)
        }
        
    except Exception as e:
        logger.error(f"Trip QR verify error: {e}")
        return {"success": False, "detail": str(e)}

async def log_trip_completion(tag_id: str, driver_id: str, passenger_id: str, lat: float, lng: float, completed_at: str, method: str):
    """Arka planda trip logunu kaydet"""
    try:
        # Her iki kullanıcıya +3 puan ver
        for uid in [passenger_id, driver_id]:
            try:
                user_result = supabase.table("users").select("total_trips, points").eq("id", uid).execute()
                if user_result.data:
                    current_trips = user_result.data[0].get("total_trips", 0) or 0
                    current_points = user_result.data[0].get("points", 100) or 100
                    
                    supabase.table("users").update({
                        "total_trips": current_trips + 1,
                        "points": current_points + 3
                    }).eq("id", uid).execute()
            except Exception as e:
                logger.warning(f"Puan güncelleme hatası {uid}: {e}")
        
        # Trip log kaydet
        try:
            supabase.table("trip_logs").insert({
                "tag_id": tag_id,
                "driver_id": driver_id,
                "passenger_id": passenger_id,
                "end_latitude": lat,
                "end_longitude": lng,
                "completed_at": completed_at,
                "end_method": method
            }).execute()
        except:
            pass  # Tablo yoksa sorun değil
            
    except Exception as e:
        logger.error(f"Trip log hatası: {e}")

# ==================== SÜPER HIZLI QR - KİŞİYE ÖZEL ====================

@api_router.post("/trip/complete-qr")
async def complete_trip_with_qr(request: Request):
    """⚡ SÜPER HIZLI - Kişiye özel QR ile yolculuk bitirme
    
    Frontend QR değeri: leylektag://end?u={driver_user_id}&t={tag_id}
    Yolcu tarar → Trip tamamlanır → İki tarafa da puanlama modalı açılır
    """
    start_time = time.time()
    
    try:
        body = await request.json()
        tag_id = body.get("tag_id")
        scanner_user_id = body.get("scanner_user_id")  # Yolcu
        scanned_user_id = body.get("scanned_user_id")  # Sürücü (QR'dan)
        latitude = body.get("latitude", 0)
        longitude = body.get("longitude", 0)
        
        if not tag_id or not scanner_user_id or not scanned_user_id:
            return {"success": False, "detail": "Eksik parametreler"}
        
        # 1. Tag'i getir
        tag = await get_cached_tag(tag_id)
        if not tag:
            return {"success": False, "detail": "Yolculuk bulunamadı"}
        
        if tag.get("status") not in ["matched", "in_progress"]:
            return {"success": False, "detail": "Bu yolculuk aktif değil"}
        
        # 2. Tarayan yolcu mu? Taranan sürücü mü?
        driver_id = tag.get("driver_id")
        passenger_id = tag.get("passenger_id")
        
        if scanner_user_id != passenger_id:
            return {"success": False, "detail": "Sadece yolcu QR tarayabilir"}
        
        if scanned_user_id != driver_id:
            return {"success": False, "detail": "QR kod bu yolculuğun sürücüsüne ait değil"}
        
        # 3. Yolculuğu tamamla
        completed_at = datetime.utcnow().isoformat()
        
        # Güncelleme - end_method opsiyonel (kolon yoksa hata vermesin)
        update_data = {
            "status": "completed",
            "completed_at": completed_at
        }
        
        try:
            # end_method kolonunu eklemeyi dene
            supabase.table("tags").update({
                **update_data,
                "end_method": "qr"
            }).eq("id", tag_id).execute()
        except Exception as col_err:
            # Kolon yoksa sadece status güncelle
            logger.warning(f"end_method kolonu yok, sadece status güncelleniyor: {col_err}")
            supabase.table("tags").update(update_data).eq("id", tag_id).execute()
        
        # Cache temizle
        invalidate_tag_cache(tag_id)
        
        # 4. İsimleri al
        driver_user = await get_cached_user(driver_id)
        passenger_user = await get_cached_user(scanner_user_id)
        driver_name = (driver_user.get("first_name") or driver_user.get("name", "Sürücü").split()[0]) if driver_user else "Sürücü"
        passenger_name = (passenger_user.get("first_name") or passenger_user.get("name", "Yolcu").split()[0]) if passenger_user else "Yolcu"
        
        # 5. Socket.IO ile İKİ TARAFA DA puanlama modalı gönder
        try:
            # Yolcuya: Şoförü puanla
            await sio.emit("show_rating_modal", {
                "tag_id": tag_id,
                "rate_user_id": driver_id,
                "rate_user_name": driver_name,
                "message": "Yolculuk tamamlandı!"
            }, room=_normalize_user_room(passenger_id))
            
            # Şoföre: Yolcuyu puanla
            await sio.emit("show_rating_modal", {
                "tag_id": tag_id,
                "rate_user_id": passenger_id,
                "rate_user_name": passenger_name,
                "message": "Yolculuk tamamlandı!"
            }, room=_normalize_user_room(driver_id))
            
            logger.info(f"✅ QR Puanlama modalları gönderildi: yolcu={passenger_id}, şoför={driver_id}")
        except Exception as socket_err:
            logger.warning(f"Socket emit hatası: {socket_err}")
        
        # 6. Trip log (arka planda)
        asyncio.create_task(log_trip_completion(tag_id, driver_id, passenger_id, latitude, longitude, completed_at, "qr_personal"))
        
        elapsed = (time.time() - start_time) * 1000
        logger.info(f"✅ QR Trip tamamlandı {elapsed:.0f}ms: tag={tag_id}")
        
        return {
            "success": True,
            "message": "Yolculuk tamamlandı!",
            "tag_id": tag_id,
            "driver_name": driver_name,
            "show_rating": True,
            "elapsed_ms": round(elapsed)
        }
        
    except Exception as e:
        logger.error(f"QR Trip complete error: {e}")
        return {"success": False, "detail": str(e)}

# ==================== KİŞİYE ÖZEL QR KOD API'LERİ (ESKİ - GERİYE UYUMLULUK) ====================

@api_router.get("/qr/my-code")
async def get_my_qr_code(user_id: str):
    """⚡ Kullanıcının kişiye özel QR kodunu getir - HIZLI (DB'siz)"""
    try:
        # QR kodu user_id'den türetilir - her zaman aynı
        qr_code = generate_user_qr_code(user_id)
        
        # Kullanıcı adını al (cache'den)
        user = await get_cached_user(user_id)
        user_name = user.get("name", "Kullanıcı") if user else "Kullanıcı"
        
        # QR string formatı
        qr_string = f"leylekpay://u?c={qr_code}&i={user_id}"
        
        return {
            "success": True,
            "qr_code": qr_code,
            "qr_string": qr_string,
            "user_name": user_name
        }
    except Exception as e:
        logger.error(f"QR get error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/qr/scan-trip-end")
async def scan_qr_for_trip_end(
    scanner_user_id: str,
    scanned_qr_code: str,
    tag_id: str,
    latitude: float = 0,
    longitude: float = 0
):
    """⚡ SÜPER HIZLI - Yolcu şoförün QR'ını tarar, yolculuk biter"""
    start_time = time.time()
    
    try:
        # 1. QR kodundan user_id bul (QR kod formatı: LYK-XXXXXXXXXX)
        scanned_user_id = None
        
        # Tüm kullanıcıların QR kodlarını kontrol et (cache'den)
        # Veya QR kodunu çöz - user_id'yi bulmak için
        
        # Tag'den diğer kullanıcıyı bul
        tag = await get_cached_tag(tag_id)
        if not tag or tag.get("status") not in ["matched", "in_progress"]:
            return {"success": False, "detail": "Aktif yolculuk bulunamadı"}
        
        passenger_id = tag.get("passenger_id")
        driver_id = tag.get("driver_id")
        
        # Scanner yolcu ise, taranan şoför olmalı (ve tersi)
        if scanner_user_id == passenger_id:
            expected_user_id = driver_id
        elif scanner_user_id == driver_id:
            expected_user_id = passenger_id
        else:
            return {"success": False, "detail": "Bu yolculuğa erişim yetkiniz yok"}
        
        # Beklenen kullanıcının QR kodunu kontrol et
        expected_qr = generate_user_qr_code(expected_user_id)
        
        if scanned_qr_code != expected_qr:
            return {"success": False, "detail": "Geçersiz QR kod - Yanlış kişinin kodunu taradınız"}
        
        scanned_user_id = expected_user_id
        
        # 2. HIZLI: Yolculuğu bitir
        completed_at = datetime.utcnow().isoformat()
        
        supabase.table("tags").update({
            "status": "completed",
            "completed_at": completed_at
        }).eq("id", tag_id).execute()
        
        # Cache temizle
        invalidate_tag_cache(tag_id)
        
        # 3. QR tamamlama logunu kaydet (Admin için)
        try:
            supabase.table("qr_completions").insert({
                "tag_id": tag_id,
                "scanner_id": scanner_user_id,
                "scanned_id": scanned_user_id,
                "latitude": latitude,
                "longitude": longitude,
                "completed_at": completed_at
            }).execute()
        except Exception as log_err:
            logger.warning(f"QR log kaydedilemedi: {log_err}")
        
        # 4. Kullanıcı isimlerini al
        scanner_user = await get_cached_user(scanner_user_id)
        scanned_user = await get_cached_user(scanned_user_id)
        scanner_name = scanner_user.get("name", "Kullanıcı") if scanner_user else "Kullanıcı"
        scanned_name = scanned_user.get("name", "Kullanıcı") if scanned_user else "Kullanıcı"
        
        # 5. Socket.IO ile İKİ TARAFA DA puanlama modalı gönder
        try:
            # Yolcuya: Şoförü puanla
            await sio.emit("show_rating_modal", {
                "tag_id": tag_id,
                "rate_user_id": driver_id,
                "rate_user_name": scanned_name if scanner_user_id == passenger_id else scanner_name,
                "message": "Yolculuk tamamlandı! Şoförü puanlayın."
            }, room=_normalize_user_room(passenger_id))
            
            # Şoföre: Yolcuyu puanla
            await sio.emit("show_rating_modal", {
                "tag_id": tag_id,
                "rate_user_id": passenger_id,
                "rate_user_name": scanner_name if scanner_user_id == passenger_id else scanned_name,
                "message": "Yolculuk tamamlandı! Yolcuyu puanlayın."
            }, room=_normalize_user_room(driver_id))
            
            logger.info(f"✅ Puanlama modalları gönderildi: yolcu={passenger_id}, şoför={driver_id}")
        except Exception as socket_err:
            logger.warning(f"Socket emit hatası: {socket_err}")
        
        # 6. Arka planda puan güncelle
        asyncio.create_task(update_trip_points_async(passenger_id, driver_id, tag_id, latitude, longitude, completed_at))
        
        elapsed = (time.time() - start_time) * 1000
        logger.info(f"✅ QR tamamlandı {elapsed:.0f}ms: tag={tag_id}")
        
        return {
            "success": True,
            "message": "Yolculuk tamamlandı!",
            "tag_id": tag_id,
            "scanned_user_name": scanned_name,
            "show_rating": True,
            "elapsed_ms": round(elapsed)
        }
        
    except Exception as e:
        logger.error(f"QR scan error: {e}")
        return {"success": False, "detail": str(e)}

async def update_trip_points_async(passenger_id: str, driver_id: str, tag_id: str, lat: float, lng: float, completed_at: str):
    """Arka planda puan güncelle - Kullanıcıyı bekletmez"""
    try:
        # Her iki kullanıcıya +3 puan ver
        for uid in [passenger_id, driver_id]:
            try:
                user_result = supabase.table("users").select("total_trips, rating, points").eq("id", uid).execute()
                if user_result.data:
                    current_trips = user_result.data[0].get("total_trips", 0) or 0
                    current_points = user_result.data[0].get("points", 100) or 100
                    
                    supabase.table("users").update({
                        "total_trips": current_trips + 1,
                        "points": current_points + 3  # +3 puan
                    }).eq("id", uid).execute()
                    
                    # Cache temizle
                    cache_key = f"user:{uid}"
                    if cache_key in _user_cache:
                        del _user_cache[cache_key]
                        
            except Exception as e:
                logger.warning(f"Puan güncelleme hatası {uid}: {e}")
                
    except Exception as e:
        logger.error(f"Async puan güncelleme hatası: {e}")

@api_router.post("/qr/rate-user")
async def rate_user_after_trip(
    rater_user_id: str,
    rated_user_id: str,
    tag_id: str,
    rating: int
):
    """⚡ HIZLI - Yolculuk sonrası puanlama"""
    try:
        if rating < 1 or rating > 5:
            return {"success": False, "detail": "Puan 1-5 arasında olmalı"}
        
        # Kullanıcının mevcut puanını al
        user_result = supabase.table("users").select("rating, total_ratings").eq("id", rated_user_id).execute()
        
        if not user_result.data:
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        user = user_result.data[0]
        current_rating = user.get("rating", 5.0) or 5.0
        total_ratings = user.get("total_ratings", 0) or 0
        
        # Yeni ortalama hesapla
        new_total = total_ratings + 1
        new_rating = ((current_rating * total_ratings) + rating) / new_total
        new_rating = round(new_rating, 2)
        
        # Güncelle
        supabase.table("users").update({
            "rating": new_rating,
            "total_ratings": new_total
        }).eq("id", rated_user_id).execute()
        
        # Tag'e puanlama bilgisi ekle
        try:
            tag_result = supabase.table("tags").select("passenger_id, driver_id").eq("id", tag_id).execute()
            if tag_result.data:
                tag = tag_result.data[0]
                if rater_user_id == tag.get("passenger_id"):
                    supabase.table("tags").update({"rating_by_passenger": rating}).eq("id", tag_id).execute()
                elif rater_user_id == tag.get("driver_id"):
                    supabase.table("tags").update({"rating_by_driver": rating}).eq("id", tag_id).execute()
        except:
            pass
        
        # Cache temizle
        cache_key = f"user:{rated_user_id}"
        if cache_key in _user_cache:
            del _user_cache[cache_key]
        
        logger.info(f"✅ Puanlama: {rated_user_id} -> {rating}⭐ (ort: {new_rating})")
        
        return {
            "success": True,
            "message": f"{rating} yıldız verildi!",
            "new_rating": new_rating
        }
        
    except Exception as e:
        logger.error(f"Rate user error: {e}")
        return {"success": False, "detail": str(e)}

# ==================== ADMİN: QR TAMAMLAMALARI ====================

@api_router.get("/admin/qr-completions")
async def get_qr_completions(limit: int = 50):
    """Admin için QR ile tamamlanan yolculukları listele"""
    try:
        result = supabase.table("qr_completions").select("*").order("completed_at", desc=True).limit(limit).execute()
        
        completions = []
        for c in result.data:
            # Kullanıcı isimlerini al
            scanner = await get_cached_user(c.get("scanner_id", ""))
            scanned = await get_cached_user(c.get("scanned_id", ""))
            
            completions.append({
                "id": c.get("id"),
                "tag_id": c.get("tag_id"),
                "scanner_name": scanner.get("name") if scanner else "Bilinmiyor",
                "scanned_name": scanned.get("name") if scanned else "Bilinmiyor",
                "latitude": c.get("latitude"),
                "longitude": c.get("longitude"),
                "completed_at": c.get("completed_at")
            })
        
        return {"success": True, "completions": completions}
    except Exception as e:
        logger.error(f"QR completions error: {e}")
        return {"success": True, "completions": []}

# ==================== ÖDEME SİSTEMİ ====================

@api_router.post("/payment/create-request")
async def create_payment_request(
    driver_id: str,
    passenger_id: str,
    tag_id: str,
    amount: float,
    description: str = ""
):
    """⚡ Şoför için ödeme talebi oluştur - Dinamik QR"""
    try:
        # Token oluştur (5 dakika geçerli)
        timestamp = int(time.time())
        token_data = f"{driver_id}:{passenger_id}:{tag_id}:{amount}:{timestamp}"
        token = hashlib.md5(token_data.encode()).hexdigest()[:16]
        
        # QR string formatı: leylekpay://pay?d=driver_id&p=passenger_id&t=tag_id&a=amount&ts=timestamp&tk=token
        qr_string = f"leylekpay://pay?d={driver_id}&p={passenger_id}&t={tag_id}&a={amount}&ts={timestamp}&tk={token}"
        
        # Ödeme talebini kaydet
        try:
            supabase.table("payment_requests").insert({
                "driver_id": driver_id,
                "passenger_id": passenger_id,
                "tag_id": tag_id,
                "amount": amount,
                "description": description,
                "status": "pending",
                "token": token,
                "expires_at": datetime.utcfromtimestamp(timestamp + 300).isoformat()
            }).execute()
        except Exception as db_err:
            logger.warning(f"Payment request kayıt hatası: {db_err}")
        
        return {
            "success": True,
            "qr_string": qr_string,
            "token": token,
            "amount": amount,
            "expires_in": 300
        }
    except Exception as e:
        logger.error(f"Payment create error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/payment/verify")
async def verify_payment(
    payer_user_id: str,
    driver_id: str,
    tag_id: str,
    amount: float,
    timestamp: int,
    token: str
):
    """⚡ Ödeme doğrula ve kaydet"""
    try:
        # Token doğrula
        expected_token_data = f"{driver_id}:{payer_user_id}:{tag_id}:{amount}:{timestamp}"
        expected_token = hashlib.md5(expected_token_data.encode()).hexdigest()[:16]
        
        if token != expected_token:
            return {"success": False, "detail": "Geçersiz ödeme kodu"}
        
        # Süre kontrolü (5 dakika)
        if int(time.time()) - timestamp > 300:
            return {"success": False, "detail": "Ödeme süresi dolmuş"}
        
        # Ödemeyi kaydet
        payment_data = {
            "payer_id": payer_user_id,
            "receiver_id": driver_id,
            "tag_id": tag_id,
            "amount": amount,
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat()
        }
        
        try:
            supabase.table("payments").insert(payment_data).execute()
        except Exception as db_err:
            logger.warning(f"Payment kayıt hatası: {db_err}")
        
        # Şoföre bildirim gönder
        try:
            payer = await get_cached_user(payer_user_id)
            payer_name = payer.get("name", "Yolcu") if payer else "Yolcu"
            
            await sio.emit("payment_received", {
                "tag_id": tag_id,
                "amount": amount,
                "payer_name": payer_name,
                "message": f"{payer_name} size {amount}₺ ödeme yaptı!"
            }, room=_normalize_user_room(driver_id))
        except Exception as socket_err:
            logger.warning(f"Payment socket hatası: {socket_err}")
        
        logger.info(f"✅ Ödeme tamamlandı: {payer_user_id} -> {driver_id}, {amount}₺")
        
        return {
            "success": True,
            "message": f"{amount}₺ ödeme başarılı!",
            "payment_id": payment_data.get("id")
        }
    except Exception as e:
        logger.error(f"Payment verify error: {e}")
        return {"success": False, "detail": str(e)}

# ==================== YOLCULUK LOG SİSTEMİ (DEVLET İÇİN) ====================

@api_router.get("/admin/trip-logs")
async def get_trip_logs(limit: int = 100, start_date: str = None, end_date: str = None):
    """Admin için detaylı yolculuk logları - Devlet raporu için"""
    try:
        query = supabase.table("tags").select(
            "id, passenger_id, driver_id, status, created_at, completed_at, "
            "start_address, destination_address, price, distance_km, rating_by_passenger, rating_by_driver"
        ).order("created_at", desc=True).limit(limit)
        
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        
        result = query.execute()
        
        logs = []
        for tag in result.data:
            # Kullanıcı bilgilerini al
            passenger = await get_cached_user(tag.get("passenger_id", ""))
            driver = await get_cached_user(tag.get("driver_id", ""))
            
            logs.append({
                "tag_id": tag.get("id"),
                "passenger_name": passenger.get("name") if passenger else "Bilinmiyor",
                "passenger_id": tag.get("passenger_id"),
                "driver_name": driver.get("name") if driver else "Bilinmiyor", 
                "driver_id": tag.get("driver_id"),
                "status": tag.get("status"),
                "start_address": tag.get("start_address"),
                "destination_address": tag.get("destination_address"),
                "distance_km": tag.get("distance_km"),
                "price": tag.get("price"),
                "rating_passenger_gave": tag.get("rating_by_passenger"),
                "rating_driver_gave": tag.get("rating_by_driver"),
                "started_at": tag.get("created_at"),
                "completed_at": tag.get("completed_at")
            })
        
        return {"success": True, "logs": logs, "total": len(logs)}
    except Exception as e:
        logger.error(f"Trip logs error: {e}")
        return {"success": True, "logs": []}

@api_router.get("/admin/payment-logs")
async def get_payment_logs(limit: int = 100):
    """Admin için ödeme logları"""
    try:
        result = supabase.table("payments").select("*").order("completed_at", desc=True).limit(limit).execute()
        
        logs = []
        for p in result.data:
            payer = await get_cached_user(p.get("payer_id", ""))
            receiver = await get_cached_user(p.get("receiver_id", ""))
            
            logs.append({
                "payment_id": p.get("id"),
                "payer_name": payer.get("name") if payer else "Bilinmiyor",
                "receiver_name": receiver.get("name") if receiver else "Bilinmiyor",
                "amount": p.get("amount"),
                "tag_id": p.get("tag_id"),
                "completed_at": p.get("completed_at")
            })
        
        return {"success": True, "logs": logs}
    except Exception as e:
        logger.error(f"Payment logs error: {e}")
        return {"success": True, "logs": []}

@api_router.post("/qr/rate")
async def rate_after_qr(
    tag_id: str,
    rater_user_id: str,
    rating: int,
    comment: str = None
):
    """QR ile bitirme sonrası puanlama"""
    try:
        if rating < 1 or rating > 5:
            return {"success": False, "detail": "Puan 1-5 arasında olmalı"}
        
        # Tag'i al
        result = supabase.table("tags").select("*").eq("id", tag_id).execute()
        if not result.data:
            return {"success": False, "detail": "Yolculuk bulunamadı"}
        
        tag = result.data[0]
        passenger_id = tag.get("passenger_id")
        driver_id = tag.get("driver_id")
        
        # Kim puanlıyor?
        if rater_user_id == passenger_id:
            # Yolcu sürücüyü puanlıyor
            rated_user_id = driver_id
            rating_field = "rating_by_passenger"
        elif rater_user_id == driver_id:
            # Sürücü yolcuyu puanlıyor
            rated_user_id = passenger_id
            rating_field = "rating_by_driver"
        else:
            return {"success": False, "detail": "Bu yolculuğa puanlama yetkiniz yok"}
        
        # Puanı kaydet
        update_data = {
            rating_field: {
                "rating": rating,
                "comment": comment,
                "rated_at": datetime.utcnow().isoformat()
            }
        }
        supabase.table("tags").update(update_data).eq("id", tag_id).execute()
        
        # Puanlanan kullanıcının ortalama puanını güncelle
        all_ratings = []
        
        if rated_user_id == driver_id:
            # Sürücünün tüm puanlarını al
            ratings_result = supabase.table("tags").select("rating_by_passenger").eq("driver_id", driver_id).not_.is_("rating_by_passenger", "null").execute()
        else:
            # Yolcunun tüm puanlarını al
            ratings_result = supabase.table("tags").select("rating_by_driver").eq("passenger_id", passenger_id).not_.is_("rating_by_driver", "null").execute()
        
        if ratings_result.data:
            for r in ratings_result.data:
                rating_data = r.get("rating_by_passenger") or r.get("rating_by_driver")
                if rating_data and isinstance(rating_data, dict):
                    all_ratings.append(rating_data.get("rating", 5))
        
        # Yeni puanı da ekle
        all_ratings.append(rating)
        
        if all_ratings:
            avg_rating = sum(all_ratings) / len(all_ratings)
            supabase.table("users").update({"rating": round(avg_rating, 2)}).eq("id", rated_user_id).execute()
        
        logger.info(f"⭐ Puanlama kaydedildi: tag={tag_id}, rater={rater_user_id}, rating={rating}")
        
        return {
            "success": True,
            "message": f"{rating} yıldız puanınız kaydedildi!",
            "rating": rating
        }
        
    except Exception as e:
        logger.error(f"Rate error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.get("/admin/qr-completions")
async def get_qr_completions(admin_phone: str, limit: int = 50):
    """Admin için QR ile tamamlanan yolculukları listele"""
    try:
        # Admin kontrolü
        admin_check = supabase.table("users").select("is_admin").eq("phone", admin_phone).execute()
        if not admin_check.data or not admin_check.data[0].get("is_admin"):
            return {"success": False, "detail": "Yetkisiz erişim"}
        
        # QR ile tamamlanan yolculukları al
        result = supabase.table("tags").select(
            "*, users!tags_passenger_id_fkey(name, phone), users!tags_driver_id_fkey(name, phone)"
        ).eq("status", "completed").not_.is_("qr_completion", "null").order("completed_at", desc=True).limit(limit).execute()
        
        completions = []
        for tag in result.data or []:
            qr_data = tag.get("qr_completion", {})
            completions.append({
                "tag_id": tag.get("id"),
                "passenger_name": tag.get("users", {}).get("name") if isinstance(tag.get("users"), dict) else None,
                "driver_name": tag.get("users!tags_driver_id_fkey", {}).get("name") if isinstance(tag.get("users!tags_driver_id_fkey"), dict) else None,
                "completed_at": qr_data.get("completed_at"),
                "latitude": qr_data.get("latitude"),
                "longitude": qr_data.get("longitude"),
                "scanner_id": qr_data.get("scanner_id"),
                "method": qr_data.get("method", "qr_code"),
                "rating_by_passenger": tag.get("rating_by_passenger"),
                "rating_by_driver": tag.get("rating_by_driver")
            })
        
        return {"success": True, "completions": completions, "count": len(completions)}
        
    except Exception as e:
        logger.error(f"Admin QR completions error: {e}")
        return {"success": False, "detail": str(e)}

# ==================== CORS & ROUTER ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NOT: app.include_router en sonda olmalı - tüm route'lar tanımlandıktan sonra

# ==================== WEB SAYFALARI ====================
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os

# Static dosyaları serve et
static_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

templates_path = os.path.join(os.path.dirname(__file__), "templates")

@app.get("/", response_class=HTMLResponse)
async def landing_page():
    """Ana sayfa - Landing Page"""
    try:
        with open(os.path.join(templates_path, "landing.html"), "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except:
        return HTMLResponse(content="<h1>Leylek TAG</h1><p>Ana sayfa yükleniyor...</p>")

@app.get("/gizlilik-politikasi", response_class=HTMLResponse)
async def privacy_policy():
    """Gizlilik Politikası"""
    try:
        with open(os.path.join(templates_path, "gizlilik-politikasi.html"), "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except:
        return HTMLResponse(content="<h1>Gizlilik Politikası</h1>")

@app.get("/kvkk", response_class=HTMLResponse)
async def kvkk():
    """KVKK Aydınlatma Metni"""
    try:
        with open(os.path.join(templates_path, "kvkk.html"), "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except:
        return HTMLResponse(content="<h1>KVKK Aydınlatma Metni</h1>")

@app.get("/hesap-silme", response_class=HTMLResponse)
async def account_deletion():
    """Hesap Silme Talebi"""
    try:
        with open(os.path.join(templates_path, "hesap-silme.html"), "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except:
        return HTMLResponse(content="<h1>Hesap Silme</h1>")

@app.get("/kullanim-sartlari", response_class=HTMLResponse)
async def terms_of_service():
    """Kullanım Şartları"""
    try:
        with open(os.path.join(templates_path, "kullanim-sartlari.html"), "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except:
        return HTMLResponse(content="<h1>Kullanım Şartları</h1>")

# Hesap silme API endpoint'i
@api_router.post("/account/delete-request")
async def account_delete_request(request: dict):
    """Hesap silme talebi al"""
    try:
        phone = request.get("phone", "")
        email = request.get("email", "")
        reason = request.get("reason", "")
        comment = request.get("comment", "")
        
        logger.info(f"🗑️ Hesap silme talebi: {phone}, Sebep: {reason}")
        
        # Talebi kaydet (opsiyonel - admin panelinde göstermek için)
        # supabase.table("delete_requests").insert({...}).execute()
        
        return {"success": True, "message": "Talebiniz alındı"}
    except Exception as e:
        return {"success": False, "detail": str(e)}

# ==================== DAILY.CO VIDEO/AUDIO CALL API ====================

@api_router.post("/daily/create-room")
async def create_daily_room(request: dict):
    """
    Daily.co'da yeni bir arama odası oluştur
    Socket ile karşı tarafa bildirim gönder
    """
    try:
        caller_id = request.get("caller_id")
        receiver_id = request.get("receiver_id")
        call_type = request.get("call_type", "video")  # "video" veya "audio"
        tag_id = request.get("tag_id", "")
        caller_name = request.get("caller_name", "Arayan")
        
        # Benzersiz oda adı oluştur
        room_name = f"leylektag_{tag_id}_{int(time.time())}"
        
        # Daily.co API'ye istek at
        headers = {
            "Authorization": f"Bearer {DAILY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "name": room_name,
            "privacy": "public",
            "properties": {
                "max_participants": 2,
                "enable_chat": False,
                "enable_screenshare": False,
                "exp": int(time.time()) + 3600,  # 1 saat geçerli
                "enable_knocking": False,
                "start_video_off": call_type == "audio",
                "start_audio_off": False
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{DAILY_API_URL}/rooms",
                json=payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                logger.error(f"Daily.co room creation failed: {response.text}")
                raise HTTPException(status_code=500, detail="Arama odası oluşturulamadı")
            
            room_data = response.json()
            room_url = room_data.get("url")
            
            logger.info(f"📹 Daily.co oda oluşturuldu: {room_url}")
            
            # 🔥 HARİCİ SOCKET SUNUCUSUNA BİLDİRİM GÖNDER
            try:
                # Socket.IO client ile harici sunucuya bağlan
                import socketio
                external_sio = socketio.AsyncClient()
                await external_sio.connect('https://socket.leylektag.com', transports=['websocket'])
                
                # Arama bildirimi gönder
                await external_sio.emit('call_invite', {
                    'room_url': room_url,
                    'room_name': room_name,
                    'caller_id': caller_id,
                    'caller_name': caller_name,
                    'receiver_id': receiver_id,
                    'call_type': call_type,
                    'tag_id': tag_id
                })
                
                await external_sio.disconnect()
                logger.info(f"📲 Daily.co arama bildirimi gönderildi (harici socket): {receiver_id}")
            except Exception as socket_err:
                logger.warning(f"⚠️ Socket bildirim hatası: {socket_err}")

            try:
                asyncio.create_task(send_push_notification(
                    receiver_id,
                    f"📞 {caller_name}",
                    "Size gelen bir arama var.",
                    build_call_push_payload(
                        "incoming_daily_call",
                        caller_id,
                        caller_name,
                        call_type,
                        room_url=room_url,
                        room_name=room_name,
                        tag_id=tag_id,
                    )
                ))
            except Exception as push_err:
                logger.warning(f"⚠️ Daily room push gönderilemedi: {push_err}")
            
            return {
                "success": True,
                "room_url": room_url,
                "room_name": room_name,
                "call_type": call_type,
                "receiver_online": True
            }
            
    except Exception as e:
        logger.error(f"Daily.co room creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SIMPLE DAILY.CO CALL SYSTEM ====================
@api_router.post("/calls/start")
async def start_call(request: dict):
    """
    Simple Daily.co call - Sadece room oluştur, socket bildirimi FRONTEND'de
    """
    try:
        caller_id = request.get("caller_id")
        receiver_id = request.get("receiver_id")
        call_type = request.get("call_type", "audio")
        tag_id = request.get("tag_id", "")
        
        if not caller_id or not receiver_id:
            raise HTTPException(status_code=400, detail="caller_id and receiver_id required")
        
        room_name = f"leylek_{tag_id}_{int(time.time())}"
        
        headers = {
            "Authorization": f"Bearer {DAILY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "name": room_name,
            "privacy": "public",
            "properties": {
                "max_participants": 2,
                "enable_chat": False,
                "enable_screenshare": False,
                "exp": int(time.time()) + 600,
                "enable_knocking": False,
                "start_video_off": call_type == "audio",
                "start_audio_off": False,
                "enable_prejoin_ui": False,
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{DAILY_API_URL}/rooms",
                json=payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                logger.error(f"Daily.co room creation failed: {response.text}")
                raise HTTPException(status_code=500, detail="Could not create call room")
            
            room_data = response.json()
            room_url = room_data.get("url")
            
            logger.info(f"📞 Room oluşturuldu: {room_url}")
            
            try:
                caller_name = "Arayan"
                caller_result = supabase.table("users").select("name").eq("id", caller_id).limit(1).execute()
                if caller_result.data:
                    caller_name = caller_result.data[0].get("name", "Arayan")
            except Exception:
                caller_name = "Arayan"

            try:
                asyncio.create_task(send_push_notification(
                    receiver_id,
                    f"📞 {caller_name}",
                    "Size gelen bir arama var.",
                    build_call_push_payload(
                        "incoming_daily_call",
                        caller_id,
                        caller_name,
                        call_type,
                        room_url=room_url,
                        room_name=room_name,
                        tag_id=tag_id,
                    )
                ))
            except Exception as push_err:
                logger.warning(f"⚠️ Call start push gönderilemedi: {push_err}")
            
            return {
                "success": True,
                "room_url": room_url,
                "room_name": room_name,
                "call_type": call_type,
                "expires_in": 600
            }
            
    except Exception as e:
        logger.error(f"Call start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/calls/end")
async def end_call(request: dict):
    """
    End call - CRITICAL: Must broadcast to other participant before cleanup
    
    Flow:
    1. Receive end request with caller_id, receiver_id, room_name
    2. Broadcast call_ended to BOTH participants via socket
    3. Delete Daily.co room
    4. Return success
    """
    try:
        room_name = request.get("room_name", "")
        caller_id = request.get("caller_id", "")
        receiver_id = request.get("receiver_id", "")
        ended_by = request.get("ended_by", "")
        
        logger.info(f"📴 Call end request: room={room_name}, ended_by={ended_by}")
        
        # 1. Broadcast call_ended to BOTH participants via socket server
        # This ensures the other participant knows to close their UI
        if caller_id or receiver_id:
            try:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    # Call socket server to broadcast
                    socket_data = {
                        "caller_id": caller_id,
                        "receiver_id": receiver_id,
                        "ended_by": ended_by,
                        "room_name": room_name
                    }
                    # Emit via our local socket.io
                    await sio.emit('call_ended_broadcast', socket_data)
                    logger.info(f"✅ Call ended broadcast sent")
            except Exception as e:
                logger.error(f"Socket broadcast error: {e}")
        
        # 2. Delete room from Daily.co
        if room_name:
            headers = {
                "Authorization": f"Bearer {DAILY_API_KEY}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                try:
                    await client.delete(
                        f"{DAILY_API_URL}/rooms/{room_name}",
                        headers=headers,
                        timeout=10
                    )
                    logger.info(f"🗑️ Daily room deleted: {room_name}")
                except:
                    pass
        
        # 3. Update call log
        try:
            supabase.table("call_logs").update({
                "status": "ended",
                "ended_at": datetime.utcnow().isoformat()
            }).eq("room_name", room_name).execute()
        except:
            pass
            
        return {"success": True, "message": "Call ended"}
        
    except Exception as e:
        logger.error(f"Call end error: {e}")
        return {"success": True}  # Always return success to not block UI

@api_router.delete("/daily/delete-room/{room_name}")
async def delete_daily_room(room_name: str):
    """
    Daily.co odasını sil (arama bitince)
    """
    try:
        headers = {
            "Authorization": f"Bearer {DAILY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{DAILY_API_URL}/rooms/{room_name}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"🗑️ Daily.co oda silindi: {room_name}")
                return {"success": True, "message": "Oda silindi"}
            else:
                logger.warning(f"Daily.co room deletion failed: {response.text}")
                return {"success": False, "message": "Oda silinemedi"}
                
    except Exception as e:
        logger.error(f"Daily.co room deletion error: {e}")
        return {"success": False, "detail": str(e)}

# Socket event: Daily.co arama kabul
@sio.event
async def accept_daily_call(sid, data):
    """Daily.co araması kabul edildi"""
    caller_id = data.get('caller_id')
    room_url = data.get('room_url')
    
    logger.info(f"✅ Daily.co arama kabul edildi: {room_url}")
    
    caller_sid = connected_users.get(caller_id)
    if caller_sid:
        await sio.emit('daily_call_accepted', {
            'room_url': room_url,
            'accepted': True
        }, room=caller_sid)

# Socket event: Daily.co arama reddet
@sio.event
async def reject_daily_call(sid, data):
    """Daily.co araması reddedildi"""
    caller_id = data.get('caller_id')
    
    logger.info(f"❌ Daily.co arama reddedildi")
    
    caller_sid = connected_users.get(caller_id)
    if caller_sid:
        await sio.emit('daily_call_rejected', {
            'rejected': True
        }, room=caller_sid)

# Socket event: Daily.co arama bitti
@sio.event
async def end_daily_call(sid, data):
    """Daily.co araması sonlandırıldı"""
    other_user_id = data.get('other_user_id')
    room_name = data.get('room_name')
    
    logger.info(f"📴 Daily.co arama sonlandırıldı: {room_name}")
    
    # Karşı tarafa bildir
    other_sid = connected_users.get(other_user_id)
    if other_sid:
        await sio.emit('daily_call_ended', {
            'ended': True,
            'room_name': room_name
        }, room=other_sid)
    
    # Odayı sil (arka planda)
    try:
        headers = {
            "Authorization": f"Bearer {DAILY_API_KEY}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"{DAILY_API_URL}/rooms/{room_name}",
                headers=headers,
                timeout=5
            )
    except:
        pass  # Silme başarısız olsa da önemli değil


# Socket event: MARTI TAG - Sürücü teklifi kabul eder (Uber-style: trip lock → push → socket)
@sio.on("driver_accept_offer")
async def handle_driver_accept_offer(sid, data):
    """
    Eşleşme: tags satırı id=tag_id için status='matched', driver_id, matched_at güncellenir.
    WHERE yalnızca id (status='waiting' şartı yok — istemci/debug ile uyum).
    Yolcu araç tercihi (tag + yolcu profili) ile sürücü vehicle_kind eşleşmezse kabul reddedilir.

    DB: modül geneli `supabase` = supabase_client.get_supabase() (create_client(URL, SERVICE_ROLE_KEY)).

    Push / socket / rolling_dispatch_stop hata verse bile offer_accepted_error üretilmez (eşleşme sonrası blok).
    """
    data = data or {}
    print("ACCEPT PAYLOAD:", data)
    tag_id = data.get("tag_id")
    driver_id = data.get("driver_id")
    driver_name = (data.get("driver_name") or "Sürücü").strip() or "Sürücü"
    print("TAG:", tag_id, "DRIVER:", driver_id)
    logger.info(f"driver_accept_offer RECEIVED tag_id={tag_id} driver_id={str(driver_id)[:20] if driver_id else '?'}")
    if not tag_id or not driver_id:
        logger.warning("driver_accept_offer: tag_id veya driver_id eksik")
        await sio.emit("offer_accepted_error", {"error": "Eksik bilgi"}, room=sid)
        return

    resolved_driver_id = await resolve_user_id(str(driver_id).strip())
    if not resolved_driver_id:
        await sio.emit("offer_accepted_error", {"error": "Geçersiz sürücü"}, room=sid)
        return

    if not supabase:
        logger.error("driver_accept_offer: supabase client yok — SERVICE_ROLE_KEY kontrol edin")
        await sio.emit(
            "offer_accepted_error",
            {"error": "Sunucu veritabanı yapılandırması eksik"},
            room=sid,
        )
        return

    tid = str(tag_id).strip()
    if len(tid) == 36 and tid.count("-") == 4:
        tid = tid.lower()

    trip_id = tid
    tag = None
    driver_phone = None

    # --- Tag + sürücü araç tipi; eşleşmezse reddet ---
    try:
        print("🚀 MATCH FLOW START")
        logger.info("MATCH FLOW START")
        tag_result = (
            supabase.table("tags")
            .select(
                "id, status, passenger_id, passenger_preferred_vehicle, pickup_location, pickup_lat, pickup_lng, "
                "dropoff_location, dropoff_lat, dropoff_lng, final_price, distance_km, estimated_minutes"
            )
            .eq("id", tid)
            .limit(1)
            .execute()
        )
        if not tag_result.data:
            await sio.emit("offer_accepted_error", {"error": "Teklif bulunamadı"}, room=sid)
            return
        tag = tag_result.data[0]
        # status='waiting' şartı kaldırıldı — doğrudan id ile UPDATE

        dr = (
            supabase.table("users")
            .select("name, phone, push_token, driver_details")
            .eq("id", resolved_driver_id)
            .limit(1)
            .execute()
        )
        if not dr.data and "-" in str(resolved_driver_id):
            dr = (
                supabase.table("users")
                .select("name, phone, push_token")
                .eq("id", str(resolved_driver_id).lower())
                .limit(1)
                .execute()
            )
        if dr.data and dr.data[0].get("name"):
            driver_name = dr.data[0]["name"]
        driver_phone = (dr.data[0].get("phone") or "").strip() if dr.data else None

        driver_eff_sock = _effective_driver_vehicle_kind(dr.data[0] if dr.data else {})
        pu_row_sock = None
        if tag.get("passenger_id"):
            try:
                pids = await resolve_user_id(str(tag["passenger_id"]).strip())
                pus = (
                    supabase.table("users")
                    .select("driver_details")
                    .eq("id", pids)
                    .limit(1)
                    .execute()
                )
                if pus.data:
                    pu_row_sock = pus.data[0]
            except Exception:
                pass
        trip_pref_sock = _trip_passenger_vehicle_pref(tag, pu_row_sock)
        if not _driver_matches_passenger_vehicle_pref(driver_eff_sock, trip_pref_sock):
            await sio.emit(
                "offer_accepted_error",
                {"error": "Bu talep için araç tipiniz uygun değil"},
                room=sid,
            )
            return

        _upd_body = {
            "status": "matched",
            "driver_id": resolved_driver_id,
            "driver_name": driver_name,
            "matched_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("tags").update(_upd_body).eq("id", tid).execute()
        # Orijinal tag_id farklı biçimdeyse (UUID büyük/küçük harf) bir kez daha dene
        if str(tag_id).strip() != tid:
            alt = str(tag_id).strip()
            print("RETRY UPDATE with alt id:", alt)
            supabase.table("tags").update(_upd_body).eq("id", alt).execute()
        logger.info(
            f"driver_accept_offer UPDATE tag={tid} driver={resolved_driver_id}"
        )
        logger.info(f"TRIP LOCK SUCCESS driver_accept_offer tag={tid} driver={resolved_driver_id}")
    except Exception as e:
        logger.exception(f"driver_accept_offer match (DB) error: {e}")
        await sio.emit("offer_accepted_error", {"error": str(e)}, room=sid)
        return

    # --- Eşleşme sonrası: best-effort; hata offer_accepted_error üretmez ---
    try:
        try:
            await rolling_dispatch_stop(
                tid, revoke_offers=True, except_driver_id=resolved_driver_id
            )
        except Exception as _rds:
            logger.warning(f"rolling_dispatch_stop after driver_accept_offer (non-fatal): {_rds}")
        try:
            await handle_dispatch_accept(tid, resolved_driver_id)
        except Exception as _hda:
            logger.warning(f"handle_dispatch_accept after driver_accept_offer (non-fatal): {_hda}")

        passenger_id = tag.get("passenger_id")
        passenger_id = str(passenger_id).strip() if passenger_id else None
        if passenger_id:
            passenger_id = await resolve_user_id(passenger_id)
        passenger_name = "Yolcu"
        passenger_phone = None
        pr = None
        if passenger_id:
            pr = supabase.table("users").select("name, phone, push_token").eq("id", passenger_id).limit(1).execute()
            if not pr.data and "-" in passenger_id:
                pr = (
                    supabase.table("users")
                    .select("name, phone, push_token")
                    .eq("id", passenger_id.lower())
                    .limit(1)
                    .execute()
                )
            if pr and pr.data:
                if pr.data[0].get("name"):
                    passenger_name = pr.data[0]["name"]
                passenger_phone = (pr.data[0].get("phone") or "").strip()
        if not passenger_id:
            logger.warning(f"driver_accept_offer: tag {tid} için passenger_id yok (push/socket kısıtlı)")

        def _id_hint(uid):
            if not uid:
                return "?"
            s = str(uid).strip()
            if "-" in s:
                return f"uuid:{s[-8:]}"
            if s.isdigit() and len(s) >= 10:
                return f"phone:{s[:4]}***"
            return f"id:{s[:8]}"

        logger.info(f"MATCH PUSH: driver_id={_id_hint(resolved_driver_id)} passenger_id={_id_hint(passenger_id)}")
        match_data = {"event": "match", "trip_id": trip_id, "type": "matched", "tag_id": tid}

        print("📲 SENDING PUSH DRIVER")
        push_driver_ok = await send_push_notification(
            resolved_driver_id,
            "Eşleşme sağlandı",
            "Yolcuya gitmek için tıklayın.",
            match_data,
        )
        if not push_driver_ok and driver_phone and _looks_like_phone(driver_phone):
            push_driver_ok = await send_push_notification(
                driver_phone,
                "Eşleşme sağlandı",
                "Yolcuya gitmek için tıklayın.",
                match_data,
            )
            if push_driver_ok:
                logger.info("PUSH DRIVER SENT (retry by phone)")
        logger.info("PUSH DRIVER SENT" if push_driver_ok else "PUSH DRIVER FAILED")

        if passenger_id:
            print("📲 SENDING PUSH PASSENGER")
            push_p_ok = await send_push_notification(
                passenger_id,
                "Sürücü bulundu",
                "Sürücünüz yola çıktı.",
                match_data,
            )
            if not push_p_ok and passenger_phone and _looks_like_phone(passenger_phone):
                push_p_ok = await send_push_notification(
                    passenger_phone,
                    "Sürücü bulundu",
                    "Sürücünüz yola çıktı.",
                    match_data,
                )
                if push_p_ok:
                    logger.info("PUSH PASSENGER SENT (retry by phone)")
            logger.info("PUSH PASSENGER SENT" if push_p_ok else "PUSH PASSENGER FAILED")

        matched_at = datetime.utcnow().isoformat()
        payload = {
            "trip_id": trip_id,
            "tag_id": tid,
            "driver_id": resolved_driver_id,
            "driver_name": driver_name,
            "passenger_id": passenger_id,
            "passenger_name": passenger_name,
            "pickup_location": tag.get("pickup_location"),
            "dropoff_location": tag.get("dropoff_location"),
            "pickup_lat": tag.get("pickup_lat"),
            "pickup_lng": tag.get("pickup_lng"),
            "dropoff_lat": tag.get("dropoff_lat"),
            "dropoff_lng": tag.get("dropoff_lng"),
            "offered_price": tag.get("offered_price") or tag.get("final_price"),
            "final_price": tag.get("final_price"),
            "distance_km": tag.get("distance_km"),
            "estimated_minutes": tag.get("estimated_minutes"),
            "status": "matched",
            "matched_at": matched_at,
        }
        driver_sid = connected_users.get(str(resolved_driver_id).strip().lower()) or connected_users.get(
            resolved_driver_id
        )
        driver_room = _normalize_user_room(resolved_driver_id)
        driver_target = driver_sid or driver_room
        if driver_target:
            await sio.emit("offer_accepted_success", payload, room=driver_target)
            await sio.emit("tag_matched", payload, room=driver_target)
        # İstenen net match event: sürücü room'una ride_matched
        await sio.emit("ride_matched", payload, room=f"user_{str(resolved_driver_id).strip().lower()}")
        if passenger_id:
            passenger_sid = connected_users.get(str(passenger_id).strip().lower()) or connected_users.get(passenger_id)
            passenger_room = _normalize_user_room(passenger_id)
            passenger_target = passenger_sid or passenger_room
            if passenger_target:
                await sio.emit("driver_matched", payload, room=passenger_target)
                await sio.emit("tag_matched", payload, room=passenger_target)
            # İstenen net match event: yolcu room'una ride_matched
            await sio.emit("ride_matched", payload, room=f"user_{str(passenger_id).strip().lower()}")
        logger.info("SOCKET EMIT DONE driver_accept_offer")
    except Exception as e:
        logger.warning(f"driver_accept_offer post-match (non-fatal): {e}")

    logger.info("MATCH FLOW END driver_accept_offer")


# ==================== CHAT MESSAGING SYSTEM (HYBRID) ====================
# Supabase = Source of Truth, Socket = Real-time notification (best-effort)

class ChatMessageCreate(BaseModel):
    tag_id: str
    sender_id: str
    receiver_id: str
    message: str
    sender_name: Optional[str] = None

@api_router.post("/chat/send-message")
async def send_chat_message(msg: ChatMessageCreate):
    """
    HYBRID CHAT: 
    1. FIRST save to Supabase (source of truth)
    2. THEN emit socket event (best-effort, non-blocking)
    3. Send push notification to receiver
    """
    try:
        # 1. Supabase'e kaydet (SOURCE OF TRUTH)
        message_data = {
            "tag_id": msg.tag_id,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "message": msg.message,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("chat_messages").insert(message_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save message")
        
        saved_message = result.data[0]
        logger.info(f"💬 Chat message saved to Supabase: {saved_message['id']}")
        
        # 2. Gönderenin adını al
        sender_result = supabase.table("users").select("name").eq("id", msg.sender_id).execute()
        sender_name = sender_result.data[0].get("name", "Birisi") if sender_result.data else "Birisi"
        
        # 3. 🔔 PUSH NOTIFICATION - Alıcıya mesaj bildirimi
        asyncio.create_task(send_push_notification(
            msg.receiver_id,
            f"💬 {sender_name}",
            msg.message[:100] + ("..." if len(msg.message) > 100 else ""),
            {"type": "chat_message", "tag_id": msg.tag_id, "sender_id": msg.sender_id}
        ))
        logger.info(f"📤 Chat push notification sent to {msg.receiver_id}")
        
        # 4. Socket bildirimi (BEST-EFFORT - başarısız olursa önemli değil)
        try:
            # Receiver'a socket emit
            await sio.emit("new_chat_message", {
                "tag_id": msg.tag_id,
                "message": saved_message,
                "sender_name": sender_name
            }, room=_normalize_user_room(msg.receiver_id))
        except Exception as socket_err:
            logger.warning(f"⚠️ Socket notification failed (non-blocking): {socket_err}")
        
        return {
            "success": True,
            "message_id": saved_message["id"],
            "created_at": saved_message["created_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Chat send error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/chat/messages")
async def get_chat_messages(tag_id: str, limit: int = 50, offset: int = 0):
    """
    Supabase'den mesajları çek (SOURCE OF TRUTH)
    Pagination destekli
    """
    try:
        result = supabase.table("chat_messages")\
            .select("*")\
            .eq("tag_id", tag_id)\
            .order("created_at", desc=False)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        messages = result.data or []
        
        return {
            "success": True,
            "messages": messages,
            "count": len(messages),
            "tag_id": tag_id
        }
        
    except Exception as e:
        logger.error(f"❌ Chat fetch error: {e}")
        # Hata durumunda boş array dön (UI kırılmasın)
        return {
            "success": False,
            "messages": [],
            "count": 0,
            "error": str(e)
        }

@api_router.post("/chat/mark-read")
async def mark_messages_read(tag_id: str, user_id: str):
    """
    Kullanıcının okuduğu mesajları işaretle
    """
    try:
        result = supabase.table("chat_messages")\
            .update({"read_at": datetime.utcnow().isoformat()})\
            .eq("tag_id", tag_id)\
            .eq("receiver_id", user_id)\
            .is_("read_at", "null")\
            .execute()
        
        return {"success": True, "updated": len(result.data or [])}
    except Exception as e:
        logger.error(f"❌ Mark read error: {e}")
        return {"success": False, "error": str(e)}

# ==================== MARTI TAG - FİYAT HESAPLAMA ====================

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """İki nokta arası mesafe (km) - Kuş uçuşu"""
    import math
    R = 6371  # Dünya yarıçapı km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _eta_minutes(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> int:
    """Kuş uçuşu mesafeden tahmini varış süresi (dk) - şehir içi ~25 km/h"""
    if not all([from_lat, from_lng, to_lat, to_lng]):
        return 0
    km = haversine_distance(from_lat, from_lng, to_lat, to_lng)
    # Gerçek yol genelde 1.2–1.4x; ortalama hız ~25 km/h → dk = km * 2.5
    minutes = max(1, round(km * 2.5))
    return min(minutes, 120)  # max 120 dk

async def get_road_distance(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """
    Google Directions API ile gerçek yol mesafesi hesapla
    Returns: {"distance_km": float, "duration_min": int} veya None
    """
    try:
        import httpx
        
        # Google Maps API Key
        api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if not api_key:
            logger.warning("⚠️ GOOGLE_MAPS_API_KEY bulunamadı, haversine kullanılacak")
            return None
        
        url = f"https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "mode": "driving",
            "key": api_key
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
        
        if data.get("status") == "OK" and data.get("routes"):
            leg = data["routes"][0]["legs"][0]
            distance_km = leg["distance"]["value"] / 1000  # metre -> km
            duration_min = int(leg["duration"]["value"] / 60)  # saniye -> dakika
            
            logger.info(f"📍 Google Directions: {distance_km:.1f} km, {duration_min} dk")
            
            return {
                "distance_km": round(distance_km, 1),
                "duration_min": max(1, duration_min)
            }
        else:
            logger.warning(f"⚠️ Google Directions API hatası: {data.get('status')}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Google Directions API hatası: {e}")
        return None

def is_peak_hour() -> bool:
    """Yoğun saat kontrolü (08:00-10:00, 17:00-20:00)"""
    from datetime import datetime, timezone, timedelta
    try:
        # Türkiye saati UTC+3
        turkey_tz = timezone(timedelta(hours=3))
        now = datetime.now(turkey_tz)
        hour = now.hour
        # Yoğun saatler: 08:00-10:00 ve 17:00-20:00
        return (8 <= hour < 10) or (17 <= hour < 20)
    except:
        # Fallback: UTC+3
        hour = (datetime.utcnow().hour + 3) % 24
        return (8 <= hour < 10) or (17 <= hour < 20)

class CalculatePriceRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    driver_lat: Optional[float] = None  # Sürücü konumu (opsiyonel)
    driver_lng: Optional[float] = None


@api_router.post("/price/calculate")
async def calculate_price(request: CalculatePriceRequest):
    """
    Leylek TAG Fiyat Hesaplama - DİNAMİK SİSTEM
    Google Directions API ile gerçek yol mesafesi kullanır
    """
    try:
        # 1. Önce Google Directions API ile gerçek mesafe dene
        road_info = await get_road_distance(
            request.pickup_lat, request.pickup_lng,
            request.dropoff_lat, request.dropoff_lng
        )
        
        if road_info:
            trip_distance_km = road_info["distance_km"]
            estimated_minutes = road_info["duration_min"]
            logger.info(f"📍 Google API ile hesaplandı: {trip_distance_km} km, {estimated_minutes} dk")
        else:
            # Fallback: Haversine (kuş uçuşu) + %30 ekleme (yol kıvrımları için)
            haversine_km = haversine_distance(
                request.pickup_lat, request.pickup_lng,
                request.dropoff_lat, request.dropoff_lng
            )
            trip_distance_km = round(haversine_km * 1.3, 1)  # %30 ekleme
            estimated_minutes = int((trip_distance_km / 30) * 60)
            logger.info(f"📍 Haversine ile hesaplandı: {trip_distance_km} km (kuş uçuşu: {haversine_km:.1f} km)")
        
        # Minimum mesafe 1 km
        trip_distance_km = max(1.0, trip_distance_km)
        estimated_minutes = max(5, estimated_minutes)  # Minimum 5 dakika
        
        # Yoğun saat kontrolü
        peak = is_peak_hour()
        
        # 2. DİNAMİK FİYATLANDIRMA - Admin ayarlarını kullan
        if peak:
            min_price_per_km = PRICING_SETTINGS["min_price_per_km_peak"]
            max_price_per_km = PRICING_SETTINGS["max_price_per_km_peak"]
        else:
            min_price_per_km = PRICING_SETTINGS["min_price_per_km_normal"]
            max_price_per_km = PRICING_SETTINGS["max_price_per_km_normal"]
        
        # Yolculuk ücreti hesapla
        trip_min_price = round(trip_distance_km * min_price_per_km)
        trip_max_price = round(trip_distance_km * max_price_per_km)
        
        # 3. Minimum fiyat kuralı (Admin ayarlarından)
        minimum = PRICING_SETTINGS["minimum_price"]
        min_price = max(minimum, trip_min_price)
        max_price = max(min_price + 20, trip_max_price)
        
        # Önerilen fiyat (ortası)
        suggested_price = round((min_price + max_price) / 2)
        
        logger.info(f"💰 Fiyat hesaplama: Yolculuk {trip_distance_km:.1f}km, {estimated_minutes}dk, {min_price}-{max_price}TL (peak={peak})")
        
        return {
            "success": True,
            "distance_km": round(trip_distance_km, 1),
            "trip_distance_km": round(trip_distance_km, 1),
            "estimated_minutes": estimated_minutes,
            "min_price": min_price,
            "max_price": max_price,
            "suggested_price": suggested_price,
            "is_peak_hour": peak,
            "currency": "TL",
            "price_per_km_range": f"{min_price_per_km}-{max_price_per_km} TL/km",
            "driver_pickup_price_per_km": PRICING_SETTINGS["driver_pickup_per_km"]
        }
    except Exception as e:
        logger.error(f"❌ Price calculation error: {e}")
        return {"success": False, "error": str(e)}

class CreateRideOfferRequest(BaseModel):
    tag_id: str = None  # 🆕 Frontend'den gelen ID
    passenger_id: str
    pickup_lat: float
    pickup_lng: float
    pickup_location: str
    dropoff_lat: float
    dropoff_lng: float
    dropoff_location: str
    offered_price: int
    distance_km: float
    estimated_minutes: int
    # car | motorcycle | motor — yoksa profil veya varsayılan car
    passenger_preferred_vehicle: Optional[str] = None
    # Frontend alias (ride/create); passenger_preferred_vehicle ile aynı anlam
    passenger_vehicle_kind: Optional[str] = None

@api_router.post("/ride/create-offer")
async def create_ride_offer(request: CreateRideOfferRequest):
    """
    Martı TAG - Yolcu teklif oluşturur
    Bu teklif tüm yakındaki sürücülere gönderilir
    """
    try:
        # Her zaman canonical UUID ile ilerle (eski id/telefon kaynaklı eşleşme kaçaklarını önler)
        passenger_id = await resolve_user_id(request.passenger_id)
        # Tag ID - frontend'den gelen veya yeni oluştur
        tag_id = request.tag_id or str(uuid.uuid4())
        
        # Yolcu bilgisi + araç tercihi (driver_details.passenger_preferred_vehicle)
        passenger_result = (
            supabase.table("users")
            .select("name, driver_details")
            .eq("id", passenger_id)
            .execute()
        )
        pref_from_request = _canonical_vehicle_kind(
            request.passenger_preferred_vehicle
        ) or _canonical_vehicle_kind(request.passenger_vehicle_kind)
        passenger_name = "Yolcu"
        passenger_pref_vehicle = pref_from_request or "car"
        if passenger_result.data:
            prow = passenger_result.data[0]
            passenger_name = prow.get("name") or "Yolcu"
            from_profile = _passenger_preferred_vehicle_from_row(prow)
            passenger_pref_vehicle = pref_from_request or from_profile or "car"
            # Profilde son tercihi sakla (bir sonraki teklif için)
            try:
                dd = _driver_details_as_dict(prow)
                dd["passenger_preferred_vehicle"] = passenger_pref_vehicle
                supabase.table("users").update({"driver_details": dd}).eq("id", passenger_id).execute()
            except Exception as sync_ve:
                logger.warning(f"passenger_preferred_vehicle profil senkronu: {sync_ve}")
        
        # Tag oluştur - Mevcut tablo kolonlarını kullan
        tag_data = {
            "id": tag_id,
            "passenger_id": passenger_id,
            "passenger_name": passenger_name,
            "pickup_lat": request.pickup_lat,
            "pickup_lng": request.pickup_lng,
            "pickup_location": request.pickup_location,
            "dropoff_lat": request.dropoff_lat,
            "dropoff_lng": request.dropoff_lng,
            "dropoff_location": request.dropoff_location,
            "final_price": request.offered_price,  # offered_price yerine final_price kullan
            "status": "waiting",
            "created_at": datetime.utcnow().isoformat(),
            "passenger_preferred_vehicle": passenger_pref_vehicle,
        }
        
        result = supabase.table("tags").insert(tag_data).execute()
        
        if result.data:
            tag = result.data[0]
            # Response'a ek bilgiler ekle
            tag["offered_price"] = request.offered_price  # Frontend için
            tag["distance_km"] = request.distance_km
            tag["estimated_minutes"] = request.estimated_minutes
            logger.info(
                f"🏷️ Yeni teklif oluşturuldu: {tag['id']} - {request.offered_price}TL "
                f"(yolcu araç tercihi={passenger_pref_vehicle})"
            )
            logger.info(f"PASSENGER CREATED TAG {tag_id}")
            # Teklif dağıtımı: bellek içi rolling batch (tag DB'den okunur; dispatch_queue kullanılmaz)
            logger.info(f"CALL rolling_dispatch_start tag={tag_id}")
            notified = await rolling_dispatch_start(tag_id)
            if notified == 0:
                logger.warning(f"⚠️ Rolling batch: tag={tag_id} için {DISPATCH_RADIUS_KM} km içinde uygun sürücü yok")
                try:
                    await sio.emit(
                        "dispatch_exhausted",
                        {"tag_id": tag_id, "message": "20 km içinde uygun sürücü bulunamadı"},
                        room=_normalize_user_room(passenger_id),
                    )
                except Exception:
                    pass

            return {
                "success": True,
                "tag": tag,
                "dispatch_mode": "rolling_batch",
                "eligible_driver_count": notified,
                "message": "Teklifiniz sürücülere gönderildi"
            }
        
        return {"success": False, "error": "Tag oluşturulamadı"}
    except Exception as e:
        logger.error(f"❌ Create ride offer error: {e}")
        return {"success": False, "error": str(e)}


@api_router.post("/ride/create")
async def create_ride(request: CreateRideOfferRequest):
    """
    Yolcu teklif oluşturma — POST /api/ride/create
    create-offer ile aynı: tag insert + rolling_dispatch_start.
    """
    return await create_ride_offer(request)


@api_router.post("/ride/accept")
async def accept_ride(tag_id: str, driver_id: str):
    """
    Martı TAG - Sürücü teklifi kabul eder
    İLK KABUL EDEN KAZANIR - Atomik işlem
    Yolcu araç tercihi ile sürücü vehicle_kind eşleşmezse kabul edilmez.
    """
    try:
        resolved_driver_id = await resolve_user_id(driver_id)
        # Önce tag'in durumunu kontrol et (race condition önleme)
        tag_result = supabase.table("tags").select("*").eq("id", tag_id).execute()
        
        if not tag_result.data:
            return {"success": False, "error": "Teklif bulunamadı"}
        
        tag = tag_result.data[0]
        
        # Zaten kabul edilmiş mi?
        if tag.get("status") != "waiting":
            return {"success": False, "error": "Bu teklif artık mevcut değil", "already_taken": True}

        logger.info("Accept: direct match mode")

        # Sürücü bilgisini al (araç tipi doğrulaması)
        driver_result = supabase.table("users").select("name, phone, driver_details").eq("id", resolved_driver_id).execute()
        if not driver_result.data:
            return {"success": False, "error": "Şoför bulunamadı"}
        driver_eff_ar = _effective_driver_vehicle_kind(driver_result.data[0])
        pu_row_ar = None
        pida = tag.get("passenger_id")
        if pida:
            try:
                pida_r = await resolve_user_id(str(pida).strip())
                pu_ar = (
                    supabase.table("users")
                    .select("driver_details")
                    .eq("id", pida_r)
                    .limit(1)
                    .execute()
                )
                if pu_ar.data:
                    pu_row_ar = pu_ar.data[0]
            except Exception:
                pass
        trip_pref_ar = _trip_passenger_vehicle_pref(tag, pu_row_ar)
        if not _driver_matches_passenger_vehicle_pref(driver_eff_ar, trip_pref_ar):
            return {"success": False, "error": "Bu talep için araç tipiniz uygun değil"}
        driver_name = driver_result.data[0]["name"] if driver_result.data else "Sürücü"
        
        # Yolcu bilgisini al - passenger_id kullan (tag'da bazen user_id olarak da saklanabilir)
        passenger_id = tag.get("passenger_id")
        if not passenger_id:
            refetch = supabase.table("tags").select("passenger_id").eq("id", tag_id).limit(1).execute()
            if refetch.data and refetch.data[0].get("passenger_id"):
                passenger_id = refetch.data[0]["passenger_id"]
        if passenger_id:
            passenger_id = await resolve_user_id(passenger_id)

        if passenger_id:
            passenger_result = supabase.table("users").select("name, phone").eq("id", passenger_id).execute()
            passenger_name = passenger_result.data[0]["name"] if passenger_result.data else "Yolcu"
        else:
            passenger_name = "Yolcu"
        
        # Atomik güncelleme - sadece status='waiting' ise güncelle
        # .select("*") zorunlu: aksi halde update_result.data boş kalır (PostgREST)
        update_result = supabase.table("tags").update({
            "status": "matched",
            "driver_id": resolved_driver_id,
            "driver_name": driver_name,
            "matched_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id).eq("status", "waiting").select("*").execute()
        
        if not update_result.data:
            return {"success": False, "error": "Bu teklif artık mevcut değil", "already_taken": True}
        
        updated_tag = update_result.data[0]
        updated_tag["passenger_name"] = passenger_name

        try:
            await rolling_dispatch_stop(
                tag_id, revoke_offers=True, except_driver_id=resolved_driver_id
            )
        except Exception as _rds:
            logger.warning(f"rolling_dispatch_stop after accept_ride (non-fatal): {_rds}")

        # Socket: yolcu / sürücü (DB dispatch_queue kullanılmıyor)
        match_socket_payload = {
            "tag_id": tag_id,
            "status": "matched",
            "driver_id": resolved_driver_id,
            "driver_name": driver_name,
            "passenger_id": passenger_id,
            "passenger_name": passenger_name,
            "pickup_location": updated_tag.get("pickup_location"),
            "pickup_lat": updated_tag.get("pickup_lat"),
            "pickup_lng": updated_tag.get("pickup_lng"),
            "dropoff_location": updated_tag.get("dropoff_location"),
            "dropoff_lat": updated_tag.get("dropoff_lat"),
            "dropoff_lng": updated_tag.get("dropoff_lng"),
            "final_price": updated_tag.get("final_price"),
            "matched_at": updated_tag.get("matched_at"),
        }
        if passenger_id:
            await emit_socket_event_to_user(passenger_id, "ride_accepted", match_socket_payload)
        await emit_socket_event_to_user(resolved_driver_id, "ride_matched", match_socket_payload)
        
        # Push (Expo) — teklif kanalıyla aynı
        await send_match_notification_to_both(tag_id, resolved_driver_id, passenger_id)
        
        logger.info(f"✅ Eşleşme: {tag_id} - Sürücü: {driver_name}")
        
        return {
            "success": True,
            "tag": updated_tag,
            "message": "Teklif kabul edildi!"
        }
    except Exception as e:
        logger.error(f"❌ Accept ride error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/ride/available-offers")
async def get_available_offers(driver_id: str, lat: float, lng: float, radius_km: float = 20):
    """
    Martı TAG - Sürücü için mevcut teklifleri getir
    Sadece 'waiting' durumundaki ve yakındaki teklifler
    """
    try:
        resolved_driver_id = await resolve_user_id(driver_id)
        dr_row = (
            supabase.table("users")
            .select("driver_details")
            .eq("id", resolved_driver_id)
            .limit(1)
            .execute()
        )
        driver_eff = _effective_driver_vehicle_kind(dr_row.data[0] if dr_row.data else {})

        # Tüm bekleyen teklifleri al
        result = supabase.table("tags").select("*")\
            .eq("status", "waiting")\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        
        offers = []
        for tag in result.data or []:
            trip_pref = _trip_passenger_vehicle_pref(tag, None)
            if not _driver_matches_passenger_vehicle_pref(driver_eff, trip_pref):
                continue
            # Mesafe hesapla
            distance = haversine_distance(lat, lng, tag["pickup_lat"], tag["pickup_lng"])
            
            # Sadece belirli yarıçap içindekiler
            if distance <= radius_km:
                tag["distance_to_pickup"] = round(distance, 1)
                tag["passenger_name"] = tag.get("passenger_name") or "Yolcu"
                offers.append(tag)
        
        # Mesafeye göre sırala (en yakın önce)
        offers.sort(key=lambda x: x["distance_to_pickup"])
        
        return {"success": True, "offers": offers, "count": len(offers)}
    except Exception as e:
        logger.error(f"❌ Get available offers error: {e}")
        return {"success": False, "error": str(e), "offers": []}

# ==================== PROMOSYON KODU SİSTEMİ ====================

@api_router.post("/admin/promo/create")
async def create_promo_code(admin_phone: str, hours: int, code: str = None, max_uses: int = 1, description: str = ""):
    """Admin - Promosyon kodu oluştur"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        promo_code = code or generate_promo_code()
        
        promo_data = {
            "code": promo_code.upper(),
            "hours": hours,
            "max_uses": max_uses,
            "used_count": 0,
            "description": description,
            "is_active": True,
            "created_by": admin_phone,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("promo_codes").insert(promo_data).execute()
        
        logger.info(f"✅ Promosyon kodu oluşturuldu: {promo_code} ({hours} saat)")
        return {"success": True, "promo": result.data[0] if result.data else promo_data}
    except Exception as e:
        logger.error(f"Create promo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/promo/list")
async def list_promo_codes(admin_phone: str):
    """Admin - Tüm promosyon kodlarını listele"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        result = supabase.table("promo_codes").select("*").order("created_at", desc=True).execute()
        
        return {"success": True, "promos": result.data or []}
    except Exception as e:
        logger.error(f"List promo error: {e}")
        return {"success": False, "promos": []}

@api_router.post("/admin/promo/deactivate")
async def deactivate_promo(admin_phone: str, code: str):
    """Admin - Promosyon kodunu deaktive et"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        supabase.table("promo_codes").update({"is_active": False}).eq("code", code.upper()).execute()
        
        return {"success": True, "message": "Promosyon kodu deaktive edildi"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@api_router.post("/admin/driver/grant-package-by-phone")
async def admin_grant_driver_package_by_phone(admin_phone: str, phone: str, package_id: str = "1_month"):
    """Admin: telefona göre sürücü paketi yükle (satın alınmış gibi)."""
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")

    try:
        clean_phone = (phone or "").replace("+90", "").replace(" ", "").replace("-", "")
        # Paketi kontrol et
        if package_id not in DRIVER_PACKAGES:
            raise HTTPException(status_code=400, detail="Geçersiz paket")

        # Kullanıcıyı bul (905xx / 5xx varyantları için mevcut helper)
        user_row = None
        for candidate in _phone_lookup_candidates(clean_phone):
            res = supabase.table("users").select("id, phone, driver_active_until").eq("phone", candidate).limit(1).execute()
            if res.data:
                user_row = res.data[0]
                break
        if not user_row:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

        hours = DRIVER_PACKAGES[package_id]["hours"]
        now = datetime.utcnow()

        current_until = user_row.get("driver_active_until")
        if current_until:
            try:
                active_until = datetime.fromisoformat(current_until.replace("Z", "+00:00"))
                if active_until.tzinfo:
                    active_until = active_until.replace(tzinfo=None)
                base = active_until if active_until > now else now
            except Exception:
                base = now
        else:
            base = now

        new_until = base + timedelta(hours=hours)

        supabase.table("users").update({
            "driver_active_until": new_until.isoformat(),
            "updated_at": now.isoformat(),
        }).eq("id", user_row["id"]).execute()

        # Log (tablo yoksa sorun etmeyelim)
        try:
            supabase.table("driver_package_purchases").insert({
                "user_id": user_row["id"],
                "package_id": package_id,
                "package_name": DRIVER_PACKAGES[package_id]["name"],
                "hours": hours,
                "price_tl": DRIVER_PACKAGES[package_id]["price_tl"],
                "purchased_at": now.isoformat(),
                "expires_at": new_until.isoformat(),
                "notes": f"admin_grant:{admin_phone}",
            }).execute()
        except Exception:
            pass

        return {
            "success": True,
            "user_id": user_row["id"],
            "phone": user_row.get("phone"),
            "package_id": package_id,
            "active_until": new_until.isoformat(),
            "hours_added": hours,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"admin_grant_driver_package_by_phone error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/driver/promo/redeem")
async def redeem_promo_code(user_id: str, code: str):
    """Sürücü - Promosyon kodunu kullan"""
    try:
        code = code.upper().strip()
        
        # Promosyon kodunu kontrol et
        result = supabase.table("promo_codes").select("*").eq("code", code).eq("is_active", True).execute()
        
        if not result.data:
            return {"success": False, "error": "Geçersiz veya süresi dolmuş promosyon kodu"}
        
        promo = result.data[0]
        
        # Kullanım limitini kontrol et
        if promo["used_count"] >= promo["max_uses"]:
            return {"success": False, "error": "Bu promosyon kodu kullanım limitine ulaştı"}
        
        # Kullanıcı daha önce kullanmış mı?
        usage_check = supabase.table("promo_usage").select("id").eq("user_id", user_id).eq("promo_code", code).execute()
        if usage_check.data:
            return {"success": False, "error": "Bu promosyon kodunu daha önce kullandınız"}
        
        # Sürücünün mevcut aktif süresini al
        user_result = supabase.table("users").select("driver_active_until").eq("id", user_id).execute()
        
        current_until = None
        if user_result.data and user_result.data[0].get("driver_active_until"):
            current_until = datetime.fromisoformat(user_result.data[0]["driver_active_until"].replace("Z", ""))
        
        # Yeni süreyi hesapla
        now = datetime.utcnow()
        if current_until and current_until > now:
            new_until = current_until + timedelta(hours=promo["hours"])
        else:
            new_until = now + timedelta(hours=promo["hours"])
        
        # Kullanıcıyı güncelle
        supabase.table("users").update({
            "driver_active_until": new_until.isoformat()
        }).eq("id", user_id).execute()
        
        # Promosyon kullanım sayısını artır
        supabase.table("promo_codes").update({
            "used_count": promo["used_count"] + 1
        }).eq("code", code).execute()
        
        # Kullanım kaydı oluştur
        supabase.table("promo_usage").insert({
            "user_id": user_id,
            "promo_code": code,
            "hours_added": promo["hours"],
            "used_at": datetime.utcnow().isoformat()
        }).execute()
        
        logger.info(f"✅ Promosyon kullanıldı: {code} -> {user_id} ({promo['hours']} saat)")
        
        return {
            "success": True,
            "message": f"{promo['hours']} saat eklendi!",
            "hours_added": promo["hours"],
            "active_until": new_until.isoformat()
        }
    except Exception as e:
        logger.error(f"Redeem promo error: {e}")
        return {"success": False, "error": str(e)}

# ==================== SÜRÜCÜ AKTİFLİK KURALLARI (3 SAAT MİNİMUM) ====================

@api_router.post("/driver/toggle-online")
async def toggle_driver_online(user_id: str, is_online: bool):
    """Sürücü online/offline durumunu değiştir - 3 SAAT MİNİMUM KURALI"""
    try:
        now = datetime.utcnow()
        
        # Mevcut durumu al (admin için phone da lazım)
        user_result = supabase.table("users").select(
            "phone, driver_online, driver_active_until, driver_activated_at"
        ).eq("id", user_id).execute()
        
        if not user_result.data:
            return {"success": False, "error": "Kullanıcı bulunamadı"}
        
        user = user_result.data[0]
        current_online = user.get("driver_online", False)
        active_until = user.get("driver_active_until")
        activated_at = user.get("driver_activated_at")
        phone = (user.get("phone") or "").replace("+90", "").replace(" ", "").replace("-", "")
        is_admin_user = phone in ADMIN_PHONE_NUMBERS
        
        # Aktif paketi kontrol et (ücretsiz dönemde atlanır; admin ise yoksa/bitmişse 1 yıl ver)
        if is_online:
            need_activate = False
            if DRIVER_UNLIMITED_FREE_PERIOD:
                pass
            elif not active_until:
                if is_admin_user:
                    need_activate = True
                else:
                    return {"success": False, "error": "Aktif paketiniz yok. Lütfen paket satın alın veya promosyon kodu kullanın."}
            else:
                active_until_dt = datetime.fromisoformat(active_until.replace("Z", ""))
                if active_until_dt < now:
                    if is_admin_user:
                        need_activate = True
                    else:
                        return {"success": False, "error": "Paket süreniz dolmuş. Lütfen yeni paket alın."}
            if need_activate:
                # Admin: ücretsiz 1 yıl aktif
                active_until = (now + timedelta(days=365)).isoformat()
                supabase.table("users").update({
                    "driver_active_until": active_until,
                    "updated_at": now.isoformat()
                }).eq("id", user_id).execute()
        
        # KAPAMA İSTEĞİ - 3 saat kuralı (admin hariç)
        if not is_online and current_online and not is_admin_user:
            if activated_at:
                activated_at_dt = datetime.fromisoformat(activated_at.replace("Z", ""))
                hours_active = (now - activated_at_dt).total_seconds() / 3600
                
                if hours_active < 3:
                    remaining_minutes = int((3 - hours_active) * 60)
                    return {
                        "success": False,
                        "error": f"En az 3 saat aktif kalmalısınız. Kalan süre: {remaining_minutes} dakika",
                        "min_hours": 3,
                        "hours_active": round(hours_active, 1),
                        "remaining_minutes": remaining_minutes
                    }
        
        # Durumu güncelle
        update_data = {"driver_online": is_online}
        
        if is_online and not current_online:
            # Açılıyor - aktivasyon zamanını kaydet
            update_data["driver_activated_at"] = now.isoformat()
        elif not is_online and current_online:
            # Kapanıyor - aktivasyon zamanını temizle
            update_data["driver_activated_at"] = None
        
        supabase.table("users").update(update_data).eq("id", user_id).execute()
        
        status_text = "aktif" if is_online else "pasif"
        logger.info(f"🚗 Sürücü {status_text}: {user_id}")
        
        return {
            "success": True,
            "is_online": is_online,
            "message": f"Sürücü modu {'açıldı' if is_online else 'kapatıldı'}"
        }
    except Exception as e:
        logger.error(f"Toggle driver online error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/driver/activation-status")
async def get_driver_activation_status(user_id: str):
    """Sürücünün aktivasyon durumunu getir"""
    try:
        user_result = supabase.table("users").select(
            "driver_online, driver_active_until, driver_activated_at"
        ).eq("id", user_id).execute()
        
        if not user_result.data:
            return {"success": False, "error": "Kullanıcı bulunamadı"}
        
        user = user_result.data[0]
        now = datetime.utcnow()
        
        is_online = user.get("driver_online", False)
        active_until = user.get("driver_active_until")
        activated_at = user.get("driver_activated_at")
        
        # Kalan paket süresini hesapla
        remaining_package_minutes = 0
        if active_until:
            active_until_dt = datetime.fromisoformat(active_until.replace("Z", ""))
            if active_until_dt > now:
                remaining_package_minutes = int((active_until_dt - now).total_seconds() / 60)
        
        # Minimum aktiflik süresini hesapla
        can_deactivate = True
        remaining_min_minutes = 0
        hours_active = 0
        
        if is_online and activated_at:
            activated_at_dt = datetime.fromisoformat(activated_at.replace("Z", ""))
            hours_active = (now - activated_at_dt).total_seconds() / 3600
            
            if hours_active < 3:
                can_deactivate = False
                remaining_min_minutes = int((3 - hours_active) * 60)
        
        return {
            "success": True,
            "is_online": is_online,
            "active_until": active_until,
            "remaining_package_minutes": remaining_package_minutes,
            "hours_active": round(hours_active, 2),
            "can_deactivate": can_deactivate,
            "remaining_min_minutes": remaining_min_minutes,
            "min_hours_required": 3
        }
    except Exception as e:
        logger.error(f"Get activation status error: {e}")
        return {"success": False, "error": str(e)}

# ==================== GELİŞMİŞ ADMİN PANELİ ====================

@api_router.get("/admin/dashboard/full")
async def admin_full_dashboard(admin_phone: str):
    """Admin - Tam dashboard istatistikleri"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        now = datetime.utcnow()
        now_iso = now.isoformat()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_start = (now - timedelta(days=7)).isoformat()
        
        # Kullanıcı istatistikleri - push_token ve driver_active_until da al
        users_result = supabase.table("users").select(
            "id, driver_details, driver_online, driver_active_until, created_at, push_token"
        ).execute()
        
        total_users = len(users_result.data) if users_result.data else 0
        
        drivers = []
        online_drivers = 0
        new_users_today = 0
        push_token_count = 0
        
        for u in users_result.data or []:
            # Push token sayısı
            if u.get("push_token"):
                push_token_count += 1
            
            # Sürücü kontrolü
            if u.get("driver_details"):
                drivers.append(u)
                # driver_online VE driver_active_until geçerli mi?
                if u.get("driver_online"):
                    active_until = u.get("driver_active_until")
                    if DRIVER_UNLIMITED_FREE_PERIOD or (active_until and active_until > now_iso):
                        online_drivers += 1
            
            # Bugün kayıt olan
            if u.get("created_at", "") >= today_start:
                new_users_today += 1
        
        # Trip istatistikleri
        completed_today = supabase.table("tags").select("id", count="exact").eq("status", "completed").gte("completed_at", today_start).execute()
        completed_week = supabase.table("tags").select("id", count="exact").eq("status", "completed").gte("completed_at", week_start).execute()
        active_trips = supabase.table("tags").select("id", count="exact").in_("status", ["matched", "in_progress"]).execute()
        waiting_trips = supabase.table("tags").select("id", count="exact").eq("status", "waiting").execute()
        
        # KYC istatistikleri
        kyc_pending_count = 0
        try:
            kyc_pending = supabase.table("driver_kyc").select("id", count="exact").eq("status", "pending").execute()
            kyc_pending_count = kyc_pending.count or 0
        except:
            pass
        
        # Promosyon istatistikleri
        active_promos_count = 0
        try:
            active_promos = supabase.table("promo_codes").select("id", count="exact").eq("is_active", True).execute()
            active_promos_count = active_promos.count or 0
        except:
            pass
        
        return {
            "success": True,
            "stats": {
                "users": {
                    "total": total_users,
                    "drivers": len(drivers),
                    "passengers": total_users - len(drivers),
                    "online_drivers": online_drivers,
                    "new_today": new_users_today,
                    "with_push_token": push_token_count
                },
                "trips": {
                    "completed_today": completed_today.count or 0,
                    "completed_week": completed_week.count or 0,
                    "active": active_trips.count or 0,
                    "waiting": waiting_trips.count or 0
                },
                "kyc": {
                    "pending": kyc_pending_count
                },
                "promos": {
                    "active": active_promos_count
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin full dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/users/full")
async def admin_get_users_full(admin_phone: str, page: int = 1, limit: int = 20, search: str = None, filter_type: str = None):
    """Admin - Detaylı kullanıcı listesi"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        offset = (page - 1) * limit
        
        query = supabase.table("users").select("*", count="exact")
        
        if search:
            query = query.or_(f"phone.ilike.%{search}%,name.ilike.%{search}%")
        
        if filter_type == "drivers":
            query = query.not_.is_("driver_details", "null")
        elif filter_type == "online":
            query = query.eq("driver_online", True)
        
        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        users = []
        for u in result.data:
            users.append({
                "id": u["id"],
                "phone": u["phone"],
                "name": u["name"],
                "city": u.get("city"),
                "rating": float(u.get("rating", 5.0)),
                "total_trips": u.get("total_trips", 0),
                "is_active": u.get("is_active", True),
                "is_driver": bool(u.get("driver_details")),
                "is_online": u.get("driver_online", False),
                "driver_active_until": u.get("driver_active_until"),
                "profile_photo": u.get("profile_photo"),
                "created_at": u.get("created_at"),
                "last_active": u.get("last_active")
            })
        
        return {
            "success": True,
            "users": users,
            "total": result.count or 0,
            "page": page,
            "limit": limit
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin get users full error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/trips")
async def admin_get_trips(admin_phone: str, page: int = 1, limit: int = 20, status: str = None):
    """Admin - Trip listesi"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        offset = (page - 1) * limit
        
        query = supabase.table("tags").select("*", count="exact")
        
        if status:
            query = query.eq("status", status)
        
        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {
            "success": True,
            "trips": result.data or [],
            "total": result.count or 0,
            "page": page,
            "limit": limit
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin get trips error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/login-logs")
async def admin_get_login_logs(admin_phone: str, page: int = 1, limit: int = 50):
    """Admin - Giriş logları"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        offset = (page - 1) * limit
        
        result = supabase.table("login_logs").select("*", count="exact").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {
            "success": True,
            "logs": result.data or [],
            "total": result.count or 0,
            "page": page,
            "limit": limit
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login logs error: {e}")
        return {"success": True, "logs": [], "total": 0, "page": page, "limit": limit}

@api_router.post("/admin/user/ban")
async def admin_ban_user(admin_phone: str, user_id: str, is_banned: bool):
    """Admin - Kullanıcı banla/ban kaldır"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # is_active alanını güncelle (banned = is_active: false)
        supabase.table("users").update({
            "is_active": not is_banned,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        action = "banlandı" if is_banned else "ban kaldırıldı"
        logger.info(f"🚫 Kullanıcı {action}: {user_id}")
        
        return {"success": True, "message": f"Kullanıcı {action}"}
    except Exception as e:
        logger.error(f"Admin ban user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/user/add-time")
async def admin_add_driver_time(admin_phone: str, user_id: str, hours: int):
    """Admin - Sürücüye süre ekle"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        user_result = supabase.table("users").select("driver_active_until").eq("id", user_id).execute()
        
        now = datetime.utcnow()
        current_until = None
        
        if user_result.data and user_result.data[0].get("driver_active_until"):
            current_until = datetime.fromisoformat(user_result.data[0]["driver_active_until"].replace("Z", ""))
        
        if current_until and current_until > now:
            new_until = current_until + timedelta(hours=hours)
        else:
            new_until = now + timedelta(hours=hours)
        
        supabase.table("users").update({
            "driver_active_until": new_until.isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"⏱️ Admin süre ekledi: {user_id} ({hours} saat)")
        
        return {
            "success": True,
            "message": f"{hours} saat eklendi",
            "active_until": new_until.isoformat()
        }
    except Exception as e:
        logger.error(f"Admin add time error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PUSH NOTİFİKASYON SİSTEMİ ====================

@api_router.post("/notifications/register-token")
async def register_push_token(user_id: str, token: str, platform: str = "android"):
    """Push notification token kaydet"""
    try:
        if not token:
            return {"success": False, "error": "token gerekli"}

        if not ExpoPushService.is_valid_token(token):
            return {"success": False, "error": "Sadece Expo push token desteklenir"}

        update_payload = {
            "push_token": token,
            "push_token_updated_at": datetime.utcnow().isoformat()
        }

        # push_token_type kolonu yoksa geriye dönük uyumluluk için fallback
        try:
            update_payload["push_token_type"] = "expo"
            supabase.table("users").update(update_payload).eq("id", user_id).execute()
        except Exception:
            update_payload.pop("push_token_type", None)
            supabase.table("users").update(update_payload).eq("id", user_id).execute()

        logger.info(f"📱 Push token kaydedildi: {user_id}")
        return {"success": True, "platform": platform, "token_type": "expo"}
    except Exception as e:
        logger.error(f"Register push token error: {e}")
        return {"success": False, "error": str(e)}

def _looks_like_phone(uid: str) -> bool:
    """user_id 10 haneli rakam ise (Türkiye telefonu) telefon kabul et."""
    if not uid or len(uid) > 15:
        return False
    digits = "".join(c for c in uid if c.isdigit())
    return len(digits) >= 10 and digits[:1] in "59"  # 5xxxxxxxxx veya 9xxxxxxxxx


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Tek kullanıcıya Expo push bildirim gönder (users.push_token). user_id = UUID veya telefon (fallback)."""
    try:
        uid = str(user_id).strip() if user_id else ""
        if not uid:
            logger.warning("❌ Push: user_id boş")
            return False
        user_result = supabase.table("users").select("push_token, name, id, phone").eq("id", uid).limit(1).execute()
        # UUID büyük/küçük harf farkı
        if not user_result.data and "-" in uid:
            user_result = supabase.table("users").select("push_token, name, id, phone").eq("id", uid.lower()).limit(1).execute()
        # Telefon ile fallback: E.164 normalize et, tüm olası DB formatlarını dene
        if not user_result.data and _looks_like_phone(uid):
            phone_e164 = normalize_phone_e164(uid)
            if phone_e164:
                # DB'de +905..., 905..., 5326..., 0532... saklanabilir; hepsini dene
                digits_only = "".join(c for c in phone_e164 if c.isdigit())  # 905326427412
                ten_digit = digits_only[-10:] if len(digits_only) >= 10 else digits_only  # 5326427412
                candidates = [
                    phone_e164,       # +905326427412
                    digits_only,      # 905326427412
                    ten_digit,        # 5326427412
                    "0" + ten_digit if len(ten_digit) == 10 else None,  # 05326427412
                ]
                seen = set()
                for candidate in candidates:
                    if not candidate or candidate in seen:
                        continue
                    seen.add(candidate)
                    user_result = supabase.table("users").select("push_token, name, id, phone").eq("phone", candidate).limit(1).execute()
                    if user_result.data:
                        logger.info(f"📱 Push: kullanıcı telefon ile bulundu (E.164={phone_e164})")
                        break
                # Son deneme: phone içinde bu 10 rakam geçen (boşluk/tire ile kayıtlı olabilir)
                if not user_result.data and len(ten_digit) >= 10:
                    like_r = supabase.table("users").select("push_token, name, id, phone").like("phone", f"%{ten_digit}%").limit(5).execute()
                    if like_r.data:
                        for row in like_r.data:
                            if ten_digit in "".join(c for c in (row.get("phone") or "") if c.isdigit()):
                                class _R: pass
                                user_result = _R()
                                user_result.data = [row]
                                logger.info(f"📱 Push: kullanıcı telefon LIKE ile bulundu (core={ten_digit})")
                                break
        if not user_result.data:
            logger.warning(f"❌ Push: kullanıcı bulunamadı (user_id={uid[:20]}...) – ID veya telefon veritabanında yok.")
            return False
        row = user_result.data[0]
        uid = row.get("id") or uid
        token = row.get("push_token")
        user_name = row.get("name", "Unknown")
        user_phone = row.get("phone") or ""

        if not token:
            logger.warning(f"📭 Push token yok: {user_name} (id={uid[:8]}... phone={user_phone[:4] if user_phone else '?'}) – Giriş yapıp bildirim izni verilmeli.")
            return False

        if not ExpoPushService.is_valid_token(token):
            logger.warning(f"⚠️ Geçersiz Expo token: {user_name} (id={uid[:8]}...) – Token ExponentPushToken/ExpoPushToken ile başlamalı.")
            return False

        ok = await send_expo_notification(token, title, body, data)
        if not ok:
            logger.warning(f"⚠️ Expo API bildirim göndermedi: {user_name} (id={uid[:8]}...)")
        return ok
    except Exception as e:
        logger.error(f"❌ Send push exception: {e}")
        return False


async def send_match_notification_to_both(tag_id: str, driver_id: str, passenger_id: str) -> dict:
    """
    Eşleşme tam bu anda – sürücü ve yolcuya anında bildirim.
    Teklif bildirimi çalıştığı için aynı type (new_offer) + event=match ile Expo'ya gidiyor.
    Returns: {"driver": bool, "passenger": bool}
    """
    out = {"driver": False, "passenger": False}
    logger.info(f"📢 EŞLEŞME BİLDİRİMİ BAŞLADI: tag_id={tag_id}, driver_id={driver_id}, passenger_id={passenger_id}")
    try:
        tag_row = supabase.table("tags").select("id, passenger_id, driver_id, pickup_lat, pickup_lng, final_price, offered_price").eq("id", tag_id).limit(1).execute()
        if not tag_row.data:
            logger.warning(f"🔔 Eşleşme bildirimi: tag bulunamadı {tag_id}")
            return out
        row = tag_row.data[0]
        d_id = str(row.get("driver_id") or driver_id or "").strip() or None
        p_id = str(row.get("passenger_id") or passenger_id or "").strip() or None
        if not d_id and not p_id:
            logger.warning(f"🔔 Eşleşme bildirimi: driver_id ve passenger_id yok")
            return out
        eta_min = 0
        try:
            if d_id and row.get("pickup_lat") is not None and row.get("pickup_lng") is not None:
                loc = supabase.table("users").select("latitude, longitude").eq("id", d_id).limit(1).execute()
                if loc.data and loc.data[0].get("latitude") is not None:
                    eta_min = _eta_minutes(
                        loc.data[0].get("latitude"), loc.data[0].get("longitude"),
                        float(row["pickup_lat"]), float(row["pickup_lng"])
                    )
        except Exception:
            pass
        driver_body = f"Yolcuya {eta_min} dk. Yolcuya git için tıklayın." if eta_min else "Yolcuya git için tıklayın."
        passenger_title = "Paylaşımlı yolculuk başladı"
        passenger_body = "Sürücüye yazmak için tıklayın."
        # Teklif bildirimi gibi type=new_offer kullan (cihazda aynı kanal/aynı davranış); event=match ile uygulama eşleşme ekranına gidebilir
        base_data = {"type": "new_offer", "event": "match", "tag_id": tag_id, "eta_min": eta_min}
        if d_id:
            driver_data = {**base_data, "role": "driver", "price": int(row.get("final_price") or row.get("offered_price") or 0)}
            out["driver"] = await send_trip_push_and_log(d_id, "new_ride_request", "Eşleşme sağlandı", driver_body, driver_data)
            logger.info(f"🔔 Eşleşme push sürücü: {d_id[:8]}... sonuç={out['driver']}")
        if p_id:
            passenger_data = {**base_data, "role": "passenger"}
            out["passenger"] = await send_trip_push_and_log(p_id, "new_ride_request", passenger_title, passenger_body, passenger_data)
            logger.info(f"🔔 Eşleşme push yolcu: {p_id[:8]}... sonuç={out['passenger']}")
        logger.info(f"📢 EŞLEŞME BİLDİRİMİ BİTTİ: tag_id={tag_id}, driver={out['driver']}, passenger={out['passenger']}")
    except Exception as e:
        logger.exception(f"🔔 send_match_notification_to_both hata: {e}")
    return out


async def send_trip_push_and_log(user_id: str, notification_type: str, title: str, body: str, data: dict = None) -> bool:
    """
    Trip lifecycle (ve diğer) bildirimleri: önce notifications_log'a yaz, sonra push gönder.
    Tüm bildirimler loglanır (token yoksa bile). user_id users.id (UUID string) olmalı.
    """
    uid = str(user_id).strip() if user_id else None
    if not uid:
        logger.warning("⚠️ send_trip_push_and_log: user_id boş")
        return False
    payload = data or {}
    payload.setdefault("type", notification_type)
    try:
        supabase.table("notifications_log").insert({
            "type": notification_type,
            "user_id": uid,
            "title": title,
            "body": body,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception as log_err:
        logger.warning(f"⚠️ notifications_log insert failed: {log_err}")
    ok = await send_push_notification(uid, title, body, payload)
    if not ok:
        logger.warning(f"⚠️ Trip push gönderilemedi: user_id={uid}, type={notification_type}, title={title!r}")
    return ok


async def send_push_notifications_to_users(user_ids: list, title: str, body: str, data: dict = None) -> dict:
    """Birden fazla kullanıcıya, tekil send_push_notification fonksiyonu ile gönder."""
    sent = 0
    failed = 0

    for user_id in user_ids or []:
        if await send_push_notification(user_id, title, body, data):
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed, "total": len(user_ids or [])}

def _expo_push_data_stringify(data: Optional[dict]) -> dict:
    """
    Expo Push HTTP API: data içindeki tüm değerler string olmalı.
    int/bool/float gönderildiğinde bildirim reddedilebilir veya cihaza hiç düşmez.
    """
    if not data:
        return {}
    out = {}
    for k, v in data.items():
        if v is None:
            continue
        key = str(k)
        if isinstance(v, (dict, list)):
            out[key] = json.dumps(v, ensure_ascii=False)
        elif isinstance(v, bool):
            out[key] = "true" if v else "false"
        else:
            out[key] = str(v)
    return out


async def _send_expo_and_get_receipt(token: str, title: str, body: str, data: dict = None):
    """Expo Push API'ye istek atar; (success, receipt_dict) döner. receipt Expo'nun data[0] objesidir."""
    try:
        import httpx
        payload = _expo_push_data_stringify(data or {})
        notification_type = payload.get("type")
        channel_id = "default"
        if notification_type == "new_offer":
            channel_id = "offers"
        elif notification_type in ["match_found", "match_confirmed", "kyc_approved", "kyc_rejected"]:
            # Eşleşme: teklif bildirimi geldiği için "offers" kanalı kullan (aynı kanal = aynı davranış)
            channel_id = "offers"
        elif notification_type in ["incoming_call", "incoming_daily_call"]:
            channel_id = "calls"
        elif notification_type == "admin_notification":
            channel_id = "admin"
        elif notification_type in ("driver_on_the_way", "driver_arrived", "trip_started", "trip_completed", "new_ride_request", "matched"):
            channel_id = "offers"

        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": payload,
            "priority": "high",
            "channelId": channel_id,
            "_displayInForeground": True
        }
        messages_payload = [message]

        logger.info(f"🔔 Expo API'ye gönderiliyor: type={notification_type}, channelId={channel_id}, token={token[:50]}...")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {EXPO_ACCESS_TOKEN}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages_payload,
                headers=headers,
            )

            logger.info(f"🔔 Expo API yanıtı: status={response.status_code}")

            if response.status_code != 200:
                return False, {"http_status": response.status_code, "body": response.text[:500]}

            response_data = response.json()
            receipts = response_data.get("data") or []
            if not receipts:
                return False, {"error": "boş receipt listesi"}
            first = receipts[0]
            if first.get("status") == "error":
                err_msg = first.get("message", "bilinmeyen hata")
                err_details = first.get("details") or first
                logger.error(f"❌ Expo API hatası: {err_msg} | details={err_details}")
                return False, first
            logger.info(f"✅ Expo push başarılı (receipt status={first.get('status', 'ok')})")
            return True, first
    except Exception as e:
        logger.error(f"❌ Expo API exception: {e}")
        return False, {"exception": str(e)}


async def send_expo_notification(token: str, title: str, body: str, data: dict = None):
    """Expo Push API ile bildirim gönder"""
    success, _ = await _send_expo_and_get_receipt(token, title, body, data)
    return success

async def send_bulk_push_notification(title: str, body: str, target: str = "all", data: dict = None):
    """Toplu push bildirim gönder - users.push_token kaynağını kullanır."""
    try:
        query = supabase.table("users").select("id, push_token, driver_details, driver_online")
        
        if target == "drivers":
            # Sadece sürücülere (driver_details olan)
            query = query.not_.is_("driver_details", "null")
        elif target == "passengers":
            # Sadece yolculara (driver_details olmayan)
            query = query.is_("driver_details", "null")
        elif target == "online_drivers":
            # Sadece online sürücülere
            query = query.eq("driver_online", True)
        
        result = query.execute()
        
        if not result.data:
            return 0
        
        user_ids = [
            user["id"]
            for user in result.data
            if user.get("id")
            and user.get("push_token")
            and ExpoPushService.is_valid_token(user.get("push_token"))
        ]

        if not user_ids:
            logger.info(f"📭 Push token'ı olan kullanıcı bulunamadı (target={target})")
            return 0

        send_result = await send_push_notifications_to_users(user_ids, title, body, data)
        sent_count = send_result["sent"]

        logger.info(f"📤 Toplu push gönderildi: {sent_count}/{send_result['total']} kullanıcı - {title}")
        
        # Admin bildirimini kaydet
        try:
            supabase.table("admin_notifications_log").insert({
                "title": title,
                "body": body,
                "target": target,
                "sent_count": sent_count,
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        except:
            pass
        
        return sent_count
    except Exception as e:
        logger.error(f"Bulk push error: {e}")
        return 0

@api_router.post("/admin/notifications/send")
async def admin_send_push(admin_phone: str, title: str, body: str, target: str = "all", user_id: str = None, data: str = None):
    """Admin - Push bildirim gönder"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # Bildirimi kaydetmeyi dene (tablo yoksa atla)
        try:
            notification_data = {
                "title": title,
                "body": body,
                "target": target,
                "user_id": user_id,
                "sent_by": admin_phone,
                "created_at": datetime.utcnow().isoformat()
            }
            supabase.table("notifications").insert(notification_data).execute()
        except Exception as save_err:
            logger.warning(f"Bildirim kaydedilemedi (tablo olmayabilir): {save_err}")
        
        # Gönder
        payload = {"type": "admin_notification", "target": target}
        if data:
            payload["raw_data"] = data

        total_users = 0
        users_with_token = 0

        if user_id:
            success = await send_push_notification(user_id, title, body, payload)
            sent_count = 1 if success else 0
        else:
            # Hedef kitle sayıları (0 kişiye gidince nedenini göstermek için)
            try:
                if target == "all":
                    r = supabase.table("users").select("id, push_token").execute()
                    total_users = len(r.data or [])
                    users_with_token = sum(1 for u in (r.data or []) if u.get("push_token") and ExpoPushService.is_valid_token(u.get("push_token")))
                elif target == "drivers":
                    r = supabase.table("users").select("id, push_token, driver_details").not_.is_("driver_details", "null").execute()
                    total_users = len(r.data or [])
                    users_with_token = sum(1 for u in (r.data or []) if u.get("push_token") and ExpoPushService.is_valid_token(u.get("push_token")))
                elif target == "passengers":
                    r = supabase.table("users").select("id, push_token, driver_details").execute()
                    passengers = [u for u in (r.data or []) if not u.get("driver_details")]
                    total_users = len(passengers)
                    users_with_token = sum(1 for u in passengers if u.get("push_token") and ExpoPushService.is_valid_token(u.get("push_token")))
            except Exception:
                pass
            sent_count = await send_bulk_push_notification(title, body, target, payload)
        
        msg = f"{sent_count} kullanıcıya bildirim gönderildi"
        if sent_count == 0 and total_users >= 0:
            msg += f". (Toplam {total_users} kullanıcı, {users_with_token} tanesinde bildirim token'ı kayıtlı. Uygulamada bildirim iznini açıp uygulamayı kapatıp açın.)"
        
        return {
            "success": True,
            "sent_count": sent_count,
            "message": msg,
            "total_users": total_users,
            "users_with_token": users_with_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin send push error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/notifications/history")
async def admin_get_notification_history(admin_phone: str, page: int = 1, limit: int = 20):
    """Admin - Bildirim geçmişi"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        offset = (page - 1) * limit
        
        result = supabase.table("admin_notifications").select("*", count="exact").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {
            "success": True,
            "notifications": result.data or [],
            "total": result.count or 0,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Admin notification history error: {e}")
        return {"success": True, "notifications": [], "total": 0}

# ==================== LEYLEK MUHABBETİ (COMMUNITY) ====================
# Tamamen izole modül - mevcut sistemlere dokunmaz

# 🆕 DISPATCH QUEUE - Reject Endpoint
@api_router.post("/ride/reject")
async def reject_ride(tag_id: str, driver_id: str):
    """
    Sürücü dispatch teklifini reddetti
    Sonraki sürücüye otomatik geçilir
    """
    try:
        # Dispatch reject handler'ı çağır
        await handle_dispatch_reject(tag_id, driver_id)
        
        return {"success": True, "message": "Teklif reddedildi"}
    except Exception as e:
        logger.error(f"❌ Reject ride error: {e}")
        return {"success": False, "error": str(e)}

# 🆕 DISPATCH CONFIG API'LERİ
@api_router.get("/dispatch/config")
async def get_dispatch_config_api():
    """Dispatch queue ayarlarını getir"""
    try:
        config = await get_dispatch_config()
        return {"success": True, "config": config}
    except Exception as e:
        return {"success": False, "error": str(e)}

@api_router.post("/dispatch/config")
async def update_dispatch_config_api(request: Request):
    """Dispatch queue ayarlarını güncelle (Admin only)"""
    try:
        body = await request.json()
        
        # Config tablosuna kaydet
        import json
        config_value = json.dumps(body)
        
        # Upsert - varsa güncelle, yoksa ekle
        try:
            existing = supabase.table("config").select("*").eq("key", "dispatch_config").execute()
            if existing.data:
                supabase.table("config").update({"value": config_value}).eq("key", "dispatch_config").execute()
            else:
                supabase.table("config").insert({"key": "dispatch_config", "value": config_value}).execute()
        except:
            # Tablo yoksa in-memory güncelle
            DISPATCH_CONFIG.update(body)
        
        logger.info(f"✅ Dispatch config güncellendi: {body}")
        return {"success": True, "config": body}
    except Exception as e:
        logger.error(f"❌ Update dispatch config error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/dispatch/queue/{tag_id}")
async def get_dispatch_queue(tag_id: str):
    """Belirli bir tag için dispatch queue durumunu getir (yolcu bekleme ekranı için özet alanlar)."""
    try:
        queue = list(dispatch_queues.get(tag_id, []) or [])
        if not queue:
            try:
                result = (
                    supabase.table("dispatch_queue")
                    .select("*")
                    .eq("tag_id", tag_id)
                    .order("priority")
                    .execute()
                )
                queue = list(result.data) if result.data else []
            except Exception:
                queue = []

        cfg = await get_dispatch_config()
        timeout_default = int(cfg.get("driver_offer_timeout", 10) or 10)
        total_drivers = len(queue)
        current_index = 0
        timeout_remaining = timeout_default
        status = "searching"

        if total_drivers == 0:
            return {
                "success": True,
                "queue": queue,
                "current_index": 0,
                "total_drivers": 0,
                "timeout_remaining": timeout_remaining,
                "status": "no_drivers",
            }

        def _st(e):
            return str(e.get("status") or "").lower()

        sent = [e for e in queue if _st(e) == "sent"]
        expired = [e for e in queue if _st(e) == "expired"]
        accepted = [e for e in queue if _st(e) == "accepted"]

        if accepted:
            status = "matched"
            current_index = int(accepted[0].get("priority") or total_drivers)
        elif sent:
            status = "offering"
            current_index = int(sent[0].get("priority") or 1)
        elif len(expired) >= total_drivers:
            status = "no_drivers"
            current_index = total_drivers
        elif expired:
            status = "searching"
            current_index = len(expired)

        return {
            "success": True,
            "queue": queue,
            "current_index": current_index,
            "total_drivers": total_drivers,
            "timeout_remaining": timeout_remaining,
            "status": status,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# Community Pydantic modelleri
class CommunityMessageCreate(BaseModel):
    user_id: str
    name: str
    role: str  # 'passenger' veya 'driver'
    content: str  # max 300 karakter
    city: Optional[str] = "Genel"

class CommunityLikeRequest(BaseModel):
    message_id: str
    user_id: str

class CommunityReportRequest(BaseModel):
    message_id: str
    reporter_id: str
    reason: Optional[str] = None

@api_router.get("/community/messages")
async def get_community_messages(limit: int = 50, offset: int = 0, city: Optional[str] = None):
    """Son mesajları getir (şehir ve sayfalama destekli)"""
    try:
        query = supabase.table("community_messages").select("*")
        
        # Şehir filtresi
        if city:
            query = query.eq("city", city)
        
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {"success": True, "messages": response.data, "count": len(response.data)}
    except Exception as e:
        logger.error(f"❌ Community messages error: {e}")
        return {"success": False, "messages": [], "error": str(e)}

@api_router.get("/community/online-count")
async def community_online_count(city: str):
    """Şehirdeki online kullanıcı sayısı (yaklaşık)"""
    try:
        # Son 5 dakikada aktif kullanıcıları say
        five_mins_ago = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        result = supabase.table("users").select("id", count="exact").eq("city", city).gte("last_active", five_mins_ago).execute()
        return {"count": result.count or 0}
    except Exception as e:
        # Fallback: rastgele sayı
        import random
        return {"count": random.randint(5, 25)}

@api_router.post("/community/message")
async def create_community_message(msg: CommunityMessageCreate):
    """Yeni mesaj oluştur - Küfür filtresi ile"""
    try:
        # İçerik kontrolü
        if len(msg.content) > 300:
            return {"success": False, "error": "Mesaj 300 karakterden uzun olamaz"}
        
        if len(msg.content.strip()) == 0:
            return {"success": False, "error": "Mesaj boş olamaz"}
        
        # GENİŞLETİLMİŞ KÜFÜR FİLTRESİ
        bad_words = [
            # Türkçe küfürler
            "amk", "aq", "amq", "amına", "amina", "orospu", "oruspu", "piç", "pic", "pezevenk",
            "göt", "got", "sik", "sikik", "sikim", "yarrak", "yarak", "taşak", "tasak",
            "kahpe", "kaltak", "ibne", "top", "döl", "dol", "meme", "am ", " am",
            "ananı", "anani", "bacını", "bacini", "s2m", "s2k", "mk", "oc", "oç",
            "gerizekalı", "gerizekali", "salak", "aptal", "mal", "dangalak", "hıyar",
            # Hakaret
            "şerefsiz", "serefsiz", "namussuz", "ahlaksız", "ahlaksiz", "alçak", "alcak",
            # Argo
            "lan", "ulan", "yavşak", "yavsak", "puşt", "pust",
        ]
        
        content_lower = msg.content.lower().replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
        
        for word in bad_words:
            word_normalized = word.lower().replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
            if word_normalized in content_lower:
                logger.warning(f"⚠️ Küfür tespit edildi: {msg.user_id} - '{word}'")
                return {"success": False, "error": "Uygunsuz içerik tespit edildi. Lütfen saygılı bir dil kullanın."}
        
        # Veritabanına ekle
        data = {
            "user_id": msg.user_id,
            "name": msg.name,
            "role": msg.role,
            "content": msg.content.strip(),
            "likes_count": 0,
            "city": msg.city or "Genel"
        }
        
        response = supabase.table("community_messages").insert(data).execute()
        
        if response.data:
            return {"success": True, "message": response.data[0]}
        else:
            return {"success": False, "error": "Mesaj kaydedilemedi"}
    except Exception as e:
        logger.error(f"❌ Community message create error: {e}")
        return {"success": False, "error": str(e)}

@api_router.post("/community/like")
async def like_community_message(req: CommunityLikeRequest):
    """Mesajı beğen"""
    try:
        # Önce mevcut likes_count'u al
        response = supabase.table("community_messages")\
            .select("likes_count")\
            .eq("id", req.message_id)\
            .single()\
            .execute()
        
        if not response.data:
            return {"success": False, "error": "Mesaj bulunamadı"}
        
        current_likes = response.data.get("likes_count", 0)
        new_likes = current_likes + 1
        
        # Güncelle
        update_response = supabase.table("community_messages")\
            .update({"likes_count": new_likes})\
            .eq("id", req.message_id)\
            .execute()
        
        return {"success": True, "likes_count": new_likes}
    except Exception as e:
        logger.error(f"❌ Community like error: {e}")
        return {"success": False, "error": str(e)}

@api_router.post("/community/report")
async def report_community_message(req: CommunityReportRequest):
    """Mesajı şikayet et"""
    try:
        # Şikayeti logla (admin paneli eklenince işlenecek)
        logger.warning(f"⚠️ COMMUNITY REPORT: Message {req.message_id} reported by {req.reporter_id}. Reason: {req.reason}")
        
        # Gelecekte: community_reports tablosuna kaydet
        return {"success": True, "message": "Şikayet alındı"}
    except Exception as e:
        logger.error(f"❌ Community report error: {e}")
        return {"success": False, "error": str(e)}

@api_router.delete("/community/message/{message_id}")
async def delete_community_message(message_id: str, user_id: str):
    """Kendi mesajını sil"""
    try:
        # Sadece kendi mesajını silebilir
        response = supabase.table("community_messages")\
            .delete()\
            .eq("id", message_id)\
            .eq("user_id", user_id)\
            .execute()
        
        return {"success": True}
    except Exception as e:
        logger.error(f"❌ Community delete error: {e}")
        return {"success": False, "error": str(e)}

# ==================== HESAP SİLME (Google Play Zorunlu) ====================

class DeleteAccountRequest(BaseModel):
    user_id: str

@api_router.post("/user/delete-account")
async def delete_user_account(request: DeleteAccountRequest):
    """
    Kullanıcı hesabını sil - Google Play zorunlu özellik
    - Hesap hemen devre dışı bırakılır
    - Veriler 30 gün içinde silinir
    - Yasal zorunluluklar anonimleştirilir
    """
    try:
        user_id = request.user_id
        
        if not user_id:
            return {"success": False, "error": "user_id gerekli"}
        
        logger.warning(f"🗑️ HESAP SİLME İSTEĞİ: {user_id}")
        
        # 1. Kullanıcıyı bul
        user_result = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
        
        if not user_result.data:
            return {"success": False, "error": "Kullanıcı bulunamadı"}
        
        user = user_result.data[0]
        
        # 2. Kullanıcıyı devre dışı bırak (soft delete)
        supabase.table("users").update({
            "is_active": False,
            "is_banned": True,
            "deleted_at": datetime.utcnow().isoformat(),
            "deletion_reason": "user_request",
            # Kişisel verileri anonimleştir
            "name": f"Silinmiş Kullanıcı {user_id[:8]}",
            "profile_photo": None,
        }).eq("id", user_id).execute()
        
        # 3. Aktif TAG'leri iptal et
        supabase.table("tags").update({
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat(),
            "cancel_reason": "account_deleted"
        }).eq("passenger_id", user_id).in_("status", ["waiting", "pending", "offers_received", "matched", "in_progress"]).execute()
        
        supabase.table("tags").update({
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat(),
            "cancel_reason": "account_deleted"
        }).eq("driver_id", user_id).in_("status", ["matched", "in_progress"]).execute()
        
        # 4. Community mesajlarını anonimleştir
        supabase.table("community_messages").update({
            "user_name": "Silinmiş Kullanıcı",
            "user_id": None
        }).eq("user_id", user_id).execute()
        
        logger.warning(f"✅ HESAP SİLİNDİ: {user_id}")
        
        return {
            "success": True,
            "message": "Hesabınız başarıyla silindi. Verileriniz 30 gün içinde kalıcı olarak kaldırılacaktır."
        }
        
    except Exception as e:
        logger.error(f"❌ Delete account error: {e}")
        return {"success": False, "error": str(e)}

# ==================== ADMIN PANELİ ====================
# Admin telefon numarası
ADMIN_PHONES = ["5326497412"]

# Dinamik fiyatlandırma ayarları (bellekte, restart olunca sıfırlanır)
# Kalıcı olması için DB'ye taşınabilir
PRICING_SETTINGS = {
    "min_price_per_km_normal": 20,
    "max_price_per_km_normal": 30,
    "min_price_per_km_peak": 25,
    "max_price_per_km_peak": 35,
    "minimum_price": 100,
    "driver_pickup_per_km": 10,
}

def is_admin(phone: str) -> bool:
    """Telefon numarasının admin olup olmadığını kontrol et"""
    if not phone:
        return False
    # Numarayı temizle
    clean_phone = phone.replace("+90", "").replace("+", "").replace(" ", "").strip()
    if clean_phone.startswith("90"):
        clean_phone = clean_phone[2:]
    return clean_phone in ADMIN_PHONES

@api_router.get("/admin/check")
async def check_admin(phone: str):
    """Kullanıcının admin olup olmadığını kontrol et"""
    return {"is_admin": is_admin(phone)}

@api_router.get("/admin/dashboard")
async def admin_dashboard(phone: str):
    """Admin dashboard - tüm veriler"""
    if not is_admin(phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        # 1. Aktif kullanıcılar (son 24 saat giriş yapanlar)
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
        users_result = supabase.table("users").select("id, name, phone, role, rating, is_verified, created_at, last_login").gte("last_login", yesterday).execute()
        active_users = users_result.data if users_result.data else []
        
        # 2. Tüm kullanıcı sayısı
        all_users_result = supabase.table("users").select("id", count="exact").execute()
        total_users = all_users_result.count if all_users_result.count else 0
        
        # 3. Aktif TAG'ler (waiting, matched, in_progress)
        tags_result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone)").in_("status", ["waiting", "pending", "offers_received", "matched", "in_progress"]).order("created_at", desc=True).limit(50).execute()
        active_tags = tags_result.data if tags_result.data else []
        
        # 4. Bugünkü tamamlanan yolculuklar
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        completed_result = supabase.table("tags").select("*", count="exact").eq("status", "completed").gte("completed_at", today_start).execute()
        today_completed = completed_result.count if completed_result.count else 0
        
        # 5. Bugünkü toplam ciro
        completed_with_price = supabase.table("tags").select("final_price").eq("status", "completed").gte("completed_at", today_start).execute()
        today_revenue = sum([t.get("final_price", 0) or 0 for t in (completed_with_price.data or [])])
        
        # 6. Son 10 eşleşme
        recent_matches = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone)").eq("status", "matched").order("matched_at", desc=True).limit(10).execute()
        
        # 7. Son 10 iptal
        recent_cancels = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone)").eq("status", "cancelled").order("cancelled_at", desc=True).limit(10).execute()
        
        return {
            "success": True,
            "stats": {
                "total_users": total_users,
                "active_users_24h": len(active_users),
                "active_tags": len(active_tags),
                "today_completed": today_completed,
                "today_revenue": today_revenue,
            },
            "active_users": active_users,
            "active_tags": active_tags,
            "recent_matches": recent_matches.data if recent_matches.data else [],
            "recent_cancels": recent_cancels.data if recent_cancels.data else [],
            "pricing_settings": PRICING_SETTINGS,
        }
    except Exception as e:
        logger.error(f"❌ Admin dashboard error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/admin/pricing")
async def get_pricing_settings(phone: str):
    """Fiyatlandırma ayarlarını getir"""
    if not is_admin(phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    return {"success": True, "settings": PRICING_SETTINGS}

class UpdatePricingRequest(BaseModel):
    phone: str
    min_price_per_km_normal: int = None
    max_price_per_km_normal: int = None
    min_price_per_km_peak: int = None
    max_price_per_km_peak: int = None
    minimum_price: int = None
    driver_pickup_per_km: int = None

@api_router.post("/admin/pricing/update")
async def update_pricing_settings(request: UpdatePricingRequest):
    """Fiyatlandırma ayarlarını güncelle"""
    if not is_admin(request.phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        if request.min_price_per_km_normal is not None:
            PRICING_SETTINGS["min_price_per_km_normal"] = request.min_price_per_km_normal
        if request.max_price_per_km_normal is not None:
            PRICING_SETTINGS["max_price_per_km_normal"] = request.max_price_per_km_normal
        if request.min_price_per_km_peak is not None:
            PRICING_SETTINGS["min_price_per_km_peak"] = request.min_price_per_km_peak
        if request.max_price_per_km_peak is not None:
            PRICING_SETTINGS["max_price_per_km_peak"] = request.max_price_per_km_peak
        if request.minimum_price is not None:
            PRICING_SETTINGS["minimum_price"] = request.minimum_price
        if request.driver_pickup_per_km is not None:
            PRICING_SETTINGS["driver_pickup_per_km"] = request.driver_pickup_per_km
        
        logger.info(f"💰 Admin fiyat güncelleme: {PRICING_SETTINGS}")
        return {"success": True, "settings": PRICING_SETTINGS}
    except Exception as e:
        logger.error(f"❌ Pricing update error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/admin/users")
async def admin_get_users(phone: str, page: int = 1, limit: int = 50):
    """Tüm kullanıcıları listele"""
    if not is_admin(phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        offset = (page - 1) * limit
        result = supabase.table("users").select("*", count="exact").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {
            "success": True,
            "users": result.data if result.data else [],
            "total": result.count if result.count else 0,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"❌ Admin users error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/admin/tags")
async def admin_get_tags(phone: str, status: str = None, page: int = 1, limit: int = 50):
    """Tüm TAG'leri listele"""
    if not is_admin(phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        offset = (page - 1) * limit
        query = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone)", count="exact")
        
        if status:
            query = query.eq("status", status)
        
        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {
            "success": True,
            "tags": result.data if result.data else [],
            "total": result.count if result.count else 0,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"❌ Admin tags error: {e}")
        return {"success": False, "error": str(e)}

class AdminUserActionRequest(BaseModel):
    phone: str  # Admin phone
    user_id: str
    action: str  # "ban", "unban", "set_rating", "delete"
    value: float = None  # Rating için

@api_router.post("/admin/user/action")
async def admin_user_action(request: AdminUserActionRequest):
    """Kullanıcı üzerinde admin işlemi"""
    if not is_admin(request.phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        if request.action == "ban":
            supabase.table("users").update({"is_banned": True}).eq("id", request.user_id).execute()
            logger.warning(f"🚫 Admin: User {request.user_id} BANNED")
            return {"success": True, "message": "Kullanıcı yasaklandı"}
        
        elif request.action == "unban":
            supabase.table("users").update({"is_banned": False}).eq("id", request.user_id).execute()
            logger.info(f"✅ Admin: User {request.user_id} UNBANNED")
            return {"success": True, "message": "Kullanıcı yasağı kaldırıldı"}
        
        elif request.action == "set_rating":
            if request.value is None:
                raise HTTPException(status_code=400, detail="Rating değeri gerekli")
            supabase.table("users").update({"rating": request.value}).eq("id", request.user_id).execute()
            logger.info(f"⭐ Admin: User {request.user_id} rating -> {request.value}")
            return {"success": True, "message": f"Puan {request.value} olarak ayarlandı"}
        
        elif request.action == "delete":
            # Soft delete - sadece deaktive et
            supabase.table("users").update({"is_active": False, "is_banned": True}).eq("id", request.user_id).execute()
            logger.warning(f"🗑️ Admin: User {request.user_id} DELETED (soft)")
            return {"success": True, "message": "Kullanıcı silindi"}
        
        else:
            raise HTTPException(status_code=400, detail="Geçersiz işlem")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Admin user action error: {e}")
        return {"success": False, "error": str(e)}

class AdminTagActionRequest(BaseModel):
    phone: str  # Admin phone
    tag_id: str
    action: str  # "cancel", "complete", "delete"

@api_router.post("/admin/tag/action")
async def admin_tag_action(request: AdminTagActionRequest):
    """TAG üzerinde admin işlemi"""
    if not is_admin(request.phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        if request.action == "cancel":
            supabase.table("tags").update({
                "status": "cancelled",
                "cancelled_at": datetime.utcnow().isoformat(),
                "cancel_reason": "Admin tarafından iptal edildi"
            }).eq("id", request.tag_id).execute()
            logger.warning(f"🚫 Admin: Tag {request.tag_id} CANCELLED")
            return {"success": True, "message": "Yolculuk iptal edildi"}
        
        elif request.action == "complete":
            supabase.table("tags").update({
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat()
            }).eq("id", request.tag_id).execute()
            logger.info(f"✅ Admin: Tag {request.tag_id} COMPLETED")
            return {"success": True, "message": "Yolculuk tamamlandı olarak işaretlendi"}
        
        elif request.action == "delete":
            supabase.table("tags").delete().eq("id", request.tag_id).execute()
            logger.warning(f"🗑️ Admin: Tag {request.tag_id} DELETED")
            return {"success": True, "message": "TAG silindi"}
        
        else:
            raise HTTPException(status_code=400, detail="Geçersiz işlem")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Admin tag action error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/admin/stats")
async def admin_stats(phone: str, days: int = 7):
    """Son X günlük istatistikler"""
    if not is_admin(phone):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    try:
        start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        # Günlük tamamlanan yolculuklar
        completed = supabase.table("tags").select("completed_at, final_price").eq("status", "completed").gte("completed_at", start_date).execute()
        
        # Günlük iptal edilen yolculuklar
        cancelled = supabase.table("tags").select("cancelled_at").eq("status", "cancelled").gte("cancelled_at", start_date).execute()
        
        # Yeni kayıtlar
        new_users = supabase.table("users").select("created_at", count="exact").gte("created_at", start_date).execute()
        
        return {
            "success": True,
            "period_days": days,
            "completed_trips": len(completed.data) if completed.data else 0,
            "cancelled_trips": len(cancelled.data) if cancelled.data else 0,
            "new_users": new_users.count if new_users.count else 0,
            "total_revenue": sum([t.get("final_price", 0) or 0 for t in (completed.data or [])]),
        }
    except Exception as e:
        logger.error(f"❌ Admin stats error: {e}")
        return {"success": False, "error": str(e)}

# ==================== SÜRÜCÜ AÇILIŞ PAKETLERİ API ====================

@api_router.get("/driver/packages")
async def get_driver_packages():
    """Mevcut sürücü açılış paketlerini getir"""
    packages = []
    for key, pkg in DRIVER_PACKAGES.items():
        packages.append({
            "id": key,
            "name": pkg["name"],
            "hours": pkg["hours"],
            "price_tl": pkg["price_tl"],
        })
    return {"success": True, "packages": packages}

@api_router.get("/drivers/nearby")
async def get_nearby_drivers(
    lat: float,
    lng: float,
    radius_km: float = 20,
    passenger_vehicle_kind: Optional[str] = None,
):
    """Yakındaki online sürücülerin konum ve bilgilerini al.
    passenger_vehicle_kind=car|motorcycle verilirse yalnızca o tipteki sürücüler (dispatch ile uyumlu)."""
    try:
        pref = _canonical_vehicle_kind(passenger_vehicle_kind)
        now = datetime.utcnow().isoformat()
        q = supabase.table("users").select(
            "id, name, latitude, longitude, rating, driver_details"
        ).eq("driver_online", True)
        drivers_result = _apply_driver_active_until_filter(q, now).execute()
        
        nearby_drivers = []
        for driver in (drivers_result.data or []):
            if pref is not None:
                if _effective_driver_vehicle_kind(driver) != pref:
                    continue
            d_lat = driver.get("latitude")
            d_lng = driver.get("longitude")
            if d_lat and d_lng:
                distance = haversine_distance(lat, lng, d_lat, d_lng)
                if distance <= radius_km:
                    vehicle = None
                    if driver.get("driver_details"):
                        details = driver["driver_details"]
                        if isinstance(details, dict):
                            vehicle = f"{details.get('vehicle_brand', '')} {details.get('vehicle_model', '')}".strip()
                    
                    nearby_drivers.append({
                        "id": driver["id"],
                        "name": driver.get("name", "Sürücü"),
                        "latitude": d_lat,
                        "longitude": d_lng,
                        "rating": driver.get("rating"),
                        "vehicle": vehicle,
                        "distance_km": round(distance, 1)
                    })
        
        # Mesafeye göre sırala
        nearby_drivers.sort(key=lambda x: x["distance_km"])
        
        return {
            "success": True,
            "drivers": nearby_drivers,
            "count": len(nearby_drivers)
        }
    except Exception as e:
        logger.error(f"Nearby drivers error: {e}")
        return {"success": False, "drivers": [], "count": 0}

@api_router.get("/driver/nearby-activity")
async def get_nearby_activity(
    lat: float,
    lng: float,
    radius_km: float = 20,
    passenger_vehicle_kind: Optional[str] = None,
    user_id: Optional[str] = None,
    driver_id: Optional[str] = None,
):
    """Sürücü için yakındaki aktif yolculuklar ve yoğunluk bilgisi.
    passenger_vehicle_kind ile nearby_driver_count yalnız uygun tipteki sürücüleri sayar (yolcu ekranı).
    user_id/driver_id verilirse nearby_tags yalnız bu sürücünün araç tipiyle eşleşen talepleri listeler."""
    try:
        pref = _canonical_vehicle_kind(passenger_vehicle_kind)
        driver_eff_map = None
        did = driver_id or user_id
        if did:
            try:
                rid = await resolve_user_id(did)
                du = (
                    supabase.table("users")
                    .select("driver_details")
                    .eq("id", rid)
                    .limit(1)
                    .execute()
                )
                if du.data:
                    driver_eff_map = _effective_driver_vehicle_kind(du.data[0])
            except Exception:
                pass
        # 1. Yakındaki aktif (bekleyen) yolculukları al
        active_tags = supabase.table("tags").select(
            "id, pickup_lat, pickup_lng, pickup_location, status, final_price, passenger_preferred_vehicle"
        ).eq("status", "waiting").execute()
        
        nearby_tags = []
        region_counts = {}  # Bölge yoğunluğu
        
        for tag in (active_tags.data or []):
            tag_lat = tag.get("pickup_lat")
            tag_lng = tag.get("pickup_lng")
            if tag_lat and tag_lng:
                distance = haversine_distance(lat, lng, tag_lat, tag_lng)
                if distance <= radius_km:
                    if driver_eff_map is not None:
                        pref_tag = _trip_passenger_vehicle_pref(tag, None)
                        if not _driver_matches_passenger_vehicle_pref(driver_eff_map, pref_tag):
                            continue
                    nearby_tags.append({
                        "id": tag["id"],
                        "lat": tag_lat,
                        "lng": tag_lng,
                        "location": tag.get("pickup_location", ""),
                        "price": tag.get("final_price", 0),
                        "distance_km": round(distance, 1)
                    })
                    
                    # Bölge yoğunluğu hesapla
                    location = tag.get("pickup_location", "")
                    if location:
                        # İlk kelimeyi bölge olarak al (örn: "Çankaya")
                        region = location.split(",")[0].split("/")[0].strip()
                        region_counts[region] = region_counts.get(region, 0) + 1
        
        # 2. Yoğun bölgeleri belirle (2+ istek olan yerler)
        busy_regions = [
            {"name": region, "count": count, "message": f"{region} bölgesi yoğun"}
            for region, count in region_counts.items() if count >= 2
        ]
        
        # 3. Yakındaki online sürücü sayısı (isteğe bağlı araç tipi filtresi)
        now = datetime.utcnow().isoformat()
        q = supabase.table("users").select("id, latitude, longitude, driver_details").eq("driver_online", True)
        drivers_result = _apply_driver_active_until_filter(q, now).execute()
        
        nearby_drivers = 0
        for d in (drivers_result.data or []):
            if pref is not None:
                if _effective_driver_vehicle_kind(d) != pref:
                    continue
            d_lat, d_lng = d.get("latitude"), d.get("longitude")
            if d_lat and d_lng:
                if haversine_distance(lat, lng, d_lat, d_lng) <= radius_km:
                    nearby_drivers += 1
        
        return {
            "success": True,
            "nearby_tags": nearby_tags,
            "nearby_tag_count": len(nearby_tags),
            "nearby_driver_count": nearby_drivers,
            "busy_regions": busy_regions,
            "radius_km": radius_km
        }
    except Exception as e:
        logger.error(f"Nearby activity error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.get("/driver/status")
async def get_driver_status(user_id: str):
    """Sürücünün aktif durumunu ve kalan süresini getir"""
    try:
        result = supabase.table("users").select("driver_active_until, driver_online, driver_details").eq("id", user_id).execute()
        
        if not result.data:
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        user = result.data[0]
        driver_active_until = user.get("driver_active_until")
        driver_online = user.get("driver_online", False)
        driver_details = user.get("driver_details") or {}
        
        # KYC kontrolü
        is_verified_driver = driver_details.get("kyc_status") == "approved" and driver_details.get("is_verified", False)
        
        if not is_verified_driver:
            return {
                "success": True,
                "is_active": False,
                "is_verified_driver": False,
                "remaining_seconds": 0,
                "remaining_text": "KYC onayı gerekli",
                "driver_online": False
            }
        
        if DRIVER_UNLIMITED_FREE_PERIOD:
            return {
                "success": True,
                "is_active": True,
                "is_verified_driver": True,
                "remaining_seconds": 86400 * 365 * 10,
                "remaining_text": "Ücretsizdir",
                "driver_online": driver_online,
                "active_until": driver_active_until,
            }
        
        # Süre kontrolü
        if driver_active_until:
            try:
                # ISO formatını parse et
                active_until = datetime.fromisoformat(driver_active_until.replace("Z", "+00:00"))
                now = datetime.now(active_until.tzinfo) if active_until.tzinfo else datetime.utcnow()
                
                remaining = (active_until - now).total_seconds()
                
                if remaining > 0:
                    hours = int(remaining // 3600)
                    minutes = int((remaining % 3600) // 60)
                    seconds = int(remaining % 60)
                    remaining_text = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                    
                    return {
                        "success": True,
                        "is_active": True,
                        "is_verified_driver": True,
                        "remaining_seconds": int(remaining),
                        "remaining_text": remaining_text,
                        "driver_online": driver_online,
                        "active_until": driver_active_until
                    }
                else:
                    # Süre dolmuş - otomatik offline yap
                    supabase.table("users").update({
                        "driver_online": False
                    }).eq("id", user_id).execute()
                    
                    return {
                        "success": True,
                        "is_active": False,
                        "is_verified_driver": True,
                        "remaining_seconds": 0,
                        "remaining_text": "Süre doldu",
                        "driver_online": False
                    }
            except Exception as parse_err:
                logger.warning(f"Tarih parse hatası: {parse_err}")
        
        return {
            "success": True,
            "is_active": False,
            "is_verified_driver": True,
            "remaining_seconds": 0,
            "remaining_text": "Paket satın alın",
            "driver_online": False
        }
        
    except Exception as e:
        logger.error(f"Driver status error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/driver/activate-package")
async def activate_driver_package(user_id: str, package_id: str):
    """Sürücü paketini aktifleştir (ödeme doğrulandıktan sonra çağrılır)"""
    try:
        # Paket kontrolü
        if package_id not in DRIVER_PACKAGES:
            return {"success": False, "detail": "Geçersiz paket"}
        
        package = DRIVER_PACKAGES[package_id]
        hours = package["hours"]
        
        # Minimum satın alma: 24 saat
        if hours < 24:
            return {"success": False, "detail": "En az 24 saatlik paket satın alabilirsiniz"}
        
        # Kullanıcı kontrolü
        result = supabase.table("users").select("driver_details, driver_active_until").eq("id", user_id).execute()
        if not result.data:
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        user = result.data[0]
        driver_details = user.get("driver_details") or {}
        
        # KYC kontrolü
        if driver_details.get("kyc_status") != "approved":
            return {"success": False, "detail": "Sürücü kaydınız henüz onaylanmamış"}
        
        # Mevcut süreye ekle veya yeni süre başlat
        current_until = user.get("driver_active_until")
        now = datetime.utcnow()
        
        if current_until:
            try:
                active_until = datetime.fromisoformat(current_until.replace("Z", "+00:00"))
                if active_until.tzinfo:
                    active_until = active_until.replace(tzinfo=None)
                
                if active_until > now:
                    # Mevcut süreye ekle
                    new_until = active_until + timedelta(hours=hours)
                else:
                    # Yeni süre başlat
                    new_until = now + timedelta(hours=hours)
            except:
                new_until = now + timedelta(hours=hours)
        else:
            new_until = now + timedelta(hours=hours)
        
        # Güncelle
        supabase.table("users").update({
            "driver_active_until": new_until.isoformat(),
            "driver_online": True,
            "updated_at": now.isoformat()
        }).eq("id", user_id).execute()
        
        # Paket satın alma logunu kaydet
        try:
            supabase.table("driver_package_purchases").insert({
                "user_id": user_id,
                "package_id": package_id,
                "package_name": package["name"],
                "hours": hours,
                "price_tl": package["price_tl"],
                "purchased_at": now.isoformat(),
                "expires_at": new_until.isoformat()
            }).execute()
        except Exception as log_err:
            logger.warning(f"Paket log hatası (tablo yok olabilir): {log_err}")
        
        logger.info(f"✅ Sürücü paketi aktifleştirildi: {user_id} -> {package_id} ({hours} saat)")
        
        return {
            "success": True,
            "message": f"{package['name']} paketi aktifleştirildi!",
            "active_until": new_until.isoformat(),
            "hours_added": hours
        }
        
    except Exception as e:
        logger.error(f"Package activation error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/driver/go-offline")
async def driver_go_offline(user_id: str):
    """Sürücüyü offline yap (manuel)"""
    try:
        supabase.table("users").update({
            "driver_online": False,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"🔴 Sürücü offline oldu: {user_id}")
        return {"success": True, "message": "Offline oldunuz"}
    except Exception as e:
        logger.error(f"Driver offline error: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/driver/go-online")
async def driver_go_online(user_id: str):
    """Sürücüyü online yap (aktif paketi varsa). Admin numaraları otomatik 1 yıl paket alır."""
    try:
        result = supabase.table("users").select("phone, driver_active_until, driver_details").eq("id", user_id).execute()
        if not result.data:
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        user = result.data[0]
        driver_details = user.get("driver_details") or {}
        driver_active_until = user.get("driver_active_until")
        phone_normalized = _normalize_phone(user.get("phone") or "")
        is_admin = phone_normalized in ADMIN_PHONE_NUMBERS
        
        # Admin: KYC olmadan sürücü sayılıyor; paket yoksa 1 yıl ver
        if is_admin:
            if not driver_active_until:
                now_admin = datetime.utcnow()
                admin_until = (now_admin + timedelta(days=365)).isoformat()
                supabase.table("users").update({
                    "driver_active_until": admin_until,
                    "updated_at": now_admin.isoformat()
                }).eq("id", user_id).execute()
                driver_active_until = admin_until
        else:
            # KYC kontrolü (admin değilse)
            if driver_details.get("kyc_status") != "approved":
                return {"success": False, "detail": "Sürücü kaydınız henüz onaylanmamış"}
        
        # Süre kontrolü (ücretsiz dönemde yok)
        if not DRIVER_UNLIMITED_FREE_PERIOD:
            if not driver_active_until:
                return {"success": False, "detail": "Aktif paketiniz yok. Lütfen bir paket satın alın."}
            
            try:
                active_until = datetime.fromisoformat(driver_active_until.replace("Z", "+00:00"))
                now_check = datetime.now(active_until.tzinfo) if active_until.tzinfo else datetime.utcnow()
                
                if active_until <= now_check:
                    return {"success": False, "detail": "Paket süreniz dolmuş. Lütfen yeni bir paket satın alın."}
            except Exception:
                return {"success": False, "detail": "Paket süresi kontrol edilemedi"}
        
        supabase.table("users").update({
            "driver_online": True,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"🟢 Sürücü online oldu: {user_id}")
        return {"success": True, "message": "Online oldunuz"}
    except Exception as e:
        logger.error(f"Driver online error: {e}")
        return {"success": False, "detail": str(e)}

def _normalize_phone(phone: str) -> str:
    """+90 532... -> 5326497412"""
    if not phone:
        return ""
    return (phone or "").replace("+90", "").replace(" ", "").replace("-", "").strip()


@api_router.get("/driver/dashboard")
async def get_driver_dashboard(user_id: str):
    """Sürücü dashboard bilgilerini getir - Kazanç paneli için"""
    try:
        # 1. Kullanıcı bilgilerini al
        user_result = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user_result.data:
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        user = user_result.data[0]
        driver_details = user.get("driver_details") or {}
        phone_normalized = _normalize_phone(user.get("phone") or "")
        is_admin = phone_normalized in ADMIN_PHONE_NUMBERS
        
        # Admin: driver_active_until yoksa 1 yıl ver (sürücü ekranı açılsın)
        driver_active_until = user.get("driver_active_until")
        if is_admin and not driver_active_until:
            now_temp = datetime.utcnow()
            admin_until = (now_temp + timedelta(days=365)).isoformat()
            supabase.table("users").update({
                "driver_active_until": admin_until,
                "updated_at": now_temp.isoformat()
            }).eq("id", user_id).execute()
            driver_active_until = admin_until
            user["driver_active_until"] = admin_until
        
        # 2. Bugünün başlangıcı ve haftanın başlangıcı
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Haftanın başı (Pazartesi)
        days_since_monday = now.weekday()
        week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 3. Bugünkü tamamlanan yolculukları al
        today_trips_result = supabase.table("tags").select("id, final_price, completed_at").eq("driver_id", user_id).eq("status", "completed").gte("completed_at", today_start.isoformat()).execute()
        
        today_trips = today_trips_result.data or []
        today_trips_count = len(today_trips)
        today_earnings = sum([t.get("final_price", 0) or 0 for t in today_trips])
        
        # 4. Haftalık tamamlanan yolculukları al
        weekly_trips_result = supabase.table("tags").select("id, final_price, completed_at").eq("driver_id", user_id).eq("status", "completed").gte("completed_at", week_start.isoformat()).execute()
        
        weekly_trips = weekly_trips_result.data or []
        weekly_trips_count = len(weekly_trips)
        weekly_earnings = sum([t.get("final_price", 0) or 0 for t in weekly_trips])
        
        # 5. Kalan aktif süre
        driver_active_until = user.get("driver_active_until")
        remaining_seconds = 0
        remaining_text = "Paket yok"
        is_active = False
        
        if DRIVER_UNLIMITED_FREE_PERIOD:
            is_active = True
            remaining_seconds = 86400 * 365 * 10
            remaining_text = "Ücretsizdir"
        elif driver_active_until:
            try:
                active_until = datetime.fromisoformat(driver_active_until.replace("Z", "+00:00"))
                if active_until.tzinfo:
                    active_until = active_until.replace(tzinfo=None)
                
                remaining = (active_until - now).total_seconds()
                if remaining > 0:
                    is_active = True
                    remaining_seconds = int(remaining)
                    hours = int(remaining // 3600)
                    minutes = int((remaining % 3600) // 60)
                    seconds = int(remaining % 60)
                    remaining_text = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                else:
                    remaining_text = "Süre doldu"
            except Exception:
                pass
        
        # 6. Günlük hedef (varsayılan 10 yolculuk veya 500 TL)
        daily_goal_trips = 10
        daily_goal_earnings = 500
        
        trips_progress = min(100, int((today_trips_count / daily_goal_trips) * 100))
        earnings_progress = min(100, int((today_earnings / daily_goal_earnings) * 100))
        
        # Ortalama ilerleme
        daily_progress = (trips_progress + earnings_progress) // 2
        
        # 7. Rating bilgisi (null-safe: DB'de null olabilir)
        try:
            r = user.get("rating")
            rating = float(r) if r is not None and r != "" else 5.0
        except (TypeError, ValueError):
            rating = 5.0
        try:
            t = user.get("total_trips")
            total_trips = int(t) if t is not None and t != "" else 0
        except (TypeError, ValueError):
            total_trips = 0
        
        return {
            "success": True,
            "today": {
                "trips_count": today_trips_count,
                "earnings": today_earnings,
            },
            "weekly": {
                "trips_count": weekly_trips_count,
                "earnings": weekly_earnings,
            },
            "active_time": {
                "is_active": is_active,
                "remaining_seconds": remaining_seconds,
                "remaining_text": remaining_text,
                "is_online": user.get("driver_online", False),
            },
            "daily_goal": {
                "target_trips": daily_goal_trips,
                "target_earnings": daily_goal_earnings,
                "trips_progress": trips_progress,
                "earnings_progress": earnings_progress,
                "overall_progress": daily_progress,
            },
            "stats": {
                "rating": rating,
                "total_trips": total_trips,
            }
        }
        
    except Exception as e:
        logger.error(f"Driver dashboard error: {e}")
        return {"success": False, "detail": str(e)}

# ==================== TÜRKİYE IP KONTROLÜ ====================
TURKEY_IP_RANGES = [
    # Türkiye IP aralıkları (CIDR)
    "31.3.", "31.6.", "31.7.", "31.14.", "31.15.",
    "37.9.", "37.75.", "37.130.", "37.148.", "37.202.", "37.230.",
    "46.1.", "46.2.", "46.3.", "46.4.", "46.5.", "46.6.", "46.45.", "46.154.", "46.196.",
    "78.160.", "78.161.", "78.162.", "78.163.", "78.164.", "78.165.", "78.166.", "78.167.", "78.168.", "78.169.", "78.170.", "78.171.", "78.172.", "78.173.", "78.174.", "78.175.", "78.176.", "78.177.", "78.178.", "78.179.", "78.180.", "78.181.", "78.182.", "78.183.", "78.184.", "78.185.", "78.186.", "78.187.", "78.188.", "78.189.", "78.190.", "78.191.",
    "81.212.", "81.213.", "81.214.", "81.215.",
    "85.96.", "85.97.", "85.98.", "85.99.", "85.100.", "85.101.", "85.102.", "85.103.", "85.104.", "85.105.", "85.106.", "85.107.", "85.108.", "85.109.", "85.110.", "85.111.",
    "88.224.", "88.225.", "88.226.", "88.227.", "88.228.", "88.229.", "88.230.", "88.231.", "88.232.", "88.233.", "88.234.", "88.235.", "88.236.", "88.237.", "88.238.", "88.239.", "88.240.", "88.241.", "88.242.", "88.243.", "88.244.", "88.245.", "88.246.", "88.247.", "88.248.", "88.249.", "88.250.", "88.251.", "88.252.", "88.253.", "88.254.", "88.255.",
    "89.252.", "89.253.", "89.254.", "89.255.",
    "94.54.", "94.55.", "94.102.", "94.122.", "94.123.", "94.136.", "94.137.", "94.138.", "94.139.",
    "95.0.", "95.1.", "95.2.", "95.3.", "95.4.", "95.5.", "95.6.", "95.7.", "95.8.", "95.9.", "95.10.", "95.11.", "95.12.", "95.13.", "95.14.", "95.15.",
    "176.33.", "176.34.", "176.35.", "176.36.", "176.37.", "176.38.", "176.39.", "176.40.", "176.41.", "176.42.", "176.43.", "176.44.", "176.45.", "176.46.", "176.47.", "176.48.", "176.49.", "176.50.", "176.51.", "176.52.", "176.53.", "176.54.", "176.55.", "176.56.", "176.57.", "176.58.", "176.59.", "176.88.", "176.89.", "176.90.", "176.91.", "176.92.", "176.93.", "176.94.", "176.95.", "176.96.", "176.97.", "176.98.", "176.99.", "176.234.", "176.235.", "176.236.", "176.237.", "176.238.", "176.239.", "176.240.", "176.241.",
    "178.244.", "178.245.", "178.246.", "178.247.", "178.248.", "178.249.", "178.250.", "178.251.",
    "185.4.", "185.13.", "185.26.", "185.28.", "185.30.", "185.32.", "185.33.", "185.34.", "185.35.", "185.36.", "185.37.", "185.38.", "185.39.", "185.40.", "185.41.", "185.42.", "185.43.", "185.44.", "185.45.", "185.46.", "185.47.", "185.48.", "185.49.", "185.50.", "185.51.", "185.52.", "185.53.", "185.54.", "185.55.", "185.56.", "185.57.", "185.58.", "185.59.", "185.60.", "185.61.", "185.62.", "185.63.", "185.64.", "185.65.", "185.66.", "185.67.", "185.68.", "185.69.", "185.70.", "185.86.", "185.87.", "185.88.", "185.89.", "185.94.", "185.95.", "185.100.", "185.101.", "185.102.", "185.103.",
    "188.57.", "188.58.", "188.59.", "188.119.", "188.120.", "188.121.", "188.132.",
    "193.140.", "193.141.", "193.142.", "193.254.", "193.255.",
    "194.27.", "194.28.", "194.29.", "194.31.",
    "195.85.", "195.112.", "195.155.", "195.174.", "195.175.",
    "212.2.", "212.58.", "212.98.", "212.154.", "212.174.", "212.175.", "212.252.", "212.253.",
    "213.14.", "213.142.", "213.153.", "213.238.",
    "217.17.", "217.65.", "217.66.", "217.114.", "217.130.", "217.131.",
]

def is_turkey_ip(ip: str) -> bool:
    """IP adresinin Türkiye'den olup olmadığını kontrol et"""
    if not ip:
        return True  # IP yoksa izin ver (localhost vs)
    
    # Localhost ve private IP'ler için izin ver
    if ip.startswith("127.") or ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("172."):
        return True
    
    # Türkiye IP kontrolü
    for prefix in TURKEY_IP_RANGES:
        if ip.startswith(prefix):
            return True
    
    return False

def get_client_ip(request: Request) -> str:
    """Request'ten gerçek IP adresini al"""
    # X-Forwarded-For header'ını kontrol et (proxy/load balancer arkasında)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    # X-Real-IP header'ı
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    
    # Client IP
    if request.client:
        return request.client.host
    
    return ""

# ==================== LOGIN LOG SİSTEMİ ====================
async def log_login_attempt(user_id: str, phone: str, ip_address: str, device_id: str, device_info: str, success: bool, fail_reason: str = None):
    """Giriş denemesini logla"""
    try:
        log_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "phone": phone,
            "ip_address": ip_address,
            "device_id": device_id,
            "device_info": device_info,
            "success": success,
            "fail_reason": fail_reason,
            "country": "TR" if is_turkey_ip(ip_address) else "FOREIGN",
            "created_at": datetime.utcnow().isoformat()
        }
        supabase.table("login_logs").insert(log_data).execute()
    except Exception as e:
        logger.error(f"Login log error: {e}")

# ==================== GÜVENLİ GİRİŞ - TÜRKİYE IP KONTROLÜ ====================
@api_router.post("/auth/secure-login")
async def secure_login(request: Request, phone: str, pin: str, device_id: str = None, device_info: str = None):
    """Güvenli giriş - Türkiye IP kontrolü ile"""
    try:
        canonical = _auth_normalize_or_raise(phone)
        client_ip = get_client_ip(request)
        
        # Türkiye IP kontrolü
        if not is_turkey_ip(client_ip):
            await log_login_attempt(None, canonical, client_ip, device_id, device_info, False, "FOREIGN_IP")
            raise HTTPException(
                status_code=403, 
                detail="Bu uygulama sadece Türkiye'den erişilebilir. VPN kullanıyorsanız lütfen kapatın."
            )
        
        # Kullanıcıyı bul (905 / 5XX kayıt uyumu)
        user = _users_get_by_phone_flexible(canonical)
        
        if not user:
            await log_login_attempt(None, canonical, client_ip, device_id, device_info, False, "USER_NOT_FOUND")
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Kullanıcı aktif mi?
        if user.get("is_deleted", False):
            await log_login_attempt(user["id"], canonical, client_ip, device_id, device_info, False, "USER_DELETED")
            raise HTTPException(status_code=403, detail="Bu hesap silinmiş")
        
        if not user.get("is_active", True):
            await log_login_attempt(user["id"], canonical, client_ip, device_id, device_info, False, "USER_BANNED")
            raise HTTPException(status_code=403, detail="Bu hesap askıya alınmış")
        
        # PIN kontrolü
        if not verify_pin(pin, user.get("pin_hash", "")):
            await log_login_attempt(user["id"], canonical, client_ip, device_id, device_info, False, "WRONG_PIN")
            raise HTTPException(status_code=401, detail="Yanlış PIN")
        
        # Başarılı giriş - güncelle
        supabase.table("users").update({
            "last_login": datetime.utcnow().isoformat(),
            "last_ip": client_ip,
            "last_device_id": device_id,
            "last_device_info": device_info,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user["id"]).execute()
        
        # Başarılı log
        await log_login_attempt(user["id"], canonical, client_ip, device_id, device_info, True, None)
        
        is_admin = _phone_10_for_admin_check(canonical) in ADMIN_PHONE_NUMBERS
        
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "name": user["name"],
                "first_name": user.get("first_name"),
                "last_name": user.get("last_name"),
                "city": user.get("city"),
                "rating": float(user.get("rating", 5.0)),
                "total_trips": user.get("total_trips", 0),
                "profile_photo": user.get("profile_photo"),
                "driver_details": user.get("driver_details"),
                "is_admin": is_admin
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Secure login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - SOFT DELETE ====================
@api_router.post("/admin/soft-delete-user")
async def admin_soft_delete_user(admin_phone: str, user_id: str, reason: str = "Admin tarafından silindi"):
    """Kullanıcıyı soft delete yap - is_active: false yaparak giriş engelle"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # Sadece is_active = false yaparak hesabı devre dışı bırak
        supabase.table("users").update({
            "is_active": False,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"🗑️ Kullanıcı silindi (soft): {user_id} - Sebep: {reason}")
        return {"success": True, "message": "Kullanıcı silindi (soft delete)"}
    except Exception as e:
        logger.error(f"Soft delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - SÜRÜCÜ ONLİNE/OFFLİNE ====================
@api_router.post("/admin/set-driver-offline")
async def admin_set_driver_offline(admin_phone: str, driver_id: str):
    """Admin - Sürücüyü zorla offline yap"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        supabase.table("users").update({
            "driver_online": False,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", driver_id).execute()
        
        return {"success": True, "message": "Sürücü offline yapıldı"}
    except Exception as e:
        logger.error(f"Admin set driver offline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - ONLINE SÜRÜCÜLER ====================
@api_router.get("/admin/online-drivers")
async def admin_get_online_drivers(admin_phone: str):
    """Admin - Online sürücüleri listele"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        result = supabase.table("users").select(
            "id, name, phone, city, rating, latitude, longitude, driver_online, driver_active_until, last_activity"
        ).eq("driver_online", True).execute()
        
        drivers = []
        for driver in (result.data or []):
            drivers.append({
                "id": driver["id"],
                "name": driver.get("name", "İsimsiz"),
                "phone": driver.get("phone"),
                "city": driver.get("city"),
                "rating": float(driver.get("rating", 5.0)),
                "latitude": driver.get("latitude"),
                "longitude": driver.get("longitude"),
                "active_until": driver.get("driver_active_until"),
                "last_active": driver.get("last_activity")
            })
        
        return {"success": True, "drivers": drivers, "total": len(drivers)}
    except Exception as e:
        logger.error(f"Admin online drivers error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - AKTİF YOLCULUKLAR ====================
@api_router.get("/admin/active-trips")
async def admin_get_active_trips(admin_phone: str):
    """Admin - Aktif yolculukları listele"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # Aktif ve eşleşmiş yolculukları getir
        result = supabase.table("tags").select("*").in_("status", ["waiting", "matched", "in_progress"]).execute()
        
        trips = []
        for tag in (result.data or []):
            # Yolcu ve sürücü bilgisi
            passenger_name = "-"
            driver_name = "-"
            
            try:
                if tag.get("passenger_id"):
                    p_result = supabase.table("users").select("name, phone").eq("id", tag["passenger_id"]).execute()
                    if p_result.data:
                        passenger_name = f"{p_result.data[0].get('name', '-')} ({p_result.data[0].get('phone', '')})"
                
                if tag.get("driver_id"):
                    d_result = supabase.table("users").select("name, phone").eq("id", tag["driver_id"]).execute()
                    if d_result.data:
                        driver_name = f"{d_result.data[0].get('name', '-')} ({d_result.data[0].get('phone', '')})"
            except:
                pass
            
            trips.append({
                "id": tag["id"],
                "status": tag.get("status"),
                "passenger": passenger_name,
                "driver": driver_name,
                "pickup": tag.get("pickup_location") or tag.get("start_address"),
                "dropoff": tag.get("dropoff_location") or tag.get("destination_name"),
                "price": tag.get("final_price") or tag.get("calculated_price"),
                "created_at": tag.get("created_at")
            })
        
        return {"success": True, "trips": trips, "total": len(trips)}
    except Exception as e:
        logger.error(f"Admin active trips error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - LOGIN LOGS ====================
@api_router.get("/admin/login-logs-full")
async def admin_get_login_logs_full(admin_phone: str, page: int = 1, limit: int = 50, filter_country: str = None):
    """Admin - Giriş loglarını getir (IP, cihaz bilgisi ile)"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        offset = (page - 1) * limit
        
        query = supabase.table("login_logs").select("*", count="exact").order("created_at", desc=True)
        
        if filter_country:
            query = query.eq("country", filter_country)
        
        result = query.range(offset, offset + limit - 1).execute()
        
        return {
            "success": True, 
            "logs": result.data or [], 
            "total": result.count or 0,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Admin login logs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - PROMOSYON TAM CRUD ====================
@api_router.get("/admin/promotions")
async def admin_get_promotions(admin_phone: str):
    """Admin - Tüm promosyonları listele"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        result = supabase.table("promotions").select("*").order("created_at", desc=True).execute()
        
        return {"success": True, "promotions": result.data or []}
    except Exception as e:
        logger.error(f"Admin promotions error: {e}")
        return {"success": False, "promotions": []}

@api_router.post("/admin/promotions/create")
async def admin_create_promotion(admin_phone: str, code: str = None, hours: int = 3, max_uses: int = 100, description: str = ""):
    """Admin - Yeni promosyon kodu oluştur"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        promo_code = code.upper() if code else generate_promo_code().upper()
        
        promo_data = {
            "id": str(uuid.uuid4()),
            "code": promo_code,
            "hours": hours,
            "max_uses": max_uses,
            "used_count": 0,
            "is_active": True,
            "description": description,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("promotions").insert(promo_data).execute()
        
        return {"success": True, "promotion": result.data[0] if result.data else promo_data}
    except Exception as e:
        logger.error(f"Create promotion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/promotions/toggle")
async def admin_toggle_promotion(admin_phone: str, promo_id: str, is_active: bool):
    """Admin - Promosyonu aktif/pasif yap"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        supabase.table("promotions").update({"is_active": is_active}).eq("id", promo_id).execute()
        
        return {"success": True, "message": f"Promosyon {'aktif' if is_active else 'pasif'} yapıldı"}
    except Exception as e:
        logger.error(f"Toggle promotion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN - PUSH NOTIFICATION ====================
@api_router.post("/admin/push/send")
async def admin_send_push_notification(admin_phone: str, title: str, message: str, target: str = "all", user_ids: str = None):
    """Admin - Push bildirim gönder (all, drivers, passengers, specific)"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        # Hedef kullanıcıları belirle
        target_rows = []
        
        if target == "all":
            result = supabase.table("users").select("id, push_token").execute()
            target_rows = result.data or []
        elif target == "drivers":
            result = supabase.table("users").select("id, push_token").eq("driver_online", True).execute()
            target_rows = result.data or []
        elif target == "passengers":
            # Driver olmayan kullanıcılar
            result = supabase.table("users").select("id, push_token, driver_online").execute()
            target_rows = [u for u in (result.data or []) if not u.get("driver_online")]
        elif target == "specific" and user_ids:
            ids = [uid.strip() for uid in user_ids.split(",")]
            result = supabase.table("users").select("id, push_token").in_("id", ids).execute()
            target_rows = result.data or []
        
        token_user_ids = [
            row["id"]
            for row in target_rows
            if row.get("id") and ExpoPushService.is_valid_token(row.get("push_token"))
        ]

        push_result = await send_push_notifications_to_users(
            user_ids=token_user_ids,
            title=title,
            body=message,
            data={"type": "admin_push", "target": target}
        )
        sent_count = push_result["sent"]
        failed_count = push_result["failed"]
        
        # Log kaydet
        supabase.table("notification_logs").insert({
            "id": str(uuid.uuid4()),
            "admin_phone": admin_phone,
            "title": title,
            "message": message,
            "target": target,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
        
        return {
            "success": True, 
            "sent": sent_count, 
            "failed": failed_count,
            "total_tokens": len(token_user_ids)
        }
    except Exception as e:
        logger.error(f"Admin push notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== GOOGLE DIRECTIONS API - IN-APP NAVİGASYON ====================
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")

@api_router.get("/directions")
async def get_directions(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float):
    """Google Directions API - Turn-by-turn navigasyon için"""
    try:
        if not GOOGLE_MAPS_API_KEY:
            return {"success": False, "error": "Google Maps API key not configured"}
        
        url = f"https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "mode": "driving",
            "language": "tr",
            "key": GOOGLE_MAPS_API_KEY
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            data = response.json()
        
        if data.get("status") != "OK":
            return {"success": False, "error": data.get("status")}
        
        route = data.get("routes", [{}])[0]
        leg = route.get("legs", [{}])[0]
        
        steps = []
        for step in leg.get("steps", []):
            # Manevra türünü çıkar
            maneuver = step.get("maneuver", "straight")
            
            # HTML taglerini temizle
            instruction = step.get("html_instructions", "")
            import re
            instruction = re.sub('<[^<]+?>', '', instruction)
            
            steps.append({
                "maneuver": maneuver,
                "instruction": instruction,
                "distance": step.get("distance", {}).get("text", ""),
                "duration": step.get("duration", {}).get("text", ""),
                "start_location": step.get("start_location"),
                "end_location": step.get("end_location"),
                "polyline": step.get("polyline", {}).get("points", "")
            })
        
        return {
            "success": True,
            "steps": steps,
            "total_distance": leg.get("distance", {}).get("text", ""),
            "total_duration": leg.get("duration", {}).get("text", ""),
            "polyline": route.get("overview_polyline", {}).get("points", "")
        }
        
    except Exception as e:
        logger.error(f"Directions API error: {e}")
        return {"success": False, "error": str(e)}

# ==================== API ROUTER INCLUDE ====================
# TÜM ROUTE'LAR TANIMLANDIKTAN SONRA INCLUDE EDİLMELİ!
app.include_router(api_router)

# ==================== SOCKET.IO ENABLED APP ====================
# Combine Socket.IO + FastAPI. Run uvicorn with socket_app, NOT app.
socket_app = socketio.ASGIApp(
    sio,
    other_asgi_app=fastapi_app,
    socketio_path="/socket.io"
)

if __name__ == "__main__":
    import uvicorn
    # CRITICAL: Must run socket_app so /socket.io is served. FastAPI routes stay on fastapi_app.
    uvicorn.run(socket_app, host="0.0.0.0", port=SOCKET_SERVER_PORT)
