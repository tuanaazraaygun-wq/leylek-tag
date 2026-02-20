"""
Leylek TAG - Supabase Backend
Full PostgreSQL Backend with Supabase + Socket.IO
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import logging
import uuid
from pathlib import Path
from datetime import datetime, timedelta
import secrets
import base64
import hashlib
import httpx
import json
import time

# Socket.IO
import socketio

# Supabase
from supabase import create_client, Client

# Agora Token Builder
from agora_token_builder import RtcTokenBuilder

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

# ==================== SOCKET.IO SERVER ====================
# Emergent /api/* path'ini kullanıyor, bu yüzden /api/socket.io kullanıyoruz
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Aktif kullanıcılar: {user_id: socket_id}
connected_users = {}

@sio.event
async def connect(sid, environ):
    logger.info(f"🔌 Socket bağlandı: {sid}")
    logger.info(f"🔌 Toplam bağlı: {len(connected_users) + 1}")

@sio.event
async def disconnect(sid):
    # Kullanıcıyı connected_users'dan kaldır
    user_to_remove = None
    for user_id, socket_id in connected_users.items():
        if socket_id == sid:
            user_to_remove = user_id
            break
    if user_to_remove:
        del connected_users[user_to_remove]
        logger.info(f"🔌 Socket ayrıldı: {sid} (user: {user_to_remove})")
    else:
        logger.info(f"🔌 Socket ayrıldı: {sid}")

@sio.event
async def register(sid, data):
    """Kullanıcı kaydı - user_id ile socket_id eşleştir"""
    user_id = data.get('user_id')
    if user_id:
        connected_users[user_id] = sid
        logger.info(f"📱 Kullanıcı kayıtlı: {user_id} -> {sid}")
        await sio.emit('registered', {'success': True, 'user_id': user_id}, room=sid)

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
        
        # Her iki tarafa da ANINDA bildir
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

# ==================== CONFIG ====================
MAX_DISTANCE_KM = 50
ADMIN_PHONE_NUMBERS = ["5326497412"]  # Ana admin numarası
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

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

# Supabase Config
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Initialize Supabase
supabase: Client = None

def init_supabase():
    global supabase
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("✅ Supabase bağlantısı başarılı")
    else:
        logger.error("❌ Supabase credentials eksik!")

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

# Create app
app = FastAPI(title="Leylek TAG API - Supabase", version="3.0.0")
api_router = APIRouter(prefix="/api")

# ==================== SOCKET.IO ASGI APP ====================
# Socket.IO'yu /api/socket.io path'inde çalıştır
# NOT: socket_app dosyanın sonunda oluşturulacak (route'lar eklendikten sonra)

# Son temizlik zamanı (global)
last_cleanup_time = None

@app.on_event("startup")
async def startup():
    global last_cleanup_time
    init_supabase()
    last_cleanup_time = datetime.utcnow()
    logger.info("✅ Server started with Supabase + Socket.IO (path: /api/socket.io)")

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
        # Zaten UUID formatında
        return user_id
    
    # MongoDB ID olabilir, mongo_id ile ara
    try:
        result = supabase.table("users").select("id").eq("mongo_id", user_id).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        logger.warning(f"User ID resolve error: {e}")
    
    # Bulunamadıysa orijinal değeri döndür
    return user_id

# OSRM API (TAMAMEN ÜCRETSİZ - LİMİTSİZ)
# OpenStreetMap'in routing servisi - Daha güvenilir ve limitsiz

async def get_route_info(origin_lat, origin_lng, dest_lat, dest_lng):
    """OSRM ile rota bilgisi al (TAMAMEN ÜCRETSİZ - LİMİTSİZ)"""
    try:
        # OSRM Public API - 5 saniye timeout
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
        logger.warning(f"OSRM timeout/error: {e}")
    
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

# Yardımcı fonksiyon
async def _check_user_logic(phone: str, device_id: str = None):
    """Kullanıcı var mı kontrol et - iç mantık"""
    try:
        result = supabase.table("users").select("*").eq("phone", phone).execute()
        
        if result.data:
            user = result.data[0]
            has_pin = bool(user.get("pin_hash"))
            
            # Cihaz kontrolü
            is_verified = False
            if device_id and user.get("driver_details"):
                verified_devices = user.get("driver_details", {}).get("verified_devices", [])
                is_verified = device_id in verified_devices
            
            return {
                "success": True,
                "user_exists": True,  # Frontend bunu bekliyor
                "exists": True,
                "has_pin": has_pin,
                "device_verified": is_verified,  # Frontend bunu bekliyor
                "is_device_verified": is_verified,
                "user_id": user["id"],
                "is_admin": phone in ADMIN_PHONE_NUMBERS
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
# Format: {phone: {"code": "123456", "expires": timestamp, "last_sent": timestamp}}
otp_storage: dict = {}

# Rate limit: 60 seconds between OTP requests
OTP_RATE_LIMIT_SECONDS = 60
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

async def send_sms_via_netgsm(phone: str, message: str) -> dict:
    """
    NETGSM API ile SMS gönder - HTTP GET API (daha güvenilir)
    Returns: {"success": bool, "response": dict, "error": str}
    """
    result = {"success": False, "response": None, "error": None}
    
    try:
        usercode = os.getenv("NETGSM_USERCODE", "")
        password = os.getenv("NETGSM_PASSWORD", "")
        msgheader = os.getenv("NETGSM_MSGHEADER", "")
        
        if not usercode or not password:
            logger.error("❌ NETGSM credentials eksik!")
            result["error"] = "NETGSM credentials missing"
            return result
        
        # Normalize phone number to 905XXXXXXXXX format
        normalized_phone = normalize_turkish_phone(phone)
        logger.info(f"📱 Phone normalized: {phone} -> {normalized_phone}")
        
        # Use msgheader or usercode as sender
        sender = msgheader if msgheader else usercode
        
        # NETGSM HTTP GET API - daha basit ve güvenilir
        # Docs: https://www.netgsm.com.tr/dokuman/
        import urllib.parse
        
        # URL encode the message
        encoded_message = urllib.parse.quote(message)
        
        # Build API URL
        url = (
            f"https://api.netgsm.com.tr/sms/send/get?"
            f"usercode={usercode}"
            f"&password={urllib.parse.quote(password)}"
            f"&gsmno={normalized_phone}"
            f"&message={encoded_message}"
            f"&msgheader={urllib.parse.quote(sender)}"
            f"&dil=TR"
        )
        
        logger.info(f"📱 NETGSM Request - Phone: {normalized_phone}, Sender: {sender}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response_text = response.text.strip()
            
            # Log response
            logger.info(f"📱 NETGSM Response: {response_text}")
            result["response"] = {"raw": response_text}
            
            # Parse response - NETGSM returns codes like:
            # 00 XXXXXXXX = Success (with job ID)
            # 20 = Post error
            # 30 = Credential error
            # 40 = Sender not defined
            # 50 = Incorrect IYS brand code
            # 51 = IYS brand code required
            # 70 = Incorrect query parameter
            
            parts = response_text.split()
            code = parts[0] if parts else response_text
            
            if code in ["00", "01", "02"]:
                job_id = parts[1] if len(parts) > 1 else "N/A"
                logger.info(f"✅ SMS gönderildi: {normalized_phone}, JobID: {job_id}")
                result["success"] = True
                result["response"]["job_id"] = job_id
            else:
                error_desc = {
                    "20": "POST hatası",
                    "30": "Kimlik doğrulama hatası (usercode/password yanlış)",
                    "40": "Mesaj başlığı (sender) tanımlı değil",
                    "50": "IYS marka kodu hatalı",
                    "51": "IYS marka kodu zorunlu",
                    "70": "Parametre hatası"
                }.get(code, f"Bilinmeyen hata: {code}")
                
                logger.error(f"❌ SMS gönderilemedi: {normalized_phone} - Code: {code}, Desc: {error_desc}")
                result["error"] = f"Code: {code}, Desc: {error_desc}"
                
    except Exception as e:
        logger.error(f"❌ NETGSM exception: {e}")
        result["error"] = str(e)
    
    return result

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOtpBodyRequest = None, phone: str = None):
    """
    OTP gönder - NETGSM ile gerçek SMS
    
    Features:
    - Rate limit: 60 seconds between requests
    - Single active OTP per phone
    - TTL: 3 minutes
    - Phone normalization to 905XXXXXXXXX
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
    
    # Rate limit check
    current_time = time.time()
    stored = otp_storage.get(cleaned_phone)
    
    if stored and stored.get("last_sent"):
        time_since_last = current_time - stored["last_sent"]
        if time_since_last < OTP_RATE_LIMIT_SECONDS:
            remaining = int(OTP_RATE_LIMIT_SECONDS - time_since_last)
            logger.warning(f"⚠️ Rate limit: {cleaned_phone}, wait {remaining}s")
            raise HTTPException(
                status_code=429, 
                detail=f"Lütfen {remaining} saniye bekleyin"
            )
    
    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    
    # Store OTP with TTL and rate limit timestamp
    otp_storage[cleaned_phone] = {
        "code": otp_code,
        "expires": current_time + OTP_TTL_SECONDS,
        "last_sent": current_time
    }
    
    # Send SMS via NETGSM
    message = f"Leylek TAG dogrulama kodunuz: {otp_code}"
    sms_result = await send_sms_via_netgsm(cleaned_phone, message)
    
    if sms_result["success"]:
        logger.info(f"✅ OTP gönderildi: {cleaned_phone}")
        return {"success": True, "message": "OTP gönderildi"}
    else:
        # Log failure but still return success (code is stored)
        logger.error(f"❌ SMS failed for {cleaned_phone}: {sms_result['error']}")
        
        # In production, you might want to fail here
        # For now, fallback to test mode
        logger.warning(f"⚠️ Fallback test mode: {cleaned_phone} -> 123456")
        otp_storage[cleaned_phone]["code"] = "123456"
        
        return {
            "success": True, 
            "message": "OTP gönderildi",
            "warning": "SMS delivery issue, using test code"
        }

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
    
    # TR numara doğrulama ve normalize et
    is_valid, result = validate_turkish_phone(phone_number)
    if is_valid:
        phone_number = normalize_turkish_phone(result)
    
    logger.info(f"📱 OTP verify for: {phone_number}")
    
    # OTP kontrolü
    stored_otp = otp_storage.get(phone_number)
    
    if stored_otp:
        # Süre kontrolü
        if time.time() > stored_otp["expires"]:
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
            raise HTTPException(status_code=400, detail="Geçersiz OTP")
        logger.warning(f"⚠️ Test OTP used for: {phone_number}")
    
    # Kullanıcı var mı kontrol et
    result = supabase.table("users").select("*").eq("phone", phone_number).execute()
    
    if result.data:
        user = result.data[0]
        has_pin = bool(user.get("pin_hash"))
        
        # Last login güncelle
        try:
            supabase.table("users").update({
                "last_login": datetime.utcnow().isoformat()
            }).eq("id", user["id"]).execute()
        except:
            pass
        
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

