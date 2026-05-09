"""
LeylekTag Answer Engine — intent kataloğu (tanımlar INTENT_DEFINITIONS içinde).
Genişletmek için INTENT_DEFINITIONS listesine yeni IntentDefinition eklenir.

Bakım:
- example_queries: doğal kullanıcı cümleleri (coverage / telemetri miss triage; matcher skoruna girmez).
- match_phrases + phrase_weights: normalize edilmiş mesajda alt dizgi araması ve ağırlık.
- TEKLIF_INCOMING_PROBLEM_PHRASES: “gelen teklif yok” sinyali — matcher’da how_to_send_offer cezası (tek kaynak).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .normalize import normalize_query as _norm_q

SupportedRole = Literal["passenger", "driver", "any"]


@dataclass(frozen=True)
class IntentDefinition:
    id: str
    title: str
    supported_roles: tuple[SupportedRole, ...]
    example_queries: tuple[str, ...]
    description: str
    """normalize_query ile kontrol edilen alt dizgiler; uzun ifade önce eşleşir."""
    match_phrases: tuple[str, ...]
    """Uzun / ayırt edici ifadeye daha yüksek ağırlık."""
    phrase_weights: tuple[tuple[str, int], ...] = field(default_factory=tuple)
    role_specific_templates: dict[str, str] = field(default_factory=dict)
    """Bağlam yokken (rol net değil) güvenli özet — role_specific varsa doldurulmalı."""
    default_template: str = ""
    voice_role_specific_templates: dict[str, str] = field(default_factory=dict)
    """voiceMode için kısa, TTS dostu rol bazlı cevaplar."""
    voice_default_template: str = ""


def _dedupe_phrases(*groups: tuple[str, ...]) -> tuple[str, ...]:
    """Aynı normalize ifadeyi tekrar etme; grupları sırayla birleştir."""
    seen: set[str] = set()
    out: list[str] = []
    for g in groups:
        for p in g:
            k = _norm_q(p)
            if not k or k in seen:
                continue
            seen.add(k)
            out.append(p.strip())
    return tuple(out)


# --- how_to_send_offer ---

NEUTRAL_SEND_OFFER = """Teklif mi, talep mi?

Özet
Yolcu talep yayınlar, sürücüler teklif gönderir; yolcu bir teklifi kabul eder. Sürücü harita veya listeden talep seçip teklif yazar.

Adımlar
1) Önce rolünü netleştir (yolcu / sürücü ana akışı); menüler buna göre değişir.
2) Yolcuysan: talep oluştur → kalkış/varış ve araç tipi (motor / otomobil) → ödeme ve fiyat özetini oku → yayınla → gelen kartlardan birine Kabul / Onay.
3) Sürücüysen: müsait ol → uygun talebi aç → rota ve tutarı oku → teklif ekranında ücreti yaz → Gönder → yanıtı bekle.

Dikkat
Yanlış talep veya araç tipine teklif gönderme; göndermeden özeti bir kez daha oku.

Sonraki adım
Bulunduğun ekrandaki ana düğmeyi kullan (Talep oluştur, Teklif ver, Kabul). Takılırsan rolünü ve talep/teklif ekranını kontrol et."""

DRIVER_SEND_OFFER = """Sürücü: talebe teklif gönderme

Özet
Uygun talebi açarsın, tutarı netleştirip teklif ekranından gönderirsin; yolcu kabul edince eşleşme tamamlanır.

Adımlar
1) Harita veya listeden talebi seç; kalkış–varış ve araç tipini (motor / otomobil) doğrula. Aracına uymuyorsa girme.
2) Rota, süre, mesafe ve tutar satırlarını oku; ek ücret / ödeme notu varsa kontrol et.
3) “Teklif ver / oluştur” ile düzenleme ekranına geç; net ücreti ve varsa bekleme süresini yaz; notu kısa tut.
4) Onay / Gönder ile ilet. Teklif beklemede kalır; red veya süre dolarsa listeden yeniden dene.

Dikkat
Yanlış gönderdiyse iptal/düzeltme ekranda varsa kullan; yoksa red bekleyip gerekirse yeni teklif hazırla.

Sonraki adım
Bekleme ekranında kal; kabul gelince buluşma ve yolculuk adımlarını uygulama sırayla gösterir."""

PASSENGER_SEND_OFFER = """Yolcu: teklif göndermezsin, talep açarsın

Özet
Sürücüye doğrudan teklif yazmazsın. Talebi yayınlarsın; sürücüler teklif gönderir, sen birini kabul edersin.

Adımlar
1) “Talep oluştur” veya yolculuk başlat adımına gir.
2) Haritada kalkış ve varışı seç; üstteki özet doğru mu bak.
3) Motor veya otomobili işaretle; ödeme seçeneğini ve ücret satırını oku, sonra yayınla.
4) Gelen kartlarda ücret, süre ve rotayı karşılaştır; uygun olana Kabul / Onay’a bas.

Dikkat
Talep yayında değilse teklif gelmez; iptal veya yanlış ekrandaysan talep akışına dön.

Sonraki adım
Kabul sonrası buluşma ve yolculuk ekranlarını izle; adres için uygulama içi mesajı kullan."""

MATCHING_WORKS = """LeylekTag eşleşme akışı

1) Yolcu talep oluşturur.
2) Sürücüler talepleri görür.
3) Sürücü teklif gönderir.
4) Yolcu bir teklifi kabul ederse eşleşme olur.

Notlar
- Yolcu teklif göndermez.
- Eşleşme, yolcunun bir teklifi kabul etmesiyle tamamlanır (sürücü teklifi gönderir; eşleşmeyi yolcu kabulü tamamlar)."""

WHO_SENDS_OFFER_SHORT = """Kim teklif gönderir?

