"""
Leylek Zeka — deterministic feature-knowledge intents (manifest-backed copy).

No LLM. Templates avoid forbidden user-reply phrases (brand hosts, IAP pitch, etc.).
"""
from __future__ import annotations

from services.leylek_zeka.product_knowledge_manifest import (
    get_leylek_zeka_product_manifest,
    get_supported_product_fact,
    get_unavailable_feature,
)

from .catalog import IntentDefinition

_m = get_leylek_zeka_product_manifest()

# --- Fail-closed (account / live state without verified API context) ---
# When Bearer + verified_context is present, controllers.ai_controller resolves
# verified_* personal intents first (see services.leylek_zeka.verified_context).
# These catalog intents remain the fail-closed fallback when verified data is absent.

ACCOUNT_STATE_UNVERIFIED = (
    "Doğrulayamadım. Hesap, araç onayı, KYC veya erişim durumunu doğrulanmış veri olmadan "
    "söyleyemem. Lütfen uygulama içindeki ilgili ekranı kontrol edin; çözülmezse Destek’e yazın."
)

LIVE_TRIP_STATE_UNVERIFIED = (
    "Doğrulayamadım. Şu anki eşleşme veya yolculuk durumunu doğrulanmış canlı veri olmadan "
    "söyleyemem. Aktif yolculuk ekranını kontrol edin; gerekirse Destek’e yazın."
)

# --- Immediate danger (deterministic; never OpenAI / never claim action completed) ---

IMMEDIATE_DANGER_EMERGENCY = """Acil güvenlik

Şu an tehlikedeyseniz hemen 112’yi arayın.

Mümkünse güvenli bir yere geçin. Çevrenizdeki insanlardan yardım isteyin.

Uygulamadaki Güven Al yalnızca kısa süreli görüntülü görüşme talebi için bir destek aracıdır; acil servis, polis veya ambulans yerine geçmez.

Bu asistan polis, ambulans veya platform müdahalesi başlatmaz; sürekli izleme yapmaz ve güvenlik garantisi vermez. Otomatik ihbar veya tamamlanmış işlem iddiası yoktur.

Önce 112. Güvenli olduğunuzda uygulama içi Destek’e de yazabilirsiniz."""

IMMEDIATE_DANGER_EMERGENCY_VOICE = (
    "Tehlikedeyseniz hemen 112’yi arayın. Mümkünse güvenli bir yere geçin. "
    "Güven Al acil servis yerine geçmez. Bu asistan müdahale başlatmaz."
)

# --- Manifest-backed templates ---

_fact_identity = get_supported_product_fact("product_identity")
_fact_api = get_supported_product_fact("live_api_host")
_fact_vehicle = get_supported_product_fact("vehicle_registry_araclarim")
_fact_vehicle_kyc = get_supported_product_fact("vehicle_kyc_pending_no_resubmit")
_fact_map = get_supported_product_fact("driver_panel_v2_map_first")
_fact_camera = get_supported_product_fact("driver_map_camera_control")
_fact_contrib = get_supported_product_fact("contribution_cash_iban")
_fact_history = get_supported_product_fact("trip_history_operational_log")
_fact_legal = get_supported_product_fact("legal_registry_production")
_fact_support = get_supported_product_fact("support_contacts")
_fact_pos = get_supported_product_fact("positioning_not_taxi")
_unavail_card = get_unavailable_feature("in_app_card_payment")
_unavail_iap = get_unavailable_feature("driver_package_purchase_iap")
_unavail_earn = get_unavailable_feature("earnings_dashboard")
_unavail_legacy = get_unavailable_feature("legacy_driver_verify_route")
_unavail_zeka = get_unavailable_feature("zeka_automatic_action_completion")

PRODUCT_IDENTITY = f"""Ürün ve kimlik

Tüketici ürün adı: {_m.product_name}.
Asistan: {_m.assistant_name}.
Geliştirici şirket: {_m.company_name}.

Canlı API: {_m.live_api_host}.
Eski host önerilmez; yalnızca bu canlı API kullanılır.

Teknik paket veya dahili kimlikler kullanıcıya dönük ürün adı değildir.
{_fact_identity.summary if _fact_identity else ""}
{_fact_api.summary if _fact_api else ""}""".strip()

PRODUCT_IDENTITY_VOICE = (
    f"Ürün adı {_m.product_name}; asistan {_m.assistant_name}; "
    f"şirket {_m.company_name}. Canlı API {_m.live_api_host}."
)

VEHICLE_REGISTRY = f"""Araçlarım

Araç kaydı {_m.vehicle_registry.settings_path} altındadır (uygulama içi rota: /driver-vehicles).

Otomobil ve motosiklet onayları birbirinden bağımsızdır; bir tip onaylıyken diğeri eksik olabilir.
Eksik veya reddedilen tip, kanonik sürücü kimlik doğrulama ekranı (DriverKYCScreen) ile başlatılabilir.
Bekleyen (pending) araç tipi yeniden gönderilmez.
Onaylanmamış araç tipi aktif olamaz.
İlk kez kimlik/araç doğrulama da aynı kanonik ekranı kullanır.

Eski sürücü doğrulama adresi kaldırılmıştır; Araçlarım dışındaki legacy yol kullanılmaz.
{_fact_vehicle.summary if _fact_vehicle else ""}
{_fact_vehicle_kyc.summary if _fact_vehicle_kyc else ""}""".strip()

