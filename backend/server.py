"""
Leylek TAG - Full Featured Backend
MongoDB (Supabase'e geçiş için hazır)
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from bson import ObjectId
from datetime import datetime, timedelta
import secrets
import base64
from geopy.distance import geodesic

# Import models
from models import *
from database import db_instance

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

# ==================== CONFIG ====================
MAX_DISTANCE_KM = 50  # Admin ayarı: Maksimum mesafe (km) - Google Play/Apple onaylı
OFFER_EXPIRY_MINUTES = 10  # Teklif 10 dakika sonra otomatik silinir

# ==================== HELPER FUNCTIONS ====================
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """İki nokta arasındaki mesafeyi km cinsinden hesapla"""
    try:
        return geodesic((lat1, lng1), (lat2, lng2)).km
    except Exception as e:
        logger.error(f"Mesafe hesaplama hatası: {e}")
        return 0.0

import httpx

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

async def get_route_info(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """Google Directions API ile gerçek mesafe ve süre hesapla"""
    try:
        if not GOOGLE_MAPS_API_KEY:
            # API key yoksa düz çizgi mesafe hesapla
            dist = calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
            dur = round((dist / 40) * 60)  # 40 km/h ortalama
            return {"distance_km": round(dist, 1), "duration_min": dur, "source": "estimated"}
        
        url = f"https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "key": GOOGLE_MAPS_API_KEY,
            "mode": "driving",
            "language": "tr"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            data = response.json()
        
        if data.get("status") == "OK" and data.get("routes"):
            route = data["routes"][0]
            leg = route["legs"][0]
            
            distance_km = leg["distance"]["value"] / 1000
            duration_min = round(leg["duration"]["value"] / 60)
            
            return {
                "distance_km": round(distance_km, 1),
                "duration_min": duration_min,
                "source": "google"
            }
        else:
            # API hatası - fallback (yol katsayısı ile)
            straight_dist = calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
            dist = straight_dist * 1.8  # Şehir içi yollar düz çizginin ~1.8 katı
            dur = round((dist / 30) * 60)  # Şehir içi ortalama 30 km/h
            return {"distance_km": round(dist, 1), "duration_min": dur, "source": "estimated"}
            
    except Exception as e:
        logger.error(f"Route API hatası: {e}")
        dist = calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
        dur = round((dist / 40) * 60)
        return {"distance_km": round(dist, 1), "duration_min": dur, "source": "estimated"}


def get_city_from_coords(lat: float, lng: float) -> str:
    """Koordinattan şehir adı çıkar (basitleştirilmiş)"""
    # Türkiye'nin önemli şehirleri ve yaklaşık koordinatları
    cities = {
        "Ankara": (39.9334, 32.8597),
        "İstanbul": (41.0082, 28.9784),
        "İzmir": (38.4237, 27.1428),
        "Antalya": (36.8969, 30.7133),
        "Adana": (37.0000, 35.3213),
        "Bursa": (40.1826, 29.0665),
        "Gaziantep": (37.0662, 37.3833),
        "Konya": (37.8746, 32.4932),
    }
    
    # En yakın şehri bul
    min_distance = float('inf')
    closest_city = "Diğer"
    
    for city, (city_lat, city_lng) in cities.items():
        distance = calculate_distance(lat, lng, city_lat, city_lng)
        if distance < min_distance:
            min_distance = distance
            closest_city = city
    
    # 50 km'den yakınsa o şehir, değilse "Diğer"
    return closest_city if min_distance < 50 else "Diğer"


# Create app
app = FastAPI(title="Leylek TAG API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# ==================== STARTUP/SHUTDOWN ====================
@app.on_event("startup")
async def startup_db():
    await db_instance.connect()
    logger.info("✅ Database connected")

@app.on_event("shutdown")
async def shutdown_db():
    await db_instance.disconnect()
    logger.info("❌ Database disconnected")

# ==================== AUTH ENDPOINTS ====================
@api_router.get("/auth/cities")
async def get_cities():
    """Türkiye şehirlerini getir"""
    return {
        "success": True,
        "cities": TURKIYE_SEHIRLERI
    }

@api_router.post("/user/update-location")
async def update_location(user_id: str, latitude: float, longitude: float):
    """Kullanıcı konumunu güncelle"""
    try:
        await db_instance.update_one(
            "users",
            {"_id": ObjectId(user_id)},
            {"$set": {
                "location": {
                    "type": "Point",
                    "coordinates": [longitude, latitude],  # GeoJSON format: [lng, lat]
                    "latitude": latitude,
                    "longitude": longitude
                },
                "last_active": datetime.utcnow()
            }}
        )
        return {"success": True, "message": "Konum güncellendi"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/check-user")
async def check_user(request: SendOTPRequest):
    """
    Kullanıcı kayıtlı mı kontrol et
    Kayıtlıysa: OTP gönder ve giriş akışına yönlendir
    Kayıtlı değilse: Kayıt ol ekranına yönlendir
    """
    try:
        db = db_instance.db
        phone = request.phone.replace(" ", "").replace("-", "")
        
        # Kullanıcıyı bul
        user = await db.users.find_one({"phone": phone})
        
        if user:
            # Kullanıcı kayıtlı - OTP gönder (NetGSM sonra)
            # TODO: NetGSM entegrasyonu
            logger.info(f"📱 GİRİŞ OTP gönderildi: {phone} -> 123456 (MOCK)")
            
            # Giriş denemesi logla
            await db.login_attempts.insert_one({
                "phone": phone,
                "user_id": str(user["_id"]),
                "device_id": getattr(request, 'device_id', None),
                "attempt_type": "login",
                "timestamp": datetime.utcnow(),
                "ip_address": None  # Request'ten alınabilir
            })
            
            return {
                "success": True,
                "user_exists": True,
                "has_pin": user.get("pin_hash") is not None,
                "message": "OTP gönderildi (Test: 123456)",
                "user_name": user.get("name", "")
            }
        else:
            # Kullanıcı kayıtlı değil - Kayıt ol ekranına yönlendir
            return {
                "success": True,
                "user_exists": False,
                "message": "Kayıtlı kullanıcı bulunamadı. Lütfen kayıt olun."
            }
    except Exception as e:
        logger.error(f"Check user hatası: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOTPRequest):
    """
    SMS gönderme - Şimdilik mock, NetGSM entegrasyonu sonra
    """
    # TODO: NetGSM entegrasyonu
    logger.info(f"📱 OTP gönderildi: {request.phone} -> 123456 (MOCK)")
    
    return {
        "success": True,
        "message": "OTP gönderildi (Test: 123456)",
        "phone": request.phone
    }

class RegisterRequest(BaseModel):
    phone: str
    first_name: str
    last_name: str
    city: str
    pin: str
    device_id: str = None

@api_router.post("/auth/register")
async def register_user(request: RegisterRequest):
    """
    Yeni kullanıcı kaydı
    """
    try:
        db = db_instance.db
        phone = request.phone.replace(" ", "").replace("-", "")
        first_name = request.first_name
        last_name = request.last_name
        city = request.city
        pin = request.pin
        device_id = request.device_id
        
        # Telefon zaten kayıtlı mı?
        existing = await db.users.find_one({"phone": phone})
        if existing:
            return {"success": False, "detail": "Bu telefon numarası zaten kayıtlı"}
        
        # PIN hash'le (basit hash - production'da bcrypt kullanılmalı)
        import hashlib
        pin_hash = hashlib.sha256(pin.encode()).hexdigest()
        
        # Kullanıcı oluştur
        user_data = {
            "phone": phone,
            "name": f"{first_name} {last_name}",
            "first_name": first_name,
            "last_name": last_name,
            "city": city,
            "pin_hash": pin_hash,
            "device_ids": [device_id] if device_id else [],
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
            "is_active": True,
            "blocked_users": []
        }
        
        result = await db.users.insert_one(user_data)
        user_data["id"] = str(result.inserted_id)
        user_data.pop("_id", None)
        user_data.pop("pin_hash", None)
        
        logger.info(f"✅ Yeni kullanıcı kaydı: {phone} - {first_name} {last_name}")
        
        return {
            "success": True,
            "message": "Kayıt başarılı",
            "user": user_data
        }
    except Exception as e:
        logger.error(f"Register hatası: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/auth/verify-pin")
async def verify_pin(phone: str, pin: str, device_id: str = None):
    """
    6 haneli PIN doğrulama
    """
    try:
        db = db_instance.db
        phone = phone.replace(" ", "").replace("-", "")
        
        user = await db.users.find_one({"phone": phone})
        if not user:
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        # PIN kontrolü
        import hashlib
        pin_hash = hashlib.sha256(pin.encode()).hexdigest()
        
        if user.get("pin_hash") != pin_hash:
            # Yanlış PIN - logla
            await db.login_attempts.insert_one({
                "phone": phone,
                "user_id": str(user["_id"]),
                "device_id": device_id,
                "attempt_type": "wrong_pin",
                "timestamp": datetime.utcnow()
            })
            return {"success": False, "detail": "Yanlış şifre"}
        
        # Cihaz kontrolü
        user_devices = user.get("device_ids", [])
        is_new_device = device_id and device_id not in user_devices
        
        if is_new_device:
            # Yeni cihazı kaydet
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$addToSet": {"device_ids": device_id}}
            )
            logger.info(f"🔐 Yeni cihaz eklendi: {phone} - {device_id}")
        
        # Son giriş güncelle
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        # Başarılı giriş logla
        await db.login_attempts.insert_one({
            "phone": phone,
            "user_id": str(user["_id"]),
            "device_id": device_id,
            "attempt_type": "success",
            "is_new_device": is_new_device,
            "timestamp": datetime.utcnow()
        })
        
        user_data = {
            "id": str(user["_id"]),
            "phone": user["phone"],
            "name": user.get("name", ""),
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "city": user.get("city", "")
        }
        
        return {
            "success": True,
            "message": "Giriş başarılı",
            "user": user_data,
            "is_new_device": is_new_device
        }
    except Exception as e:
        logger.error(f"Verify PIN hatası: {e}")
        return {"success": False, "detail": str(e)}

@api_router.post("/auth/set-pin")
async def set_pin(phone: str, new_pin: str):
    """
    6 haneli PIN belirleme/değiştirme
    """
    try:
        db = db_instance.db
        phone = phone.replace(" ", "").replace("-", "")
        
        if len(new_pin) != 6 or not new_pin.isdigit():
            return {"success": False, "detail": "PIN 6 haneli rakam olmalıdır"}
        
        import hashlib
        pin_hash = hashlib.sha256(new_pin.encode()).hexdigest()
        
        result = await db.users.update_one(
            {"phone": phone},
            {"$set": {"pin_hash": pin_hash}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "detail": "Kullanıcı bulunamadı"}
        
        logger.info(f"🔐 PIN güncellendi: {phone}")
        return {"success": True, "message": "Şifre başarıyla belirlendi"}
    except Exception as e:
        logger.error(f"Set PIN hatası: {e}")
        return {"success": False, "detail": str(e)}

@api_router.get("/auth/login-attempts")
async def get_login_attempts(phone: str, limit: int = 10):
    """
    Giriş denemelerini getir (güvenlik için)
    """
    try:
        db = db_instance.db
        attempts = await db.login_attempts.find(
            {"phone": phone}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        for a in attempts:
            a["id"] = str(a.pop("_id"))
            a["timestamp"] = a["timestamp"].isoformat()
        
        return {"success": True, "attempts": attempts}
    except Exception as e:
        return {"success": False, "detail": str(e)}

@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """OTP doğrulama + IP ban kontrolü"""
    # TODO: Gerçek IP adresi almak için: request.client.host
    # Şimdilik mock IP kullanacağız
    client_ip = "127.0.0.1"  # request.client.host  
    
    # IP ban kontrolü
    failed_attempt = await db_instance.find_one("failed_login_attempts", {"ip_address": client_ip})
    if failed_attempt and failed_attempt.get("is_banned"):
        raise HTTPException(status_code=403, detail="IP adresiniz yasaklandı. Lütfen müşteri hizmetleri ile iletişime geçin.")
    
    # OTP doğrulama
    if request.otp != "123456":
        # Başarısız deneme kaydet
        if failed_attempt:
            new_count = failed_attempt.get("attempt_count", 0) + 1
            is_banned = new_count >= 10
            await db_instance.update_one(
                "failed_login_attempts",
                {"ip_address": client_ip},
                {
                    "$set": {
                        "attempt_count": new_count,
                        "is_banned": is_banned,
                        "banned_at": datetime.utcnow() if is_banned else None,
                        "last_attempt": datetime.utcnow(),
                        "phone": request.phone
                    }
                }
            )
            if is_banned:
                logger.warning(f"🚫 IP BAN: {client_ip} (10+ başarısız deneme)")
                raise HTTPException(status_code=403, detail="Çok fazla başarısız deneme. IP adresiniz yasaklandı.")
        else:
            await db_instance.insert_one("failed_login_attempts", {
                "ip_address": client_ip,
                "phone": request.phone,
                "attempt_count": 1,
                "is_banned": False,
                "last_attempt": datetime.utcnow(),
                "created_at": datetime.utcnow()
            })
        
        raise HTTPException(status_code=400, detail="Geçersiz OTP")
    
    # Başarılı giriş - başarısız denemeleri sıfırla
    if failed_attempt:
        await db_instance.delete_one("failed_login_attempts", {"ip_address": client_ip})
    
    user = await db_instance.find_one("users", {"phone": request.phone})
    
    return {
        "success": True,
        "message": "OTP doğrulandı",
        "user_exists": user is not None,
        "user": UserResponse(
            id=str(user["_id"]),
            phone=user["phone"],
            name=user["name"],
            city=user.get("city", ""),
            profile_photo=user.get("profile_photo"),
            rating=user.get("rating", 5.0),
            total_ratings=user.get("total_ratings", 0),
            total_trips=user.get("total_trips", 0),
            driver_details=user.get("driver_details")
        ).dict() if user else None
    }

@api_router.get("/auth/user/{user_id}")
async def get_user(user_id: str):
    """Kullanıcı bilgisi"""
    user = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    return UserResponse(
        id=str(user["_id"]),
        phone=user["phone"],
        name=user["name"],
        city=user.get("city", ""),
        profile_photo=user.get("profile_photo"),
        rating=user.get("rating", 5.0),
        total_ratings=user.get("total_ratings", 0),
        total_trips=user.get("total_trips", 0),
        driver_details=user.get("driver_details")
    )

@api_router.put("/auth/user/{user_id}/profile")
async def update_profile(user_id: str, request: UpdateProfileRequest):
    """Profil güncelleme"""
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek veri yok")
    
    await db_instance.update_one(
        "users",
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Profil güncellendi"}

@api_router.put("/auth/user/{user_id}/driver-details")
async def update_driver_details(user_id: str, request: UpdateDriverDetailsRequest):
    """Sürücü bilgilerini güncelle"""
    user = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    driver_data = {k: v for k, v in request.dict().items() if v is not None}
    
    await db_instance.update_one(
        "users",
        {"_id": ObjectId(user_id)},
        {"$set": {"driver_details": driver_data}}
    )
    
    return {"success": True, "message": "Sürücü bilgileri güncellendi"}

# ==================== PASSENGER ENDPOINTS ====================
@api_router.post("/passenger/create-request")
async def create_request(user_id: str, request: CreateTagRequest):
    """Yolcu talebi oluştur"""
    user = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Aktif TAG kontrolü
    active_tag = await db_instance.find_one("tags", {
        "passenger_id": user_id,
        "status": {"$in": [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED, TagStatus.MATCHED, TagStatus.IN_PROGRESS]}
    })
    if active_tag:
        raise HTTPException(status_code=400, detail="Zaten aktif bir TAG'ınız var")
    
    # Share link oluştur
    share_token = secrets.token_urlsafe(16)
    share_link = f"leylektag://share/{share_token}"
    
    # Şehir bilgisini hesapla
    passenger_city = get_city_from_coords(request.pickup_lat, request.pickup_lng)
    
    tag_data = Tag(
        passenger_id=user_id,
        passenger_name=user["name"],
        pickup_location=request.pickup_location,
        dropoff_location=request.dropoff_location,
        pickup_lat=request.pickup_lat,
        pickup_lng=request.pickup_lng,
        dropoff_lat=request.dropoff_lat,
        dropoff_lng=request.dropoff_lng,
        notes=request.notes,
        share_link=share_link
    ).dict()
    
    # Şehir bilgisini ekle
    tag_data["city"] = passenger_city
    
    tag_id = await db_instance.insert_one("tags", tag_data)
    
    return {
        "success": True,
        "message": "Talep oluşturuldu",
        "tag": TagResponse(
            id=tag_id,
            **{k: v for k, v in tag_data.items() if k != "_id"}
        ).dict()
    }

@api_router.get("/passenger/offers/{tag_id}")
async def get_offers(tag_id: str, user_id: str):
    """
    Teklifleri listele
    - Expire olanları filtrele
    - EN DÜŞÜK FİYATTAN YÜKSEĞE SIRALA
    """
    from datetime import datetime, timedelta
    
    tag = await db_instance.find_one("tags", {"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["passenger_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    # Önce expire olanları sil
    await db_instance.db.offers.delete_many({
        "tag_id": tag_id,
        "expires_at": {"$lt": datetime.utcnow()}
    })
    
    # Sadece aktif teklifleri getir
    offers = await db_instance.find_many("offers", {
        "tag_id": tag_id,
        "expires_at": {"$gte": datetime.utcnow()}
    })
    
    offer_responses = []
    for offer in offers:
        offer_responses.append(OfferResponse(
            id=str(offer["_id"]),
            **{k: v for k, v in offer.items() if k != "_id"}
        ))
    
    # EN DÜŞÜK FİYATA GÖRE SIRALA
    offer_list = [o.dict() for o in offer_responses]
    offer_list.sort(key=lambda x: x.get("price", 999999))
    
    return {
        "success": True,
        "offers": offer_list
    }

@api_router.post("/passenger/accept-offer")
async def accept_offer(user_id: str, request: AcceptOfferRequest):
    """Teklif kabul et"""
    tag = await db_instance.find_one("tags", {"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["passenger_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    offer = await db_instance.find_one("offers", {"_id": ObjectId(request.offer_id), "tag_id": request.tag_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    
    # Şoförün konumunu al
    driver = await db_instance.find_one("users", {"_id": ObjectId(offer["driver_id"])})
    driver_location = None
    if driver and driver.get("location") and "coordinates" in driver.get("location", {}):
        driver_location = {
            "latitude": driver["location"]["coordinates"][1],
            "longitude": driver["location"]["coordinates"][0]
        }
    
    # Yolcunun konumunu al
    passenger = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    passenger_location = None
    if passenger and passenger.get("location") and "coordinates" in passenger.get("location", {}):
        passenger_location = {
            "latitude": passenger["location"]["coordinates"][1],
            "longitude": passenger["location"]["coordinates"][0]
        }
    
    # TAG güncelle
    await db_instance.update_one(
        "tags",
        {"_id": ObjectId(request.tag_id)},
        {"$set": {
            "status": TagStatus.MATCHED,
            "driver_id": offer["driver_id"],
            "driver_name": offer["driver_name"],
            "accepted_offer_id": request.offer_id,
            "final_price": offer["price"],
            "matched_at": datetime.utcnow(),
            "driver_location": driver_location,
            "passenger_location": passenger_location
        }}
    )
    
    # Teklifi kabul et
    await db_instance.update_one(
        "offers",
        {"_id": ObjectId(request.offer_id)},
        {"$set": {"status": OfferStatus.ACCEPTED}}
    )
    
    # Diğer teklifleri reddet
    await db_instance.update_many(
        "offers",
        {"tag_id": request.tag_id, "_id": {"$ne": ObjectId(request.offer_id)}},
        {"$set": {"status": OfferStatus.REJECTED}}
    )
    
    return {"success": True, "message": "Teklif kabul edildi, eşleşme başarılı!"}

@api_router.post("/passenger/cancel-tag")
async def cancel_tag(user_id: str, request: CancelTagRequest):
    """Yolcu çağrıyı iptal eder"""
    tag = await db_instance.find_one("tags", {"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["passenger_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    # TAG'i iptal et
    await db_instance.update_one(
        "tags",
        {"_id": ObjectId(request.tag_id)},
        {"$set": {
            "status": TagStatus.CANCELLED,
            "cancelled_at": datetime.utcnow()
        }}
    )
    
    # İlgili teklifleri reddet
    await db_instance.update_many(
        "offers",
        {"tag_id": request.tag_id},
        {"$set": {"status": OfferStatus.REJECTED}}
    )
    
    logger.info(f"✅ TAG iptal edildi: {request.tag_id}")
    return {"success": True, "message": "Çağrı başarıyla iptal edildi"}

@api_router.post("/passenger/update-destination")
async def update_destination(user_id: str, request: UpdateDestinationRequest):
    """Hedef adresini güncelle"""
    tag = await db_instance.find_one("tags", {"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["passenger_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    # TAG'in durumunu kontrol et - sadece pending veya offers_received ise güncelleme yapılabilir
    if tag["status"] not in [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED]:
        raise HTTPException(status_code=400, detail="Bu aşamada hedef değiştirilemez")
    
    # Hedefi güncelle
    await db_instance.update_one(
        "tags",
        {"_id": ObjectId(request.tag_id)},
        {"$set": {
            "dropoff_location": request.dropoff_location,
            "dropoff_lat": request.dropoff_lat,
            "dropoff_lng": request.dropoff_lng,
            "updated_at": datetime.utcnow()
        }}
    )
    
    logger.info(f"✅ Hedef güncellendi: {request.tag_id} -> {request.dropoff_location}")
    return {"success": True, "message": "Hedef başarıyla güncellendi"}

@api_router.get("/passenger/driver-location/{driver_id}")
async def get_driver_location(driver_id: str):
    """Sürücünün canlı konumunu al"""
    driver = await db_instance.find_one("users", {"_id": ObjectId(driver_id)})
    if not driver:
        return {"location": None}
    
    location = driver.get("location")
    if location and "coordinates" in location:
        return {
            "location": {
                "latitude": location["coordinates"][1],
                "longitude": location["coordinates"][0]
            }
        }
    return {"location": None}

@api_router.get("/driver/passenger-location/{passenger_id}")
async def get_passenger_location(passenger_id: str):
    """Yolcunun canlı konumunu al"""
    passenger = await db_instance.find_one("users", {"_id": ObjectId(passenger_id)})
    if not passenger:
        return {"location": None}
    
    location = passenger.get("location")
    if location and "coordinates" in location:
        return {
            "location": {
                "latitude": location["coordinates"][1],
                "longitude": location["coordinates"][0]
            }
        }
    return {"location": None}

@api_router.get("/passenger/active-tag")
async def get_passenger_active_tag(user_id: str):
    """Aktif TAG getir"""
    tag = await db_instance.find_one("tags", {
        "passenger_id": user_id,
        "status": {"$in": [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED, TagStatus.MATCHED, TagStatus.IN_PROGRESS]}
    })
    
    if not tag:
        return {"success": True, "tag": None}
    
    offer_count = await db_instance.count_documents("offers", {"tag_id": str(tag["_id"])})
    
    # Eşleşme varsa şoförün güncel konumunu al
    driver_location = tag.get("driver_location")
    passenger_location = None
    route_info = None
    
    # Yolcunun konumunu al
    passenger = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if passenger and passenger.get("location") and "coordinates" in passenger.get("location", {}):
        passenger_location = {
            "latitude": passenger["location"]["coordinates"][1],
            "longitude": passenger["location"]["coordinates"][0]
        }
    
    if tag.get("driver_id") and tag.get("status") in [TagStatus.MATCHED, TagStatus.IN_PROGRESS]:
        driver = await db_instance.find_one("users", {"_id": ObjectId(tag["driver_id"])})
        if driver and driver.get("location") and "coordinates" in driver.get("location", {}):
            driver_location = {
                "latitude": driver["location"]["coordinates"][1],
                "longitude": driver["location"]["coordinates"][0]
            }
            
            # ROTA BİLGİSİ HESAPLA - Şoförden yolcuya
            if passenger_location:
                route_info = await get_route_info(
                    driver_location["latitude"], driver_location["longitude"],
                    passenger_location["latitude"], passenger_location["longitude"]
                )
                logger.info(f"📍 Rota hesaplandı (yolcu): {route_info}")
    
    tag_data = TagResponse(
        id=str(tag["_id"]),
        **{k: v for k, v in tag.items() if k != "_id"}
    ).dict()
    
    # Şoför konumunu ve rota bilgisini ekle
    tag_data["driver_location"] = driver_location
    tag_data["route_info"] = route_info
    
    return {
        "success": True,
        "tag": tag_data,
        "offer_count": offer_count
    }

@api_router.get("/passenger/history")
async def get_passenger_history(user_id: str):
    """Geçmiş yolculuklar"""
    tags = await db_instance.find_many("tags", {
        "passenger_id": user_id,
        "status": TagStatus.COMPLETED
    }, limit=50)
    
    history = []
    for tag in tags:
        history.append(TagResponse(
            id=str(tag["_id"]),
            **{k: v for k, v in tag.items() if k != "_id"}
        ))
    
    return {"success": True, "history": [h.dict() for h in history]}

# ==================== DRIVER ENDPOINTS ====================
@api_router.get("/driver/requests")
async def get_driver_requests(user_id: str):
    """
    Aktif talepleri listele
    FİLTRELEME:
    - Sadece aynı şehirdeki yolcular
    - Maksimum 20 km mesafedeki yolcular
    - Engelli kullanıcılar hariç
    SIRALAMA: En yakından uzağa
    """
    user = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    driver_city = user.get("city")
    
    # Şehir bilgisi yok ise (eski kullanıcılar için)
    if not driver_city:
        logger.warning(f"⚠️ Sürücü {user_id} şehir bilgisi eksik")
        return {"success": True, "requests": []}
    
    # Engellenen kullanıcıları al (iki yönlü)
    db = db_instance.db
    blocked_by_me = await db.blocked_users.find({"user_id": user_id}).to_list(100)
    blocked_me = await db.blocked_users.find({"blocked_user_id": user_id}).to_list(100)
    
    blocked_ids = set([b["blocked_user_id"] for b in blocked_by_me] + [b["user_id"] for b in blocked_me])
    
    # Sadece pending veya offers_received TAGleri getir
    tags = await db_instance.find_many("tags", {
        "status": {"$in": [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED]}
    })
    
    # Sürücünün konumu (yoksa mock konum kullan)
    driver_location = user.get("location")
    if not driver_location:
        logger.warning(f"⚠️ Sürücü {user_id} konum bilgisi eksik, mock konum kullanılıyor")
        driver_location = {"latitude": 41.0082, "longitude": 28.9784}
    
    driver_lat = driver_location.get("latitude", 41.0082)
    driver_lng = driver_location.get("longitude", 28.9784)
    
    tag_responses = []
    for tag in tags:
        # Engelli kullanıcı kontrolü
        if tag["passenger_id"] in blocked_ids:
            continue  # Engelli kullanıcı, atla
        
        # Yolcu bilgisini al
        passenger = await db_instance.find_one("users", {"_id": ObjectId(tag["passenger_id"])})
        if not passenger:
            continue  # Yolcu bulunamadı, atla
        
        # ŞEHİR FİLTRESİ: Sadece aynı şehirdeki yolcular
        passenger_city = passenger.get("city", "")
        if passenger_city != driver_city:
            continue  # Farklı şehir, atla
        
        # Mesafe hesaplamaları
        distance_to_passenger = 0.0
        trip_distance = 0.0
        
        # Sürücü -> Yolcu mesafesi (GPS BAZLI FİLTRELEME)
        if tag.get("pickup_lat") and tag.get("pickup_lng"):
            distance_to_passenger = calculate_distance(
                driver_lat, driver_lng,
                tag["pickup_lat"], tag["pickup_lng"]
            )
            
            # 20 KM FİLTRE: Sadece 20 km içindeki yolcular
            if distance_to_passenger > 20:
                continue  # 20 km'den uzak, atla
        
        # Yolcunun gideceği mesafe (pickup -> dropoff)
        if tag.get("pickup_lat") and tag.get("pickup_lng") and tag.get("dropoff_lat") and tag.get("dropoff_lng"):
            trip_distance = calculate_distance(
                tag["pickup_lat"], tag["pickup_lng"],
                tag["dropoff_lat"], tag["dropoff_lng"]
            )
        
        driver_offer = await db_instance.find_one("offers", {
            "tag_id": str(tag["_id"]),
            "driver_id": user_id
        })
        
        tag_responses.append({
            **TagResponse(
                id=str(tag["_id"]),
                **{k: v for k, v in tag.items() if k != "_id"}
            ).dict(),
            "has_offered": driver_offer is not None,
            "distance_to_passenger_km": round(distance_to_passenger, 2),  # Sürücü -> Yolcu
            "trip_distance_km": round(trip_distance, 2)  # Yolculuğun kendisi
        })
    
    # EN YAKINA GÖRE SIRALA (mesafe artan sıra)
    tag_responses.sort(key=lambda x: x.get("distance_to_passenger_km", 999))
    
    logger.info(f"📍 Şoför {user['name']} ({driver_city}): {len(tag_responses)} çağrı (şehir + 20km filtreli, yakınlık sıralı)")
    return {"success": True, "requests": tag_responses}

@api_router.post("/driver/send-offer")
async def send_offer(user_id: str, request: SendOfferRequest):
    """Teklif gönder"""
    user = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    tag = await db_instance.find_one("tags", {"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["status"] not in [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED]:
        raise HTTPException(status_code=400, detail="Bu TAG artık teklif kabul etmiyor")
    
    existing_offer = await db_instance.find_one("offers", {
        "tag_id": request.tag_id,
        "driver_id": user_id
    })
    if existing_offer:
        raise HTTPException(status_code=400, detail="Bu talep için zaten teklif verdiniz")
    
    # Sürücü araç bilgilerini al
    driver_details = user.get("driver_details") or {}
    vehicle_model = driver_details.get("vehicle_model", "Araç Bilgisi Yok")
    vehicle_color = driver_details.get("vehicle_color", "")
    vehicle_photo = driver_details.get("vehicle_photo")
    is_premium = user.get("is_premium", False)
    
    from datetime import datetime, timedelta
    
    # Sürücü konumu al
    driver_location = user.get("location")
    driver_lat = driver_location.get("latitude", 41.0082) if driver_location else 41.0082
    driver_lng = driver_location.get("longitude", 28.9784) if driver_location else 28.9784
    
    # Mesafe hesapla: Sürücü -> Yolcu
    distance_to_passenger = 0.0
    arrival_time_min = request.estimated_time or 5
    
    if tag.get("pickup_lat") and tag.get("pickup_lng"):
        distance_to_passenger = calculate_distance(
            driver_lat, driver_lng,
            tag["pickup_lat"], tag["pickup_lng"]
        )
        # Ortalama hız 40 km/saat ile tahmini varış süresi
        if distance_to_passenger > 0:
            arrival_time_min = max(1, int((distance_to_passenger / 40) * 60))
    
    # Mesafe hesapla: Pickup -> Dropoff (yolculuk mesafesi)
    trip_distance_km = 0.0
    trip_duration_min = 0
    
    if tag.get("pickup_lat") and tag.get("pickup_lng") and tag.get("dropoff_lat") and tag.get("dropoff_lng"):
        trip_distance_km = calculate_distance(
            tag["pickup_lat"], tag["pickup_lng"],
            tag["dropoff_lat"], tag["dropoff_lng"]
        )
        # Ortalama hız 30 km/saat ile tahmini yolculuk süresi
        if trip_distance_km > 0:
            trip_duration_min = max(1, int((trip_distance_km / 30) * 60))
    
    offer_data = Offer(
        tag_id=request.tag_id,
        driver_id=user_id,
        driver_name=user["name"],
        driver_rating=user.get("rating", 5.0),
        driver_photo=user.get("profile_photo"),
        price=request.price,
        estimated_time=arrival_time_min,  # Hesaplanan varış süresi
        notes=request.notes
    ).dict()
    
    # Araç bilgilerini ekle
    offer_data["vehicle_model"] = vehicle_model
    offer_data["vehicle_color"] = vehicle_color
    offer_data["vehicle_photo"] = vehicle_photo
    offer_data["is_premium"] = is_premium
    
    # Mesafe bilgilerini ekle
    offer_data["distance_to_passenger_km"] = round(distance_to_passenger, 1)
    offer_data["trip_distance_km"] = round(trip_distance_km, 1)
    offer_data["trip_duration_min"] = trip_duration_min
    
    # 10 dakika sonra expire olacak
    offer_data["expires_at"] = datetime.utcnow() + timedelta(minutes=OFFER_EXPIRY_MINUTES)
    
    offer_id = await db_instance.insert_one("offers", offer_data)
    
    # TAG durumunu güncelle (OFFERS_RECEIVED)
    await db_instance.update_one(
        "tags",
        {"_id": ObjectId(request.tag_id)},
        {"$set": {"status": TagStatus.OFFERS_RECEIVED}}
    )
    
    logger.info(f"📩 Teklif gönderildi: {user['name']} -> TAG {request.tag_id}")
    
    return {"success": True, "message": "Teklif gönderildi", "offer_id": offer_id}

@api_router.get("/driver/active-tag")
async def get_driver_active_tag(user_id: str):
    """Aktif TAG getir"""
    tag = await db_instance.find_one("tags", {
        "driver_id": user_id,
        "status": {"$in": [TagStatus.MATCHED, TagStatus.IN_PROGRESS]}
    })
    
    if not tag:
        return {"success": True, "tag": None}
    
    # Yolcunun güncel konumunu al
    passenger_location = tag.get("passenger_location")
    driver_location = None
    route_info = None
    
    # Şoförün konumunu al
    driver = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if driver and driver.get("location") and "coordinates" in driver.get("location", {}):
        driver_location = {
            "latitude": driver["location"]["coordinates"][1],
            "longitude": driver["location"]["coordinates"][0]
        }
    
    if tag.get("passenger_id"):
        passenger = await db_instance.find_one("users", {"_id": ObjectId(tag["passenger_id"])})
        if passenger and passenger.get("location") and "coordinates" in passenger.get("location", {}):
            passenger_location = {
                "latitude": passenger["location"]["coordinates"][1],
                "longitude": passenger["location"]["coordinates"][0]
            }
            
            # ROTA BİLGİSİ HESAPLA - Şoförden yolcuya (aynı yön, aynı sonuç)
            if driver_location:
                route_info = await get_route_info(
                    driver_location["latitude"], driver_location["longitude"],
                    passenger_location["latitude"], passenger_location["longitude"]
                )
                logger.info(f"📍 Rota hesaplandı (şoför): {route_info}")
    
    tag_data = TagResponse(
        id=str(tag["_id"]),
        **{k: v for k, v in tag.items() if k != "_id"}
    ).dict()
    
    # Yolcu konumunu ve rota bilgisini ekle
    tag_data["passenger_location"] = passenger_location
    tag_data["route_info"] = route_info
    
    return {
        "success": True,
        "tag": tag_data
    }

@api_router.post("/driver/start-tag/{tag_id}")
async def start_tag(tag_id: str, user_id: str):
    """TAG başlat"""
    tag = await db_instance.find_one("tags", {"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["driver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    await db_instance.update_one(
        "tags",
        {"_id": ObjectId(tag_id)},
        {"$set": {
            "status": TagStatus.IN_PROGRESS,
            "started_at": datetime.utcnow()
        }}
    )
    
    return {"success": True, "message": "Yolculuk başlatıldı"}

@api_router.post("/driver/complete-tag/{tag_id}")
async def complete_tag(tag_id: str, user_id: str, approved: bool = True):
    """TAG tamamla - CEZA SİSTEMİ ile"""
    tag = await db_instance.find_one("tags", {"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["driver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    # CEZA SİSTEMİ: Onaysız bitirme
    penalty_applied = False
    if not approved:
        # Tek taraflı bitirme - CEZA! -3 PUAN
        await db_instance.update_one(
            "users",
            {"_id": ObjectId(user_id)},
            {"$inc": {"rating": -3.0}}  # 3 puan düşür
        )
        penalty_applied = True
        logger.warning(f"⚠️ CEZA: {user_id} tek taraflı bitirdi - Puan -3")
    
    await db_instance.update_one(
        "tags",
        {"_id": ObjectId(tag_id)},
        {"$set": {
            "status": TagStatus.COMPLETED,
            "completed_at": datetime.utcnow(),
            "penalty_applied": penalty_applied
        }}
    )
    
    # Trip sayısını artır (her durumda)
    await db_instance.update_one(
        "users",
        {"_id": ObjectId(user_id)},
        {"$inc": {"total_trips": 1}}
    )
    await db_instance.update_one(
        "users",
        {"_id": ObjectId(tag["passenger_id"])},
        {"$inc": {"total_trips": 1}}
    )
    
    message = "Yolculuk tamamlandı"
    if penalty_applied:
        message += " (Uyarı: Tek taraflı bitirme cezası uygulandı)"
    
    return {"success": True, "message": message, "penalty_applied": penalty_applied}

# ==================== KARŞILIKLI İPTAL SİSTEMİ ====================
@api_router.post("/trip/request-end")
async def request_trip_end(tag_id: str, user_id: str, user_type: str):
    """
    Yolculuğu bitirmek için istek gönder
    user_type: 'passenger' veya 'driver'
    Karşı tarafın onayı beklenir
    """
    try:
        db = db_instance.db
        
        tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
        if not tag:
            return {"success": False, "detail": "TAG bulunamadı"}
        
        if tag.get("status") not in ["matched", "in_progress"]:
            return {"success": False, "detail": "Bu yolculuk henüz aktif değil"}
        
        # İsteği oluştur
        end_request = {
            "tag_id": tag_id,
            "requester_id": user_id,
            "requester_type": user_type,
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        
        # Eski istekleri temizle
        await db.trip_end_requests.delete_many({"tag_id": tag_id})
        
        # Yeni istek oluştur
        await db.trip_end_requests.insert_one(end_request)
        
        logger.info(f"🔴 Yolculuk bitirme isteği: {user_type} -> TAG {tag_id}")
        
        return {"success": True, "message": "Bitirme isteği gönderildi"}
    except Exception as e:
        logger.error(f"Trip end request hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@api_router.get("/trip/check-end-request")
async def check_trip_end_request(tag_id: str, user_id: str):
    """
    Karşı taraftan gelen bitirme isteğini kontrol et
    """
    try:
        db = db_instance.db
        
        # Bu kullanıcıya gelen bekleyen istek var mı?
        # (İsteği gönderen kişi DEĞİL, karşı taraf olmalı)
        pending_request = await db.trip_end_requests.find_one({
            "tag_id": tag_id,
            "requester_id": {"$ne": user_id},  # Kendisi değil
            "status": "pending"
        })
        
        if pending_request:
            return {
                "success": True,
                "has_request": True,
                "request": {
                    "requester_type": pending_request.get("requester_type", ""),
                    "requester_id": pending_request.get("requester_id", ""),
                    "created_at": pending_request.get("created_at", "").isoformat() if pending_request.get("created_at") else ""
                }
            }
        
        return {"success": True, "has_request": False}
    except Exception as e:
        return {"success": False, "detail": str(e)}


@api_router.post("/trip/respond-end-request")
async def respond_trip_end_request(tag_id: str, user_id: str, approved: bool):
    """
    Bitirme isteğine yanıt ver
    approved=True: Onayladı, yolculuk karşılıklı onay ile biter
    approved=False: Reddetti AMA yolculuk yine biter, istek gönderene CEZA!
    """
    try:
        db = db_instance.db
        
        # İsteği bul
        pending_request = await db.trip_end_requests.find_one({
            "tag_id": tag_id,
            "status": "pending"
        })
        
        if not pending_request:
            return {"success": False, "detail": "Bekleyen istek bulunamadı"}
        
        requester_id = pending_request.get("requester_id")
        requester_type = pending_request.get("requester_type")
        
        tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
        if not tag:
            return {"success": False, "detail": "TAG bulunamadı"}
        
        penalty_applied = False
        
        if approved:
            # ONAYLANDI - Yolculuğu karşılıklı onay ile bitir
            await db.tags.update_one(
                {"_id": ObjectId(tag_id)},
                {"$set": {
                    "status": TagStatus.COMPLETED,
                    "completed_at": datetime.utcnow(),
                    "mutual_end": True,  # Karşılıklı onay ile bitti
                    "penalty_applied": False
                }}
            )
            
            message = "Yolculuk karşılıklı onay ile tamamlandı"
            logger.info(f"✅ Yolculuk karşılıklı onay ile bitti: TAG {tag_id}")
            
        else:
            # REDDEDİLDİ AMA YİNE DE BİTİYOR + İSTEK GÖNDERENİN PUANI DÜŞÜYOR
            await db.tags.update_one(
                {"_id": ObjectId(tag_id)},
                {"$set": {
                    "status": TagStatus.COMPLETED,
                    "completed_at": datetime.utcnow(),
                    "mutual_end": False,  # Tek taraflı bitti
                    "penalty_applied": True,
                    "penalty_user_id": requester_id
                }}
            )
            
            # İSTEK GÖNDERENİN PUANINI DÜŞ (onaysız bitirenin)
            await db.users.update_one(
                {"_id": ObjectId(requester_id)},
                {"$inc": {"penalty_points": 1, "rating": -0.5}}  # -0.5 puan ceza
            )
            
            penalty_applied = True
            message = "Yolculuk bitti. Onaysız bitiren kişiye puan cezası uygulandı."
            logger.warning(f"⚠️ CEZA: {requester_id} onaysız bitirdi - Puan -0.5")
        
        # Trip sayılarını artır (her durumda)
        await db.users.update_one(
            {"_id": ObjectId(tag.get("passenger_id"))},
            {"$inc": {"total_trips": 1}}
        )
        await db.users.update_one(
            {"_id": ObjectId(tag.get("driver_id"))},
            {"$inc": {"total_trips": 1}}
        )
        
        # İsteği sil
        await db.trip_end_requests.delete_many({"tag_id": tag_id})
        
        return {
            "success": True, 
            "approved": approved, 
            "message": message,
            "penalty_applied": penalty_applied
        }
    except Exception as e:
        logger.error(f"Trip end respond hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@api_router.get("/driver/history")
async def get_driver_history(user_id: str):
    """Geçmiş yolculuklar"""
    tags = await db_instance.find_many("tags", {
        "driver_id": user_id,
        "status": TagStatus.COMPLETED
    }, limit=50)
    
    history = []
    for tag in tags:
        history.append(TagResponse(
            id=str(tag["_id"]),
            **{k: v for k, v in tag.items() if k != "_id"}
        ))
    
    return {"success": True, "history": [h.dict() for h in history]}

# ==================== EMERGENCY ENDPOINTS ====================
@api_router.post("/emergency/trigger")
async def trigger_emergency(user_id: str, tag_id: str):
    """Acil durum butonu"""
    tag = await db_instance.find_one("tags", {"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    
    # TAG'i acil durum olarak işaretle
    await db_instance.update_one(
        "tags",
        {"_id": ObjectId(tag_id)},
        {"$set": {"emergency_shared": True}}
    )
    
    # Emergency alert kaydet
    alert = EmergencyAlert(
        tag_id=tag_id,
        user_id=user_id,
        alert_type="sos",
        message="Acil durum bildirimi",
        location=tag.get("pickup_location")
    ).dict()
    
    await db_instance.insert_one("emergency_alerts", alert)
    
    # TODO: SMS/bildirim gönder
    logger.warning(f"🚨 ACIL DURUM: Tag {tag_id}, User {user_id}")
    
    return {"success": True, "message": "Acil durum bildirimi gönderildi"}

@api_router.get("/emergency/share/{share_token}")
async def get_shared_trip(share_token: str):
    """Paylaşılan yolculuk bilgisi"""
    share_link = f"leylektag://share/{share_token}"
    tag = await db_instance.find_one("tags", {"share_link": share_link})
    
    if not tag:
        raise HTTPException(status_code=404, detail="Yolculuk bulunamadı")
    
    return {
        "success": True,
        "tag": TagResponse(
            id=str(tag["_id"]),
            **{k: v for k, v in tag.items() if k != "_id"}
        ).dict()
    }

# ==================== CALL ENDPOINTS ====================
@api_router.post("/call/initiate")
async def initiate_call(request: InitiateCallRequest):
    """Arama başlat"""
    tag = await db_instance.find_one("tags", {"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["status"] not in [TagStatus.MATCHED, TagStatus.IN_PROGRESS]:
        raise HTTPException(status_code=400, detail="Bu TAG'de arama yapılamaz")
    
    if request.caller_id == tag["passenger_id"]:
        receiver_id = tag["driver_id"]
    elif request.caller_id == tag.get("driver_id"):
        receiver_id = tag["passenger_id"]
    else:
        raise HTTPException(status_code=403, detail="Bu TAG'de arama yapma yetkiniz yok")
    
    call_log = CallLog(
        tag_id=request.tag_id,
        caller_id=request.caller_id,
        receiver_id=receiver_id
    ).dict()
    
    call_id = await db_instance.insert_one("call_logs", call_log)
    
    return {
        "success": True,
        "call_id": call_id,
        "receiver_id": receiver_id
    }

@api_router.post("/call/end")
async def end_call(request: EndCallRequest):
    """Arama sonlandır"""
    call_log = await db_instance.find_one(
        "call_logs",
        {"tag_id": request.tag_id, "caller_id": request.caller_id},
    )
    
    if call_log:
        await db_instance.update_one(
            "call_logs",
            {"_id": call_log["_id"]},
            {"$set": {
                "ended_at": datetime.utcnow(),
                "duration": request.duration
            }}
        )
    
    return {"success": True, "message": "Arama sonlandırıldı"}

# ==================== RATING ENDPOINTS ====================
@api_router.post("/rating/submit")
async def submit_rating(user_id: str, request: SubmitRatingRequest):
    """Puan ver"""
    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="Puan 1-5 arası olmalıdır")
    
    tag = await db_instance.find_one("tags", {"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["status"] != TagStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Sadece tamamlanmış TAG'ler için puan verilebilir")
    
    existing = await db_instance.find_one("ratings", {
        "tag_id": request.tag_id,
        "rater_id": user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Bu TAG için zaten puan verdiniz")
    
    rating_data = Rating(
        tag_id=request.tag_id,
        rater_id=user_id,
        rated_user_id=request.rated_user_id,
        rating=request.rating,
        comment=request.comment
    ).dict()
    
    await db_instance.insert_one("ratings", rating_data)
    
    # Ortalama puanı güncelle
    user_ratings = await db_instance.find_many("ratings", {"rated_user_id": request.rated_user_id})
    avg_rating = sum([r["rating"] for r in user_ratings]) / len(user_ratings)
    
    await db_instance.update_one(
        "users",
        {"_id": ObjectId(request.rated_user_id)},
        {"$set": {
            "rating": round(avg_rating, 1),
            "total_ratings": len(user_ratings)
        }}
    )
    
    return {"success": True, "message": "Puan verildi"}

@api_router.get("/rating/check/{tag_id}")
async def check_rating(tag_id: str, user_id: str):
    """Puan verilmiş mi kontrol et"""
    rating = await db_instance.find_one("ratings", {
        "tag_id": tag_id,
        "rater_id": user_id
    })
    
    return {
        "success": True,
        "has_rated": rating is not None
    }

# ==================== STATISTICS ====================
@api_router.get("/stats/user/{user_id}")
async def get_user_stats(user_id: str):
    """Kullanıcı istatistikleri"""
    user = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Count trips as passenger
    passenger_trips = await db_instance.count_documents("tags", {
        "passenger_id": user_id,
        "status": TagStatus.COMPLETED
    })
    
    # Count trips as driver
    driver_trips = await db_instance.count_documents("tags", {
        "driver_id": user_id,
        "status": TagStatus.COMPLETED
    })
    
    # Calculate earnings as driver
    completed_tags = await db_instance.find_many("tags", {
        "driver_id": user_id,
        "status": TagStatus.COMPLETED
    })
    total_earned = sum([tag.get("final_price", 0) for tag in completed_tags])
    
    # Calculate spending as passenger (TODO: implement)
    total_spent = 0
    
    return {
        "success": True,
        "stats": {
            "total_trips": user.get("total_trips", 0),
            "passenger_trips": passenger_trips,
            "driver_trips": driver_trips,
            "rating": user.get("rating", 5.0),
            "total_ratings": user.get("total_ratings", 0),
            "total_earned": total_earned,
            "total_spent": total_spent
        }
    }

# CORS - Router include'dan ÖNCE olmalı
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "🕊️ Leylek TAG API",
        "version": "2.0.0",
        "status": "running"
    }


# ==================== ADMIN: TEMİZLE ====================
@app.delete("/api/admin/clear-all")
async def clear_all_data():
    """Tüm TAG ve teklifleri temizle"""
    try:
        db = db_instance.db
        
        # Tüm TAG'leri sil
        tags_result = await db.tags.delete_many({})
        
        # Tüm teklifleri sil
        offers_result = await db.offers.delete_many({})
        
        logger.info(f"🧹 Temizleme: {tags_result.deleted_count} TAG, {offers_result.deleted_count} teklif silindi")
        
        return {
            "success": True,
            "deleted_tags": tags_result.deleted_count,
            "deleted_offers": offers_result.deleted_count,
            "message": "Tüm veriler temizlendi"
        }
    except Exception as e:
        logger.error(f"Temizleme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== VOICE CALL SYSTEM v2 ====================
# - Tek seferde tek arama
# - 10 dakika süre limiti
# - Müsait değil durumu
# - Sadece eşleşen kişiler arayabilir

class StartCallRequest(BaseModel):
    tag_id: str
    caller_id: str
    caller_name: str = "Arayan"
    call_type: str = "audio"  # audio veya video

@app.post("/api/voice/start-call")
async def start_voice_call(request: StartCallRequest):
    """Arama başlat - tek seferde tek arama"""
    try:
        tag_id = request.tag_id
        caller_id = request.caller_id
        caller_name = request.caller_name
        call_type = request.call_type
        
        if not tag_id or not caller_id:
            return {"success": False, "detail": "tag_id ve caller_id gerekli"}
        
        db = db_instance.db
        
        # TAG'i bul
        tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
        if not tag:
            return {"success": False, "detail": "TAG bulunamadı"}
        
        # Sadece eşleşen kişiler arayabilir
        if tag.get("status") not in ["matched", "in_progress"]:
            return {"success": False, "detail": "Sadece eşleşme sonrası arama yapılabilir"}
        
        # Karşı tarafı belirle
        if caller_id == str(tag.get("passenger_id", "")):
            receiver_id = str(tag.get("driver_id", ""))
            receiver_name = tag.get("driver_name", "Şoför")
        else:
            receiver_id = str(tag.get("passenger_id", ""))
            receiver_name = tag.get("passenger_name", "Yolcu")
        
        # Arayan zaten aramada mı?
        caller_in_call = await db.call_requests.find_one({
            "$or": [
                {"caller_id": caller_id, "status": {"$in": ["ringing", "active"]}},
                {"receiver_id": caller_id, "status": {"$in": ["ringing", "active"]}}
            ]
        })
        if caller_in_call:
            return {"success": False, "detail": "Zaten bir aramada olduğunuz için yeni arama başlatamazsınız"}
        
        # 5 saniye bekleme kontrolü - son aramadan bu yana
        five_seconds_ago = datetime.utcnow() - timedelta(seconds=5)
        recent_call = await db.call_history.find_one({
            "caller_id": caller_id,
            "tag_id": tag_id,
            "ended_at": {"$gt": five_seconds_ago}
        })
        if recent_call:
            return {"success": False, "detail": "Lütfen tekrar aramadan önce 5 saniye bekleyin"}
        
        # Karşı taraf aramada mı?
        receiver_in_call = await db.call_requests.find_one({
            "$or": [
                {"caller_id": receiver_id, "status": {"$in": ["ringing", "active"]}},
                {"receiver_id": receiver_id, "status": {"$in": ["ringing", "active"]}}
            ]
        })
        if receiver_in_call:
            return {"success": False, "detail": "Karşı taraf başka bir aramada, lütfen bekleyin"}
        
        # Karşı taraf müsait mi?
        receiver_user = await db.users.find_one({"_id": ObjectId(receiver_id)})
        if receiver_user and receiver_user.get("call_available") == False:
            return {"success": False, "detail": "Karşı taraf şu an aramalara müsait değil"}
        
        # Eski tamamlanmış aramaları temizle (bu TAG için)
        await db.call_requests.delete_many({
            "tag_id": tag_id, 
            "status": {"$in": ["rejected", "ended", "missed"]}
        })
        
        # Yeni arama oluştur
        call_request = {
            "tag_id": tag_id,
            "caller_id": caller_id,
            "caller_name": caller_name or "Arayan",
            "receiver_id": receiver_id,
            "receiver_name": receiver_name,
            "call_type": call_type,
            "status": "ringing",
            "created_at": datetime.utcnow(),
            "started_at": None,
            "ended_at": None,
            "max_duration": 600  # 10 dakika = 600 saniye
        }
        
        result = await db.call_requests.insert_one(call_request)
        
        logger.info(f"📞 Arama başlatıldı: {caller_name} → {receiver_name} ({call_type})")
        
        return {
            "success": True,
            "message": "Arama başlatıldı",
            "call_id": str(result.inserted_id),
            "channel_name": tag_id,
            "call_type": call_type
        }
    except Exception as e:
        logger.error(f"Arama başlatma hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.get("/api/voice/check-incoming")
async def check_incoming_call(user_id: str):
    """
    Gelen arama kontrolü
    - Sadece aktif ringing aramalar
    - İptal edilmiş aramaları hemen temizle
    - Arayan kapattıysa zil çalmayı kes
    """
    try:
        db = db_instance.db
        
        # 20 saniyeden eski ringing aramaları sil (timeout)
        twenty_seconds_ago = datetime.utcnow() - timedelta(seconds=20)
        await db.call_requests.delete_many(
            {"status": "ringing", "created_at": {"$lt": twenty_seconds_ago}}
        )
        
        # Tamamlanmış/iptal edilmiş aramaları temizle
        await db.call_requests.delete_many(
            {"status": {"$in": ["ended", "rejected", "missed", "accepted", "cancelled"]}}
        )
        
        # Bu kullanıcıya gelen SADECE "ringing" durumundaki arama var mı?
        incoming_call = await db.call_requests.find_one({
            "receiver_id": user_id,
            "status": "ringing"
        })
        
        # ARAMA İPTAL EDİLDİ Mİ KONTROLÜ
        # Son 5 saniye içinde cancelled arama history var mı?
        five_seconds_ago = datetime.utcnow() - timedelta(seconds=5)
        cancelled_call = await db.call_history.find_one({
            "receiver_id": user_id,
            "status": "cancelled",
            "ended_at": {"$gt": five_seconds_ago}
        })
        
        if cancelled_call:
            # Arayan kapattı - karşı taraf bilgilendirilmeli
            return {
                "success": True,
                "has_incoming": False,
                "call_cancelled": True,
                "message": "Arayan aramayı kapattı"
            }
        
        if incoming_call:
            return {
                "success": True,
                "has_incoming": True,
                "call_cancelled": False,
                "call": {
                    "call_id": str(incoming_call.get("_id", "")),
                    "caller_name": incoming_call.get("caller_name", "Arayan"),
                    "caller_id": incoming_call.get("caller_id", ""),
                    "channel_name": incoming_call.get("tag_id", ""),
                    "tag_id": incoming_call.get("tag_id", ""),
                    "call_type": incoming_call.get("call_type", "audio")
                }
            }
        
        return {"success": True, "has_incoming": False, "call_cancelled": False}
    except Exception as e:
        logger.error(f"Gelen arama kontrolü hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.post("/api/voice/answer-call")
async def answer_call(tag_id: str, user_id: str):
    """
    Aramayı kabul et
    """
    try:
        db = db_instance.db
        
        # Call request'i güncelle
        await db.call_requests.update_one(
            {"tag_id": tag_id, "receiver_id": user_id},
            {"$set": {"status": "accepted"}}
        )
        
        logger.info(f"📞 Arama kabul edildi: TAG {tag_id}")
        
        return {"success": True, "message": "Arama kabul edildi"}
    except Exception as e:
        logger.error(f"Arama kabul hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.post("/api/voice/reject-call")
async def reject_call(tag_id: str, user_id: str):
    """Aramayı reddet - tamamen sil ve 5 sn kısıtlama ekle"""
    try:
        db = db_instance.db
        
        # Mevcut aramayı bul
        call = await db.call_requests.find_one({"tag_id": tag_id})
        
        if call:
            # Arama geçmişine kaydet (5 sn bekleme için)
            await db.call_history.insert_one({
                "tag_id": tag_id,
                "caller_id": call.get("caller_id"),
                "receiver_id": call.get("receiver_id"),
                "call_type": call.get("call_type"),
                "status": "rejected",
                "ended_at": datetime.utcnow()
            })
        
        # Call request'i tamamen sil (tekrar gelmesin)
        await db.call_requests.delete_many({"tag_id": tag_id})
        
        logger.info(f"📞 Arama reddedildi ve silindi: TAG {tag_id}")
        
        return {"success": True, "message": "Arama reddedildi"}
    except Exception as e:
        logger.error(f"Arama reddetme hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.post("/api/voice/end-call")
async def end_call(tag_id: str, user_id: str):
    """Aramayı sonlandır - tamamen sil ve geçmişe kaydet"""
    try:
        db = db_instance.db
        
        # Mevcut aramayı bul
        call = await db.call_requests.find_one({"tag_id": tag_id})
        
        if call:
            # Arama geçmişine kaydet (5 sn bekleme kontrolü için)
            await db.call_history.insert_one({
                "tag_id": tag_id,
                "caller_id": call.get("caller_id"),
                "receiver_id": call.get("receiver_id"),
                "call_type": call.get("call_type"),
                "status": "ended",
                "ended_at": datetime.utcnow()
            })
        
        # Tüm aramaları bu TAG için sil (ikisi de çıksın)
        await db.call_requests.delete_many({"tag_id": tag_id})
        
        logger.info(f"📞 Arama sonlandırıldı ve silindi: TAG {tag_id}")
        
        return {"success": True, "message": "Arama sonlandırıldı"}
    except Exception as e:
        logger.error(f"Arama sonlandırma hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.post("/api/voice/cancel-call")
async def cancel_call(tag_id: str, user_id: str):
    """
    Arayan aramayı iptal etti (henüz bağlanmadan vazgeçti)
    Bu, karşı tarafın "gelen arama" modalını kapatır
    """
    try:
        db = db_instance.db
        
        # Mevcut aramayı bul
        call = await db.call_requests.find_one({"tag_id": tag_id, "caller_id": user_id})
        
        if call:
            # Arama geçmişine kaydet
            await db.call_history.insert_one({
                "tag_id": tag_id,
                "caller_id": call.get("caller_id"),
                "receiver_id": call.get("receiver_id"),
                "call_type": call.get("call_type"),
                "status": "cancelled",
                "ended_at": datetime.utcnow()
            })
        
        # Tüm aramaları bu TAG için sil
        await db.call_requests.delete_many({"tag_id": tag_id})
        
        logger.info(f"📞 Arama iptal edildi (arayan vazgeçti): TAG {tag_id}")
        
        return {"success": True, "message": "Arama iptal edildi"}
    except Exception as e:
        logger.error(f"Arama iptal hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.post("/api/user/set-call-availability")
async def set_call_availability(user_id: str, available: bool = True):
    """Kullanıcının arama müsaitlik durumunu ayarla"""
    try:
        db = db_instance.db
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"call_available": available}}
        )
        
        status = "müsait" if available else "müsait değil"
        logger.info(f"📞 Arama durumu değişti: {user_id} → {status}")
        
        return {"success": True, "available": available, "message": f"Arama durumu: {status}"}
    except Exception as e:
        logger.error(f"Müsaitlik ayarlama hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.get("/api/voice/call-status")
async def get_call_status(tag_id: str, user_id: str):
    """Arama durumunu kontrol et - ARAYAN için önemli"""
    try:
        db = db_instance.db
        
        # Önce eski/tamamlanmış aramaları temizle
        await db.call_requests.delete_many({
            "tag_id": tag_id,
            "status": {"$in": ["ended", "rejected", "missed"]}
        })
        
        # Aktif arama var mı?
        call = await db.call_requests.find_one({
            "tag_id": tag_id
        })
        
        if call:
            status = call.get("status", "unknown")
            is_caller = call.get("caller_id") == user_id
            
            # Aktif durumlar
            if status in ["ringing", "active", "accepted"]:
                return {
                    "success": True,
                    "has_active_call": True,
                    "status": status,
                    "call_type": call.get("call_type"),
                    "caller_id": call.get("caller_id"),
                    "receiver_id": call.get("receiver_id"),
                    "is_caller": is_caller
                }
            else:
                # Aktif değil, sil
                await db.call_requests.delete_one({"_id": call["_id"]})
        
        # Arama yok - belki reddedildi veya sonlandırıldı
        # Son 10 saniye içindeki call_history'ye bak
        ten_seconds_ago = datetime.utcnow() - timedelta(seconds=10)
        recent_history = await db.call_history.find_one(
            {"tag_id": tag_id, "ended_at": {"$gt": ten_seconds_ago}},
            sort=[("ended_at", -1)]
        )
        
        if recent_history:
            return {
                "success": True,
                "has_active_call": False,
                "status": recent_history.get("status", "ended"),
                "was_rejected": recent_history.get("status") == "rejected"
            }
        
        return {"success": True, "has_active_call": False, "status": "none"}
    except Exception as e:
        return {"success": False, "detail": str(e)}


@app.post("/api/voice/log-call")
async def log_voice_call(
    user_id: str,
    other_user_id: str,
    tag_id: str,
    duration: int,  # saniye
    call_type: str = "outgoing"  # outgoing, incoming
):
    """
    Sesli arama logla
    - Kayıt TUTULMAZ, sadece kim kiminle ne kadar konuştu loglanır
    - Privacy için sadece istatistik tutulur
    """
    try:
        db = db_instance.db
        
        # Call log kaydı
        call_log = {
            "user_id": user_id,
            "other_user_id": other_user_id,
            "tag_id": tag_id,
            "duration_seconds": duration,
            "call_type": call_type,
            "timestamp": datetime.utcnow(),
            "privacy_note": "NO_RECORDING_STORED"
        }
        
        await db.call_logs.insert_one(call_log)
        
        # Call request'i temizle
        await db.call_requests.delete_many({"tag_id": tag_id})
        
        logger.info(f"📞 Arama loglandı: {user_id} → {other_user_id}, {duration}s")
        
        return {
            "success": True,
            "message": "Arama loglandı",
            "duration": duration
        }
    except Exception as e:
        logger.error(f"Arama loglama hatası: {str(e)}")
        return {"success": False, "detail": str(e)}



# ==================== BLOCK & REPORT SYSTEM ====================
@api_router.post("/user/block")
async def block_user(user_id: str, blocked_user_id: str):
    """Kullanıcıyı engelle"""
    try:
        db = db_instance.db
        
        # Zaten engellenmiş mi kontrol et
        existing = await db.blocked_users.find_one({
            "user_id": user_id,
            "blocked_user_id": blocked_user_id
        })
        
        if existing:
            return {"success": False, "message": "Bu kullanıcı zaten engellenmiş"}
        
        # Engelleme kaydı oluştur
        await db.blocked_users.insert_one({
            "user_id": user_id,
            "blocked_user_id": blocked_user_id,
            "created_at": datetime.utcnow()
        })
        
        logger.info(f"🚫 Kullanıcı engellendi: {user_id} -> {blocked_user_id}")
        
        return {"success": True, "message": "Kullanıcı engellendi"}
    except Exception as e:
        logger.error(f"Engelleme hatası: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/user/unblock")
async def unblock_user(user_id: str, blocked_user_id: str):
    """Engeli kaldır"""
    try:
        db = db_instance.db
        
        result = await db.blocked_users.delete_one({
            "user_id": user_id,
            "blocked_user_id": blocked_user_id
        })
        
        if result.deleted_count == 0:
            return {"success": False, "message": "Engel bulunamadı"}
        
        logger.info(f"✅ Engel kaldırıldı: {user_id} -> {blocked_user_id}")
        
        return {"success": True, "message": "Engel kaldırıldı"}
    except Exception as e:
        logger.error(f"Engel kaldırma hatası: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/user/blocked-list")
async def get_blocked_list(user_id: str):
    """Engellenen kullanıcılar listesi"""
    try:
        db = db_instance.db
        
        blocked = await db.blocked_users.find({"user_id": user_id}).to_list(100)
        blocked_ids = [b["blocked_user_id"] for b in blocked]
        
        return {"success": True, "blocked_users": blocked_ids}
    except Exception as e:
        logger.error(f"Engel listesi hatası: {str(e)}")
        return {"success": False, "blocked_users": []}


@api_router.post("/user/report")
async def report_user(user_id: str, reported_user_id: str, reason: str, description: str = ""):
    """Kullanıcıyı şikayet et"""
    try:
        db = db_instance.db
        
        # Şikayet kaydı oluştur
        report = {
            "reporter_id": user_id,
            "reported_user_id": reported_user_id,
            "reason": reason,
            "description": description,
            "status": "pending",  # pending, reviewed, resolved, dismissed
            "created_at": datetime.utcnow()
        }
        
        await db.reports.insert_one(report)
        
        logger.warning(f"⚠️ Şikayet: {user_id} -> {reported_user_id} ({reason})")
        
        return {"success": True, "message": "Şikayetiniz alındı. En kısa sürede incelenecektir."}
    except Exception as e:
        logger.error(f"Şikayet hatası: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/user/is-blocked")
async def check_if_blocked(user_id: str, other_user_id: str):
    """İki kullanıcı arasında engel var mı kontrol et"""
    try:
        db = db_instance.db
        
        # Her iki yönde de kontrol et
        blocked = await db.blocked_users.find_one({
            "$or": [
                {"user_id": user_id, "blocked_user_id": other_user_id},
                {"user_id": other_user_id, "blocked_user_id": user_id}
            ]
        })
        
        return {"success": True, "is_blocked": blocked is not None}
    except Exception as e:
        return {"success": False, "is_blocked": False}




# ==================== ADMIN PANEL ENDPOINTS ====================
ADMIN_PHONE_NUMBERS = ["5326497412", "05326497412"]  # Admin telefon numaraları

@api_router.get("/admin/check")
async def check_admin(phone: str):
    """Kullanıcının admin olup olmadığını kontrol et"""
    db = db_instance.db
    
    # Sabit admin numaraları
    if phone in ADMIN_PHONE_NUMBERS:
        return {"success": True, "is_admin": True}
    
    # Veritabanındaki admin listesi
    admin = await db.admins.find_one({"phone": phone, "is_active": True})
    return {"success": True, "is_admin": admin is not None}

@api_router.get("/admin/dashboard")
async def admin_dashboard(admin_phone: str):
    """Admin dashboard istatistikleri"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    # İstatistikler
    total_users = await db.users.count_documents({})
    active_trips = await db.tags.count_documents({"status": {"$in": ["matched", "in_progress"]}})
    pending_requests = await db.tags.count_documents({"status": {"$in": ["pending", "offers_received"]}})
    total_trips = await db.tags.count_documents({"status": "completed"})
    
    # Bugünkü istatistikler
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_users = await db.users.count_documents({"created_at": {"$gte": today}})
    today_trips = await db.tags.count_documents({"created_at": {"$gte": today}})
    
    # Bu haftaki istatistikler
    week_ago = datetime.utcnow() - timedelta(days=7)
    week_users = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    week_trips = await db.tags.count_documents({"created_at": {"$gte": week_ago}})
    
    # Bu ayki istatistikler
    month_ago = datetime.utcnow() - timedelta(days=30)
    month_users = await db.users.count_documents({"created_at": {"$gte": month_ago}})
    month_trips = await db.tags.count_documents({"created_at": {"$gte": month_ago}})
    
    # Toplam arama
    total_calls = await db.call_logs.count_documents({})
    
    # Şikayetler
    pending_reports = await db.reports.count_documents({"status": "pending"})
    
    return {
        "success": True,
        "stats": {
            "total_users": total_users,
            "active_trips": active_trips,
            "pending_requests": pending_requests,
            "total_completed_trips": total_trips,
            "total_calls": total_calls,
            "pending_reports": pending_reports,
            "today": {
                "users": today_users,
                "trips": today_trips
            },
            "this_week": {
                "users": week_users,
                "trips": week_trips
            },
            "this_month": {
                "users": month_users,
                "trips": month_trips
            }
        }
    }