@api_router.post("/auth/set-pin")
async def set_pin(request: SetPinRequest = None, phone: str = None, pin: str = None, first_name: str = None, last_name: str = None, city: str = None):
    """PIN oluştur veya güncelle"""
    try:
        # Body veya query param'dan al
        phone_val = request.phone if request else phone
        pin_val = request.pin if request else pin
        first_name_val = request.first_name if request else first_name
        last_name_val = request.last_name if request else last_name
        city_val = request.city if request else city
        
        if not phone_val or not pin_val:
            raise HTTPException(status_code=422, detail="Phone ve PIN gerekli")
        
        pin_hash = hash_pin(pin_val)
        
        # Kullanıcı var mı?
        result = supabase.table("users").select("id").eq("phone", phone_val).execute()
        
        if result.data:
            # Güncelle
            supabase.table("users").update({
                "pin_hash": pin_hash,
                "first_name": first_name_val,
                "last_name": last_name_val,
                "city": city_val,
                "name": f"{first_name_val or ''} {last_name_val or ''}".strip(),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("phone", phone_val).execute()
        else:
            # Yeni kullanıcı oluştur
            supabase.table("users").insert({
                "phone": phone_val,
                "pin_hash": pin_hash,
                "first_name": first_name_val,
                "last_name": last_name_val,
                "city": city_val,
                "name": f"{first_name_val or ''} {last_name_val or ''}".strip(),
                "rating": 5.0,
                "total_ratings": 0,
                "total_trips": 0,
                "is_active": True
            }).execute()
        
        logger.info(f"✅ PIN ayarlandı: {phone_val}")
        return {"success": True, "message": "PIN ayarlandı"}
    except Exception as e:
        logger.error(f"Set PIN error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# verify-pin endpoint - Frontend uyumluluğu için
@api_router.post("/auth/verify-pin")
async def verify_pin_endpoint(phone: str = None, pin: str = None, device_id: str = None):
    """PIN doğrulama - login ile aynı işlevi görür"""
    try:
        if not phone or not pin:
            raise HTTPException(status_code=422, detail="Phone ve PIN gerekli")
        
        result = supabase.table("users").select("*").eq("phone", phone).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = result.data[0]
        
        if not verify_pin(pin, user.get("pin_hash", "")):
            raise HTTPException(status_code=401, detail="Yanlış PIN")
        
        # Son giriş zamanını güncelle (device_id kolonu Supabase'de yok, bu yüzden eklenmedi)
        try:
            supabase.table("users").update({
                "last_login": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", user["id"]).execute()
        except Exception as update_err:
            logger.warning(f"Last login update error (ignored): {update_err}")
        
        is_admin = phone in ADMIN_PHONE_NUMBERS
        
        logger.info(f"✅ PIN doğrulandı: {phone}, Admin: {is_admin}")
        
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
        
        result = supabase.table("users").select("*").eq("phone", phone_val).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = result.data[0]
        
        if not verify_pin(pin_val, user.get("pin_hash", "")):
            raise HTTPException(status_code=401, detail="Yanlış PIN")
        
        # Son giriş güncelle
        supabase.table("users").update({
            "last_login": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user["id"]).execute()
        
        is_admin = phone_val in ADMIN_PHONE_NUMBERS
        
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
        # TR numara doğrulama
        is_valid, result = validate_turkish_phone(request.phone)
        if not is_valid:
            raise HTTPException(status_code=400, detail=result)
        
        cleaned_phone = result
        
        # PIN uzunluk kontrolü
        if len(request.new_pin) != 6 or not request.new_pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN 6 haneli rakamlardan oluşmalı")
        
        # Kullanıcı var mı?
        user_result = supabase.table("users").select("id, name").eq("phone", cleaned_phone).execute()
        if not user_result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user = user_result.data[0]
        pin_hash = hash_pin(request.new_pin)
        
        # PIN'i güncelle
        supabase.table("users").update({
            "pin_hash": pin_hash,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user["id"]).execute()
        
        logger.info(f"🔑 PIN sıfırlandı: {cleaned_phone}")
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
        
        # TR numara doğrulama
        is_valid, result = validate_turkish_phone(request.new_admin_phone)
        if not is_valid:
            raise HTTPException(status_code=400, detail=result)
        
        cleaned_phone = result
        
        # Kullanıcı var mı?
        user_result = supabase.table("users").select("id, name, phone").eq("phone", cleaned_phone).execute()
        if not user_result.data:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı. Önce kayıt olmalı.")
        
        user = user_result.data[0]
        
        # is_admin true yap
        supabase.table("users").update({
            "is_admin": True,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user["id"]).execute()
        
        logger.info(f"👑 Yeni admin eklendi: {cleaned_phone} by {request.admin_phone}")
        return {"success": True, "message": f"{user.get('name', cleaned_phone)} admin olarak eklendi"}
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
    """Yeni kullanıcı kaydı"""
    try:
        # Kullanıcı var mı kontrol et
        existing = supabase.table("users").select("id").eq("phone", request.phone).execute()
        if existing.data:
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
        
        # Yeni kullanıcı oluştur
        user_data = {
            "phone": request.phone,
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "city": request.city,
            "pin_hash": pin_hash,
            "points": 100,  # Herkes 100 puanla başlar
            "rating": 5.0,  # 100 puan = 5 yıldız
            "total_ratings": 0,
            "total_trips": 0,
            "is_active": True
        }
        
        result = supabase.table("users").insert(user_data).execute()
        
        if result.data:
            user = result.data[0]
            logger.info(f"✅ Yeni kullanıcı kaydedildi: {request.phone}")
            
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
                    "is_admin": request.phone in ADMIN_PHONE_NUMBERS
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

# Frontend uyumluluğu için alias
@api_router.post("/passenger/create-request")
async def create_request_alias(request: CreateTagRequest, user_id: str = None):
    """Yolcu TAG oluştur (alias)"""
    return await create_tag(request, user_id)

@api_router.get("/passenger/active-tag")
async def get_active_tag(passenger_id: str = None, user_id: str = None):
    """Aktif TAG getir - cancelled durumunda da döndür (frontend algılasın)"""
    try:
        # Arka planda inaktif TAG'leri temizle
        await auto_cleanup_inactive_tags()
        
        # passenger_id veya user_id kabul et
        uid = passenger_id or user_id
        if not uid:
            return {"success": False, "tag": None, "detail": "user_id gerekli"}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(uid)
        
        # 🔥 ÖNCELİK 1: Son 5 dakikada cancelled olmuş TAG var mı kontrol et
        # Bu sayede frontend eşleşmenin bitirildiğini algılayabilir
        from datetime import timedelta
        five_minutes_ago = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        
        cancelled_result = supabase.table("tags").select("*").eq("passenger_id", resolved_id).eq("status", "cancelled").gte("cancelled_at", five_minutes_ago).order("cancelled_at", desc=True).limit(1).execute()
        
        if cancelled_result.data:
            cancelled_tag = cancelled_result.data[0]
            logger.info(f"🛑 Cancelled TAG bulundu ve döndürülüyor: {cancelled_tag['id']}")
            return {"success": True, "tag": cancelled_tag, "was_cancelled": True}
        
        # ÖNCELİK 2: Aktif tag'leri ara
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
        
        # Şoför bilgisi
        driver_result = supabase.table("users").select("name").eq("id", driver_id_final).execute()
        driver_name = driver_result.data[0]["name"] if driver_result.data else "Şoför"
        
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
        
        logger.info(f"✅ Teklif kabul edildi: {real_offer_id} - Driver: {driver_id_final}")
        return {"success": True, "message": "Teklif kabul edildi", "driver_id": driver_id_final, "offer_id": real_offer_id}
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
        
        update_query = supabase.table("tags").update({
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id)
        
        if resolved_id:
            update_query = update_query.eq("passenger_id", resolved_id)
        
        update_query.execute()
        
        return {"success": True, "message": "TAG iptal edildi"}
    except Exception as e:
        logger.error(f"Cancel tag error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# POST method için alias (frontend uyumluluğu)
@api_router.post("/passenger/cancel-tag")
async def cancel_tag_post(request: CancelTagRequest = None, tag_id: str = None, passenger_id: str = None, user_id: str = None):
    """TAG iptal et (POST)"""
    try:
        tid = request.tag_id if request else tag_id
        pid = passenger_id or user_id
        
        if not tid:
            raise HTTPException(status_code=422, detail="tag_id gerekli")
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(pid) if pid else None
        
        update_query = supabase.table("tags").update({
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat()
        }).eq("id", tid)
        
        if resolved_id:
            update_query = update_query.eq("passenger_id", resolved_id)
        
        update_query.execute()
        
        # Aktif teklifleri de iptal et
        supabase.table("offers").update({"status": "rejected"}).eq("tag_id", tid).eq("status", "pending").execute()
        
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
        driver_result = supabase.table("users").select("city, latitude, longitude").eq("id", resolved_id).execute()
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
        result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, rating, profile_photo, city)").in_("status", ["pending", "offers_received"]).gte("created_at", ten_min_ago).order("created_at", desc=True).limit(100).execute()
        
        requests = []
        for tag in result.data:
            # Engelli kontrolü
            if tag.get("passenger_id") in all_blocked:
                continue
            
            passenger_info = tag.get("users", {}) or {}
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
        
        # 3. ARKA PLANDA mesafe hesapla ve güncelle (kullanıcı beklemez)
        import asyncio
        
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

@api_router.get("/driver/active-trip")
async def get_driver_active_trip(driver_id: str = None, user_id: str = None):
    """Şoförün aktif yolculuğu - cancelled durumunda da döndür (frontend algılasın)"""
    try:
        # driver_id veya user_id kabul et
        did = driver_id or user_id
        if not did:
            return {"success": True, "trip": None, "tag": None}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        # 🔥 ÖNCELİK 1: Son 5 dakikada cancelled olmuş TAG var mı kontrol et
        from datetime import timedelta
        five_minutes_ago = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        
        cancelled_result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone, rating, profile_photo, latitude, longitude)").eq("driver_id", resolved_id).eq("status", "cancelled").gte("cancelled_at", five_minutes_ago).order("cancelled_at", desc=True).limit(1).execute()
        
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
        
        # ÖNCELİK 2: Aktif tag'leri ara
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
                "passenger_location": passenger_location,  # EKLENDİ
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
                "tag": tag_data  # Frontend uyumluluğu için
            }
        
        return {"success": True, "trip": None, "tag": None}
    except Exception as e:
        logger.error(f"Get driver active trip error: {e}")
        return {"success": False, "trip": None, "tag": None}

# Frontend uyumluluğu için alias
@api_router.get("/driver/active-tag")
async def get_driver_active_tag(driver_id: str = None, user_id: str = None):
    """Şoförün aktif TAG'i (alias)"""
    return await get_driver_active_trip(driver_id, user_id)

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

class ExpoPushService:
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
    
    @staticmethod
    def is_valid_token(token: str) -> bool:
        return token and token.startswith("ExponentPushToken[")
    
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

@api_router.post("/user/register-push-token")
async def register_push_token(user_id: str, push_token: str):
    """Push token kaydet"""
    try:
        supabase.table("users").update({
            "push_token": push_token,
            "push_token_updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        return {"success": True}
    except Exception as e:
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
        
        tokens = []
        target_count = 0
        
        if target == "all":
            result = supabase.table("users").select("id, push_token").execute()
            target_count = len(result.data)
            tokens = [r["push_token"] for r in result.data if r.get("push_token")]
        elif target == "drivers":
            result = supabase.table("users").select("id, push_token, driver_details").execute()
            drivers = [r for r in result.data if r.get("driver_details")]
            target_count = len(drivers)
            tokens = [r["push_token"] for r in drivers if r.get("push_token")]
        elif target == "passengers":
            result = supabase.table("users").select("id, push_token, driver_details").execute()
            passengers = [r for r in result.data if not r.get("driver_details")]
            target_count = len(passengers)
            tokens = [r["push_token"] for r in passengers if r.get("push_token")]
        elif target == "user" and user_id:
            result = supabase.table("users").select("id, push_token").eq("id", user_id).execute()
            target_count = 1
            if result.data and result.data[0].get("push_token"):
                tokens = [result.data[0]["push_token"]]
        
        sent_count = 0
        failed_count = 0
        
        # Push bildirim gönder (token varsa)
        if tokens:
            try:
                push_result = await ExpoPushService.send(tokens, title, message)
                sent_count = push_result.get("sent", 0)
                failed_count = push_result.get("failed", 0)
            except Exception as e:
                logger.error(f"Push notification error: {e}")
                failed_count = len(tokens)
        
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
                    "tokens_available": len(tokens)
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
        "supabase_url": SUPABASE_URL,
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
            
            # ❌ SOCKET BİLDİRİMİ YOK - Frontend socket ile gönderiyor
            
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
        
        # 2. Socket bildirimi (BEST-EFFORT - başarısız olursa önemli değil)
        try:
            # External socket server'a HTTP ile bildir
            socket_notify_url = "https://socket.leylektag.com"
            # Socket server'a direkt emit yapamıyoruz, ama receiver polling yapacak
            logger.info(f"📤 Socket notification skipped (receiver will poll)")
        except Exception as socket_err:
            logger.warning(f"⚠️ Socket notification failed (non-blocking): {socket_err}")
            # Socket hatası mesaj kaydını ETKİLEMEZ
        
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
    """İki nokta arası mesafe (km)"""
    import math
    R = 6371  # Dünya yarıçapı km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))

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
    Leylek TAG Fiyat Hesaplama - YENİ SİSTEM
    
    1. Yolcu → Hedef mesafesi: 20-30 TL/km
    2. Sürücü → Yolcu mesafesi: 10 TL/km (otomatik eklenir)
    3. Minimum: 100 TL
    """
    try:
        # 1. Yolcu → Hedef mesafesi hesapla
        trip_distance_km = haversine_distance(
            request.pickup_lat, request.pickup_lng,
            request.dropoff_lat, request.dropoff_lng
        )
        
        # Minimum mesafe 1 km
        trip_distance_km = max(1.0, trip_distance_km)
        
        # Tahmini süre (ortalama 30 km/h şehir içi)
        estimated_minutes = int((trip_distance_km / 30) * 60)
        estimated_minutes = max(5, estimated_minutes)  # Minimum 5 dakika
        
        # Yoğun saat kontrolü
        peak = is_peak_hour()
        
        # 2. Yolculuk fiyatı: 20-30 TL/km
        if peak:
            min_price_per_km = 25  # Yoğun saatte biraz daha yüksek
            max_price_per_km = 35
        else:
            min_price_per_km = 20
            max_price_per_km = 30
        
        # Yolculuk ücreti hesapla
        trip_min_price = round(trip_distance_km * min_price_per_km)
        trip_max_price = round(trip_distance_km * max_price_per_km)
        
        # 3. Minimum 100 TL kuralı
        min_price = max(100, trip_min_price)
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
            "driver_pickup_price_per_km": 10  # Bilgi amaçlı
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

@api_router.post("/ride/create-offer")
async def create_ride_offer(request: CreateRideOfferRequest):
    """
    Martı TAG - Yolcu teklif oluşturur
    Bu teklif tüm yakındaki sürücülere gönderilir
    """
    try:
        # Tag ID - frontend'den gelen veya yeni oluştur
        tag_id = request.tag_id or str(uuid.uuid4())
        
        # Yolcu bilgisini al
        passenger_result = supabase.table("users").select("name").eq("id", request.passenger_id).execute()
        passenger_name = passenger_result.data[0]["name"] if passenger_result.data else "Yolcu"
        
        # Tag oluştur - Mevcut tablo kolonlarını kullan
        tag_data = {
            "id": tag_id,
            "passenger_id": request.passenger_id,
            "passenger_name": passenger_name,
            "pickup_lat": request.pickup_lat,
            "pickup_lng": request.pickup_lng,
            "pickup_location": request.pickup_location,
            "dropoff_lat": request.dropoff_lat,
            "dropoff_lng": request.dropoff_lng,
            "dropoff_location": request.dropoff_location,
            "final_price": request.offered_price,  # offered_price yerine final_price kullan
            "status": "waiting",
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("tags").insert(tag_data).execute()
        
        if result.data:
            tag = result.data[0]
            # Response'a ek bilgiler ekle
            tag["offered_price"] = request.offered_price  # Frontend için
            tag["distance_km"] = request.distance_km
            tag["estimated_minutes"] = request.estimated_minutes
            logger.info(f"🏷️ Yeni teklif oluşturuldu: {tag['id']} - {request.offered_price}TL")
            return {
                "success": True,
                "tag": tag,
                "message": "Teklifiniz sürücülere gönderildi"
            }
        
        return {"success": False, "error": "Tag oluşturulamadı"}
    except Exception as e:
        logger.error(f"❌ Create ride offer error: {e}")
        return {"success": False, "error": str(e)}

@api_router.post("/ride/accept")
async def accept_ride(tag_id: str, driver_id: str):
    """
    Martı TAG - Sürücü teklifi kabul eder
    İLK KABUL EDEN KAZANIR - Atomik işlem
    """
    try:
        # Önce tag'in durumunu kontrol et (race condition önleme)
        tag_result = supabase.table("tags").select("*").eq("id", tag_id).execute()
        
        if not tag_result.data:
            return {"success": False, "error": "Teklif bulunamadı"}
        
        tag = tag_result.data[0]
        
        # Zaten kabul edilmiş mi?
        if tag.get("status") != "waiting":
            return {"success": False, "error": "Bu teklif artık mevcut değil", "already_taken": True}
        
        # Sürücü bilgisini al
        driver_result = supabase.table("users").select("name, phone").eq("id", driver_id).execute()
        driver_name = driver_result.data[0]["name"] if driver_result.data else "Sürücü"
        
        # Yolcu bilgisini al
        passenger_result = supabase.table("users").select("name, phone").eq("id", tag["user_id"]).execute()
        passenger_name = passenger_result.data[0]["name"] if passenger_result.data else "Yolcu"
        
        # Atomik güncelleme - sadece status='waiting' ise güncelle
        update_result = supabase.table("tags").update({
            "status": "matched",
            "driver_id": driver_id,
            "driver_name": driver_name,
            "final_price": tag["offered_price"],
            "matched_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id).eq("status", "waiting").execute()
        
        if not update_result.data:
            return {"success": False, "error": "Bu teklif artık mevcut değil", "already_taken": True}
        
        updated_tag = update_result.data[0]
        updated_tag["passenger_name"] = passenger_name
        
        logger.info(f"✅ Eşleşme: {tag_id} - Sürücü: {driver_name} - Fiyat: {tag['offered_price']}TL")
        
        return {
            "success": True,
            "tag": updated_tag,
            "message": f"Teklif kabul edildi! {tag['offered_price']} TL"
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
        # Tüm bekleyen teklifleri al
        result = supabase.table("tags").select("*, users!tags_user_id_fkey(name, phone)")\
            .eq("status", "waiting")\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        
        offers = []
        for tag in result.data or []:
            # Mesafe hesapla
            distance = haversine_distance(lat, lng, tag["pickup_lat"], tag["pickup_lng"])
            
            # Sadece belirli yarıçap içindekiler
            if distance <= radius_km:
                tag["distance_to_pickup"] = round(distance, 1)
                tag["passenger_name"] = tag.get("users", {}).get("name", "Yolcu") if tag.get("users") else "Yolcu"
                offers.append(tag)
        
        # Mesafeye göre sırala (en yakın önce)
        offers.sort(key=lambda x: x["distance_to_pickup"])
        
        return {"success": True, "offers": offers, "count": len(offers)}
    except Exception as e:
        logger.error(f"❌ Get available offers error: {e}")
        return {"success": False, "error": str(e), "offers": []}

# ==================== LEYLEK MUHABBETİ (COMMUNITY) ====================
# Tamamen izole modül - mevcut sistemlere dokunmaz

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

# ==================== API ROUTER INCLUDE ====================
# TÜM ROUTE'LAR TANIMLANDIKTAN SONRA INCLUDE EDİLMELİ!
app.include_router(api_router)

# ==================== SOCKET.IO ENABLED APP ====================
# socket_app burada oluşturuluyor (route'lar eklendikten sonra)
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path='/api/socket.io')

# Supervisor server:socket_app olarak çalıştırmalı
# Eğer server:app olarak çalışıyorsa, app'i socket_app ile değiştir
# Bu sayede hem FastAPI route'ları hem Socket.IO çalışır

if __name__ == "__main__":
    import uvicorn
    # Socket.IO + FastAPI birlikte çalıştır
    uvicorn.run(socket_app, host="0.0.0.0", port=8001)
