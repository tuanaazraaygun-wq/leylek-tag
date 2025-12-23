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

# Supabase
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

# ==================== CONFIG ====================
MAX_DISTANCE_KM = 50
ADMIN_PHONE_NUMBERS = ["5326497412", "5551234567"]
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

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

@app.on_event("startup")
async def startup():
    init_supabase()
    logger.info("✅ Server started with Supabase")

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

async def get_route_info(origin_lat, origin_lng, dest_lat, dest_lng):
    """Google Directions API ile rota bilgisi al"""
    if not GOOGLE_MAPS_API_KEY:
        return None
    
    try:
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "mode": "driving",
            "departure_time": "now",
            "traffic_model": "best_guess",
            "key": GOOGLE_MAPS_API_KEY
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            data = response.json()
            
            if data.get("status") == "OK" and data.get("routes"):
                leg = data["routes"][0]["legs"][0]
                return {
                    "distance_km": leg["distance"]["value"] / 1000,
                    "duration_min": leg.get("duration_in_traffic", leg["duration"])["value"] / 60,
                    "distance_text": leg["distance"]["text"],
                    "duration_text": leg.get("duration_in_traffic", leg["duration"])["text"]
                }
    except Exception as e:
        logger.error(f"Route info error: {e}")
    
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
    """OTP gönder (şimdilik mock)"""
    # Body veya query param'dan al
    phone_number = None
    if request and request.phone:
        phone_number = request.phone
    elif phone:
        phone_number = phone
    
    if not phone_number:
        raise HTTPException(status_code=422, detail="Phone gerekli")
    
    logger.info(f"📱 OTP gönderildi (mock): {phone_number} -> 123456")
    return {"success": True, "message": "OTP gönderildi", "dev_otp": "123456"}

class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str

@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOtpRequest = None, phone: str = None, otp: str = None):
    """OTP doğrula"""
    # Body veya query param'dan al
    phone_number = request.phone if request else phone
    otp_code = request.otp if request else otp
    
    if not phone_number or not otp_code:
        raise HTTPException(status_code=422, detail="Phone ve OTP gerekli")
    
    # Mock OTP kontrolü
    if otp_code != "123456":
        raise HTTPException(status_code=400, detail="Geçersiz OTP")
    
    return {"success": True, "message": "OTP doğrulandı"}

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

# Frontend uyumluluğu için alias
@api_router.post("/passenger/create-request")
async def create_request_alias(request: CreateTagRequest, user_id: str = None):
    """Yolcu TAG oluştur (alias)"""
    return await create_tag(request, user_id)