@api_router.get("/admin/users")
async def admin_get_users(admin_phone: str, page: int = 1, limit: int = 20):
    """Tüm kullanıcıları listele"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    skip = (page - 1) * limit
    
    users = await db.users.find({}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents({})
    
    user_list = []
    for user in users:
        user_list.append({
            "id": str(user["_id"]),
            "phone": user.get("phone"),
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
            "city": user.get("city"),
            "is_active": user.get("is_active", True),
            "is_premium": user.get("is_premium", False),
            "created_at": user.get("created_at"),
            "last_login": user.get("last_login"),
            "total_trips": user.get("total_trips", 0),
            "rating": user.get("rating", 5.0),
            "penalty_points": user.get("penalty_points", 0),
            "device_info": user.get("device_info"),
            "last_ip": user.get("last_ip")
        })
    
    return {
        "success": True,
        "users": user_list,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/admin/user/toggle-status")
async def admin_toggle_user_status(admin_phone: str, user_id: str):
    """Kullanıcıyı aktif/pasif yap"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    new_status = not user.get("is_active", True)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": new_status}}
    )
    
    # Log kaydet
    await db.admin_logs.insert_one({
        "admin_phone": admin_phone,
        "action": "toggle_user_status",
        "target_user_id": user_id,
        "new_status": new_status,
        "timestamp": datetime.utcnow()
    })
    
    return {"success": True, "is_active": new_status}