1) Teklifi sürücü gönderir.
2) Yolcu talep oluşturur; teklif göndermez.

Kısaca: talep yolcuda, teklif sürücüde."""

TEKLIF_BRIEF = """Teklif

1) Teklifi sürücü gönderir.
2) Yolcu gelen tekliflerden birini kabul veya red eder.

Eşleşme, yolcunun bir teklifi kabul etmesiyle oluşur."""

GUVEN_AL_EXPLAINED = """Güven Al, normal TAG yolculuğunda yolcu ve sürücünün birbirinden kısa süreli görüntülü görüşme talep edebilmesini sağlar.

Butona basıldığında karşı tarafa sizden güven almak istiyor benzeri bir istek gider.

Karşı taraf kabul ederse yaklaşık 5 dakikalık görüntülü görüşme başlar.

Bu özellik acil servis, polis, çağrı merkezi, resmi güvenlik bildirimi veya otomatik ihbar sistemi değildir.

Acil durumda 112 veya ilgili resmi kanallar kullanılmalıdır."""

GUVEN_AL_EXPLAINED_VOICE = """Güven Al, normal TAG yolculuğunda yolcu ve sürücünün birbirinden kısa süreli görüntülü görüşme talep etmesini sağlar.

Butona basınca karşı tarafa sizden güven almak istiyor isteği gider. Kabul edilirse yaklaşık 5 dakikalık görüntülü görüşme başlar.

Bu özellik acil servis, polis, çağrı merkezi, resmi bildirim veya otomatik ihbar değildir. Acil durumda 112 kullanılmalıdır."""

INTERCITY_ROLE_QUESTION = """Şehir dışı Leylek Teklif Sende akışı için yardımcı olayım.

Yolcu olarak mı şehir dışına gitmek istiyorsunuz, yoksa sürücü olarak teklif vermek/açmak mı istiyorsunuz?"""

INTERCITY_ROLE_QUESTION_VOICE = """Şehir dışı Leylek Teklif Sende, şehir içi TAG’den ayrıdır ve rol ekranının altındaki karttan açılır.

Yolcu musunuz, sürücü olarak mı teklif vermek istiyorsunuz?"""

PASSENGER_INTERCITY_LEYLEK_OFFER = """Yolcu olarak şehir dışı Leylek Teklif Sende

Şehir dışı yolculuk, şehir içi normal TAG’den ayrıdır.

1) Rol seçimi ekranının altındaki Leylek Teklif Sende kartına dokunun.
2) Yolcu olarak şehir dışı talep oluşturun.
3) Rota, tarih/saat ve yolculuk notlarını girin.
4) Uygun sürücülerle teklif/eşleşme süreci uygulama içinde ilerler.
5) Eşleşme sonrası Muhabbet/chat üzerinden detayları netleştirin.
6) Uygulamadaki QR ve görüşme adımlarını takip edin.

Eşleşme veya süre garantisi verilmez."""

PASSENGER_INTERCITY_LEYLEK_OFFER_VOICE = """Yolcu olarak şehir dışı yolculuk, şehir içi normal TAG’den ayrıdır.

Rol seçimi ekranının altındaki Leylek Teklif Sende kartını açıp rota, tarih/saat ve notları girersiniz. Eşleşme sonrası Muhabbet/chat ve uygulamadaki QR ile görüşme adımlarını takip edersiniz.

Eşleşme veya süre garantisi verilmez."""

DRIVER_INTERCITY_LEYLEK_OFFER = """Sürücü olarak şehir dışı Leylek Teklif Sende

Şehir dışı yolculuk, şehir içi normal TAG’den ayrıdır.

1) Rol seçimi ekranının altındaki Leylek Teklif Sende kartına dokunun.
2) Sürücü olarak şehir dışı teklif/talep alanını kullanın.
3) Rota, tarih/saat, araç uygunluğu ve yolcu notlarını kontrol edin.
4) Uygunsa teklif verin veya uygun ilanı değerlendirin.
5) Eşleşme sonrası Muhabbet/chat üzerinden detayları netleştirin.
6) Uygulamadaki QR ve görüşme adımlarını takip edin.

Bölge yönlendirmesi, garanti kazanç veya garanti eşleşme söylenmez."""

DRIVER_INTERCITY_LEYLEK_OFFER_VOICE = """Sürücü olarak şehir dışı Leylek Teklif Sende, şehir içi normal TAG’den ayrı bir akıştır.

Rol seçimi ekranının altındaki karttan açılır. Rota, tarih/saat, araç uygunluğu ve yolcu notlarını kontrol edip uygunsa teklif verirsiniz; eşleşme sonrası Muhabbet/chat ve uygulama adımlarını takip edersiniz.

Süre, kazanç veya bölge yönlendirmesi garantisi verilmez."""

TAG_VS_INTERCITY_LEYLEK_OFFER = """Şehir içi TAG ve Leylek Teklif Sende farkı

Şehir içi normal TAG:
Yakın mesafe şehir içi yolcu/sürücü eşleşme ve normal TAG yolculuk akışıdır.

Leylek Teklif Sende:
Şehir dışı/şehirler arası yolculuklar için ayrı teklif/talep alanıdır.
Rol seçimi ekranının altındaki karttan açılır.
Eşleşme sonrası Muhabbet/chat ve ilgili yolculuk adımları kullanılır."""

TAG_VS_INTERCITY_LEYLEK_OFFER_VOICE = """Şehir içi normal TAG, yakın mesafe şehir içi yolcu/sürücü eşleşme akışıdır.

