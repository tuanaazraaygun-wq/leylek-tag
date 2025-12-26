"""
Leylek TAG - Supabase Backend
Full PostgreSQL Backend with Supabase
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import logging
from pathlib import Path
from datetime import datetime, timedelta
import secrets
import base64
import hashlib
import httpx
import json
import time

# Supabase
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

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

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

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

# Son temizlik zamanı (global)
last_cleanup_time = None

@app.on_event("startup")
async def startup():
    global last_cleanup_time
    init_supabase()
    last_cleanup_time = datetime.utcnow()
    logger.info("✅ Server started with Supabase")

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
        # OSRM Public API
        url = f"https://router.project-osrm.org/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=false"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10)
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
        logger.error(f"OSRM error: {e}")
    
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

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOtpBodyRequest = None, phone: str = None):
    """OTP gönder - TR numara kontrolü ile"""
    # Body veya query param'dan al
    phone_number = None
    if request and request.phone:
        phone_number = request.phone
    elif phone:
        phone_number = phone
    
    if not phone_number:
        raise HTTPException(status_code=422, detail="Telefon numarası gerekli")
    
    # TR numara doğrulama
    is_valid, result = validate_turkish_phone(phone_number)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    
    cleaned_phone = result  # Temizlenmiş numara
    
    # TODO: NetGSM entegrasyonu - şimdilik mock
    # netgsm_api_key = os.getenv("NETGSM_API_KEY")
    # if netgsm_api_key:
    #     otp_code = str(random.randint(100000, 999999))
    #     send_sms_via_netgsm(cleaned_phone, f"Leylek TAG doğrulama kodunuz: {otp_code}")
    # else:
    otp_code = "123456"  # Test modu
    
    logger.info(f"📱 OTP gönderildi: {cleaned_phone} -> {otp_code}")
    return {"success": True, "message": "OTP gönderildi", "dev_otp": otp_code}

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
    
    # Mock OTP kontrolü
    if otp_code != "123456":
        raise HTTPException(status_code=400, detail="Geçersiz OTP")
    
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
            "rating": 5.0,
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
    """Aktif TAG getir"""
    try:
        # Arka planda inaktif TAG'leri temizle
        await auto_cleanup_inactive_tags()
        
        # passenger_id veya user_id kabul et
        uid = passenger_id or user_id
        if not uid:
            return {"success": False, "tag": None, "detail": "user_id gerekli"}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(uid)
        
        result = supabase.table("tags").select("*").eq("passenger_id", resolved_id).in_("status", ["pending", "offers_received", "matched", "in_progress"]).order("created_at", desc=True).limit(1).execute()
        
        if result.data:
            return {"success": True, "tag": result.data[0]}
        
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
async def accept_offer(request: AcceptOfferRequest = None, user_id: str = None, passenger_id: str = None, offer_id: str = None):
    """Teklifi kabul et"""
    try:
        # Body veya query param'dan al
        oid = request.offer_id if request else offer_id
        if not oid:
            raise HTTPException(status_code=422, detail="offer_id gerekli")
        
        # Teklifi getir
        offer_result = supabase.table("offers").select("*").eq("id", oid).execute()
        if not offer_result.data:
            raise HTTPException(status_code=404, detail="Teklif bulunamadı")
        
        offer = offer_result.data[0]
        tag_id = offer["tag_id"]
        driver_id = offer["driver_id"]
        
        # Şoför bilgisi
        driver_result = supabase.table("users").select("name").eq("id", driver_id).execute()
        driver_name = driver_result.data[0]["name"] if driver_result.data else "Şoför"
        
        # Teklifi kabul et
        supabase.table("offers").update({"status": "accepted"}).eq("id", oid).execute()
        
        # Diğer teklifleri reddet
        supabase.table("offers").update({"status": "rejected"}).eq("tag_id", tag_id).neq("id", oid).execute()
        
        # TAG'i güncelle
        supabase.table("tags").update({
            "status": "matched",
            "driver_id": driver_id,
            "driver_name": driver_name,
            "accepted_offer_id": oid,
            "final_price": offer["price"],
            "matched_at": datetime.utcnow().isoformat()
        }).eq("id", tag_id).execute()
        
        logger.info(f"✅ Teklif kabul edildi: {oid}")
        return {"success": True, "message": "Teklif kabul edildi", "driver_id": driver_id}
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
        
        # Pending TAG'leri getir - Şehir filtresi SQL'de
        if driver_city:
            # Aynı şehirdeki tüm teklifleri getir
            result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, rating, profile_photo, city)").in_("status", ["pending", "offers_received"]).order("created_at", desc=True).limit(100).execute()
        else:
            result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, rating, profile_photo, city)").in_("status", ["pending", "offers_received"]).order("created_at", desc=True).limit(50).execute()
        
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
    """Teklif gönder"""
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
        
        # 3 DAKİKA COOLDOWN - Aynı şoför aynı TAG'e 3 dk içinde tekrar teklif veremez
        from datetime import datetime, timedelta
        three_min_ago = (datetime.utcnow() - timedelta(minutes=3)).isoformat()
        existing_offer = supabase.table("offers").select("id, created_at").eq("driver_id", resolved_id).eq("tag_id", tid).gte("created_at", three_min_ago).execute()
        if existing_offer.data:
            raise HTTPException(status_code=429, detail="Bu yolcuya 3 dakika içinde zaten teklif verdiniz. Lütfen bekleyin.")
        
        # Şoför bilgisi
        driver_result = supabase.table("users").select("name, rating, profile_photo, driver_details").eq("id", resolved_id).execute()
        if not driver_result.data:
            raise HTTPException(status_code=404, detail="Şoför bulunamadı")
        
        driver = driver_result.data[0]
        
        # TAG bilgisi
        tag_result = supabase.table("tags").select("*").eq("id", tid).execute()
        if not tag_result.data:
            raise HTTPException(status_code=404, detail="TAG bulunamadı")
        
        tag = tag_result.data[0]
        
        # Mesafe ve süre hesapla
        distance_to_passenger = None
        estimated_arrival = None
        trip_distance = None
        trip_duration = None
        
        if lat and lng and tag.get("pickup_lat"):
            # Şoför -> Yolcu
            route1 = await get_route_info(lat, lng, float(tag["pickup_lat"]), float(tag["pickup_lng"]))
            if route1:
                distance_to_passenger = route1["distance_km"]
                estimated_arrival = route1["duration_min"]
            
            # Yolcu -> Varış
            if tag.get("dropoff_lat"):
                route2 = await get_route_info(float(tag["pickup_lat"]), float(tag["pickup_lng"]), float(tag["dropoff_lat"]), float(tag["dropoff_lng"]))
                if route2:
                    trip_distance = route2["distance_km"]
                    trip_duration = route2["duration_min"]
        
        # Teklif oluştur
        offer_data = {
            "tag_id": tid,
            "driver_id": resolved_id,
            "driver_name": driver["name"],
            "driver_rating": float(driver.get("rating", 5.0)),
            "driver_photo": driver.get("profile_photo"),
            "price": p,
            "notes": n,
            "status": "pending",
            "distance_to_passenger_km": round(distance_to_passenger, 2) if distance_to_passenger else None,
            "estimated_arrival_min": round(estimated_arrival) if estimated_arrival else None,
            "trip_distance_km": round(trip_distance, 2) if trip_distance else None,
            "trip_duration_min": round(trip_duration) if trip_duration else None
        }
        
        if driver.get("driver_details"):
            offer_data["vehicle_model"] = driver["driver_details"].get("vehicle_model")
            offer_data["vehicle_color"] = driver["driver_details"].get("vehicle_color")
            offer_data["vehicle_photo"] = driver["driver_details"].get("vehicle_photo")
        
        result = supabase.table("offers").insert(offer_data).execute()
        
        # TAG durumunu güncelle
        supabase.table("tags").update({"status": "offers_received"}).eq("id", tid).execute()
        
        logger.info(f"📤 Teklif gönderildi: {resolved_id} -> {tid}")
        return {"success": True, "offer_id": result.data[0]["id"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send offer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/driver/active-trip")
async def get_driver_active_trip(driver_id: str = None, user_id: str = None):
    """Şoförün aktif yolculuğu"""
    try:
        # driver_id veya user_id kabul et
        did = driver_id or user_id
        if not did:
            return {"success": True, "trip": None, "tag": None}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone, rating, profile_photo)").eq("driver_id", resolved_id).in_("status", ["matched", "in_progress"]).order("matched_at", desc=True).limit(1).execute()
        
        if result.data:
            tag = result.data[0]
            passenger_info = tag.get("users", {}) or {}
            
            tag_data = {
                "id": tag["id"],
                "passenger_id": tag["passenger_id"],
                "passenger_name": passenger_info.get("name"),
                "passenger_phone": passenger_info.get("phone"),
                "passenger_rating": float(passenger_info.get("rating", 5.0)),
                "passenger_photo": passenger_info.get("profile_photo"),
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

# Agora credentials
AGORA_APP_ID = os.getenv("AGORA_APP_ID", "")
AGORA_APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE", "")

def generate_agora_token(channel_name: str, uid: int = 0, expiration_seconds: int = 3600) -> str:
    """Agora RTC token üret"""
    if not AGORA_TOKEN_AVAILABLE or not AGORA_APP_CERTIFICATE:
        logger.warning("⚠️ Agora token üretilemiyor - certificate eksik veya library yok")
        return ""
    
    try:
        # Token süresi (Unix timestamp)
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

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
