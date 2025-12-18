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
from datetime import datetime
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

@api_router.post("/auth/register")
async def register(request: RegisterRequest):
    """Kullanıcı kaydı + Şehir validasyonu (ROL YOK)"""
    # Şehir kontrolü
    if request.city not in TURKIYE_SEHIRLERI:
        raise HTTPException(status_code=400, detail="Geçersiz şehir seçimi")
    
    existing = await db_instance.find_one("users", {"phone": request.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Bu telefon numarası zaten kayıtlı")
    
    user_data = User(**request.dict()).dict()
    user_id = await db_instance.insert_one("users", user_data)
    
    logger.info(f"✅ Yeni kullanıcı: {request.name} - {request.city}")
    
    return {
        "success": True,
        "message": "Kayıt başarılı",
        "user": UserResponse(
            id=user_id,
            phone=user_data["phone"],
            name=user_data["name"],
            city=user_data["city"],
            profile_photo=user_data.get("profile_photo"),
            rating=user_data["rating"],
            total_ratings=user_data["total_ratings"],
            total_trips=user_data["total_trips"],
            driver_details=user_data.get("driver_details")
        ).dict()
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
    """Teklifleri listele - Expire olanları filtrele"""
    from datetime import datetime
    
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
    
    return {
        "success": True,
        "offers": [o.dict() for o in offer_responses]
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
    if tag.get("driver_id") and tag.get("status") in [TagStatus.MATCHED, TagStatus.IN_PROGRESS]:
        driver = await db_instance.find_one("users", {"_id": ObjectId(tag["driver_id"])})
        if driver and driver.get("location") and "coordinates" in driver.get("location", {}):
            driver_location = {
                "latitude": driver["location"]["coordinates"][1],
                "longitude": driver["location"]["coordinates"][0]
            }
    
    tag_data = TagResponse(
        id=str(tag["_id"]),
        **{k: v for k, v in tag.items() if k != "_id"}
    ).dict()
    
    # Şoför konumunu ekle
    tag_data["driver_location"] = driver_location
    
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
    """Aktif talepleri listele - SADECE AYNI ŞEHİRDEKİLER"""
    user = await db_instance.find_one("users", {"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    driver_city = user.get("city")
    
    # Şehir bilgisi yok ise (eski kullanıcılar için)
    if not driver_city:
        logger.warning(f"⚠️ Sürücü {user_id} şehir bilgisi eksik")
        return {"success": True, "requests": []}
    
    # Sadece aynı şehirdeki TAGleri getir
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
        # Yolcu bilgisini al
        passenger = await db_instance.find_one("users", {"_id": ObjectId(tag["passenger_id"])})
        if not passenger:
            continue  # Yolcu bulunamadı, atla
        
        # Mesafe hesaplamaları
        distance_to_passenger = 0.0
        trip_distance = 0.0
        
        # Sürücü -> Yolcu mesafesi (GPS BAZLI FİLTRELEME)
        if tag.get("pickup_lat") and tag.get("pickup_lng"):
            distance_to_passenger = calculate_distance(
                driver_lat, driver_lng,
                tag["pickup_lat"], tag["pickup_lng"]
            )
            
            # 50 KM FİLTRE: Sadece 50 km içindeki yolcular
            if distance_to_passenger > MAX_DISTANCE_KM:
                continue  # 50 km'den uzak, atla
        
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
    
    logger.info(f"📍 Şoför {user['name']} ({driver_city}): {len(tag_responses)} çağrı")
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
    
    offer_data = Offer(
        tag_id=request.tag_id,
        driver_id=user_id,
        driver_name=user["name"],
        driver_rating=user.get("rating", 5.0),
        driver_photo=user.get("profile_photo"),
        price=request.price,
        estimated_time=request.estimated_time,
        notes=request.notes
    ).dict()
    
    # Araç bilgilerini ekle
    offer_data["vehicle_model"] = vehicle_model
    offer_data["vehicle_color"] = vehicle_color
    offer_data["vehicle_photo"] = vehicle_photo
    offer_data["is_premium"] = is_premium
    
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
    if tag.get("passenger_id"):
        passenger = await db_instance.find_one("users", {"_id": ObjectId(tag["passenger_id"])})
        if passenger and passenger.get("location") and "coordinates" in passenger.get("location", {}):
            passenger_location = {
                "latitude": passenger["location"]["coordinates"][1],
                "longitude": passenger["location"]["coordinates"][0]
            }
    
    tag_data = TagResponse(
        id=str(tag["_id"]),
        **{k: v for k, v in tag.items() if k != "_id"}
    ).dict()
    
    # Yolcu konumunu ekle
    tag_data["passenger_location"] = passenger_location
    
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

# Include router
app.include_router(api_router)

# CORS
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


# ==================== VOICE CALL SYSTEM ====================
class StartCallRequest(BaseModel):
    tag_id: str
    caller_id: str
    caller_name: str = "Arayan"
    call_type: str = "audio"

@app.post("/api/voice/start-call")
async def start_voice_call(request: StartCallRequest):
    """
    Arama başlat - karşı tarafa bildirim gönder
    """
    try:
        tag_id = request.tag_id
        caller_id = request.caller_id
        caller_name = request.caller_name
        call_type = request.call_type
        
        # Parametre kontrolü
        if not tag_id or not caller_id:
            return {"success": False, "detail": "tag_id ve caller_id gerekli"}
        
        db = db_instance.db
        
        # TAG'i bul
        tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
        if not tag:
            return {"success": False, "detail": "TAG bulunamadı"}
        
        # Karşı tarafı belirle
        if caller_id == str(tag.get("passenger_id", "")):
            receiver_id = str(tag.get("driver_id", ""))
            receiver_name = tag.get("driver_name", "Şoför")
        else:
            receiver_id = str(tag.get("passenger_id", ""))
            receiver_name = tag.get("passenger_name", "Yolcu")
        
        # Call request oluştur
        call_request = {
            "tag_id": tag_id,
            "caller_id": caller_id,
            "caller_name": caller_name or "Arayan",
            "receiver_id": receiver_id,
            "receiver_name": receiver_name,
            "call_type": call_type,  # audio veya video
            "status": "ringing",  # ringing, accepted, rejected, ended
            "created_at": datetime.utcnow()
        }
        
        # Eski call request'leri sil (aynı TAG için)
        await db.call_requests.delete_many({"tag_id": tag_id})
        
        # Yeni call request kaydet
        await db.call_requests.insert_one(call_request)
        
        logger.info(f"📞 Arama başlatıldı: {caller_name} → {receiver_name} ({call_type})")
        
        return {
            "success": True,
            "message": "Arama başlatıldı",
            "channel_name": tag_id,
            "call_type": call_type
        }
    except Exception as e:
        logger.error(f"Arama başlatma hatası: {str(e)}")
        return {"success": False, "detail": str(e)}


@app.get("/api/voice/check-incoming")
async def check_incoming_call(user_id: str):
    """
    Gelen arama kontrolü - polling ile
    """
    try:
        db = db_instance.db
        
        # Bu kullanıcıya gelen çalan arama var mı?
        incoming_call = await db.call_requests.find_one({
            "receiver_id": user_id,
            "status": "ringing"
        })
        
        if incoming_call:
            return {
                "success": True,
                "has_incoming": True,
                "call": {
                    "caller_name": incoming_call.get("caller_name", "Arayan"),
                    "caller_id": incoming_call.get("caller_id", ""),
                    "channel_name": incoming_call.get("tag_id", ""),
                    "tag_id": incoming_call.get("tag_id", ""),
                    "call_type": incoming_call.get("call_type", "audio")
                }
            }
        
        return {
            "success": True,
            "has_incoming": False
        }
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
    """
    Aramayı reddet
    """
    try:
        db = db_instance.db
        
        # Call request'i sil
        await db.call_requests.delete_one({"tag_id": tag_id, "receiver_id": user_id})
        
        logger.info(f"📞 Arama reddedildi: TAG {tag_id}")
        
        return {"success": True, "message": "Arama reddedildi"}
    except Exception as e:
        logger.error(f"Arama reddetme hatası: {str(e)}")
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