@api_router.post("/admin/user/toggle-premium")
async def admin_toggle_premium(admin_phone: str, user_id: str):
    """Premium üyelik aç/kapat"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    new_premium = not user.get("is_premium", False)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_premium": new_premium}}
    )
    
    return {"success": True, "is_premium": new_premium}

@api_router.get("/admin/calls")
async def admin_get_calls(admin_phone: str, page: int = 1, limit: int = 50):
    """Arama kayıtlarını listele (metadata)"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    skip = (page - 1) * limit
    
    calls = await db.call_logs.find({}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.call_logs.count_documents({})
    
    call_list = []
    for call in calls:
        # Kullanıcı adlarını al
        user = await db.users.find_one({"_id": ObjectId(call.get("user_id"))})
        other_user = await db.users.find_one({"_id": ObjectId(call.get("other_user_id"))})
        
        call_list.append({
            "id": str(call["_id"]),
            "caller_name": f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Bilinmiyor",
            "receiver_name": f"{other_user.get('first_name', '')} {other_user.get('last_name', '')}" if other_user else "Bilinmiyor",
            "duration_seconds": call.get("duration_seconds", 0),
            "call_type": call.get("call_type", "audio"),
            "timestamp": call.get("timestamp")
        })
    
    return {
        "success": True,
        "calls": call_list,
        "total": total,
        "page": page
    }

@api_router.get("/admin/reports")
async def admin_get_reports(admin_phone: str, status: str = "all"):
    """Şikayetleri listele"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    query = {}
    if status != "all":
        query["status"] = status
    
    reports = await db.reports.find(query).sort("created_at", -1).to_list(100)
    
    report_list = []
    for report in reports:
        reporter = await db.users.find_one({"_id": ObjectId(report.get("reporter_id"))})
        reported = await db.users.find_one({"_id": ObjectId(report.get("reported_user_id"))})
        
        report_list.append({
            "id": str(report["_id"]),
            "reporter_name": f"{reporter.get('first_name', '')} {reporter.get('last_name', '')}" if reporter else "Bilinmiyor",
            "reported_name": f"{reported.get('first_name', '')} {reported.get('last_name', '')}" if reported else "Bilinmiyor",
            "reason": report.get("reason"),
            "description": report.get("description"),
            "status": report.get("status"),
            "created_at": report.get("created_at")
        })
    
    return {"success": True, "reports": report_list}

@api_router.post("/admin/report/update-status")
async def admin_update_report_status(admin_phone: str, report_id: str, status: str):
    """Şikayet durumunu güncelle"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    await db.reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    
    return {"success": True}

@api_router.get("/admin/logs")
async def admin_get_logs(admin_phone: str, page: int = 1, limit: int = 100):
    """Admin işlem logları"""
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    skip = (page - 1) * limit
    logs = await db.admin_logs.find({}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    log_list = []
    for log in logs:
        log_list.append({
            "id": str(log["_id"]),
            "admin_phone": log.get("admin_phone"),
            "action": log.get("action"),
            "target_user_id": log.get("target_user_id"),
            "details": log.get("details"),
            "timestamp": log.get("timestamp")
        })
    
    return {"success": True, "logs": log_list}

@api_router.post("/admin/add-admin")
async def admin_add_new_admin(admin_phone: str, new_admin_phone: str, new_admin_name: str):
    """Yeni admin ekle"""
    db = db_instance.db
    
    # Sadece ana admin ekleyebilir
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Sadece ana admin yeni admin ekleyebilir")
    
    # Zaten var mı kontrol et
    existing = await db.admins.find_one({"phone": new_admin_phone})
    if existing:
        raise HTTPException(status_code=400, detail="Bu numara zaten admin")
    
    await db.admins.insert_one({
        "phone": new_admin_phone,
        "name": new_admin_name,
        "is_active": True,
        "added_by": admin_phone,
        "created_at": datetime.utcnow()
    })
    
    return {"success": True, "message": f"{new_admin_name} admin olarak eklendi"}

@api_router.get("/admin/admins")
async def admin_list_admins(admin_phone: str):
    """Admin listesi"""
    db = db_instance.db
    
    if admin_phone not in ADMIN_PHONE_NUMBERS:
        raise HTTPException(status_code=403, detail="Sadece ana admin görebilir")
    
    admins = await db.admins.find({}).to_list(100)
    
    admin_list = [{
        "phone": "5321111111",
        "name": "Ana Admin",
        "is_active": True,
        "is_main": True
    }]
    
    for admin in admins:
        admin_list.append({
            "id": str(admin["_id"]),
            "phone": admin.get("phone"),
            "name": admin.get("name"),
            "is_active": admin.get("is_active", True),
            "is_main": False,
            "created_at": admin.get("created_at")
        })
    
    return {"success": True, "admins": admin_list}


# ==================== YASAL SAYFALAR ====================
@api_router.get("/legal/privacy")
async def get_privacy_policy():
    """Gizlilik Politikası"""
    return {
        "success": True,
        "title": "Gizlilik Politikası",
        "company": "KAREKOD TEKNOLOJİ VE YAZILIM AŞ",
        "last_updated": "2025-01-01",
        "content": """
LEYLEK TAG GİZLİLİK POLİTİKASI

Son Güncelleme: Ocak 2025

KAREKOD TEKNOLOJİ VE YAZILIM AŞ olarak kişisel verilerinizin güvenliği hakkında azami hassasiyet göstermekteyiz. Bu Gizlilik Politikası, Leylek TAG uygulaması üzerinden toplanan kişisel verilerinizin işlenmesine ilişkin esasları açıklamaktadır.

1. TOPLANAN VERİLER
- Telefon numarası (doğrulama için)
- Ad ve Soyad
- Konum bilgisi (yolculuk sırasında)
- Cihaz bilgileri (güvenlik için)
- IP adresi (güvenlik için)

2. VERİLERİN KULLANIM AMACI
- Hizmet sunumu
- Kullanıcı doğrulama
- Güvenlik ve dolandırıcılık önleme
- Müşteri desteği

3. VERİ GÜVENLİĞİ
- Tüm veriler şifrelenmiş olarak saklanır
- Aramalar uçtan uca şifrelidir
- Ses/görüntü kayıtları YAPILMAZ
- Sadece metadata (süre, tarih) saklanır

4. VERİ PAYLAŞIMI
Verileriniz üçüncü taraflarla paylaşılmaz. Ancak yasal zorunluluk halinde yetkili makamlarla paylaşılabilir.

5. HAKLARINIZ
6698 sayılı KVKK kapsamında:
- Verilerinize erişim hakkı
- Düzeltme hakkı
- Silme hakkı (Hesap silme)
- İtiraz hakkı

6. İLETİŞİM
KAREKOD TEKNOLOJİ VE YAZILIM AŞ
E-posta: info@karekodteknoloji.com
Telefon: 0850 307 80 29
Adres: Karanfil Mah. Konur Sokak No:23
"""
    }

@api_router.get("/legal/terms")
async def get_terms_of_service():
    """Kullanım Şartları"""
    return {
        "success": True,
        "title": "Kullanım Şartları",
        "company": "KAREKOD TEKNOLOJİ VE YAZILIM AŞ",
        "last_updated": "2025-01-01",
        "content": """
LEYLEK TAG KULLANIM ŞARTLARI

Son Güncelleme: Ocak 2025

1. GENEL ŞARTLAR
Leylek TAG uygulamasını kullanarak aşağıdaki şartları kabul etmiş olursunuz.

2. HİZMET TANIMI
Leylek TAG, yolcular ve sürücüler arasında bağlantı kuran bir platformdur. Platform yalnızca aracılık hizmeti sunmaktadır.

3. SORUMLULUK REDDİ
⚠️ ÖNEMLİ: KAREKOD TEKNOLOJİ VE YAZILIM AŞ:
- Kullanıcılar arası anlaşmazlıklardan sorumlu değildir
- Yolculuk sırasında oluşabilecek kaza, hasar veya kayıplardan sorumlu değildir
- Sürücülerin davranışlarından sorumlu değildir
- Platform SADECE ARACIDIR

4. KULLANICI YÜKÜMLÜLÜKLERİ
- 18 yaşından büyük olmak
- Doğru bilgi vermek
- Yasalara uygun davranmak
- Diğer kullanıcılara saygılı olmak

5. YASAKLI DAVRANIŞLAR
- Sahte hesap oluşturma
- Taciz veya tehdit
- Yasadışı faaliyetler
- Platformu kötüye kullanma

6. HESAP ASKIYA ALMA
Kurallara uymayan hesaplar geçici veya kalıcı olarak askıya alınabilir.

7. ÜCRETLER
Şu an için hizmet ÜCRETSİZDİR. İleride premium özellikler eklenebilir.

8. DEĞİŞİKLİKLER
Bu şartlar önceden haber verilmeksizin değiştirilebilir.

9. İLETİŞİM
KAREKOD TEKNOLOJİ VE YAZILIM AŞ
E-posta: info@leylekpazar.com
Telefon: 0850 307 80 29
Adres: Karanfil Mah. Konur Sokak No:23
"""
    }

@api_router.get("/legal/kvkk")
async def get_kvkk_consent():
    """KVKK Aydınlatma Metni"""
    return {
        "success": True,
        "title": "Kişisel Verilerin İşlenmesi Hakkında Aydınlatma Metni",
        "company": "KAREKOD TEKNOLOJİ VE YAZILIM AŞ",
        "content": """
KİŞİSEL VERİLERİN İŞLENMESİ HAKKINDA AYDINLATMA METNİ

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, KAREKOD TEKNOLOJİ VE YAZILIM AŞ olarak kişisel verilerinizi aşağıda açıklanan amaçlarla işlemekteyiz.

VERİ SORUMLUSU
KAREKOD TEKNOLOJİ VE YAZILIM AŞ
Karanfil Mah. Konur Sokak No:23

İŞLENEN KİŞİSEL VERİLER
✓ Kimlik bilgileri (Ad, Soyad)
✓ İletişim bilgileri (Telefon numarası)
✓ Konum bilgileri
✓ Cihaz bilgileri
✓ IP adresi

İŞLEME AMAÇLARI
✓ Hizmet sunumu
✓ Kullanıcı doğrulama
✓ Güvenlik sağlama
✓ Yasal yükümlülüklerin yerine getirilmesi

VERİ SAKLAMA SÜRESİ
Veriler, hizmet sunumu süresince ve yasal yükümlülükler kapsamında saklanır.

HAKLARINIZ
KVKK'nın 11. maddesi kapsamında:
- Kişisel verilerinizin işlenip işlenmediğini öğrenme
- İşlenmişse buna ilişkin bilgi talep etme
- İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
- Yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme
- Eksik/yanlış işlenmişse düzeltilmesini isteme
- Silinmesini veya yok edilmesini isteme
- İtiraz etme

ONAY
Bu uygulamayı kullanarak yukarıda belirtilen şartları kabul etmiş olursunuz.
"""
    }


# ==================== HESAP SİLME ====================
@api_router.post("/user/delete-account")
async def delete_user_account(user_id: str, confirmation: str):
    """
    Hesabı kalıcı olarak sil
    confirmation: "HESABIMI SIL" yazılmalı
    """
    if confirmation != "HESABIMI SIL":
        raise HTTPException(status_code=400, detail="Onay metni hatalı. 'HESABIMI SIL' yazın.")
    
    db = db_instance.db
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Aktif yolculuk var mı kontrol et
    active_tag = await db.tags.find_one({
        "$or": [
            {"passenger_id": user_id, "status": {"$in": ["pending", "offers_received", "matched", "in_progress"]}},
            {"driver_id": user_id, "status": {"$in": ["matched", "in_progress"]}}
        ]
    })
    
    if active_tag:
        raise HTTPException(status_code=400, detail="Aktif yolculuğunuz var. Önce yolculuğu tamamlayın.")
    
    # Verileri sil
    await db.users.delete_one({"_id": ObjectId(user_id)})
    await db.tags.delete_many({"passenger_id": user_id})
    await db.offers.delete_many({"driver_id": user_id})
    await db.blocked_users.delete_many({"$or": [{"user_id": user_id}, {"blocked_user_id": user_id}]})
    await db.call_logs.delete_many({"$or": [{"user_id": user_id}, {"other_user_id": user_id}]})
    
    # Log kaydet (anonim)
    await db.deleted_accounts.insert_one({
        "deleted_at": datetime.utcnow(),
        "reason": "user_requested"
    })
    
    logger.info(f"🗑️ Hesap silindi: {user_id}")
    
    return {"success": True, "message": "Hesabınız kalıcı olarak silindi."}


# ==================== KULLANICI AKTİVİTE LOGLARI ====================
@api_router.post("/user/log-activity")
async def log_user_activity(user_id: str, activity_type: str, details: str = ""):
    """Kullanıcı aktivitesi logla"""
    db = db_instance.db
    
    await db.user_activities.insert_one({
        "user_id": user_id,
        "activity_type": activity_type,
        "details": details,
        "timestamp": datetime.utcnow()
    })
    
    return {"success": True}

@api_router.post("/user/update-device-info")
async def update_device_info(user_id: str, device_model: str = "", os_version: str = "", app_version: str = ""):
    """Cihaz bilgilerini güncelle"""
    from fastapi import Request
    
    db = db_instance.db
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "device_info": {
                "model": device_model,
                "os_version": os_version,
                "app_version": app_version,
                "updated_at": datetime.utcnow()
            }
        }}
    )
    
    return {"success": True}