@api_router.get("/passenger/active-tag")
async def get_active_tag(passenger_id: str = None, user_id: str = None):
    """Aktif TAG getir"""
    try:
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
    """TAG için gelen teklifleri getir"""
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
    """Şoför için yakındaki istekleri getir"""
    try:
        # driver_id veya user_id kabul et
        did = driver_id or user_id
        if not did:
            return {"success": False, "requests": [], "detail": "driver_id veya user_id gerekli"}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        # Ayarlardan radius al
        settings_result = supabase.table("app_settings").select("driver_radius_km").eq("type", "global").execute()
        radius_km = settings_result.data[0]["driver_radius_km"] if settings_result.data else 50
        
        # Engellenen kullanıcıları al
        blocked_result = supabase.table("blocked_users").select("blocked_user_id").eq("user_id", resolved_id).execute()
        blocked_ids = [r["blocked_user_id"] for r in blocked_result.data]
        
        # Beni engelleyenleri al
        blocked_by_result = supabase.table("blocked_users").select("user_id").eq("blocked_user_id", resolved_id).execute()
        blocked_by_ids = [r["user_id"] for r in blocked_by_result.data]
        
        all_blocked = list(set(blocked_ids + blocked_by_ids))
        
        # Pending TAG'leri getir
        result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, rating, profile_photo)").in_("status", ["pending", "offers_received"]).order("created_at", desc=True).limit(50).execute()
        
        requests = []
        for tag in result.data:
            # Engelli kontrolü
            if tag.get("passenger_id") in all_blocked:
                continue
            
            # Mesafe hesapla
            distance_km = None
            duration_min = None
            
            if latitude and longitude and tag.get("pickup_lat") and tag.get("pickup_lng"):
                route_info = await get_route_info(
                    latitude, longitude,
                    float(tag["pickup_lat"]), float(tag["pickup_lng"])
                )
                if route_info:
                    distance_km = route_info["distance_km"]
                    duration_min = route_info["duration_min"]
                    
                    # Radius kontrolü
                    if distance_km > radius_km:
                        continue
            
            passenger_info = tag.get("users", {}) or {}
            requests.append({
                "id": tag["id"],
                "passenger_id": tag["passenger_id"],
                "passenger_name": passenger_info.get("name", tag.get("passenger_name", "Yolcu")),
                "passenger_rating": float(passenger_info.get("rating", 5.0)),
                "passenger_photo": passenger_info.get("profile_photo"),
                "pickup_location": tag["pickup_location"],
                "pickup_lat": float(tag["pickup_lat"]) if tag.get("pickup_lat") else None,
                "pickup_lng": float(tag["pickup_lng"]) if tag.get("pickup_lng") else None,
                "dropoff_location": tag["dropoff_location"],
                "dropoff_lat": float(tag["dropoff_lat"]) if tag.get("dropoff_lat") else None,
                "dropoff_lng": float(tag["dropoff_lng"]) if tag.get("dropoff_lng") else None,
                "notes": tag.get("notes"),
                "status": tag["status"],
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
            return {"success": True, "trip": None}
        
        # MongoDB ID'yi UUID'ye çevir
        resolved_id = await resolve_user_id(did)
        
        result = supabase.table("tags").select("*, users!tags_passenger_id_fkey(name, phone, rating, profile_photo)").eq("driver_id", resolved_id).in_("status", ["matched", "in_progress"]).order("matched_at", desc=True).limit(1).execute()
        
        if result.data:
            tag = result.data[0]
            passenger_info = tag.get("users", {}) or {}
            
            return {
                "success": True,
                "trip": {
                    "id": tag["id"],
                    "passenger_id": tag["passenger_id"],
                    "passenger_name": passenger_info.get("name"),
                    "passenger_phone": passenger_info.get("phone"),
                    "passenger_rating": float(passenger_info.get("rating", 5.0)),
                    "passenger_photo": passenger_info.get("profile_photo"),
                    "pickup_location": tag["pickup_location"],
                    "dropoff_location": tag["dropoff_location"],
                    "status": tag["status"],
                    "final_price": float(tag["final_price"]) if tag.get("final_price") else None
                }
            }
        
        return {"success": True, "trip": None}
    except Exception as e:
        logger.error(f"Get driver active trip error: {e}")
        return {"success": False, "trip": None}

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
    except Exception as e:
        logger.error(f"Complete trip error: {e}")
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
    """Push bildirim gönder"""
    try:
        if admin_phone not in ADMIN_PHONE_NUMBERS:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        tokens = []
        
        if target == "all":
            result = supabase.table("users").select("push_token").not_.is_("push_token", "null").execute()
            tokens = [r["push_token"] for r in result.data if r.get("push_token")]
        elif target == "drivers":
            result = supabase.table("users").select("push_token, driver_details").not_.is_("push_token", "null").execute()
            tokens = [r["push_token"] for r in result.data if r.get("push_token") and r.get("driver_details")]
        elif target == "passengers":
            result = supabase.table("users").select("push_token, driver_details").not_.is_("push_token", "null").execute()
            tokens = [r["push_token"] for r in result.data if r.get("push_token") and not r.get("driver_details")]
        elif target == "user" and user_id:
            result = supabase.table("users").select("push_token").eq("id", user_id).execute()
            if result.data and result.data[0].get("push_token"):
                tokens = [result.data[0]["push_token"]]
        
        # Bildirim gönder
        push_result = await ExpoPushService.send(tokens, title, message)
        
        # Kaydet
        supabase.table("notifications").insert({
            "title": title,
            "message": message,
            "target": target,
            "push_sent": push_result["sent"],
            "push_failed": push_result["failed"]
        }).execute()
        
        return {
            "success": True,
            "sent_count": push_result["sent"],
            "failed_count": push_result["failed"]
        }
    except Exception as e:
        logger.error(f"Admin send notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