Leylek Teklif Sende ise şehir dışı veya şehirler arası yolculuklar için ayrı teklif alanıdır. Rol seçimi ekranının altındaki karttan açılır ve Muhabbet/chat ile uygulama adımları kullanılır.

Kısaca: şehir içi TAG ve şehir dışı Leylek Teklif Sende ayrı akışlardır."""

LEYLEKTAG_COMPANY_INFO = """LeylekTag, Karekod Teknoloji ve Yazılım Anonim Şirketi tarafından geliştirilmektedir.

Şirket 2025 yılında Ankara’da, Türkiye’de yolculuk paylaşımı, güvenli dijital eşleşme ve yerli mobil platform teknolojileri geliştirmek amacıyla kurulmuştur.

LeylekTag içinde yapay zeka destekli rehber sistemleri, eşleşme altyapıları, gerçek zamanlı iletişim teknolojileri, QR doğrulama, sesli asistan ve mobil yolculuk deneyimi çözümleri bulunmaktadır.

Amaç; Türkiye’de güvenli, erişilebilir ve yerli ulaşım teknolojileri geliştirmektir."""

LEYLEKTAG_COMPANY_INFO_VOICE = """LeylekTag, Karekod Teknoloji ve Yazılım Anonim Şirketi tarafından geliştirilmektedir.

Şirket 2025 yılında Ankara’da kurulmuştur. Amaç; Türkiye’de güvenli, erişilebilir ve yerli ulaşım teknolojileri geliştirmektir.

LeylekTag’te yapay zeka rehberi, eşleşme altyapısı, gerçek zamanlı iletişim, QR doğrulama, sesli asistan ve mobil yolculuk çözümleri bulunur."""

MATCH_NOT_HAPPENING = """Eşleşme veya teklif gecikiyor

Özet
Gecikme çoğunlukla konum, internet, yanlış ekran veya o an boş havuzdan kaynaklanır.

Adımlar
1) Konum izni ve GPS; pin doğru adreste mi?
2) İnternet; gerekirse uygulamayı kapatıp aç.
3) Talep veya teklif bekleme ekranındasın; yanlışlıkla iptal veya başka sekmeye düşmedin mi?
4) Yolcuysan: talep yayında mı; araç tipi ve adresler doğru mu? Liste boşsa bekle veya adresi sadeleştirip talebi yenile.
5) Sürücüysen: müsait mod açık mı; listede talep var mı? Boşsa ekrandaki durumu ve bildirimlerini kontrol et.

Dikkat
Adresi gereğinden geniş bırakmak veya araç tipini yanlış seçmek eşleşmeyi yavaşlatır.

Sonraki adım
Kısa süre bekle; düzelmezse talebi net adresle yeniden aç veya müsaitliği kapat-aç. Devam ederse desteğe yaz."""

PASSENGER_ACCEPT_DRIVER = """Yolcu: gelen teklifi kabul etme

Özet
Talebine gelen sürücü kartlarından birini seçip onaylarsın; sonra eşleşme kilitlenir.

Adımlar
1) Talebin açık ve teklif listesinde olduğundan emin ol.
2) Kartlarda ücret, süre ve rotayı karşılaştır; yalnızca en düşük fiyata göre seçme.
3) Özeti son kez oku; yanlış karta çift dokunma.
4) Seçtiğin kartta Kabul / Onay’a bas; ekran buluşma / yolculuğa geçer.

Dikkat
İptal ve ücret kuralları ekranda yazdığı gibidir.

Sonraki adım
Buluşmayı mesajdan netleştir; ardından yolculuk adımlarını uygulamada izle."""

DRIVER_ACCEPT_REQUEST = """Sürücü: talebe teklif gönderme

Özet
Uygun talebi açıp teklif yazıp gönderirsin. Eşleşme, yolcunun bu teklifi kabul etmesiyle oluşur.

Adımlar
1) Harita veya listeden talebi aç; kalkış ve varışı doğrula.
2) Ücret ve rota özetini oku; teklif ekranında tutarı netleştirip gönder.
3) Yolcu kabul edene kadar bekle; kabul gelince yolculuk adımları başlar.

Dikkat
Yolcu teklif göndermez; eşleşmeyi yolcunun kabulü tamamlar.

Sonraki adım
Teklif bekleme ekranında kal; kabul gelince ekranlar ilerler."""

# --- Faz 2: iptal / mesaj / güvenlik (supported_roles: any) ---

HOW_TO_CANCEL_REQUEST_OR_TRIP = """Talep veya yolculuğu iptal etme

Özet
İptal, devam eden talep veya yolculuk ekranından yapılır; sonuç o ekranda gösterilen uyarı ve kurallara bağlıdır.

Adımlar
1) İptal etmek istediğin talep veya yolculuğun kartına / detayına gir.
2) Üst menü veya özet alanında İptal, Vazgeç veya benzeri seçeneği bul.
3) Açılan uyarı metnini oku; onaylarsan işlem uygulama kurallarına göre tamamlanır.
4) Ekranda talep kapandı veya yolculuk sonlandı bilgisi çıktıysa akış bitti sayılır.

Dikkat
Ücret, kesinti veya iade konularında ekrandaki güncel metin geçerlidir; burada sabit tutar veya ceza vaadi yoktur.

Sonraki adım
İptal seçeneği yoksa yanlış ekranda olabilirsin veya aşama ilerlemiş olabilir; doğru kartı seç veya destekten yardım iste."""

HOW_IN_APP_MESSAGING_WORKS = """Uygulama içi mesaj / sohbet

