from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from bson import ObjectId
from enum import Enum
import random
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'leylek_tag')]

# Create the main app
app = FastAPI(title="Leylek TAG API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================
class UserRole(str, Enum):
    PASSENGER = "passenger"
    DRIVER = "driver"

class TagStatus(str, Enum):
    PENDING = "pending"  # Yolcu talebi oluşturuldu
    OFFERS_RECEIVED = "offers_received"  # Teklifler geldi
    MATCHED = "matched"  # Eşleşme yapıldı
    IN_PROGRESS = "in_progress"  # Yolculuk başladı
    COMPLETED = "completed"  # Tamamlandı
    CANCELLED = "cancelled"  # İptal edildi

class OfferStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

# ==================== PYDANTIC MODELS ====================
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        return {"type": "string"}

# AUTH MODELS
class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str

class RegisterRequest(BaseModel):
    phone: str
    name: str
    role: UserRole

class User(BaseModel):
    phone: str
    name: str
    role: UserRole
    rating: float = 5.0
    total_ratings: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserResponse(BaseModel):
    id: str
    phone: str
    name: str
    role: UserRole
    rating: float
    total_ratings: int

# TAG MODELS
class CreateTagRequest(BaseModel):
    pickup_location: str
    dropoff_location: str
    notes: Optional[str] = None

class SendOfferRequest(BaseModel):
    tag_id: str
    price: float
    estimated_time: int  # dakika cinsinden
    notes: Optional[str] = None

class AcceptOfferRequest(BaseModel):
    tag_id: str
    offer_id: str

class Offer(BaseModel):
    driver_id: str
    driver_name: str
    driver_rating: float
    price: float
    estimated_time: int
    notes: Optional[str] = None
    status: OfferStatus = OfferStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OfferResponse(BaseModel):
    id: str
    driver_id: str
    driver_name: str
    driver_rating: float
    price: float
    estimated_time: int
    notes: Optional[str] = None
    status: OfferStatus
    created_at: datetime

class Tag(BaseModel):
    passenger_id: str
    passenger_name: str
    pickup_location: str
    dropoff_location: str
    notes: Optional[str] = None
    status: TagStatus = TagStatus.PENDING
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    accepted_offer_id: Optional[str] = None
    final_price: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    matched_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class TagResponse(BaseModel):
    id: str
    passenger_id: str
    passenger_name: str
    pickup_location: str
    dropoff_location: str
    notes: Optional[str] = None
    status: TagStatus
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    final_price: Optional[float] = None
    created_at: datetime
    matched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

# CALL MODELS
class InitiateCallRequest(BaseModel):
    tag_id: str
    caller_id: str

class CallSignal(BaseModel):
    tag_id: str
    user_id: str
    signal_type: str  # offer, answer, ice-candidate
    signal_data: dict

class EndCallRequest(BaseModel):
    tag_id: str
    caller_id: str
    duration: int  # saniye

class CallLog(BaseModel):
    tag_id: str
    caller_id: str
    receiver_id: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    duration: Optional[int] = None
    caller_ip: Optional[str] = None
    receiver_ip: Optional[str] = None

# RATING MODELS
class SubmitRatingRequest(BaseModel):
    tag_id: str
    rated_user_id: str
    rating: int  # 1-5 arası
    comment: Optional[str] = None

class Rating(BaseModel):
    tag_id: str
    rater_id: str
    rated_user_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== AUTH ENDPOINTS ====================
@api_router.post("/auth/send-otp")
async def send_otp(request: SendOTPRequest):
    """
    SMS gönderme (Mock) - İleride NetGSM entegrasyonu
    """
    # Mock: Gerçek SMS gönderme yok, sadece log
    logger.info(f"OTP gönderildi: {request.phone} -> 123456 (MOCK)")
    
    return {
        "success": True,
        "message": "OTP gönderildi (Test: 123456)",
        "phone": request.phone
    }

@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """
    OTP doğrulama (Mock)
    """
    # Mock: Her zaman 123456 kabul ediliyor
    if request.otp != "123456":
        raise HTTPException(status_code=400, detail="Geçersiz OTP")
    
    # Kullanıcı var mı kontrol et
    user = await db.users.find_one({"phone": request.phone})
    
    return {
        "success": True,
        "message": "OTP doğrulandı",
        "user_exists": user is not None,
        "user": UserResponse(
            id=str(user["_id"]),
            phone=user["phone"],
            name=user["name"],
            role=user["role"],
            rating=user.get("rating", 5.0),
            total_ratings=user.get("total_ratings", 0)
        ).dict() if user else None
    }

@api_router.post("/auth/register")
async def register(request: RegisterRequest):
    """
    Kullanıcı kaydı ve rol seçimi
    """
    # Kullanıcı zaten var mı?
    existing = await db.users.find_one({"phone": request.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Bu telefon numarası zaten kayıtlı")
    
    user_data = User(**request.dict()).dict()
    result = await db.users.insert_one(user_data)
    user_data["_id"] = result.inserted_id
    
    return {
        "success": True,
        "message": "Kayıt başarılı",
        "user": UserResponse(
            id=str(result.inserted_id),
            phone=user_data["phone"],
            name=user_data["name"],
            role=user_data["role"],
            rating=user_data["rating"],
            total_ratings=user_data["total_ratings"]
        ).dict()
    }

@api_router.get("/auth/user/{user_id}")
async def get_user(user_id: str):
    """
    Kullanıcı bilgilerini getir
    """
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    return UserResponse(
        id=str(user["_id"]),
        phone=user["phone"],
        name=user["name"],
        role=user["role"],
        rating=user.get("rating", 5.0),
        total_ratings=user.get("total_ratings", 0)
    )

# ==================== PASSENGER ENDPOINTS ====================
@api_router.post("/passenger/create-request")
async def create_request(user_id: str, request: CreateTagRequest):
    """
    Yolcu yolculuk talebi oluşturur
    """
    # Kullanıcıyı bul
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user["role"] != UserRole.PASSENGER:
        raise HTTPException(status_code=403, detail="Sadece yolcular talep oluşturabilir")
    
    # Aktif TAG var mı kontrol et
    active_tag = await db.tags.find_one({
        "passenger_id": user_id,
        "status": {"$in": [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED, TagStatus.MATCHED, TagStatus.IN_PROGRESS]}
    })
    if active_tag:
        raise HTTPException(status_code=400, detail="Zaten aktif bir TAG'ınız var")
    
    tag_data = Tag(
        passenger_id=user_id,
        passenger_name=user["name"],
        pickup_location=request.pickup_location,
        dropoff_location=request.dropoff_location,
        notes=request.notes
    ).dict()
    
    result = await db.tags.insert_one(tag_data)
    tag_data["_id"] = result.inserted_id
    
    return {
        "success": True,
        "message": "Talep oluşturuldu",
        "tag": TagResponse(
            id=str(result.inserted_id),
            passenger_id=tag_data["passenger_id"],
            passenger_name=tag_data["passenger_name"],
            pickup_location=tag_data["pickup_location"],
            dropoff_location=tag_data["dropoff_location"],
            notes=tag_data.get("notes"),
            status=tag_data["status"],
            driver_id=tag_data.get("driver_id"),
            driver_name=tag_data.get("driver_name"),
            final_price=tag_data.get("final_price"),
            created_at=tag_data["created_at"],
            matched_at=tag_data.get("matched_at"),
            completed_at=tag_data.get("completed_at")
        ).dict()
    }

@api_router.get("/passenger/offers/{tag_id}")
async def get_offers(tag_id: str, user_id: str):
    """
    Yolcu için gelen teklifleri listele
    """
    # TAG'i bul ve doğrula
    tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["passenger_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    # Teklifleri getir
    offers = await db.offers.find({"tag_id": tag_id}).to_list(100)
    
    offer_responses = []
    for offer in offers:
        offer_responses.append(OfferResponse(
            id=str(offer["_id"]),
            driver_id=offer["driver_id"],
            driver_name=offer["driver_name"],
            driver_rating=offer["driver_rating"],
            price=offer["price"],
            estimated_time=offer["estimated_time"],
            notes=offer.get("notes"),
            status=offer["status"],
            created_at=offer["created_at"]
        ))
    
    return {
        "success": True,
        "offers": [o.dict() for o in offer_responses]
    }

@api_router.post("/passenger/accept-offer")
async def accept_offer(user_id: str, request: AcceptOfferRequest):
    """
    Yolcu bir teklifi kabul eder ve eşleşme başlar
    """
    # TAG'i bul
    tag = await db.tags.find_one({"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["passenger_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    # Teklifi bul
    offer = await db.offers.find_one({"_id": ObjectId(request.offer_id), "tag_id": request.tag_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    
    # TAG'i güncelle
    await db.tags.update_one(
        {"_id": ObjectId(request.tag_id)},
        {
            "$set": {
                "status": TagStatus.MATCHED,
                "driver_id": offer["driver_id"],
                "driver_name": offer["driver_name"],
                "accepted_offer_id": request.offer_id,
                "final_price": offer["price"],
                "matched_at": datetime.utcnow()
            }
        }
    )
    
    # Teklifi kabul edildi olarak işaretle
    await db.offers.update_one(
        {"_id": ObjectId(request.offer_id)},
        {"$set": {"status": OfferStatus.ACCEPTED}}
    )
    
    # Diğer teklifleri reddet
    await db.offers.update_many(
        {"tag_id": request.tag_id, "_id": {"$ne": ObjectId(request.offer_id)}},
        {"$set": {"status": OfferStatus.REJECTED}}
    )
    
    return {
        "success": True,
        "message": "Teklif kabul edildi, eşleşme başarılı!"
    }

@api_router.get("/passenger/active-tag")
async def get_passenger_active_tag(user_id: str):
    """
    Yolcunun aktif TAG'ini getir
    """
    tag = await db.tags.find_one({
        "passenger_id": user_id,
        "status": {"$in": [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED, TagStatus.MATCHED, TagStatus.IN_PROGRESS]}
    })
    
    if not tag:
        return {"success": True, "tag": None}
    
    # Teklif sayısını getir
    offer_count = await db.offers.count_documents({"tag_id": str(tag["_id"])})
    
    return {
        "success": True,
        "tag": TagResponse(
            id=str(tag["_id"]),
            passenger_id=tag["passenger_id"],
            passenger_name=tag["passenger_name"],
            pickup_location=tag["pickup_location"],
            dropoff_location=tag["dropoff_location"],
            notes=tag.get("notes"),
            status=tag["status"],
            driver_id=tag.get("driver_id"),
            driver_name=tag.get("driver_name"),
            final_price=tag.get("final_price"),
            created_at=tag["created_at"],
            matched_at=tag.get("matched_at"),
            completed_at=tag.get("completed_at")
        ).dict(),
        "offer_count": offer_count
    }

# ==================== DRIVER ENDPOINTS ====================
@api_router.get("/driver/requests")
async def get_driver_requests(user_id: str):
    """
    Sürücü için aktif talepleri listele
    """
    # Kullanıcıyı doğrula
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user["role"] != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Sadece sürücüler talepleri görebilir")
    
    # PENDING veya OFFERS_RECEIVED durumundaki TAG'leri getir
    tags = await db.tags.find({
        "status": {"$in": [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED]}
    }).to_list(100)
    
    tag_responses = []
    for tag in tags:
        # Bu sürücü teklif vermiş mi?
        driver_offer = await db.offers.find_one({
            "tag_id": str(tag["_id"]),
            "driver_id": user_id
        })
        
        tag_responses.append({
            **TagResponse(
                id=str(tag["_id"]),
                passenger_id=tag["passenger_id"],
                passenger_name=tag["passenger_name"],
                pickup_location=tag["pickup_location"],
                dropoff_location=tag["dropoff_location"],
                notes=tag.get("notes"),
                status=tag["status"],
                driver_id=tag.get("driver_id"),
                driver_name=tag.get("driver_name"),
                final_price=tag.get("final_price"),
                created_at=tag["created_at"],
                matched_at=tag.get("matched_at"),
                completed_at=tag.get("completed_at")
            ).dict(),
            "has_offered": driver_offer is not None
        })
    
    return {
        "success": True,
        "requests": tag_responses
    }

@api_router.post("/driver/send-offer")
async def send_offer(user_id: str, request: SendOfferRequest):
    """
    Sürücü bir talep için teklif gönderir
    """
    # Kullanıcıyı bul
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user["role"] != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Sadece sürücüler teklif gönderebilir")
    
    # TAG'i bul
    tag = await db.tags.find_one({"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["status"] not in [TagStatus.PENDING, TagStatus.OFFERS_RECEIVED]:
        raise HTTPException(status_code=400, detail="Bu TAG artık teklif kabul etmiyor")
    
    # Daha önce teklif vermiş mi?
    existing_offer = await db.offers.find_one({
        "tag_id": request.tag_id,
        "driver_id": user_id
    })
    if existing_offer:
        raise HTTPException(status_code=400, detail="Bu talep için zaten teklif verdiniz")
    
    # Teklifi kaydet
    offer_data = Offer(
        driver_id=user_id,
        driver_name=user["name"],
        driver_rating=user.get("rating", 5.0),
        price=request.price,
        estimated_time=request.estimated_time,
        notes=request.notes
    ).dict()
    offer_data["tag_id"] = request.tag_id
    
    result = await db.offers.insert_one(offer_data)
    
    # TAG durumunu güncelle
    await db.tags.update_one(
        {"_id": ObjectId(request.tag_id)},
        {"$set": {"status": TagStatus.OFFERS_RECEIVED}}
    )
    
    return {
        "success": True,
        "message": "Teklif gönderildi",
        "offer_id": str(result.inserted_id)
    }

@api_router.get("/driver/active-tag")
async def get_driver_active_tag(user_id: str):
    """
    Sürücünün aktif TAG'ini getir (eşleştiği)
    """
    tag = await db.tags.find_one({
        "driver_id": user_id,
        "status": {"$in": [TagStatus.MATCHED, TagStatus.IN_PROGRESS]}
    })
    
    if not tag:
        return {"success": True, "tag": None}
    
    return {
        "success": True,
        "tag": TagResponse(
            id=str(tag["_id"]),
            passenger_id=tag["passenger_id"],
            passenger_name=tag["passenger_name"],
            pickup_location=tag["pickup_location"],
            dropoff_location=tag["dropoff_location"],
            notes=tag.get("notes"),
            status=tag["status"],
            driver_id=tag.get("driver_id"),
            driver_name=tag.get("driver_name"),
            final_price=tag.get("final_price"),
            created_at=tag["created_at"],
            matched_at=tag.get("matched_at"),
            completed_at=tag.get("completed_at")
        ).dict()
    }

@api_router.post("/driver/start-tag/{tag_id}")
async def start_tag(tag_id: str, user_id: str):
    """
    Sürücü TAG'ı başlatır (yolcuya doğru hareket ediyor)
    """
    tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["driver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    await db.tags.update_one(
        {"_id": ObjectId(tag_id)},
        {
            "$set": {
                "status": TagStatus.IN_PROGRESS,
                "started_at": datetime.utcnow()
            }
        }
    )
    
    return {"success": True, "message": "Yolculuk başlatıldı"}

@api_router.post("/driver/complete-tag/{tag_id}")
async def complete_tag(tag_id: str, user_id: str):
    """
    Sürücü TAG'ı tamamlar
    """
    tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["driver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG size ait değil")
    
    await db.tags.update_one(
        {"_id": ObjectId(tag_id)},
        {
            "$set": {
                "status": TagStatus.COMPLETED,
                "completed_at": datetime.utcnow()
            }
        }
    )
    
    return {"success": True, "message": "Yolculuk tamamlandı"}

# ==================== TAG ENDPOINTS ====================
@api_router.get("/tag/{tag_id}")
async def get_tag(tag_id: str, user_id: str):
    """
    TAG detayını getir
    """
    tag = await db.tags.find_one({"_id": ObjectId(tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    
    # Kullanıcı bu TAG'e dahil mi?
    if tag["passenger_id"] != user_id and tag.get("driver_id") != user_id:
        raise HTTPException(status_code=403, detail="Bu TAG'e erişim yetkiniz yok")
    
    return {
        "success": True,
        "tag": TagResponse(
            id=str(tag["_id"]),
            passenger_id=tag["passenger_id"],
            passenger_name=tag["passenger_name"],
            pickup_location=tag["pickup_location"],
            dropoff_location=tag["dropoff_location"],
            notes=tag.get("notes"),
            status=tag["status"],
            driver_id=tag.get("driver_id"),
            driver_name=tag.get("driver_name"),
            final_price=tag.get("final_price"),
            created_at=tag["created_at"],
            matched_at=tag.get("matched_at"),
            completed_at=tag.get("completed_at")
        ).dict()
    }

# ==================== CALL ENDPOINTS ====================
@api_router.post("/call/initiate")
async def initiate_call(request: InitiateCallRequest):
    """
    Sesli arama başlatır ve log kaydı oluşturur
    """
    # TAG'i kontrol et
    tag = await db.tags.find_one({"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["status"] not in [TagStatus.MATCHED, TagStatus.IN_PROGRESS]:
        raise HTTPException(status_code=400, detail="Bu TAG'de arama yapılamaz")
    
    # Arayan ve alıcıyı belirle
    if request.caller_id == tag["passenger_id"]:
        receiver_id = tag["driver_id"]
    elif request.caller_id == tag.get("driver_id"):
        receiver_id = tag["passenger_id"]
    else:
        raise HTTPException(status_code=403, detail="Bu TAG'de arama yapma yetkiniz yok")
    
    # Call log oluştur
    call_log = CallLog(
        tag_id=request.tag_id,
        caller_id=request.caller_id,
        receiver_id=receiver_id
    ).dict()
    
    result = await db.call_logs.insert_one(call_log)
    
    return {
        "success": True,
        "call_id": str(result.inserted_id),
        "receiver_id": receiver_id
    }

@api_router.post("/call/signal")
async def signal_call(signal: CallSignal):
    """
    WebRTC signaling için kullanılır
    """
    # Bu endpoint gerçek zamanlı WebRTC signaling için kullanılır
    # Şu an basit bir log tutuyoruz
    logger.info(f"Signal alındı: {signal.signal_type} - Tag: {signal.tag_id}")
    
    return {"success": True}

@api_router.post("/call/end")
async def end_call(request: EndCallRequest):
    """
    Aramayı sonlandırır ve log'u tamamlar
    """
    # En son call log'u bul ve güncelle
    call_log = await db.call_logs.find_one(
        {"tag_id": request.tag_id, "caller_id": request.caller_id},
        sort=[("started_at", -1)]
    )
    
    if call_log:
        await db.call_logs.update_one(
            {"_id": call_log["_id"]},
            {
                "$set": {
                    "ended_at": datetime.utcnow(),
                    "duration": request.duration
                }
            }
        )
    
    return {"success": True, "message": "Arama sonlandırıldı"}

# ==================== RATING ENDPOINTS ====================
@api_router.post("/rating/submit")
async def submit_rating(user_id: str, request: SubmitRatingRequest):
    """
    Kullanıcı karşı tarafa puan verir
    """
    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="Puan 1-5 arasında olmalıdır")
    
    # TAG'i kontrol et
    tag = await db.tags.find_one({"_id": ObjectId(request.tag_id)})
    if not tag:
        raise HTTPException(status_code=404, detail="TAG bulunamadı")
    if tag["status"] != TagStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Sadece tamamlanmış TAG'ler için puan verilebilir")
    
    # Daha önce puan verilmiş mi?
    existing = await db.ratings.find_one({
        "tag_id": request.tag_id,
        "rater_id": user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Bu TAG için zaten puan verdiniz")
    
    # Rating kaydet
    rating_data = Rating(
        tag_id=request.tag_id,
        rater_id=user_id,
        rated_user_id=request.rated_user_id,
        rating=request.rating,
        comment=request.comment
    ).dict()
    
    await db.ratings.insert_one(rating_data)
    
    # Kullanıcının ortalama puanını güncelle
    user_ratings = await db.ratings.find({"rated_user_id": request.rated_user_id}).to_list(1000)
    avg_rating = sum([r["rating"] for r in user_ratings]) / len(user_ratings)
    
    await db.users.update_one(
        {"_id": ObjectId(request.rated_user_id)},
        {
            "$set": {
                "rating": round(avg_rating, 1),
                "total_ratings": len(user_ratings)
            }
        }
    )
    
    return {"success": True, "message": "Puan verildi"}

@api_router.get("/rating/check/{tag_id}")
async def check_rating(tag_id: str, user_id: str):
    """
    Kullanıcı bu TAG için puan vermiş mi kontrol et
    """
    rating = await db.ratings.find_one({
        "tag_id": tag_id,
        "rater_id": user_id
    })
    
    return {
        "success": True,
        "has_rated": rating is not None
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.get("/")
async def root():
    return {"message": "Leylek TAG API", "version": "1.0.0"}
