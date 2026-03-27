"""
Turkey IP Control Module
Modüler tasarım - Mevcut sisteme dokunmaz
Frontend'de kullanılacak IP kontrolü
"""
import httpx
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# Türkiye IP kontrol servisleri
IP_CHECK_SERVICES = [
    "https://ipapi.co/{ip}/country/",
    "https://ip-api.com/json/{ip}?fields=countryCode",
]

class TurkeyIPService:
    """Türkiye IP kontrol servisi"""
    
    @staticmethod
    async def get_client_country(ip: str) -> Tuple[bool, str]:
        """
        IP adresinin ülkesini kontrol et
        
        Returns: (is_turkey, country_code)
        """
        if not ip or ip in ["127.0.0.1", "localhost", "::1"]:
            return True, "TR"  # Local IP'ler için izin ver
        
        # Private IP'ler için izin ver
        if ip.startswith(("10.", "192.168.", "172.")):
            return True, "TR"
        
        try:
            async with httpx.AsyncClient(http2=False, timeout=5.0) as client:
                # İlk servis: ipapi.co
                try:
                    response = await client.get(f"https://ipapi.co/{ip}/country/")
                    if response.status_code == 200:
                        country = response.text.strip().upper()
                        return country == "TR", country
                except:
                    pass
                
                # Yedek servis: ip-api.com
                try:
                    response = await client.get(f"https://ip-api.com/json/{ip}?fields=countryCode")
                    if response.status_code == 200:
                        data = response.json()
                        country = data.get("countryCode", "").upper()
                        return country == "TR", country
                except:
                    pass
                
        except Exception as e:
            logger.error(f"IP check error: {e}")
        
        # Hata durumunda güvenli tarafta kal ve izin ver
        return True, "UNKNOWN"
    
    @staticmethod
    def is_turkey_ip_prefix(ip: str) -> bool:
        """
        Türkiye IP prefix kontrolü (hızlı kontrol)
        Tam doğruluk için get_client_country kullanın
        """
        TURKEY_PREFIXES = [
            "31.", "37.", "46.", "78.", "81.", "85.", "88.", "89.",
            "94.", "95.", "176.", "178.", "185.", "188.", "193.",
            "194.", "195.", "212.", "213.", "217."
        ]
        
        for prefix in TURKEY_PREFIXES:
            if ip.startswith(prefix):
                return True
        return False


# ============ ERROR RESPONSE MESSAGES ============

IP_BLOCK_MESSAGES = {
    "tr": {
        "title": "Erişim Engellendi",
        "message": "Hizmet şu anda sadece Türkiye'de kullanılabilir.",
        "detail": "VPN kullanıyorsanız lütfen kapatın ve tekrar deneyin."
    },
    "en": {
        "title": "Access Denied", 
        "message": "This service is currently only available in Turkey.",
        "detail": "If you are using a VPN, please disable it and try again."
    }
}


def get_ip_block_message(locale: str = "tr") -> dict:
    """IP engelleme mesajını döndür"""
    return IP_BLOCK_MESSAGES.get(locale, IP_BLOCK_MESSAGES["en"])