Özet
Eşleşme veya yolculuk sırasında karşı taraf ile yazışmayı sohbet alanından yaparsın. Teklif ve ücret bu alanın dışında, ilgili talep/teklif ekranlarında yönetilir.

Adımlar
1) Aktif talep, teklif bekliyor veya yolculuk ekranına gir.
2) Mesaj / sohbet simgesi veya sekmesini aç.
3) Metni yazıp gönder; yanıt yine uygulama içinden gelir.
4) Bildirimleri açık tutmak mesajı kaçırmayı azaltır.

Dikkat
Fiyat veya teklif değiştirmek için teklif ve talep akışını kullan; sohbet yazışma içindir.

Sonraki adım
Gönder çalışmıyorsa interneti kontrol et, doğru yolculuk kartında olduğundan emin ol; gerekirse uygulamayı yeniden başlat."""

SAFETY_AND_TRUST_BASICS = """Güvenlik ve güvenilir kullanım

Özet
Yolculuğu uygulama üzerinden takip etmek ve ekrandaki profil ile araç bilgilerini kontrol etmek önerilir.

Adımlar
1) Kabul öncesi karttaki bilgileri oku; emin değilsen mesajla netleştir veya kabul etme.
2) Buluşma adresi gibi kritik detayları mümkünse uygulama içi mesajla paylaş.
3) Ciddi risk hissedersen yolculuğu uygulama kurallarına uygun şekilde sonlandırıp bildirim seçeneklerini kullan.
4) Şikâyet ve hesap konuları için uygulamadaki yardım / destek yolunu izle.

Dikkat
Bu metin genel bilgilendirme içerir; hukuki sonuç veya “kesin güvenli” iddiası içermez. Güncel koşullar uygulama metinlerinde yer alır.