VEHICLE_REGISTRY_VOICE = (
    "Araç kaydı Ayarlar altındaki Araçlarım’dadır. Otomobil ve motosiklet onayları bağımsızdır; "
    "bekleyen tip yeniden gönderilmez. Onaylanmamış tip aktif olamaz."
)

DRIVER_PANEL_MAP = f"""Sürücü paneli ve harita

Sürücü Paneli V2 harita önceliklidir.
Harita sokak seviyesi yakınlıkta açılır.
GPS güncellemesi işaretçi ve veriyi taşır; kamerayı kendi başına uzaklaştırmaz veya sürekli yeniden zoomlamaz.
Pan ve pinch zoom kullanıcı kontrolündedir.
Yeniden ortala, sokak seviyesi merkeze döner.
Normal eşleşmede kamera kullanıcı kontrolünde kalır.
Aktif adım adım (turn-by-turn) navigasyonda dinamik heading/zoom olabilir.
Haritanın her zaman otomatik takip ettiği söylenmez.
{_fact_map.summary if _fact_map else ""}
{_fact_camera.summary if _fact_camera else ""}""".strip()

DRIVER_PANEL_MAP_VOICE = (
    "Sürücü paneli harita önceliklidir; sokak seviyesi zoom ile açılır. "
    "Pan ve pinch sizde; GPS işaretçiyi taşır, kamerayı sürekli otomatik uzaklaştırmaz. "
    "Aktif navigasyonda dinamik heading/zoom olabilir."
)

CARD_PAYMENT_UNAVAILABLE = f"""Kart ile ödeme

{_unavail_card.summary if _unavail_card else "Uygulama içi kart tahsilatı yoktur."}
Platform uygulama içinden kart tahsilatı yapmaz.
Kart ödemesinin ileride açılacağı söylenmez.
Yolculuk başına katkı tutarı kararlaştırılabilir; nakit veya IBAN katkı onayı olabilir.
{_fact_pos.summary if _fact_pos else ""}""".strip()

CONTRIBUTION_PAYMENT_MODEL = f"""Katkı ve ödeme modeli

{_fact_contrib.summary if _fact_contrib else "Yolculuk başına katkı tutarı kararlaştırılabilir; nakit veya IBAN katkı onayı olabilir."}
Nakit veya IBAN ile katkı onayı olabilir.
Platform taksi işletmecisi değildir; katkı tutarı sürücü kazancı panosu değildir.
Uygulama içi kart tahsilatı yoktur.
IBAN / katkı belgesi için uygulama içi kayıt: /contribution-iban.
{_fact_pos.summary if _fact_pos else ""}""".strip()

DRIVER_PACKAGE_UNAVAILABLE = f"""Sürücü erişimi / paket

{_unavail_iap.summary if _unavail_iap else "Sürücü paketi için uygulama içi ödeme (IAP) mevcut değildir."}
Sürücü erişim ekranı bilgilendirme amaçlıdır.
TL fiyat uydurulmaz; paket ücretinin ileride açılacağı söylenmez.
Hesabınıza özel erişim veya çevrimiçi olma durumu doğrulanmış veri olmadan söylenemez; gerekirse Destek’e yazın.
""".strip()

EARNINGS_DASHBOARD_UNAVAILABLE = f"""Kazanç özeti

{_unavail_earn.summary if _unavail_earn else "Ayrı bir gelir özeti ekranı yoktur."}
Bugün / haftalık / aylık kazanç toplamı veya cüzdan defteri yoktur.
Yolculuk başına katkı, gelir panosu değildir.
Operasyonel yolculuk kaydı için Geçmiş (/history) kullanılır.
{_fact_history.summary if _fact_history else ""}""".strip()

TRIP_HISTORY_OPERATIONAL = f"""Yolculuk geçmişi

{_fact_history.summary if _fact_history else _m.trip_history_policy.summary}
Uygulama içi rota: /history.
Geçmiş; kazanç, cüzdan veya TL toplamı göstermez.
""".strip()

LEGAL_PRIVACY = f"""Gizlilik

Gizlilik belgesi uygulama içi üretim kaydıdır; taslak değildir.
Uygulama içi rota: /privacy.
Herkese açık sayfa: {_m.public_privacy_url}.
Genel yasal merkez: /trust-center.
{_fact_legal.summary if _fact_legal else ""}""".strip()

LEGAL_KVKK = f"""KVKK

KVKK belgesi uygulama içi üretim kaydıdır; taslak değildir.
Uygulama içi rota: /kvkk.
Herkese açık sayfa: {_m.public_kvkk_url}.
Genel yasal merkez: /trust-center.""".strip()

LEGAL_TERMS_USER = f"""Kullanıcı sözleşmesi

Kullanıcı şartları uygulama içi üretim belgesidir; taslak değildir.
Uygulama içi rota: /terms-user.
Herkese açık sayfa: {_m.public_terms_url}.
Genel yasal merkez: /trust-center.""".strip()