# ==================== BİLDİRİM SİSTEMİ ====================
@api_router.post("/admin/send-notification")
async def admin_send_notification(admin_phone: str, title: str, message: str, user_ids: list = None):
    """
    Bildirim gönder
    user_ids: None ise herkese, liste ise sadece o kullanıcılara
    """
    db = db_instance.db
    
    # Admin kontrolü
    is_admin = admin_phone in ADMIN_PHONE_NUMBERS
    if not is_admin:
        admin = await db.admins.find_one({"phone": admin_phone, "is_active": True})
        if not admin:
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    
    notification = {
        "title": title,
        "message": message,
        "target_users": user_ids,  # None = herkese
        "sent_by": admin_phone,
        "created_at": datetime.utcnow(),
        "read_by": []
    }
    
    result = await db.notifications.insert_one(notification)
    
    return {"success": True, "notification_id": str(result.inserted_id)}

@api_router.get("/user/notifications")
async def get_user_notifications(user_id: str):
    """Kullanıcının bildirimlerini al"""
    db = db_instance.db
    
    # Tüm bildirimleri veya kullanıcıya özel bildirimleri al
    notifications = await db.notifications.find({
        "$or": [
            {"target_users": None},  # Herkese
            {"target_users": user_id}  # Bu kullanıcıya
        ]
    }).sort("created_at", -1).limit(50).to_list(50)
    
    notif_list = []
    for notif in notifications:
        notif_list.append({
            "id": str(notif["_id"]),
            "title": notif.get("title"),
            "message": notif.get("message"),
            "created_at": notif.get("created_at"),
            "is_read": user_id in notif.get("read_by", [])
        })
    
    return {"success": True, "notifications": notif_list}