Sonraki adım
Şüpheli davranış veya profil için güvenliğini önceleyerek destek hattına başvur."""


# “Teklifi nasıl yollarım” (how_to_send) vs “bana teklif gelmiyor” — matcher’da how_to_send cezası (tek kaynak).
TEKLIF_INCOMING_PROBLEM_PHRASES: tuple[str, ...] = (
    "teklif gelmiyor",
    "teklif gelmedi",
    "teklif gelmiyor bana",
    "bana teklif gelmiyor",
    "bana teklif gelmedi",
    "kimse teklif göndermiyor",
    "surucuden teklif yok",
    "sürücüden teklif yok",
    "teklif bekliyorum",
    "teklif bekliyorum ama",
    "hala teklif yok",
    "halen teklif yok",
    "teklif yok hala",
)

# --- match_not_happening ---
_MNH_EXAMPLE_QUERIES: tuple[str, ...] = (
    "eşleşme gelmiyor",
    "kimse yok",
    "neden bulamıyorum",
    "çok bekledim",
    "teklif gelmiyor",
    "sürücü yok",
    "yolcu yok",
    "niye eşleşmiyor",
    "bekliyorum olmuyor",
    "talep düşmüyor",
    "çevremde kimse yok",
    "match olmuyor",
    "sürücü bulamıyorum",
    "yolcu çıkmıyor",
    "ilan göremiyorum",
    "bekliyorum gelmiyor",
    "eşleşen çıkmadı",
    "havuz bomboş",
    "istek göremiyorum",
    "talep dusmuyor",
    "hala teklif yok",
    "teklif yok hala",
)

_MNH_MATCH_CORE: tuple[str, ...] = (
    "eşleşme gelmiyor",
    "eşleşme yok",
    "eslesme gelmiyor",
    "kimse yok",
    "bulamıyorum",
    "eşleşmiyor",
    "eslesmiyor",
    "neden eşleş",
    "niye eşleş",
    "bekliyorum olmuyor",
    "uzun süredir bekliyorum",
    "teklif gelmiyor",
    "teklif gelmedi",
    "sürücü yok",
    "surucu yok",
    "yolcu yok",
    "kimse bağlanmıyor",
    "eşleşemedim",
)

_MNH_MATCH_EXT: tuple[str, ...] = (
    "talep düşmüyor",
    "talep gitmiyor",
    "kimse bağlanmadı",
    "eşleşen yok",
    "eslesen yok",
    "match yok",
    "match olmuyor",
    "havuz boş",
    "havuz bomboş",
    "çevremde kimse yok",
    "sürücü bulamıyorum",
    "surucu bulamıyorum",
    "yolcu çıkmıyor",
    "ilan göremiyorum",
    "istek göremiyorum",
    "bekliyorum gelmiyor",
    "bekliyorum ama gelmiyor",
    "hala kimse yok",
    "eşleşen çıkmadı",
    "eslesen cikmadi",
    "kimse düşmüyor",
    "eşleşme olmuyor",
    "eslesme olmuyor",
    "eslesemedim",
    "talep dusmuyor",
    "hala teklif yok",
    "halen teklif yok",
    "teklif yok hala",
)

_MNH_PHRASE_WEIGHTS: tuple[tuple[str, int], ...] = (
    ("eşleşme gelmiyor", 11),
    ("teklif gelmiyor", 10),
    ("talep düşmüyor", 10),
    ("sürücü yok", 9),
    ("yolcu yok", 9),
    ("neden eşleş", 9),
    ("kimse yok", 8),
    ("match olmuyor", 9),
    ("sürücü bulamıyorum", 9),
    ("ilan göremiyorum", 8),
    ("hala teklif yok", 11),
    ("halen teklif yok", 11),
    ("teklif yok hala", 11),
    ("talep dusmuyor", 10),
)

# --- how_to_send_offer ---
# Kısa “teklif …” / “yolcuya teklif” kalıpları match_not veya kabul intent’leriyle çakışabilir;
# matcher: TEKLIF_INCOMING_PROBLEM_PHRASES, olumsuzluk cezası, intent sırası.
_H2SO_EXAMPLE_QUERIES: tuple[str, ...] = (
    "teklif nasıl gönderilir",
    "nasıl teklif atılır",
    "teklif atamıyorum",
    "fiyat nasıl gönderiyorum",
    "sürücü teklif nasıl yollar",
    "müşteriye teklif nasıl verilir",
    "yolcuya teklif nasıl iletirim",
    "motor seçip teklif nasıl gönderirim",
    "ücreti nasıl yazıyorum",
    "teklif verme ekranı nerede",
    "teklif butonu nerede",
    "fiyatı nasıl göndereceğim",
    "ücret teklifini nasıl yazarım",
    "teklife nereden basıyorum",
    "talebe nasıl teklif veririm",
    "listeden teklif nasıl verilir",
    "teklif ekranına nasıl girerim",
    "haritadan teklif nasıl verilir",
    "teklif nasil gonderilir",
)

_H2SO_MATCH_CORE: tuple[str, ...] = (
    "teklif nasıl gönderilir",
    "nasıl teklif atılır",
    "nasıl teklif atarım",
    "teklif nasıl atılır",
    "teklif atamıyorum",
    "teklif gönderemiyorum",
    "fiyat nasıl gönder",
    "ücret nasıl gönder",
    "sürücü teklif nasıl",
    "surucu teklif nasil",
    "müşteriye teklif nasıl verilir",
    "musteriye teklif nasil verilir",
    "yolcuya teklif nasıl",
    "yolcuya teklif nasıl iletirim",
    "teklif nasıl verilir",
    "motor seçip teklif",
)

_H2SO_MATCH_EXTENDED: tuple[str, ...] = (
    "müşteriye teklif",
    "musteriye teklif",
    "yolcuya teklif",
    "teklif verme",
    "teklif ekranı",
    "teklif ekranına nasıl",
    "teklif oluştur",
    "teklif yaz",
    "teklif yollarım",
    "teklif ilet",
    "teklif butonu",
    "teklif butonu nerede",
    "teklif gönder butonu",
    "fiyatı nasıl ilet",
    "fiyatı nasıl iletirim",
    "fiyati nasil ilet",
    "ücret teklifi nasıl",
    "ucret teklifi nasil",
    "teklif yollamak istiyorum",
    "teklifimi nasıl iletirim",
    "nasıl fiyat yazarım",
    "nasil fiyat yazarim",
    "talebe teklif nasıl",
    "talebe nasıl teklif",
    "talep için teklif",
    "haritadan teklif",
    "listeden teklif nasıl",
    "teklif ekranına nasıl girerim",
    "haritadan teklif nasıl",
    "teklif nasil gonderilir",
    "nasil teklif atilir",
    "yolcuya teklif nasil",
    "nasil fiyat gonderirim",
)

_H2SO_PHRASE_WEIGHTS: tuple[tuple[str, int], ...] = (
    ("teklif nasıl gönderilir", 12),
    ("nasıl teklif atılır", 12),
    ("müşteriye teklif nasıl verilir", 11),
    ("yolcuya teklif nasıl", 11),
    ("motor seçip teklif", 9),
    ("sürücü teklif nasıl", 9),
    ("teklif gönderemiyorum", 10),
    ("fiyat nasıl gönder", 9),
    ("teklif butonu nerede", 10),
    ("talebe nasıl teklif", 10),
    ("ücret teklifi nasıl", 9),
    ("teklif ekranına nasıl girerim", 9),
    ("teklif nasil gonderilir", 12),
    ("yolcuya teklif nasil", 11),
    ("nasil teklif atilir", 12),
)


INTENT_DEFINITIONS: tuple[IntentDefinition, ...] = (
    IntentDefinition(
        id="leylektag_company_info",
        title="LeylekTag şirket bilgisi",
        supported_roles=("any",),
        example_queries=(
            "LeylekTag kim kurdu?",
            "LeylekTag kim tarafından geliştirildi?",
            "Hangi firma yaptı?",
            "Neden kuruldu?",
            "Hangi teknolojiler kullanılıyor?",
        ),
        description="LeylekTag'in şirket, kuruluş amacı ve teknoloji altyapısı bilgisini açıklar.",
        match_phrases=(
            "leylek tag kim kurdu",
            "leylektag kim kurdu",
            "leylek tag kim tarafından kuruldu",
            "leylektag kim tarafından kuruldu",
            "leylek tag kim tarafindan kuruldu",
            "leylektag kim tarafindan kuruldu",
            "leylek tag kim tarafından geliştirildi",
            "leylektag kim tarafından geliştirildi",
            "leylek tag kim tarafindan gelistirildi",
            "leylektag kim tarafindan gelistirildi",
            "hangi firma yaptı",
            "hangi firma yapti",
            "hangi firma geliştirdi",
            "hangi firma gelistirdi",
            "kim geliştirdi",
            "kim gelistirdi",
            "leylek tag nedir",
            "leylektag nedir",
            "neden kuruldu",
            "hangi şirket",
            "hangi sirket",
            "teknoloji altyapısı",
            "teknoloji altyapisi",
            "leylek tag hangi teknolojileri kullanıyor",
            "leylektag hangi teknolojileri kullanıyor",
            "leylek tag hangi teknolojileri kullaniyor",
            "leylektag hangi teknolojileri kullaniyor",
            "hangi teknolojiler kullanılıyor",
            "hangi teknolojiler kullaniliyor",
            "merkez nerede",
            "ankara şirketi mi",
            "ankara sirketi mi",
        ),
        phrase_weights=(
            ("leylek tag kim kurdu", 18),
            ("leylektag kim kurdu", 18),
            ("leylek tag kim tarafından kuruldu", 18),
            ("leylektag kim tarafından kuruldu", 18),
            ("leylek tag kim tarafindan kuruldu", 18),
            ("leylektag kim tarafindan kuruldu", 18),
            ("leylek tag kim tarafından geliştirildi", 18),
            ("leylektag kim tarafından geliştirildi", 18),
            ("leylek tag kim tarafindan gelistirildi", 18),
            ("leylektag kim tarafindan gelistirildi", 18),
            ("leylek tag hangi teknolojileri kullanıyor", 18),
            ("leylektag hangi teknolojileri kullanıyor", 18),
            ("leylek tag hangi teknolojileri kullaniyor", 18),
            ("leylektag hangi teknolojileri kullaniyor", 18),
            ("hangi teknolojiler kullanılıyor", 16),
            ("hangi teknolojiler kullaniliyor", 16),
            ("teknoloji altyapısı", 15),
            ("teknoloji altyapisi", 15),
            ("hangi firma yaptı", 14),
            ("hangi firma yapti", 14),
            ("hangi firma geliştirdi", 14),
            ("hangi firma gelistirdi", 14),
            ("leylek tag nedir", 14),
            ("leylektag nedir", 14),
            ("neden kuruldu", 12),
            ("hangi şirket", 12),
            ("hangi sirket", 12),
            ("merkez nerede", 12),
            ("ankara şirketi mi", 12),
            ("ankara sirketi mi", 12),
            ("kim geliştirdi", 10),
            ("kim gelistirdi", 10),
        ),
        default_template=LEYLEKTAG_COMPANY_INFO,
        voice_default_template=LEYLEKTAG_COMPANY_INFO_VOICE,
    ),
    IntentDefinition(
        id="guven_al_explained",
        title="Güven Al nasıl çalışır?",
        supported_roles=("any",),
        example_queries=(
            "Güven Al butonu nasıl çalışır?",
            "güven al nedir",
            "güven alma",
            "güven görüşmesi nedir",
        ),
        description="Güven Al'ın kısa süreli görüntülü görüşme isteği olduğunu açıklar.",
        match_phrases=(
            "güven al",
            "guven al",
            "güvenal",
            "guvenal",
            "güvenal butonu",
            "guvenal butonu",
            "güvenal nasıl çalışır",
            "guvenal nasil calisir",
            "güvenal nedir",
            "guvenal nedir",
            "güven al buton",
            "guven al buton",
            "güven alma",
            "guven alma",
            "güven görüşmesi",
            "guven gorusmesi",
            "güven görüşme",
            "guven gorusme",
        ),
        phrase_weights=(
            ("güvenal butonu", 16),
            ("guvenal butonu", 16),
            ("güvenal nasıl çalışır", 16),
            ("guvenal nasil calisir", 16),
            ("güvenal", 14),
            ("guvenal", 14),
            ("güven al butonu", 14),
            ("guven al butonu", 14),
            ("güven al", 12),
            ("guven al", 12),
            ("güven görüşmesi", 12),
            ("guven gorusmesi", 12),
        ),
        default_template=GUVEN_AL_EXPLAINED,
        voice_default_template=GUVEN_AL_EXPLAINED_VOICE,
    ),
    IntentDefinition(
        id="tag_vs_intercity_leylek_offer",
        title="Şehir içi TAG ve Leylek Teklif Sende farkı",
        supported_roles=("any",),
        example_queries=(
            "Şehir içi TAG ile Leylek Teklifi farkı nedir?",
            "normal TAG ve şehir dışı teklif farkı",
            "şehir içi ile şehir dışı farkı",
        ),
        description="Normal TAG şehir içi akışı ile Leylek Teklif Sende şehir dışı akışını ayırır.",
        match_phrases=(
            "şehir içi tag ile leylek teklifi fark",
            "sehir ici tag ile leylek teklifi fark",
            "normal tag ile leylek teklifi fark",
            "normal tag ve şehir dışı",
            "normal tag ve sehir disi",
            "şehir içi ile şehir dışı fark",
            "sehir ici ile sehir disi fark",
            "tag ile leylek teklif sende fark",
        ),
        phrase_weights=(
            ("şehir içi tag ile leylek teklifi fark", 16),
            ("sehir ici tag ile leylek teklifi fark", 16),
            ("normal tag ile leylek teklifi fark", 15),
            ("şehir içi ile şehir dışı fark", 14),
            ("sehir ici ile sehir disi fark", 14),
        ),
        default_template=TAG_VS_INTERCITY_LEYLEK_OFFER,
        voice_default_template=TAG_VS_INTERCITY_LEYLEK_OFFER_VOICE,
    ),
    IntentDefinition(
        id="intercity_leylek_offer",
        title="Şehir dışı Leylek Teklif Sende",
        supported_roles=("passenger", "driver"),
        example_queries=(
            "şehir dışı yolculuk nasıl yapacağım",
            "şehirler arası yolculuk",
            "Leylek Teklif Sende nedir",
            "şehir dışı teklif",
            "yolcu olarak şehir dışı nasıl giderim",
            "sürücü olarak şehir dışı teklif nasıl veririm",
        ),
        description="Şehir dışı Leylek Teklif Sende akışını rol varsa anlatır; rol yoksa önce rol sorar.",
        match_phrases=(
            "şehir dışı yolculuk",
            "sehir disi yolculuk",
            "şehirler arası yolculuk",
            "sehirler arasi yolculuk",
            "leylek teklif sende",
            "şehir dışı teklif",
            "sehir disi teklif",
            "şehir dışına",
            "sehir disina",
            "şehir dışı nasıl",
            "sehir disi nasil",
        ),
        phrase_weights=(
            ("şehir dışı yolculuk nasıl", 16),
            ("sehir disi yolculuk nasil", 16),
            ("leylek teklif sende nedir", 16),
            ("şehirler arası yolculuk", 14),
            ("sehirler arasi yolculuk", 14),
            ("şehir dışı teklif", 14),
            ("sehir disi teklif", 14),
            ("şehir dışı nasıl", 12),
            ("sehir disi nasil", 12),
            ("yolcu olarak şehir dışı", 13),
            ("yolcu olarak sehir disi", 13),
            ("sürücü olarak şehir dışı", 13),
            ("surucu olarak sehir disi", 13),
        ),
        role_specific_templates={
            "driver": DRIVER_INTERCITY_LEYLEK_OFFER,
            "passenger": PASSENGER_INTERCITY_LEYLEK_OFFER,
        },
        default_template=INTERCITY_ROLE_QUESTION,
        voice_role_specific_templates={
            "driver": DRIVER_INTERCITY_LEYLEK_OFFER_VOICE,
            "passenger": PASSENGER_INTERCITY_LEYLEK_OFFER_VOICE,
        },
        voice_default_template=INTERCITY_ROLE_QUESTION_VOICE,
    ),
    IntentDefinition(
        id="match_not_happening",
        title="Eşleşme gelmiyor / çok bekliyorum",
        supported_roles=("any",),
        example_queries=_MNH_EXAMPLE_QUERIES,
        description="Gecikme, boş liste ve teklif gelmemesi için kontrol listesi.",
        match_phrases=_dedupe_phrases(_MNH_MATCH_CORE, _MNH_MATCH_EXT),
        phrase_weights=_MNH_PHRASE_WEIGHTS,
        default_template=MATCH_NOT_HAPPENING,
    ),
    IntentDefinition(
        id="how_matching_works",
        title="Eşleşme nasıl çalışır?",
        supported_roles=("any",),
        example_queries=(
            "eşleşme nasıl oluyor",
            "nasıl eşleşirim",
            "eşleşme nedir",
            "eşleşme sistemi nasıl işliyor",
            "match nasıl oluyor",
            "nasıl eşleşiyoruz",
        ),
        description="Eşleşme sürecinin adımları (bilgi amaçlı).",
        match_phrases=(
            "eşleşme nasıl",
            "eslesme nasil",
            "nasıl eşleş",
            "nasil esles",
            "eşleşme nedir",
            "eslesme nedir",
            "eşleşme nasıl çalış",
            "eşleşme nasıl oluyor",
            "nasıl eşleşirim",
            "eşleşme sistemi",
            "eşleşme mekanizması",
            "match nasıl",
            "eşleşme işleyiş",
        ),
        phrase_weights=(
            ("eşleşme nasıl çalışır", 11),
            ("eşleşme nasıl oluyor", 10),
            ("eşleşme nedir", 10),
            ("nasıl eşleşirim", 9),
            ("eşleşme sistemi nasıl", 10),
        ),
        default_template=MATCHING_WORKS,
    ),
    IntentDefinition(
        id="who_sends_offer",
        title="Teklifi kim gönderir?",
        supported_roles=("any",),
        example_queries=(
            "kim teklif gönderir",
            "teklifi kim yollar",
            "hangi taraf teklif veriyor",
        ),
        description="Teklif sürücüdedir; yolcu talep oluşturur.",
        match_phrases=(
            "kim teklif",
            "teklifi kim",
            "teklif kimden",
            "teklif hangi taraftan",
            "hangi taraf teklif",
            "kim gönderir teklif",
            "kim gonderir teklif",
        ),
        phrase_weights=(
            ("kim teklif gönderir", 14),
            ("teklifi kim gönderir", 14),
            ("teklifi kim yollar", 12),
        ),
        default_template=WHO_SENDS_OFFER_SHORT,
    ),
    IntentDefinition(
        id="how_to_send_offer",
        title="Teklifi nasıl gönderirim?",
        supported_roles=("passenger", "driver"),
        example_queries=_H2SO_EXAMPLE_QUERIES,
        description="Yolcu talep oluşturur; sürücü teklif gönderir. Rol net değilse nötr özet.",
        match_phrases=_dedupe_phrases(_H2SO_MATCH_CORE, _H2SO_MATCH_EXTENDED),
        phrase_weights=_H2SO_PHRASE_WEIGHTS,
        role_specific_templates={
            "driver": DRIVER_SEND_OFFER,
            "passenger": PASSENGER_SEND_OFFER,
        },
        default_template=NEUTRAL_SEND_OFFER,
    ),
    IntentDefinition(
        id="how_passenger_accepts_driver",
        title="Yolcu sürücüyü nasıl seçer / kabul eder?",
        supported_roles=("passenger",),
        example_queries=(
            "sürücü nasıl seçerim",
            "teklifi nasıl kabul ederim",
            "hangi sürücüyü seçeyim",
        ),
        description="Yolcu tarafında teklif inceleme ve kabul.",
        match_phrases=(
            "sürücü nasıl seç",
            "surucu nasıl seç",
            "hangi sürücü",
            "teklifi nasıl kabul",
            "teklif kabul",
            "onaylayınca ne olur",
        ),
        phrase_weights=(
            ("sürücü nasıl seçerim", 9),
            ("teklifi nasıl kabul", 9),
        ),
        default_template=PASSENGER_ACCEPT_DRIVER,
    ),
    IntentDefinition(
        id="how_driver_accepts_request",
        title="Sürücü talebe teklif gönderme",
        supported_roles=("driver",),
        example_queries=("talep nasıl kabul edilir", "yolcuyu nasıl alırım", "işi nasıl kabul ediyorum"),
        description="Sürücü talebi seçip teklif gönderir; eşleşme yolcunun kabulüyle olur.",
        match_phrases=(
            "talep nasıl kabul",
            "talebi nasıl kabul",
            "yolcuyu nasıl al",
            "işi nasıl kabul",
            "talep kabul",
        ),
        phrase_weights=(
            ("talep nasıl kabul edilir", 10),
            ("yolcuyu nasıl alırım", 9),
        ),
        default_template=DRIVER_ACCEPT_REQUEST,
    ),
    # Yanlış eşleşme riski: kısa "iptal" tek başına kullanılmaz; "iptal ettim hala…" gibi cümlelerde match_not güçlenebilir.
    IntentDefinition(
        id="how_to_cancel_request_or_trip",
        title="Talep veya yolculuğu nasıl iptal ederim?",
        supported_roles=("any",),
        example_queries=(
            "nasıl iptal ederim",
            "talebi iptal etmek istiyorum",
            "yolculuğu iptal",
            "vazgeçmek istiyorum",
            "iptal butonu nerede",
            "iptal ücreti var mı",
        ),
        description="Talep/yolculuk iptal akışı; ücret iddiası yok, ekran uyarısına yönlendirir.",
        match_phrases=(
            "nasıl iptal",
            "iptal ederim",
            "iptal etmek",
            "iptal etmek istiyorum",
            "iptal ediyorum",
            "talep iptal",
            "talebimi iptal",
            "yolculuk iptal",
            "yolculuğu iptal",
            "yolculugu iptal",
            "işi iptal",
            "isi iptal",
            "iptal nasıl",
            "iptal nasil",
            "vazgeçmek",
            "vazgecmek",
            "vazgeçtim",
            "iptal butonu",
            "iptal nasıl yapılır",
            "iptal nasil yapilir",
        ),
        phrase_weights=(
            ("nasıl iptal ederim", 12),
            ("talep iptal", 11),
            ("yolculuk iptal", 11),
            ("iptal etmek istiyorum", 11),
            ("iptal butonu nerede", 10),
            ("vazgeçmek istiyorum", 10),
            ("iptal ücreti", 10),
            ("iptal ucreti", 10),
        ),
        default_template=HOW_TO_CANCEL_REQUEST_OR_TRIP,
    ),
    # Yanlış eşleşme riski: yalnızca "gönder" / "nasıl gönderirim" teklif intent’ine gitmeli; matcher’da teklif+fiyat cezası var.
    IntentDefinition(
        id="how_in_app_messaging_works",
        title="Uygulama içi mesaj / sohbet nasıl kullanılır?",
        supported_roles=("any",),
        example_queries=(
            "mesaj nasıl atılır",
            "sürücüye yazamıyorum",
            "sohbet nerede",
            "mesaj gitmiyor",
            "yolcuya nasıl yazarım",
            "uygulama içi mesaj",
        ),
        description="Sohbet/mesaj akışı; teklif ve ücret dışında tutulur.",
        match_phrases=(
            "mesaj nasıl",
            "mesaj nasil",
            "nasıl mesaj",
            "nasil mesaj",
            "mesaj gönder",
            "mesaj gonder",
            "mesaj atamıyorum",
            "mesaj yazamıyorum",
            "mesaj gitmiyor",
            "sohbet nasıl",
            "sohbet nasil",
            "sohbet nerede",
            "uygulama içi mesaj",
            "uygulama ici mesaj",
            "sürücüye yaz",
            "surucuye yaz",
            "yolcuya yaz",
            "mesaj nereden",
            "mesaj nerede",
            "chat",
            "mesajla iletişim",
            "mesajla iletisim",
            "bildirim mesaj",
        ),
        phrase_weights=(
            ("mesaj nasıl atılır", 12),
            ("mesaj nasıl gönderilir", 11),
            ("mesaj gitmiyor", 11),
            ("sohbet nerede", 10),
            ("uygulama içi mesaj", 10),
            ("sürücüye yazamıyorum", 11),
        ),
        default_template=HOW_IN_APP_MESSAGING_WORKS,
    ),
    # Yanlış eşleşme riski: çok kısa "güven" / "risk" kullanılmaz; iddialı söylem yok.
    IntentDefinition(
        id="safety_and_trust_basics",
        title="Güvenlik ve güvenilir kullanım",
        supported_roles=("any",),
        example_queries=(
            "güvenli mi uygulama",
            "dolandırılır mıyım",
            "şikayet nasıl edilir",
            "şüpheli sürücü",
            "profili nasıl kontrol ederim",
        ),
        description="Genel güvenlik önerileri; garanti veya kesin iddia içermez.",
        match_phrases=(
            "güvenli mi",
            "guvenli mi",
            "güvenlik",
            "guvenlik",
            "güvenilir mi",
            "guvenilir mi",
            "güvenmiyorum",
            "guvenmiyorum",
            "dolandırıcı",
            "dolandirici",
            "dolandırılır",
            "dolandirilir",
            "şikayet",
            "sikayet",
            "şüpheli",
            "supheli",
            "profil doğru",
            "profil dogru",
            "taciz",
            "güvenilir kullanım",
        ),
        phrase_weights=(
            ("güvenli mi", 11),
            ("uygulama güvenli", 10),
            ("dolandırılır mıyım", 11),
            ("şikayet nasıl", 10),
            ("şüpheli sürücü", 10),
        ),
        default_template=SAFETY_AND_TRUST_BASICS,
    ),
)
