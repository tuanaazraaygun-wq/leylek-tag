"""
Push Notification Service Module
Modüler tasarım - Mevcut sisteme dokunmaz
"""
import httpx
import logging
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

class PushNotificationService:
    """Expo Push Notification servisi"""
    
    @staticmethod
    async def send_notification(
        push_token: str,
        title: str,
        body: str,
        data: Optional[Dict] = None,
        sound: str = "default",
        priority: str = "high"
    ) -> bool:
        """Tek bir kullanıcıya bildirim gönder"""
        try:
            if not push_token or not push_token.startswith("ExponentPushToken"):
                logger.warning(f"Invalid push token: {push_token}")
                return False
            
            payload = {
                "to": push_token,
                "title": title,
                "body": body,
                "sound": sound,
                "priority": priority,
            }
            
            if data:
                payload["data"] = data
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("data", [{}])[0].get("status") == "ok":
                        logger.info(f"Push notification sent successfully")
                        return True
                    else:
                        logger.error(f"Push notification failed: {result}")
                        return False
                else:
                    logger.error(f"Push notification HTTP error: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"Push notification error: {e}")
            return False
    
    @staticmethod
    async def send_bulk_notifications(
        push_tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict] = None
    ) -> Dict[str, int]:
        """Birden fazla kullanıcıya bildirim gönder"""
        sent = 0
        failed = 0
        
        # Expo max 100 notification per request
        valid_tokens = [t for t in push_tokens if t and t.startswith("ExponentPushToken")]
        
        for i in range(0, len(valid_tokens), 100):
            batch = valid_tokens[i:i+100]
            messages = [
                {
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "priority": "high",
                    "data": data or {}
                }
                for token in batch
            ]
            
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        EXPO_PUSH_URL,
                        json=messages,
                        headers={"Content-Type": "application/json"},
                        timeout=30.0
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        for ticket in result.get("data", []):
                            if ticket.get("status") == "ok":
                                sent += 1
                            else:
                                failed += 1
                    else:
                        failed += len(batch)
                        
            except Exception as e:
                logger.error(f"Bulk push error: {e}")
                failed += len(batch)
        
        return {"sent": sent, "failed": failed}


# ============ NOTIFICATION TEMPLATES ============

class NotificationTemplates:
    """Bildirim şablonları"""
    
    @staticmethod
    def new_ride_request(passenger_name: str, pickup: str, price: float) -> Dict:
        """Sürücüye yeni yolculuk talebi"""
        return {
            "title": "🚗 Yeni Yolculuk Talebi",
            "body": f"{passenger_name} - {pickup} adresinden yolculuk istiyor. ₺{price}",
            "data": {"type": "new_ride_request"}
        }
    
    @staticmethod
    def driver_accepted(driver_name: str, eta_minutes: int = 5) -> Dict:
        """Yolcuya sürücü kabul etti"""
        return {
            "title": "✅ Sürücü Yolda!",
            "body": f"{driver_name} talebinizi kabul etti. Tahmini varış: {eta_minutes} dakika",
            "data": {"type": "driver_accepted"}
        }
    
    @staticmethod
    def ride_completed(price: float) -> Dict:
        """Yolculuk tamamlandı"""
        return {
            "title": "🏁 Yolculuk Tamamlandı",
            "body": f"Yolculuğunuz tamamlandı. Tutar: ₺{price}. Lütfen puanlayın!",
            "data": {"type": "ride_completed"}
        }
    
    @staticmethod
    def driver_arrived() -> Dict:
        """Sürücü geldi"""
        return {
            "title": "📍 Sürücünüz Geldi",
            "body": "Sürücünüz konumunuza ulaştı. Lütfen aracanıza binin.",
            "data": {"type": "driver_arrived"}
        }
    
    @staticmethod
    def package_activated(hours: int) -> Dict:
        """Paket aktive edildi"""
        return {
            "title": "🎉 Paketiniz Aktif",
            "body": f"{hours} saatlik paketiniz aktif edildi. İyi yolculuklar!",
            "data": {"type": "package_activated"}
        }
    
    @staticmethod
    def package_expiring(hours_left: int) -> Dict:
        """Paket süresi doluyor"""
        return {
            "title": "⏰ Paket Süresi Doluyor",
            "body": f"Paketinizin bitmesine {hours_left} saat kaldı. Yeni paket alın!",
            "data": {"type": "package_expiring"}
        }
    
    @staticmethod
    def system_announcement(message: str) -> Dict:
        """Sistem duyurusu"""
        return {
            "title": "📢 Duyuru",
            "body": message,
            "data": {"type": "system_announcement"}
        }
    
    @staticmethod
    def new_message(sender_name: str) -> Dict:
        """Yeni mesaj"""
        return {
            "title": "💬 Yeni Mesaj",
            "body": f"{sender_name} size mesaj gönderdi",
            "data": {"type": "new_message"}
        }