@api_router.post("/user/mark-notification-read")
async def mark_notification_read(user_id: str, notification_id: str):
    """Bildirimi okundu işaretle"""
    db = db_instance.db
    
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$addToSet": {"read_by": user_id}}
    )
    
    return {"success": True}



# ==================== AGORA TOKEN SYSTEM ====================
from agora_token_builder import RtcTokenBuilder

# Role değerleri
ROLE_PUBLISHER = 1
ROLE_SUBSCRIBER = 2

AGORA_APP_ID = os.getenv("AGORA_APP_ID", "43c07f0cef814fd4a5ae3283c8bd77de")
AGORA_APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE", "32b612f5a7c7469188a17a3c3a2efd73")

@app.get("/api/agora/token")
async def get_agora_token(channel_name: str, uid: int = 0):
    """
    Agora RTC Token oluştur
    - Secure Mode için gerekli
    - Token 24 saat geçerli
    """
    try:
        import time
        
        # Token geçerlilik süresi (24 saat)
        expiration_time_in_seconds = 86400
        current_timestamp = int(time.time())
        privilege_expired_ts = current_timestamp + expiration_time_in_seconds
        
        # Token oluştur
        token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channel_name,
            uid,
            ROLE_PUBLISHER,
            privilege_expired_ts
        )
        
        logger.info(f"🔑 Agora Token oluşturuldu: channel={channel_name}, uid={uid}")
        
        return {
            "success": True,
            "token": token,
            "app_id": AGORA_APP_ID,
            "channel": channel_name,
            "uid": uid,
            "expires_in": expiration_time_in_seconds
        }
    except Exception as e:
        logger.error(f"Agora token hatası: {str(e)}")
        return {"success": False, "detail": str(e)}



