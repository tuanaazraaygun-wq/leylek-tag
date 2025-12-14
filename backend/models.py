"""Pydantic models for Leylek TAG"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# ==================== TÜRKİYE ŞEHİRLERİ ====================
TURKIYE_SEHIRLERI = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya",
    "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik",
    "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum",
    "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
    "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
    "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis",
    "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa",
    "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize",
    "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Şırnak", "Sivas", "Tekirdağ",
    "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
]

# ==================== ENUMS ====================
class UserRole(str, Enum):
    PASSENGER = "passenger"
    DRIVER = "driver"

class TagStatus(str, Enum):
    PENDING = "pending"
    OFFERS_RECEIVED = "offers_received"
    MATCHED = "matched"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class OfferStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

class VehicleType(str, Enum):
    SEDAN = "sedan"
    SUV = "suv"
    VAN = "van"
    HATCHBACK = "hatchback"

# ==================== USER MODELS ====================
class DriverDetails(BaseModel):
    license_number: Optional[str] = None
    license_photo: Optional[str] = None  # base64
    vehicle_type: Optional[VehicleType] = None
    vehicle_plate: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_photo: Optional[str] = None  # base64
    is_verified: bool = False

class User(BaseModel):
    phone: str
    name: str
    role: UserRole
    city: str  # Kullanıcının şehri (zorunlu)
    profile_photo: Optional[str] = None  # base64
    rating: float = 5.0
    total_ratings: int = 0
    total_trips: int = 0
    driver_details: Optional[DriverDetails] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: datetime = Field(default_factory=datetime.utcnow)

class UserResponse(BaseModel):
    id: str
    phone: str
    name: str
    role: UserRole
    city: str
    profile_photo: Optional[str] = None
    rating: float
    total_ratings: int
    total_trips: int
    driver_details: Optional[DriverDetails] = None

# ==================== AUTH MODELS ====================
class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str

class RegisterRequest(BaseModel):
    phone: str
    name: str
    role: UserRole
    city: str  # Şehir seçimi zorunlu

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    profile_photo: Optional[str] = None

class UpdateDriverDetailsRequest(BaseModel):
    license_number: Optional[str] = None
    license_photo: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    vehicle_plate: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_photo: Optional[str] = None

# ==================== TAG MODELS ====================
class CreateTagRequest(BaseModel):
    pickup_location: str
    dropoff_location: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    notes: Optional[str] = None

class Tag(BaseModel):
    passenger_id: str
    passenger_name: str
    pickup_location: str
    dropoff_location: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    notes: Optional[str] = None
    status: TagStatus = TagStatus.PENDING
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    accepted_offer_id: Optional[str] = None
    final_price: Optional[float] = None
    emergency_shared: bool = False
    share_link: Optional[str] = None
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
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    notes: Optional[str] = None
    status: TagStatus
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    final_price: Optional[float] = None
    emergency_shared: bool = False
    share_link: Optional[str] = None
    created_at: datetime
    matched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

# ==================== OFFER MODELS ====================
class SendOfferRequest(BaseModel):
    tag_id: str
    price: float
    estimated_time: int
    notes: Optional[str] = None

class Offer(BaseModel):
    tag_id: str
    driver_id: str
    driver_name: str
    driver_rating: float
    driver_photo: Optional[str] = None
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
    driver_photo: Optional[str] = None
    price: float
    estimated_time: int
    notes: Optional[str] = None
    status: OfferStatus
    created_at: datetime

class AcceptOfferRequest(BaseModel):
    tag_id: str
    offer_id: str

# ==================== CALL MODELS ====================
class InitiateCallRequest(BaseModel):
    tag_id: str
    caller_id: str

class CallSignal(BaseModel):
    tag_id: str
    user_id: str
    signal_type: str
    signal_data: dict

class EndCallRequest(BaseModel):
    tag_id: str
    caller_id: str
    duration: int

class CallLog(BaseModel):
    tag_id: str
    caller_id: str
    receiver_id: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    duration: Optional[int] = None

# ==================== RATING MODELS ====================
class SubmitRatingRequest(BaseModel):
    tag_id: str
    rated_user_id: str
    rating: int
    comment: Optional[str] = None

class Rating(BaseModel):
    tag_id: str
    rater_id: str
    rated_user_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== EMERGENCY MODELS ====================
class EmergencyShareRequest(BaseModel):
    tag_id: str
    contacts: List[str]  # Phone numbers

class EmergencyAlert(BaseModel):
    tag_id: str
    user_id: str
    alert_type: str  # "sos", "share"
    message: str
    location: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== IP BAN MODELS ====================
class FailedLoginAttempt(BaseModel):
    ip_address: str
    phone: str
    attempt_count: int = 1
    is_banned: bool = False
    banned_at: Optional[datetime] = None
    last_attempt: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
