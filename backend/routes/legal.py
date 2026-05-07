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
- Sürücü/yolcu eşleşme ve teklif sistemi
- Leylek Teklifi / Muhabbet mesajlaşma
- Sesli görüşme / VoIP kullanımı
- Sesli mesaj veya ses verisi özellikleri (varsa)
- Cihaz, log ve güvenlik kayıtları

3. VERİ GÜVENLİĞİ
- Tüm veriler şifrelenmiş olarak saklanır
- Aramalar uçtan uca şifrelidir
- Standart VoIP görüşmelerinde çağrı içeriği kaydedilmez
- Bağlantı/arama metadata'sı (süre, tarih gibi) ürün ve güvenlik operasyonları kapsamında işlenebilir

4. VERİ PAYLAŞIMI
Verileriniz üçüncü taraflarla paylaşılmaz. Ancak yasal zorunluluk halinde yetkili makamlarla paylaşılabilir.

5. MUHABBET İÇERİK SAKLAMA
Uygulamada sesli mesaj veya ses kaydı özelliği kullanılırsa, ilgili ses verisi ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir.
Muhabbet mesaj içerikleri de ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir.

6. HAKLARINIZ
6698 sayılı KVKK kapsamında:
- Verilerinize erişim hakkı
- Düzeltme hakkı
- Silme hakkı (Hesap silme)
- İtiraz hakkı

7. İLETİŞİM
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

7. ÜRÜN KAPSAMI (BİLGİLENDİRME)
- Konum verisi işleme
- Sürücü/yolcu eşleşme ve teklif sistemi
- Leylek Teklifi / Muhabbet mesajlaşma
- Sesli görüşme / VoIP kullanımı
- Sesli mesaj veya ses verisi özellikleri (varsa)
- Muhabbet mesaj/ses kayıtları ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir
- Cihaz, log ve güvenlik kayıtları

8. ÜCRETLER
Şu an için hizmet ÜCRETSİZDİR. İleride premium özellikler eklenebilir.

9. DEĞİŞİKLİKLER
Bu şartlar önceden haber verilmeksizin değiştirilebilir.

10. İLETİŞİM
KAREKOD TEKNOLOJİ VE YAZILIM AŞ
E-posta: info@karekodteknoloji.com
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
✓ Sürücü/yolcu eşleşme ve teklif sistemi
✓ Leylek Teklifi / Muhabbet mesajlaşma
✓ Sesli görüşme / VoIP ve varsa sesli mesaj özellikleri
✓ Cihaz, log ve güvenlik kayıtları

VERİ SAKLAMA SÜRESİ
Veriler, hizmet sunumu süresince ve yasal yükümlülükler kapsamında saklanır. Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse) ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir.

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