LEGAL_TERMS_DRIVER = """Sürücü sözleşmesi

Sürücü şartları uygulama içi üretim belgesidir; taslak değildir.
Uygulama içi rota: /terms-driver.
Genel yasal merkez: /trust-center.""".strip()

LEGAL_IDENTITY = """Kimlik doğrulama metni

Kimlik doğrulama belgesi uygulama içi üretim kaydıdır; taslak değildir.
Uygulama içi rota: /identity-verification.
Genel yasal merkez: /trust-center.""".strip()

LEGAL_CONTRIBUTION_IBAN = """Katkı / IBAN belgesi

Katkı ve IBAN belgesi uygulama içi üretim kaydıdır; taslak değildir.
Uygulama içi rota: /contribution-iban.
Genel yasal merkez: /trust-center.""".strip()

LEGAL_COMMUNITY = """Topluluk kuralları

Topluluk kuralları uygulama içi üretim belgesidir; taslak değildir.
Uygulama içi rota: /community-guidelines.
Genel yasal merkez: /trust-center.""".strip()

LEGAL_DELETE_ACCOUNT = f"""Hesap silme

Hesap silme mevcuttur.
Uygulama içi rota: /delete-account.
Herkese açık sayfa: {_m.public_account_deletion_url}.
Genel yasal merkez: /trust-center.
{_fact_legal.summary if _fact_legal else ""}""".strip()

LEGAL_TRUST_CENTER = f"""Yasal belgeler

{_fact_legal.summary if _fact_legal else _m.legal_documents.summary}
Uygulama içi yasal merkez: /trust-center.
Belgeler üretim kaydıdır; taslak değildir.""".strip()

SUPPORT_CONTACTS = f"""Destek

Şirket: {_m.company_name}.
E-posta: {_m.support_email}.
Telefon: {_m.support_phone}.
Uygulama içi rota: /support.

Şikayet veya destek talebinin sonuçlandığı, çözüldüğü veya işlendiği burada iddia edilmez.
{_fact_support.summary if _fact_support else ""}""".strip()

UNAVAILABLE_FEATURES_SUMMARY = f"""Şu anda olmayan özellikler

- {_unavail_card.summary if _unavail_card else "Kartla ödeme yapılamaz."}
- {_unavail_iap.summary if _unavail_iap else "Sürücü paketi IAP yok."}
- {_unavail_earn.summary if _unavail_earn else "Gelir özeti ekranı yok."}
- {_unavail_legacy.summary if _unavail_legacy else "Eski sürücü doğrulama yolu yok."}
- {_unavail_zeka.summary if _unavail_zeka else "Asistan işlem tamamlayamaz."}

Kart ödemesinin veya paket ücretinin ileride açılacağı söylenmez.
""".strip()


def _intent(
    *,
    id: str,
    title: str,
    description: str,
    example_queries: tuple[str, ...],
    match_phrases: tuple[str, ...],
    phrase_weights: tuple[tuple[str, int], ...],
    default_template: str,
    voice_default_template: str = "",
) -> IntentDefinition:
    return IntentDefinition(
        id=id,
        title=title,
        supported_roles=("any",),
        example_queries=example_queries,
        description=description,
        match_phrases=match_phrases,
        phrase_weights=phrase_weights,
        default_template=default_template,
        voice_default_template=voice_default_template or default_template,
    )


