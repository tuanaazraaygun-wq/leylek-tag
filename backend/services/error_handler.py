"""
Error Handling & System Stability Module
Modüler tasarım - Mevcut sisteme dokunmaz
"""
import logging
import traceback
from typing import Dict, Any, Optional
from datetime import datetime
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)

# ============ ERROR CODES ============
ERROR_CODES = {
    # Authentication Errors (1xxx)
    1001: "Geçersiz telefon numarası",
    1002: "Geçersiz PIN",
    1003: "OTP doğrulama başarısız",
    1004: "Oturum süresi doldu",
    1005: "Kullanıcı bulunamadı",
    1006: "Hesap askıya alındı",
    1007: "Türkiye dışından erişim engellendi",
    
    # Payment Errors (2xxx)
    2001: "Ödeme başlatılamadı",
    2002: "Ödeme doğrulama başarısız",
    2003: "Geçersiz paket tipi",
    2004: "Ödeme iptal edildi",
    2005: "Webhook doğrulama başarısız",
    
    # Ride Errors (3xxx)
    3001: "Aktif yolculuk bulunamadı",
    3002: "Sürücü bulunamadı",
    3003: "Yolcu bulunamadı",
    3004: "Eşleşme başarısız",
    3005: "Yolculuk iptal edildi",
    3006: "QR kod doğrulama başarısız",
    3007: "Konum bilgisi alınamadı",
    
    # Socket Errors (4xxx)
    4001: "Bağlantı kurulamadı",
    4002: "Bağlantı kesildi",
    4003: "Mesaj gönderilemedi",
    
    # Database Errors (5xxx)
    5001: "Veritabanı bağlantı hatası",
    5002: "Veri kaydetme hatası",
    5003: "Veri okuma hatası",
    
    # General Errors (9xxx)
    9001: "Beklenmeyen hata",
    9002: "Servis geçici olarak kullanılamıyor",
    9003: "İstek zaman aşımına uğradı",
}


class AppError(Exception):
    """Uygulama özel hata sınıfı"""
    
    def __init__(self, code: int, message: str = None, details: Dict = None):
        self.code = code
        self.message = message or ERROR_CODES.get(code, "Bilinmeyen hata")
        self.details = details or {}
        self.timestamp = datetime.utcnow().isoformat()
        super().__init__(self.message)
    
    def to_dict(self) -> Dict:
        return {
            "success": False,
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
                "timestamp": self.timestamp
            }
        }


# ============ ERROR HANDLER DECORATOR ============

def safe_api_call(default_return=None, error_code: int = 9001):
    """API çağrıları için güvenli hata yakalama decorator'ı"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except AppError:
                raise
            except Exception as e:
                logger.error(f"API Error in {func.__name__}: {e}\n{traceback.format_exc()}")
                if default_return is not None:
                    return default_return
                raise AppError(error_code, details={"original_error": str(e)})
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except AppError:
                raise
            except Exception as e:
                logger.error(f"API Error in {func.__name__}: {e}\n{traceback.format_exc()}")
                if default_return is not None:
                    return default_return
                raise AppError(error_code, details={"original_error": str(e)})
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


def safe_socket_handler(func):
    """Socket event handler'ları için güvenli hata yakalama"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Socket Error in {func.__name__}: {e}\n{traceback.format_exc()}")
            # Socket hataları session'ı kesmemeli
            return None
    return wrapper


# ============ TIMEOUT DECORATOR ============

def with_timeout(seconds: int = 30):
    """Timeout decorator'ı"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await asyncio.wait_for(func(*args, **kwargs), timeout=seconds)
            except asyncio.TimeoutError:
                logger.error(f"Timeout in {func.__name__} after {seconds}s")
                raise AppError(9003, f"İşlem {seconds} saniye içinde tamamlanamadı")
        return wrapper
    return decorator


# ============ RETRY DECORATOR ============

def with_retry(max_attempts: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """Otomatik yeniden deneme decorator'ı"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    logger.warning(f"Attempt {attempt + 1}/{max_attempts} failed for {func.__name__}: {e}")
                    
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
            
            logger.error(f"All {max_attempts} attempts failed for {func.__name__}")
            raise last_exception
        return wrapper
    return decorator


# ============ LOGGING UTILITIES ============

class RequestLogger:
    """HTTP request logger"""
    
    @staticmethod
    def log_request(method: str, path: str, user_id: str = None, extra: Dict = None):
        log_data = {
            "type": "request",
            "method": method,
            "path": path,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            **(extra or {})
        }
        logger.info(f"REQUEST: {log_data}")
    
    @staticmethod
    def log_response(status_code: int, path: str, duration_ms: float = None, extra: Dict = None):
        log_data = {
            "type": "response",
            "status_code": status_code,
            "path": path,
            "duration_ms": duration_ms,
            "timestamp": datetime.utcnow().isoformat(),
            **(extra or {})
        }
        logger.info(f"RESPONSE: {log_data}")
    
    @staticmethod
    def log_error(error_code: int, message: str, path: str = None, user_id: str = None, extra: Dict = None):
        log_data = {
            "type": "error",
            "error_code": error_code,
            "message": message,
            "path": path,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            **(extra or {})
        }
        logger.error(f"ERROR: {log_data}")


# ============ HEALTH CHECK ============

class SystemHealth:
    """Sistem sağlık kontrolü"""
    
    _services = {}
    
    @classmethod
    def register_service(cls, name: str, check_func):
        """Servis kaydet"""
        cls._services[name] = check_func
    
    @classmethod
    async def check_all(cls) -> Dict:
        """Tüm servisleri kontrol et"""
        results = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {}
        }
        
        for name, check_func in cls._services.items():
            try:
                is_healthy = await check_func() if asyncio.iscoroutinefunction(check_func) else check_func()
                results["services"][name] = {
                    "status": "healthy" if is_healthy else "unhealthy"
                }
                if not is_healthy:
                    results["status"] = "degraded"
            except Exception as e:
                results["services"][name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                results["status"] = "degraded"
        
        return results


# ============ CIRCUIT BREAKER ============

class CircuitBreaker:
    """Circuit breaker pattern implementasyonu"""
    
    def __init__(self, failure_threshold: int = 5, recovery_time: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failures = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    def record_success(self):
        """Başarılı çağrı kaydet"""
        self.failures = 0
        self.state = "closed"
    
    def record_failure(self):
        """Başarısız çağrı kaydet"""
        self.failures += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.failures >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"Circuit breaker opened after {self.failures} failures")
    
    def can_execute(self) -> bool:
        """Çağrı yapılabilir mi?"""
        if self.state == "closed":
            return True
        
        if self.state == "open":
            # Recovery süresi geçti mi?
            if self.last_failure_time:
                elapsed = (datetime.utcnow() - self.last_failure_time).seconds
                if elapsed >= self.recovery_time:
                    self.state = "half-open"
                    return True
            return False
        
        # half-open
        return True