# ==================== ZORLA BİTİR ====================
@api_router.post("/trip/force-end")
async def force_end_trip(tag_id: str, user_id: str):
    """
    Yolculuğu ZORLA bitir
    - Onay beklemeden bitirir
    - Zorla bitiren kişinin puanı düşer (-1 puan)
    """
    try:
        db = db_instance.db
        
        tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
        if not tag:
            return {"success": False, "detail": "TAG bulunamadı"}
        
        # Kullanıcı bu TAG'ın parçası mı?
        is_passenger = tag.get("passenger_id") == user_id
        is_driver = tag.get("driver_id") == user_id
        
        if not is_passenger and not is_driver:
            return {"success": False, "detail": "Bu yolculuğa erişim yetkiniz yok"}
        
        # TAG'ı zorla bitir
        await db.tags.update_one(
            {"_id": ObjectId(tag_id)},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.utcnow(),
                "force_ended": True,
                "force_ended_by": user_id
            }}
        )
        
        # Zorla bitiren kişinin puanını düşür
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"penalty_points": 1, "rating": -1.0}}
        )
        
        # Bekleyen istekleri temizle
        await db.trip_end_requests.delete_many({"tag_id": tag_id})
        
        logger.warning(f"⚠️ ZORLA BİTİRİLDİ: TAG {tag_id} by {user_id} (-1 puan cezası)")
        
        return {
            "success": True,
            "message": "Yolculuk zorla bitirildi. -1 puan cezası uygulandı."
        }
    except Exception as e:
        logger.error(f"Force end error: {str(e)}")
        return {"success": False, "detail": str(e)}