FEATURE_INTENT_DEFINITIONS: tuple[IntentDefinition, ...] = (
    _intent(
        id="immediate_danger_emergency",
        title="Acil tehlike / 112 yönlendirme",
        description=(
            "Anlık tehlike ifadelerinde deterministik güvenlik yanıtı; OpenAI yok; "
            "112 öncelikli; Güven Al acil servis yerine geçmez; işlem tamamlandı iddiası yok."
        ),
        example_queries=(
            "Tehlikedeyim",
            "Acil durum",
            "Yardım edin",
            "112",
            "Biri beni takip ediyor",
            "Sürücüden korkuyorum",
        ),
        match_phrases=(
            "tehlikedeyim",
            "tehlikedeyiz",
            "can güvenliğim tehlikede",
            "can guvenligim tehlikede",
            "acil durum",
            "yardım edin",
            "yardim edin",
            "yardıma ihtiyacım var",
            "yardima ihtiyacim var",
            "kendimi güvende hissetmiyorum",
            "kendimi guvende hissetmiyorum",
            "biri beni takip ediyor",
            "biri peşimde",
            "biri pesimde",
            "sürücüden korkuyorum",
            "surucuden korkuyorum",
            "yolcudan korkuyorum",
            "şiddet var",
            "siddet var",
            "saldırı var",
            "saldiri var",
            "tehdit ediliyorum",
            "zorla tutuluyorum",
            "araçtan inemiyorum",
            "aractan inemiyorum",
            "polis çağır",
            "polis cagir",
            "ambulans çağır",
            "ambulans cagir",
            "112",
            "güvenlik sorunu yaşıyorum",
            "guvenlik sorunu yasiyorum",
            "güvenlik sorunum var",
            "guvenlik sorunum var",
            "güven al",
            "guven al",
            "hemen tehlike",
            "acil yardım",
            "acil yardim",
            "tehlike var",
            "yardım çağır",
            "yardim cagir",
            "yardım çağrıldı",
            "yardim cagrildi",
            "yardım çağırıldı",
            "yardim cagirildi",
        ),
        phrase_weights=(
            ("tehlikedeyim", 40),
            ("can güvenliğim tehlikede", 40),
            ("can guvenligim tehlikede", 40),
            ("acil durum", 38),
            ("yardım edin", 38),
            ("yardim edin", 38),
            ("yardıma ihtiyacım var", 38),
            ("yardima ihtiyacim var", 38),
            ("biri beni takip ediyor", 38),
            ("sürücüden korkuyorum", 36),
            ("surucuden korkuyorum", 36),
            ("yolcudan korkuyorum", 36),
            ("zorla tutuluyorum", 38),
            ("araçtan inemiyorum", 36),
            ("aractan inemiyorum", 36),
            ("tehdit ediliyorum", 36),
            ("şiddet var", 36),
            ("siddet var", 36),
            ("saldırı var", 36),
            ("saldiri var", 36),
            ("polis çağır", 36),
            ("polis cagir", 36),
            ("ambulans çağır", 36),
            ("ambulans cagir", 36),
            ("yardım çağrıldı", 36),
            ("yardim cagrildi", 36),
            ("yardım çağırıldı", 36),
            ("yardim cagirildi", 36),
            ("yardım çağır", 34),
            ("yardim cagir", 34),
            ("güvenlik sorunu yaşıyorum", 34),
            ("guvenlik sorunu yasiyorum", 34),
            ("kendimi güvende hissetmiyorum", 34),
            ("kendimi guvende hissetmiyorum", 34),
            ("112", 32),
            ("hemen tehlike", 32),
            ("acil yardım", 32),
            ("acil yardim", 32),
            ("tehlike var", 28),
            # Below guven_al_explained bare "güven al" (12) so product Qs stay informational
            ("güven al", 10),
            ("guven al", 10),
        ),
        default_template=IMMEDIATE_DANGER_EMERGENCY,
        voice_default_template=IMMEDIATE_DANGER_EMERGENCY_VOICE,
    ),
    _intent(
        id="account_state_unverified",
        title="Hesap/KYC durumu doğrulanamadı",
        description="Doğrulanmış API bağlamı olmadan hesap/KYC/araç onayı/erişim durumu uydurulmaz.",
        example_queries=(
            "Aracım onaylı mı?",
            "KYC onaylandı mı?",
            "Paketim aktif mi?",
            "Hesabım onaylandı mı?",
        ),
        match_phrases=(
            "aracım onaylı mı",
            "aracim onayli mi",
            "aracım onaylandı mı",
            "aracim onaylandi mi",
            "kyc onaylandı mı",
            "kyc onaylandi mi",
            "kyc onaylı mı",
            "kyc onayli mi",
            "kimlik doğrulamam onaylandı mı",
            "kimlik dogrulamam onaylandi mi",
            "paketim aktif mi",
            "hesabım onaylandı mı",
            "hesabim onaylandi mi",
            "başvurum onaylandı mı",
            "basvurum onaylandi mi",
            "erişimim açık mı",
            "erisimim acik mi",
            "neden çevrimiçi olamıyorum",
            "neden cevrimici olamiyorum",
            "çevrimiçi olamıyorum",
            "cevrimici olamiyorum",
        ),
        phrase_weights=(
            ("aracım onaylı mı", 28),
            ("aracim onayli mi", 28),
            ("kyc onaylandı mı", 28),
            ("kyc onaylandi mi", 28),
            ("paketim aktif mi", 28),
            ("neden çevrimiçi olamıyorum", 28),
            ("neden cevrimici olamiyorum", 28),
            ("hesabım onaylandı mı", 26),
            ("hesabim onaylandi mi", 26),
            ("kimlik doğrulamam onaylandı mı", 26),
            ("kimlik dogrulamam onaylandi mi", 26),
        ),
        default_template=ACCOUNT_STATE_UNVERIFIED,
    ),
    _intent(
        id="live_trip_state_unverified",
        title="Canlı yolculuk/eşleşme durumu doğrulanamadı",
        description="Doğrulanmış canlı veri olmadan aktif eşleşme/yolculuk durumu uydurulmaz.",
        example_queries=(
            "Şu an eşleşmem var mı?",
            "Aktif yolculuğum var mı?",
            "Yolculuk durumum ne?",
        ),
        match_phrases=(
            "şu an eşleşmem var mı",
            "su an eslesmem var mi",
            "eşleşmem var mı",
            "eslesmem var mi",
            "aktif yolculuğum var mı",
            "aktif yolculugum var mi",
            "yolculuk durumum ne",
            "yolculuk hangi aşamada",
            "yolculuk hangi asamada",
            "şu anki eşleşmem",
            "su anki eslesmem",
            "mevcut yolculuğum",
            "mevcut yolculugum",
            "teklif geldi mi",
            "biniş doğrulandı mı",
            "binis dogrulandi mi",
            "yolculuk başladı mı",
            "yolculuk basladi mi",
            "yolculuk tamamlandı mı",
            "yolculuk tamamlandi mi",
        ),
        phrase_weights=(
            ("şu an eşleşmem var mı", 28),
            ("su an eslesmem var mi", 28),
            ("aktif yolculuğum var mı", 28),
            ("aktif yolculugum var mi", 28),
            ("yolculuk durumum ne", 24),
            ("yolculuk hangi aşamada", 24),
            ("yolculuk hangi asamada", 24),
            ("teklif geldi mi", 22),
            ("eşleşmem var mı", 22),
            ("eslesmem var mi", 22),
        ),
        default_template=LIVE_TRIP_STATE_UNVERIFIED,
    ),
    _intent(
        id="product_identity",
        title="Ürün kimliği ve API",
        description="Leylek Yolculuk ürün adı, şirket ve canlı API bilgisini verir.",
        example_queries=(
            "Bu uygulamanın adı ne?",
            "LeylekTag mi Leylek Yolculuk mu?",
            "Uygulamayı kim geliştiriyor?",
            "Şirket kim?",
            "API adresi ne?",
        ),
        match_phrases=(
            "uygulamanın adı ne",
            "uygulamanin adi ne",
            "uygulama adı ne",
            "uygulama adi ne",
            "ürün adı ne",
            "urun adi ne",
            "leylektag mi leylek yolculuk",
            "leylek tag mi leylek yolculuk",
            "leylektag mi",
            "uygulamayı kim geliştiriyor",
            "uygulamayi kim gelistiriyor",
            "şirket kim",
            "sirket kim",
            "şirket adı ne",
            "sirket adi ne",
            "api adresi ne",
            "api adresi nedir",
            "canlı api",
            "canli api",
            "api host",
        ),
        phrase_weights=(
            ("uygulamanın adı ne", 26),
            ("uygulamanin adi ne", 26),
            ("api adresi ne", 26),
            ("api adresi nedir", 26),
            ("leylektag mi leylek yolculuk", 24),
            ("leylek tag mi leylek yolculuk", 24),
            ("şirket kim", 22),
            ("sirket kim", 22),
            ("uygulamayı kim geliştiriyor", 20),
            ("uygulamayi kim gelistiriyor", 20),
            ("canlı api", 18),
            ("canli api", 18),
        ),
        default_template=PRODUCT_IDENTITY,
        voice_default_template=PRODUCT_IDENTITY_VOICE,
    ),
    _intent(
        id="vehicle_registry_araclarim",
        title="Araçlarım / araç kaydı",
        description="Araçlarım konumu, ikinci araç, pending ve legacy doğrulama yolunu açıklar.",
        example_queries=(
            "Araçlarım nerede?",
            "İkinci araç nasıl eklenir?",
            "Hem araba hem motosiklet ekleyebilir miyim?",
            "Pending aracı tekrar gönderebilir miyim?",
            "driver-verify nerede?",
        ),
        match_phrases=(
            "araçlarım nerede",
            "araclarim nerede",
            "araçlarım",
            "araclarim",
            "ikinci araç",
            "ikinci arac",
            "ikinci araç nasıl",
            "ikinci arac nasil",
            "hem araba hem motor",
            "hem araba hem motosiklet",
            "araba onaylı motor",
            "araba onayli motor",
            "pending araç",
            "pending arac",
            "bekleyen araç",
            "bekleyen arac",
            "tekrar gönderebilir miyim",
            "tekrar gonderebilir miyim",
            "driver verify",
            "driver-verify",
            "araç kayıt",
            "arac kayit",
        ),
        phrase_weights=(
            ("araçlarım nerede", 26),
            ("araclarim nerede", 26),
            ("ikinci araç nasıl eklenir", 26),
            ("ikinci arac nasil eklenir", 26),
            ("ikinci araç nasıl", 24),
            ("ikinci arac nasil", 24),
            ("hem araba hem motosiklet", 22),
            ("pending araç", 22),
            ("pending arac", 22),
            ("driver-verify", 22),
            ("driver verify", 22),
            ("araçlarım", 14),
            ("araclarim", 14),
        ),
        default_template=VEHICLE_REGISTRY,
        voice_default_template=VEHICLE_REGISTRY_VOICE,
    ),
    _intent(
        id="driver_panel_map_behavior",
        title="Sürücü paneli harita davranışı",
        description="Harita öncelikli panel, sokak zoom, kullanıcı pan/pinch ve navigasyon ayrımını açıklar.",
        example_queries=(
            "Sürücü paneli nasıl çalışıyor?",
            "Harita neden yakın?",
            "Harita neden kendi kendine uzaklaşmıyor?",
            "Aracımı haritada nasıl takip ederim?",
            "Haritayı uzaklaştırabilir miyim?",
        ),
        match_phrases=(
            "sürücü paneli nasıl",
            "surucu paneli nasil",
            "sürücü paneli",
            "surucu paneli",
            "harita neden yakın",
            "harita neden yakin",
            "harita neden uzaklaşmıyor",
            "harita neden uzaklasmiyor",
            "kendi kendine uzaklaş",
            "kendi kendine uzaklas",
            "otomatik zoom",
            "haritayı uzaklaştır",
            "haritayi uzaklastir",
            "haritada nasıl takip",
            "haritada nasil takip",
            "yeniden ortala",
            "recenter",
            "sokak seviyesi",
            "pinch zoom",
        ),
        phrase_weights=(
            ("harita neden yakın", 24),
            ("harita neden yakin", 24),
            ("harita neden uzaklaşmıyor", 24),
            ("harita neden uzaklasmiyor", 24),
            ("harita neden kendi kendine uzaklaşmıyor", 26),
            ("harita neden kendi kendine uzaklasmiyor", 26),
            ("kendi kendine uzaklaşmıyor", 24),
            ("kendi kendine uzaklasmiyor", 24),
            ("sürücü paneli nasıl", 22),
            ("surucu paneli nasil", 22),
            ("haritada nasıl takip", 20),
            ("haritada nasil takip", 20),
            ("haritayı uzaklaştırabilir miyim", 24),
            ("haritayi uzaklastirabilir miyim", 24),
            ("haritayı uzaklaştır", 20),
            ("haritayi uzaklastir", 20),
            ("otomatik zoom", 18),
            ("yeniden ortala", 16),
            ("sürücü paneli", 12),
            ("surucu paneli", 12),
        ),
        default_template=DRIVER_PANEL_MAP,
        voice_default_template=DRIVER_PANEL_MAP_VOICE,
    ),
    _intent(
        id="card_payment_unavailable",
        title="Kart ödemesi yok",
        description="Uygulama içi kart ödemesinin olmadığını söyler; yakında demez.",
        example_queries=(
            "Kartla ödeme var mı?",
            "Kart ödeme ne zaman gelecek?",
            "Uygulama parayı kesiyor mu?",
        ),
        match_phrases=(
            "kartla ödeme",
            "kartla odeme",
            "kart ile ödeme",
            "kart ile odeme",
            "kart ödeme var mı",
            "kart odeme var mi",
            "kart ödeme ne zaman",
            "kart odeme ne zaman",
            "kredi kartı ile öde",
            "kredi karti ile ode",
            "uygulama parayı kesiyor",
            "uygulama parayi kesiyor",
            "kart tahsilat",
        ),
        phrase_weights=(
            ("kartla ödeme", 26),
            ("kartla odeme", 26),
            ("kart ödeme var mı", 26),
            ("kart odeme var mi", 26),
            ("kart ödeme ne zaman", 24),
            ("kart odeme ne zaman", 24),
            ("uygulama parayı kesiyor", 22),
            ("uygulama parayi kesiyor", 22),
            ("kart ile ödeme", 20),
            ("kart ile odeme", 20),
        ),
        default_template=CARD_PAYMENT_UNAVAILABLE,
    ),
    _intent(
        id="contribution_payment_model",
        title="Katkı payı ve IBAN",
        description="Yolculuk başı katkı, nakit/IBAN onayını açıklar; kart tahsilatı yoktur.",
        example_queries=(
            "Ödeme nasıl yapılıyor?",
            "Katkı payı nedir?",
            "IBAN kullanabilir miyim?",
        ),
        match_phrases=(
            "ödeme nasıl yapılıyor",
            "odeme nasil yapiliyor",
            "katkı payı nedir",
            "katki payi nedir",
            "katkı payı",
            "katki payi",
            "iban kullanabilir miyim",
            "iban ile katkı",
            "iban ile katki",
            "nakit katkı",
            "nakit katki",
            "masraf paylaşımı",
            "masraf paylasimi",
        ),
        phrase_weights=(
            ("katkı payı nedir", 26),
            ("katki payi nedir", 26),
            ("iban kullanabilir miyim", 24),
            ("ödeme nasıl yapılıyor", 22),
            ("odeme nasil yapiliyor", 22),
            ("katkı payı", 14),
            ("katki payi", 14),
        ),
        default_template=CONTRIBUTION_PAYMENT_MODEL,
    ),
    _intent(
        id="driver_package_unavailable",
        title="Sürücü paketi IAP yok",
        description="Uygulama içi sürücü paketi/IAP olmadığını ve erişim ekranının bilgilendirme olduğunu söyler.",
        example_queries=(
            "Paket satın alabilir miyim?",
            "Sürücü paketi ne kadar?",
            "Paket nasıl alınır?",
        ),
        match_phrases=(
            "paket satın alabilir miyim",
            "paket satin alabilir miyim",
            "sürücü paketi ne kadar",
            "surucu paketi ne kadar",
            "paket nasıl alınır",
            "paket nasil alinir",
            "paket ücreti",
            "paket ucreti",
            "iap",
            "uygulama içi satın",
            "uygulama ici satin",
        ),
        phrase_weights=(
            ("paket satın alabilir miyim", 26),
            ("paket satin alabilir miyim", 26),
            ("sürücü paketi ne kadar", 24),
            ("surucu paketi ne kadar", 24),
            ("paket nasıl alınır", 22),
            ("paket nasil alinir", 22),
            ("iap", 16),
        ),
        default_template=DRIVER_PACKAGE_UNAVAILABLE,
    ),
    _intent(
        id="earnings_dashboard_unavailable",
        title="Kazanç özeti yok",
        description="Ayrı kazanç/cüzdan panosunun olmadığını söyler.",
        example_queries=(
            "Kazançlarımı nereden görürüm?",
            "Bugün ne kadar kazandım?",
            "Haftalık kazanç var mı?",
            "Cüzdan var mı?",
        ),
        match_phrases=(
            "kazançlarımı nereden",
            "kazanclarimi nereden",
            "bugün ne kadar kazandım",
            "bugun ne kadar kazandim",
            "haftalık kazanç",
            "haftalik kazanc",
            "aylık kazanç",
            "aylik kazanc",
            "cüzdan var mı",
            "cuzdan var mi",
            "kazanç paneli",
            "kazanc paneli",
            "gelir özeti",
            "gelir ozeti",
        ),
        phrase_weights=(
            ("bugün ne kadar kazandım", 26),
            ("bugun ne kadar kazandim", 26),
            ("kazançlarımı nereden", 24),
            ("kazanclarimi nereden", 24),
            ("haftalık kazanç", 22),
            ("haftalik kazanc", 22),
            ("cüzdan var mı", 22),
            ("cuzdan var mi", 22),
            ("kazanç paneli", 20),
            ("kazanc paneli", 20),
        ),
        default_template=EARNINGS_DASHBOARD_UNAVAILABLE,
    ),
    _intent(
        id="trip_history_operational",
        title="Yolculuk geçmişi",
        description="Geçmişin operasyonel kayıt olduğunu ve /history rotasını açıklar.",
        example_queries=(
            "Geçmiş yolculuklarda para görünür mü?",
            "Yolculuk geçmişi nerede?",
            "History nerede?",
        ),
        match_phrases=(
            "geçmiş yolculuklarda para",
            "gecmis yolculuklarda para",
            "yolculuk geçmişi",
            "yolculuk gecmisi",
            "geçmiş nerede",
            "gecmis nerede",
            "history nerede",
            "operasyonel kayıt",
            "operasyonel kayit",
        ),
        phrase_weights=(
            ("geçmiş yolculuklarda para", 24),
            ("gecmis yolculuklarda para", 24),
            ("yolculuk geçmişi", 20),
            ("yolculuk gecmisi", 20),
            ("geçmiş nerede", 18),
            ("gecmis nerede", 18),
            ("history nerede", 16),
        ),
        default_template=TRIP_HISTORY_OPERATIONAL,
    ),
    _intent(
        id="legal_privacy",
        title="Gizlilik belgesi",
        description="Gizlilik belgesi üretim kaydıdır; /privacy.",
        example_queries=("Gizlilik politikası nerede?",),
        match_phrases=(
            "gizlilik politikası",
            "gizlilik politikasi",
            "gizlilik nerede",
            "privacy nerede",
            "privacy policy",
        ),
        phrase_weights=(
            ("gizlilik politikası", 24),
            ("gizlilik politikasi", 24),
            ("gizlilik nerede", 20),
            ("privacy nerede", 18),
        ),
        default_template=LEGAL_PRIVACY,
    ),
    _intent(
        id="legal_kvkk",
        title="KVKK belgesi",
        description="KVKK üretim kaydıdır; /kvkk.",
        example_queries=("KVKK nerede?",),
        match_phrases=("kvkk nerede", "kvkk metni", "kvkk belgesi", "kvkk"),
        phrase_weights=(
            ("kvkk nerede", 24),
            ("kvkk metni", 20),
            ("kvkk belgesi", 20),
            ("kvkk", 12),
        ),
        default_template=LEGAL_KVKK,
    ),
    _intent(
        id="legal_terms_user",
        title="Kullanıcı sözleşmesi",
        description="Kullanıcı şartları; /terms-user.",
        example_queries=("Kullanıcı sözleşmesi nerede?",),
        match_phrases=(
            "kullanıcı sözleşmesi",
            "kullanici sozlesmesi",
            "kullanıcı şartları",
            "kullanici sartlari",
            "terms-user",
            "user terms",
        ),
        phrase_weights=(
            ("kullanıcı sözleşmesi", 24),
            ("kullanici sozlesmesi", 24),
            ("kullanıcı şartları", 20),
            ("kullanici sartlari", 20),
        ),
        default_template=LEGAL_TERMS_USER,
    ),
    _intent(
        id="legal_terms_driver",
        title="Sürücü sözleşmesi",
        description="Sürücü şartları; /terms-driver.",
        example_queries=("Sürücü sözleşmesi nerede?",),
        match_phrases=(
            "sürücü sözleşmesi",
            "surucu sozlesmesi",
            "sürücü şartları",
            "surucu sartlari",
            "terms-driver",
            "driver terms",
        ),
        phrase_weights=(
            ("sürücü sözleşmesi", 24),
            ("surucu sozlesmesi", 24),
            ("sürücü şartları", 20),
            ("surucu sartlari", 20),
        ),
        default_template=LEGAL_TERMS_DRIVER,
    ),
    _intent(
        id="legal_identity_verification",
        title="Kimlik doğrulama belgesi",
        description="Kimlik doğrulama metni; /identity-verification.",
        example_queries=("Kimlik doğrulama metni nerede?",),
        match_phrases=(
            "kimlik doğrulama metni",
            "kimlik dogrulama metni",
            "kimlik doğrulama belgesi",
            "kimlik dogrulama belgesi",
            "identity-verification",
        ),
        phrase_weights=(
            ("kimlik doğrulama metni", 24),
            ("kimlik dogrulama metni", 24),
            ("kimlik doğrulama belgesi", 22),
            ("kimlik dogrulama belgesi", 22),
        ),
        default_template=LEGAL_IDENTITY,
    ),
    _intent(
        id="legal_contribution_iban",
        title="Katkı/IBAN belgesi",
        description="Katkı/IBAN belgesi konumu; /contribution-iban.",
        example_queries=("Katkı/IBAN belgesi nerede?",),
        match_phrases=(
            "katkı iban belgesi",
            "katki iban belgesi",
            "iban belgesi nerede",
            "katkı belgesi nerede",
            "katki belgesi nerede",
            "contribution-iban",
        ),
        phrase_weights=(
            ("katkı iban belgesi", 24),
            ("katki iban belgesi", 24),
            ("iban belgesi nerede", 22),
            ("katkı belgesi nerede", 20),
            ("katki belgesi nerede", 20),
        ),
        default_template=LEGAL_CONTRIBUTION_IBAN,
    ),
    _intent(
        id="legal_community_guidelines",
        title="Topluluk kuralları",
        description="Topluluk kuralları; /community-guidelines.",
        example_queries=("Topluluk kuralları nerede?",),
        match_phrases=(
            "topluluk kuralları",
            "topluluk kurallari",
            "community guidelines",
            "community-guidelines",
        ),
        phrase_weights=(
            ("topluluk kuralları", 24),
            ("topluluk kurallari", 24),
            ("community guidelines", 18),
        ),
        default_template=LEGAL_COMMUNITY,
    ),
    _intent(
        id="legal_delete_account",
        title="Hesap silme",
        description="Hesap silme mevcuttur; /delete-account.",
        example_queries=("Hesabımı nasıl silerim?",),
        match_phrases=(
            "hesabımı nasıl silerim",
            "hesabimi nasil silerim",
            "hesap silme",
            "hesabımı sil",
            "hesabimi sil",
            "delete-account",
            "delete account",
        ),
        phrase_weights=(
            ("hesabımı nasıl silerim", 26),
            ("hesabimi nasil silerim", 26),
            ("hesap silme", 22),
            ("hesabımı sil", 20),
            ("hesabimi sil", 20),
        ),
        default_template=LEGAL_DELETE_ACCOUNT,
    ),
    _intent(
        id="legal_trust_center",
        title="Yasal belgeler merkezi",
        description="Belgelerin üretim kaydı olduğunu ve /trust-center’ı açıklar.",
        example_queries=(
            "Belgeler taslak mı?",
            "Yasal belgeler nerede?",
            "Trust center nerede?",
        ),
        match_phrases=(
            "belgeler taslak mı",
            "belgeler taslak mi",
            "yasal belgeler",
            "trust center",
            "trust-center",
            "güven merkezi",
            "guven merkezi",
        ),
        phrase_weights=(
            ("belgeler taslak mı", 26),
            ("belgeler taslak mi", 26),
            ("yasal belgeler", 20),
            ("trust center", 18),
            ("güven merkezi", 16),
            ("guven merkezi", 16),
        ),
        default_template=LEGAL_TRUST_CENTER,
    ),
    _intent(
        id="support_contacts",
        title="Destek iletişim",
        description="Destek e-posta ve telefonunu verir; sonuç iddiası yapmaz.",
        example_queries=(
            "Destek numarası ne?",
            "Destek maili ne?",
            "Kiminle iletişime geçeceğim?",
            "Şikayetimi nereye bildirebilirim?",
        ),
        match_phrases=(
            "destek numarası",
            "destek numarasi",
            "destek maili",
            "destek e-posta",
            "destek email",
            "kiminle iletişime",
            "kiminle iletisime",
            "şikayetimi nereye",
            "sikayetimi nereye",
            "destek iletişimi",
            "destek iletisimi",
            "0850",
        ),
        phrase_weights=(
            ("destek numarası", 24),
            ("destek numarasi", 24),
            ("destek maili", 24),
            ("şikayetimi nereye", 22),
            ("sikayetimi nereye", 22),
            ("kiminle iletişime", 20),
            ("kiminle iletisime", 20),
            ("destek e-posta", 18),
        ),
        default_template=SUPPORT_CONTACTS,
    ),
    _intent(
        id="unavailable_features_summary",
        title="Olmayan özellikler özeti",
        description="Kart, IAP, kazanç özeti ve legacy doğrulama yolunun olmadığını özetler.",
        example_queries=(
            "Şu anda olmayan özellikler neler?",
            "Hangi özellikler yok?",
        ),
        match_phrases=(
            "olmayan özellikler",
            "olmayan ozellikler",
            "şu anda olmayan",
            "su anda olmayan",
            "hangi özellikler yok",
            "hangi ozellikler yok",
            "desteklenmeyen özellik",
            "desteklenmeyen ozellik",
        ),
        phrase_weights=(
            ("olmayan özellikler", 24),
            ("olmayan ozellikler", 24),
            ("şu anda olmayan", 22),
            ("su anda olmayan", 22),
            ("hangi özellikler yok", 20),
            ("hangi ozellikler yok", 20),
        ),
        default_template=UNAVAILABLE_FEATURES_SUMMARY,
    ),
)
