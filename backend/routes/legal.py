"""
GET /api/legal/privacy | /api/legal/terms | /api/legal/kvkk
Yasal metinler — JSON (mobil kayıt onayı). Mağaza / web HTML ayrı path'lerde kalır.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/legal", tags=["legal"])


@router.get("/privacy")
async def api_legal_privacy():
    """Gizlilik politikası — LegalConsentModal & mağaza referansı ile uyumlu JSON."""
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
""",
    }


@router.get("/terms")
async def api_legal_terms():
    """Kullanım şartları — JSON."""
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
E-posta: destek@leylektag.com
Telefon: 0850 307 80 29
Adres: Karanfil Mah. Konur Sokak No:23
""",
    }


@router.get("/kvkk")
async def api_legal_kvkk():
    """KVKK aydınlatma — JSON."""
    return {
        "success": True,
        "title": "Kişisel Verilerin İşlenmesi Hakkında Aydınlatma Metni",
        "company": "KAREKOD TEKNOLOJİ VE YAZILIM AŞ",
        "last_updated": "2025-01-01",
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
""",
    }
