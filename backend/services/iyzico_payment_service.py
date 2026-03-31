"""
iyzico Payment Service Module
Modüler tasarım - Mevcut sisteme dokunmaz
Sürücü aktivasyon paketleri için ödeme işlemleri
"""
import iyzipay
import json
import uuid
import logging
import hashlib
import hmac
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)

# ============ PAKET TANIMLARI ============
DRIVER_PACKAGES = {
    "3h": {"hours": 3, "price": 50.00, "name": "3 Saatlik Paket"},
    "6h": {"hours": 6, "price": 90.00, "name": "6 Saatlik Paket"},
    "9h": {"hours": 9, "price": 120.00, "name": "9 Saatlik Paket"},
    "12h": {"hours": 12, "price": 150.00, "name": "12 Saatlik Paket"},
    "24h": {"hours": 24, "price": 250.00, "name": "24 Saatlik Paket"},
}

class IyzicoPaymentService:
    """iyzico ödeme servisi"""
    
    def __init__(self):
        self.api_key = os.environ.get("IYZICO_API_KEY", "")
        self.secret_key = os.environ.get("IYZICO_SECRET_KEY", "")
        self.base_url = os.environ.get("IYZICO_BASE_URL", "https://sandbox-api.iyzipay.com")
        
        self.options = {
            'api_key': self.api_key,
            'secret_key': self.secret_key,
            'base_url': self.base_url
        }
        self.webhook_secret = os.environ.get("IYZICO_WEBHOOK_SECRET", "")

        if not self.api_key or not self.secret_key:
            # Geriye uyumluluk için çalışmayı kesmeden görünür uyarı bırak.
            logger.warning("iyzico credentials are missing; requests may fail at runtime")

    @staticmethod
    def _parse_iyzico_response(raw_response) -> Dict:
        """iyzico raw cevabını güvenli şekilde JSON'a çevir."""
        try:
            return json.loads(raw_response.read().decode('utf-8'))
        except Exception as exc:
            logger.error(f"Failed to parse iyzico response: {exc}")
            return {
                "status": "failure",
                "errorMessage": "iyzico response parse error"
            }
    
    def get_package_details(self, package_type: str) -> Optional[Dict]:
        """Paket detaylarını getir"""
        return DRIVER_PACKAGES.get(package_type)
    
    def create_checkout_form(
        self,
        user_id: str,
        package_type: str,
        buyer_info: Dict,
        callback_url: str
    ) -> Tuple[bool, str, str]:
        """
        iyzico checkout form oluştur
        
        Returns: (success, payment_page_url or error, conversation_id)
        """
        try:
            package = self.get_package_details(package_type)
            if not package:
                return False, "Geçersiz paket tipi", ""
            
            conversation_id = str(uuid.uuid4())
            price = str(package["price"])
            
            # Buyer bilgileri
            buyer = {
                'id': user_id,
                'name': buyer_info.get('name', 'Driver'),
                'surname': buyer_info.get('surname', 'User'),
                'gsmNumber': buyer_info.get('phone', '+905000000000'),
                'email': buyer_info.get('email', 'driver@leylektag.com'),
                'identityNumber': buyer_info.get('identity_number', '11111111111'),
                'registrationAddress': buyer_info.get('address', 'Istanbul, Turkey'),
                'ip': buyer_info.get('ip', '127.0.0.1'),
                'city': buyer_info.get('city', 'Istanbul'),
                'country': 'Turkey',
                'zipCode': buyer_info.get('zip_code', '34000')
            }
            
            # Adres bilgileri
            address = {
                'contactName': f"{buyer['name']} {buyer['surname']}",
                'city': buyer['city'],
                'country': 'Turkey',
                'address': buyer['registrationAddress'],
                'zipCode': buyer['zipCode']
            }
            
            # Sepet öğeleri
            basket_items = [
                {
                    'id': f"pkg_{package_type}",
                    'name': package['name'],
                    'category1': 'Sürücü Paketi',
                    'category2': 'Aktivasyon',
                    'itemType': 'VIRTUAL',
                    'price': price
                }
            ]
            
            # Ödeme isteği
            request = {
                'locale': 'tr',
                'conversationId': conversation_id,
                'price': price,
                'paidPrice': price,
                'currency': 'TRY',
                'basketId': f"basket_{conversation_id}",
                'paymentGroup': 'PRODUCT',
                'callbackUrl': callback_url,
                'enabledInstallments': ['1'],
                'buyer': buyer,
                'shippingAddress': address,
                'billingAddress': address,
                'basketItems': basket_items
            }
            
            # iyzico API çağrısı
            checkout_form = iyzipay.CheckoutFormInitialize().create(request, self.options)
            result = self._parse_iyzico_response(checkout_form)
            
            if result.get('status') == 'success':
                logger.info(f"Checkout form created: {conversation_id}")
                return True, result.get('paymentPageUrl', ''), conversation_id
            else:
                error_msg = result.get('errorMessage', 'Bilinmeyen hata')
                logger.error(f"Checkout form error: {error_msg}")
                return False, error_msg, conversation_id
                
        except Exception as e:
            logger.error(f"iyzico create checkout error: {e}")
            return False, str(e), ""
    
    def retrieve_payment_result(self, token: str) -> Dict:
        """Ödeme sonucunu al"""
        try:
            request = {
                'locale': 'tr',
                'token': token
            }
            
            result = iyzipay.CheckoutForm().retrieve(request, self.options)
            return self._parse_iyzico_response(result)
            
        except Exception as e:
            logger.error(f"iyzico retrieve error: {e}")
            return {"status": "failure", "errorMessage": str(e)}
    
    def verify_webhook_signature(self, payload: Dict, signature: str) -> bool:
        """Webhook imzasını doğrula"""
        try:
            # Geriye uyumluluk: secret yoksa mevcut davranış korunur.
            if not self.webhook_secret:
                logger.warning("IYZICO_WEBHOOK_SECRET not set; webhook signature check is bypassed")
                return True

            payload_str = json.dumps(payload, separators=(",", ":"), sort_keys=True)
            computed = hmac.new(
                self.webhook_secret.encode("utf-8"),
                payload_str.encode("utf-8"),
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(computed, signature or "")
        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}")
            return False


# ============ DATABASE HELPERS ============

async def save_payment_log(supabase, data: Dict) -> bool:
    """Ödeme logunu kaydet"""
    try:
        log_data = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "conversation_id": data.get("conversation_id"),
            "package_type": data.get("package_type"),
            "amount": data.get("amount"),
            "status": data.get("status", "pending"),
            "payment_id": data.get("payment_id"),
            "created_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("payment_logs").insert(log_data).execute()
        return True
    except Exception as e:
        logger.error(f"Save payment log error: {e}")
        return False


async def activate_driver_package(supabase, user_id: str, package_type: str) -> bool:
    """Sürücü paketini aktive et"""
    try:
        package = DRIVER_PACKAGES.get(package_type)
        if not package:
            return False
        
        hours = package["hours"]
        expiry_time = datetime.utcnow() + timedelta(hours=hours)
        
        supabase.table("users").update({
            "driver_active_until": expiry_time.isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"Driver package activated: {user_id} - {hours}h until {expiry_time}")
        return True
        
    except Exception as e:
        logger.error(f"Activate driver package error: {e}")
        return False
