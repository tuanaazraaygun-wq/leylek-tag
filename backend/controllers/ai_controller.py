"""
Leylek Zeka — OpenAI ve OPENAI_API_KEY yokken / hata halinde hazır Türkçe yanıtlar.
Eşleşme/socket/harita koduna dokunulmaz.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Literal, Optional, TypedDict

import httpx

from services.admin_leylek_zeka_kb import try_match_admin_kb
from services.answer_engine import try_resolve
from services.answer_engine.telemetry import emit_answer_engine_resolution
from services.leylek_zeka.product_knowledge_manifest import (
    get_leylek_zeka_product_manifest,
)
from services.leylek_zeka.reply_guard import (
    brand_identity_snippet,
    evaluate_user_visible_reply,
    unsupported_feature_policy_snippet,
)
from services.leylek_zeka.response_contract import (
    LeylekZekaResponseMetadata,
    ReplyOrigin,
    build_leylek_zeka_response_metadata,
)

logger = logging.getLogger("server")

OPENAI_URL = "https://api.openai.com/v1/responses"
# Hızlı/ucuz varsayılan model; opsiyonel override: OPENAI_MODEL
OPENAI_DEFAULT_MODEL = "gpt-4o-mini"
REQUEST_TIMEOUT_SEC = 20.0
RATE_LIMIT_SEC = 5.0

# Leylek Zeka kullanıcı sohbeti: yalnızca OpenAI (OPENAI_API_KEY). Kaynak etiketi gerçeği yansıtır.
Source = Literal["openai", "fallback", "answer_engine", "admin_kb", "operation_snapshot"]


def _emit_answer_engine_telemetry(
    *,
    hit: bool,
    intent_id: str | None,
    response_source: Source,
    context: dict[str, Any] | None,
    user_message: str,
) -> None:
    try:
        emit_answer_engine_resolution(
            hit=hit,
            intent_id=intent_id,
            response_source=response_source,
            context=context,
            user_message=user_message,
        )
    except Exception:
        logger.debug("answer_engine telemetry failed", exc_info=True)


class AnswerEngineMeta(TypedDict):
    """answer_engine veya operation_snapshot deterministic yanıt meta."""

    intent_id: str
    deterministic: Literal[True]


_OPERATION_GUARDRAIL = (
    "\n[Operasyon özeti] support_context.operation içindeki sayılar ve bölge adları dışında "
    "yeni bölge veya sayı uydurma. no_guarantee=true ise kesin süre, eşleşme veya kazanç garantisi verme. "
    "Koordinat veya tag/kullanıcı id isteme veya yazma. message_hint varsa ona sadık kal; "
    "kısaltabilirsin ama yeni yoğunluk iddiası ekleme."
)

_DRIVER_OPERATION_PHRASES = (
    "nereye gitmeliyim",
    "nerede talep",
    "talep var",
    "yoğun bölge",
    "yogun bolge",
    "yoğunluk",
    "yogunluk",
    "müşteri bul",
    "musteri bul",
    "talep yoğun",
    "hangi bölge",
    "hangi bolge",
    "nereye git",
    "yakında yolcu",
    "yakinda yolcu",
    "yolcu var mı",
    "yolcu var mi",
    "iş var mı",
    "is var mi",
    "hareket var mı",
    "hareket var mi",
)

_OPS_AUTOSHOT_FLOW_HINTS = frozenset({
    "passenger_matching",
    "driver_idle",
    "driver_offer_list",
})

_GENERAL_EDUCATION_PHRASES = (
    "kim kurdu",
    "leylektag",
    "hangi firma",
    "neden kuruldu",
    "hangi teknoloji",
    "nasıl çalışır",
    "nasil calisir",
    "nasıl iptal",
    "nasil iptal",
    "iptal et",
    "iptal nasıl",
    "iptal nasil",
    "qr",
    "güven al",
    "guven al",
    "muhabbet",
    "sohbet nasıl",
    "sohbet nasil",
    "şikayet",
    "sikayet",
    "bildir",
    "dolandır",
    "dolandir",
    "leylek teklif",
    "şehir dışı",
    "sehir disi",
    "yolcu nasıl başlat",
    "yolcu nasil baslat",
    "sürücü nasıl ol",
    "surucu nasil ol",
    "kyc",
    "kayıt ol",
    "kayit ol",
    "kim teklif",
    "teklifi kim",
    "hangi taraf teklif",
)

_PASSENGER_OPERATION_PHRASES = (
    "sürücü gelmedi",
    "surucu gelmedi",
    "teklif gelmedi",
    "teklif gelmiyor",
    "neden bekliyorum",
    "yakında sürücü",
    "yakinda surucu",
    "sürücü var mı",
    "surucu var mi",
    "uygun sürücü",
    "uygun surucu",
    "bekliyorum olmuyor",
    "çevrede sürücü",
    "cevremde surucu",
    "bölgesel uygunluk",
    "bolgesel uygunluk",
)


# Product identity from SSOT.
_MANIFEST = get_leylek_zeka_product_manifest()
_PRODUCT_NAME = _MANIFEST.product_name
_ASSISTANT_NAME = _MANIFEST.assistant_name
_COMPANY_NAME = _MANIFEST.company_name

# Tek kaynak: system prompt + eşleşme/rol fallback’lerinde aynı kanon (teklif → yolcu kabulü).
_ESLESME_VE_ROL = (
    f"{_PRODUCT_NAME} eşleşmesi şöyle işler: "
    "Yolcu uygulama üzerinden bir yolculuk talebi oluşturur. Uygun sürücüler bu talebi görür. "
    "Sürücü yolcuya teklif gönderir. Yolcu gelen tekliflerden birini inceler ve kabul eder. "
    "Eşleşme yalnızca yolcunun teklifi kabul etmesiyle tamamlanır. "
    "Eşleşme sürücünün talep onayıyla oluşmaz; talebe ilk bakan veya ilk teklif veren sürücü otomatik eşleşmez. "
    "Eşleşme sonrasında yolcu ve sürücü, yan yana gelene kadar uygulama içi sesli iletişim ve yazılı sohbet "
    "özelliklerini kullanabilir. Sürücü tarafında navigasyon desteği bulunur. "
    "Yolcu araca bindiğinde QR doğrulaması ile başlangıç adımı tamamlanır. Süreç bitirilirken yine QR doğrulaması kullanılır."
)

_ROL_KABUL_NETLIGI = (
    f"{_PRODUCT_NAME} eşleşmesinde kabul adımı yolcudadır. "
    "Sürücü uygun talebi görüp teklif gönderir; yolcu gelen tekliflerden birini kabul eder. "
    "Eşleşme yalnızca yolcunun teklifi kabul etmesiyle tamamlanır. "
    "Eşleşme sürücünün talep onayıyla oluşmaz; talebe ilk bakan veya ilk teklif veren sürücü otomatik eşleşmez."
)

_KIM_TEKLIF = (
    "Teklifi sürücü gönderir. Yolcu talep oluşturur; teklif göndermez. "
    "Yolcu gelen tekliflerden birini kabul edince eşleşme tamamlanır."
)

_SURUCU_SEC = (
    _ESLESME_VE_ROL
    + "\nSürücüysen uygun talepleri görür ve teklif gönderirsin; eşleşmeyi talep onayıyla bitirmezsin. "
    "Yolcu gelen tekliflerden birini kabul edince eşleşme tamamlanır."
)

_YOLCU_SEC = (
    _ESLESME_VE_ROL
    + "\nYolcuysan talep oluşturur, gelen sürücü tekliflerini inceler ve uygun olanı kabul edersin. "
    "Eşleşme, bir teklifi kabul ettikten sonra tamamlanır."
)

LEYLEK_ZEKA_SYSTEM = (
    f"Sen {_PRODUCT_NAME} uygulamasının yardımcısı {_ASSISTANT_NAME}'sın. "
    f"Şirket: {_COMPANY_NAME}. Samimi, saygılı, kısa ve net konuş. "
    "Kullanıcıya uygulama içindeki yolculuk, eşleşme ve kullanım adımlarında yardımcı ol. "
    f"Uygulama dışı genel, hukuki, tıbbi veya kişisel konularda kesin yönlendirme yapma; nazikçe {_PRODUCT_NAME} "
    "içindeki konulara dön. "
    "Bilmediğin bir şeyi uydurma. Doğrulayamadığın hesap, KYC, yolculuk veya işlem durumunda "
    "'Doğrulayamadım.' de. Kullanıcıyı azarlama. Gerekirse uygulama içi destek veya geri bildirim paylaşmasını öner. "
    "Eşleşme ve rol sorularında yalnızca tanımlı kanon akışı kullan: yolcu talep oluşturur, sürücü teklif gönderir, "
    "yolcu teklifi kabul eder; eşleşme yolcu kabulüyle tamamlanır. "
    "Markdown kullanma; yıldızlı kalın başlık yazma. Düz metin ve kısa numaralı adımlar kullan.\n"
    f"{brand_identity_snippet()}\n"
    f"{unsupported_feature_policy_snippet()}\n\n"
    + _ESLESME_VE_ROL
)

USER_HELP_MODE = "USER_HELP_MODE"


def _context_system_addon(ctx: dict[str, Any] | None) -> str:
    """İstemciden gelen opsiyonel bağlam — PII yok; yalnızca ekran/rol ipuçları."""
    if not ctx or not isinstance(ctx, dict):
        return ""
    parts: list[str] = []
    for k in (
        "screen",
        "flowHint",
        "role",
        "city",
        "vehicleType",
        "hasActiveOffer",
        "isWaitingMatch",
        "isDriver",
        "isPassenger",
        "guideMode",
        "stageLabel",
        "intentScope",
        "operationAwareness",
        "safeAdviceOnly",
        "voiceMode",
        "inputMode",
    ):
        v = ctx.get(k)
        if v is None or v == "":
            continue
        parts.append(f"{k}={v}")
    sc = ctx.get("support_context")
    operation_addon = ""
    if isinstance(sc, dict):
        trip = sc.get("trip")
        if isinstance(trip, dict):
            try:
                parts.append(
                    "support_trip="
                    + json.dumps(trip, ensure_ascii=False, separators=(",", ":"))
                )
            except Exception:
                parts.append("support_trip=(serialize_error)")
        operation = sc.get("operation")
        if isinstance(operation, dict) and operation:
            try:
                parts.append(
                    "support_operation="
                    + json.dumps(operation, ensure_ascii=False, separators=(",", ":"))
                )
            except Exception:
                parts.append("support_operation=(serialize_error)")
            operation_addon = _OPERATION_GUARDRAIL
    if not parts:
        return operation_addon
    return (
        "\n[Kullanıcı bağlamı — kişisel veri yok] "
        + ", ".join(parts)
        + "\nBu bağlama uygun, kısa yardım ver. Markdown kullanma."
        + operation_addon
        + (
            "\nvoiceMode=true ise konuşma diliyle yanıt ver: 2-4 kısa cümle kur, gereksiz liste yapma; "
            "kritik güvenlik, garanti yok ve acil durum bilgilerini çıkarma."
            if ctx.get("voiceMode") is True
            else ""
        )
    )


def _support_operation_from_context(context: dict[str, Any] | None) -> dict[str, Any] | None:
    if not context or not isinstance(context, dict):
        return None
    sc = context.get("support_context")
    if not isinstance(sc, dict):
        return None
    op = sc.get("operation")
    return op if isinstance(op, dict) and op else None


def _is_general_education_question(t: str) -> bool:
    """Şirket / prosedür / KYC vb. — Tier-A autoshot dışı."""
    return any(p in t for p in _GENERAL_EDUCATION_PHRASES)


def _should_use_operation_snapshot_short_circuit(
    context: dict[str, Any] | None,
    user_message: str,
    operation: dict[str, Any],
) -> bool:
    """
    Tier-A: operationAwareness + operasyonel flowHint → keyword yok.
    Tier-B: mevcut _is_operation_question yedek.
    """
    t = _normalize_for_match(user_message)
    if not t or _is_general_education_question(t):
        return False
    flow = str((context or {}).get("flowHint") or "").strip().lower()
    if (
        context
        and context.get("operationAwareness") is True
        and flow in _OPS_AUTOSHOT_FLOW_HINTS
    ):
        return True
    return _is_operation_question(user_message, operation)


def _is_operation_question(user_message: str, operation: dict[str, Any]) -> bool:
    t = _normalize_for_match(user_message)
    if not t:
        return False
    kind = str(operation.get("kind") or "").strip().lower()
    if kind == "driver_demand":
        return any(p in t for p in _DRIVER_OPERATION_PHRASES)
    if kind == "passenger_availability":
        return any(p in t for p in _PASSENGER_OPERATION_PHRASES)
    return any(p in t for p in _DRIVER_OPERATION_PHRASES + _PASSENGER_OPERATION_PHRASES)


def _try_operation_snapshot_reply(
    user_message: str,
    context: dict[str, Any] | None,
) -> tuple[str, AnswerEngineMeta] | None:
    """
    Bearer ile yüklenmiş operation özeti + operasyon sorusu → message_hint (deterministic).
    has_data=false / signal=none dahil.
    """
    operation = _support_operation_from_context(context)
    if not operation:
        return None
    if not _should_use_operation_snapshot_short_circuit(context, user_message, operation):
        return None
    hint = str(operation.get("message_hint") or "").strip()
    if not hint:
        return None
    kind = str(operation.get("kind") or "operation_snapshot")
    return hint, {"intent_id": kind, "deterministic": True}

_last_request_mono: dict[str, float] = {}
_rate_lock = asyncio.Lock()


async def enforce_rate_limit(client_key: str) -> None:
    """Aynı istemci için en az RATE_LIMIT_SEC aralık."""
    now = time.monotonic()
    async with _rate_lock:
        last = _last_request_mono.get(client_key, 0.0)
        if now - last < RATE_LIMIT_SEC:
            raise RateLimitedError()
        _last_request_mono[client_key] = now


class RateLimitedError(Exception):
    """429 — çok sık istek."""


class LeylekZekaError(Exception):
    """Model çağrısı başarısız (fallback’e düşülür)."""


def _normalize_for_match(text: str) -> str:
    """Küçük harf + fazla boşluk; Türkçe İ/I eşleşmesi için güvenli sadeleştirme."""
    t = (text or "").strip()
    # Python default lower: 'İ' → 'i̇' (combining), 'I' → 'i' — arama ifadelerini kırar.
    t = t.replace("İ", "i").replace("I", "i")
    t = t.lower()
    t = re.sub(r"\s+", " ", t)
    return t


def _has_eslesme(t: str) -> bool:
    return (
        "eşleş" in t
        or "esles" in t
        or "esleş" in t
        or "eşles" in t
    )


_REPLIES: dict[str, str] = {
    "eslesme_gelmedi": (
        "Şehir içinde eşleşme, o an çevrendeki uygun yolcu veya sürücü yoğunluğuna bağlıdır; "
        "bazen birkaç dakika sürebilir veya rota dışı kalındığında teklif sayısı azalabilir.\n\n"
        "Konum izninin açık olduğundan, internetinin stabil olduğundan ve uygulamanın arka planda "
        "kapanmadığından emin ol. Gerekirse talebi iptal edip adres veya araç tercihini netleştirerek "
        "yeniden başlatabilirsin.\n\n"
        "İstersen adım adım anlatayım."
    ),
    "eslesme_nasil": _ESLESME_VE_ROL,
    "eslesme_genel": _ESLESME_VE_ROL,
    "teklif": _ESLESME_VE_ROL,
    "motor_araba": (
        f"{_PRODUCT_NAME}'te talebini veya sürücü profilini oluştururken araç tipini (örneğin motor veya otomobil) "
        "ilgili alandan seçebilirsin; böylece sistem seni doğru tekliflerle eşleştirir.\n\n"
        "Şehir içinde trafik, park ve yolcu kapasitesi açısından ihtiyacına en uygun türü işaretlemen "
        "hem eşleşmeyi hem buluşmayı kolaylaştırır.\n\n"
        "İstersen hangi araç tipinin daha uygun olduğunu söyleyeyim."
    ),
    "motor": (
        "Motor tercihini yolcu talebinde veya sürücü tarafındaki araç bilgilerinde, listeden motoru "
        "işaretleyerek kaydedebilirsin.\n\n"
        "Seçimini kaydettikten sonra gelen teklifler bu profile göre filtrelenir.\n\n"
        "İstersen hangi araç tipinin daha uygun olduğunu söyleyeyim."
    ),
    "araba": (
        "Otomobil seçimini talep veya profil ekranındaki araç tipi alanından yap; "
        f"{_PRODUCT_NAME} şehir içi rotalarda sana uygun sürücü veya yolcu önerilerini buna göre sıralar.\n\n"
        "Kapasite veya bagaj ihtiyacın varsa bunu not düşmek eşleşmeyi netleştirir.\n\n"
        "İstersen hangi araç tipinin daha uygun olduğunu söyleyeyim."
    ),
    "surucu_sec": _SURUCU_SEC,
    "yolcu_sec": _YOLCU_SEC,
    "kim_teklif": _KIM_TEKLIF,
    "rol_kabul_netligi": _ROL_KABUL_NETLIGI,
    "guvenlik": (
        f"{_PRODUCT_NAME}'te yolculuğu uygulama üzerinden takip etmeni, karşı tarafın profil ve araç bilgilerini "
        "ekrandan teyit etmeni ve şüpheli bir durumda yolculuğu sonlandırıp bildirimde bulunmanı öneririz.\n\n"
        "Hesap doğrulama ve şikâyet kanalları güvenliği destekler; özel bilgini mesajda paylaşmaman en sağlıklısıdır.\n\n"
        "İstersen adım adım anlatayım."
    ),
    "mesaj": (
        "Aktif talep veya yolculuk ekranındaki sohbet alanına yazıp gönder’e bastığında mesajın karşı tarafa düşer; "
        "bildirimleri açık tutman buluşmayı kolaylaştırır.\n\n"
        "Konum veya güvenlikle ilgili kritik bilgileri mümkünse uygulama içinden iletmeni öneririm.\n\n"
        "İstersen bu ekranı birlikte ilerleyelim."
    ),
    "iptal": (
        "Devam eden talep veya yolculuğunda iptal seçeneği genelde aynı akışın üst kısmında veya "
        "özet ekranında yer alır; dokunduğunda işlem uygulama kurallarına göre sonlanır.\n\n"
        "İptal öncesi ekrandaki uyarı metnini oku; ücret veya ceza ihtimali varsa orada belirtilir.\n\n"
        "İstersen adım adım anlatayım."
    ),
    "sehir_ici": (
        f"{_PRODUCT_NAME} şehir içi kısa mesafeler için optimize edilir: konumunu paylaşırsın, talebini veya "
        "müsaitliğini işaretlersin; harita üzerinden yakın eşleşmeler önerilir.\n\n"
        "Yoğun saatlerde birkaç dakika beklemek normaldir; rota veya çıkış noktanı netleştirmek süreyi kısaltır.\n\n"
        "İstersen bu ekranı birlikte ilerleyelim."
    ),
}

_FALLBACK_GENERIC = (
    f"Şu an sana {_PRODUCT_NAME} içindeki yolculuk, eşleşme ve kullanım adımlarına göre kısa yanıtlar veriyorum. "
    "Eşleşme, yolculuk, araç tipi, güvenlik, iptal veya şehir içi kullanım için sorunu birkaç kelimeyle yazabilir "
    "veya alttaki önerilen sorulardan birine dokunabilirsin.\n\n"
    "İstersen adım adım anlatayım."
)


def fallback_reply(user_message: str, context: Optional[dict[str, Any]] = None) -> str:
    """OPENAI_API_KEY yokken veya model kullanılamazken doğal Türkçe hazır yanıt."""
    t = _normalize_for_match(user_message)
    if not t:
        return _FALLBACK_GENERIC

    if any(
        p in t
        for p in (
            "kim kabul",
            "kabul eden kim",
            "yolcu mu kabul",
            "sürücü mü kabul",
            "surucu mu kabul",
            "sürücü kabul eder",
            "surucu kabul eder",
            "sürücü onaylar",
            "surucu onaylar",
            "eşleşmeyi kim",
            "eslesmeyi kim",
            "ilk kabul",
            "ilk kabul eden",
            "talebi kabul",
            "talep kabul",
            "kabul edince eşleş",
            "kabul edince esles",
            "sürücü talebi kabul",
            "surucu talebi kabul",
        )
    ):
        return _REPLIES["rol_kabul_netligi"]

    if any(
        p in t
        for p in (
            "kim teklif",
            "teklifi kim",
            "teklif kimden",
            "hangi taraf teklif",
            "teklif hangi taraftan",
            "yolcu teklif",
            "yolcu gönderir mi teklif",
            "yolcu gonderir mi teklif",
            "yolcu teklif gönder",
            "yolcu teklif gonder",
        )
    ):
        return _REPLIES["kim_teklif"]

    ctx = context if isinstance(context, dict) else None
    if ctx:
        if ctx.get("isWaitingMatch") or (ctx.get("flowHint") in ("passenger_matching", "passenger_offer_waiting")):
            if _has_eslesme(t) or "bekle" in t or "teklif" in t:
                return _REPLIES["eslesme_gelmedi"]
        if ctx.get("flowHint") == "driver_offer_compose" and "teklif" in t:
            return _REPLIES["teklif"]
        if ctx.get("flowHint") == "role-select" and ("rol" in t or "sürücü" in t or "yolcu" in t):
            return (
                _ESLESME_VE_ROL
                + "\nRol seçimi menüleri buna göre düzenlenir; ardından araç veya talep tercihlerini netleştirmen eşleşmeyi kolaylaştırır."
            )

    if _has_eslesme(t) and any(
        w in t
        for w in (
            "gelmedi",
            "gelmiyor",
            "neden",
            "olmuyor",
            "yok",
            "bulamadım",
            "bekliyorum",
            "uzun",
            "gecik",
            "bekledim",
        )
    ):
        return _REPLIES["eslesme_gelmedi"]

    if _has_eslesme(t) and any(
        w in t for w in ("nasıl", "nasil", "oluyor", "çalışır", "calisir", "çalış", "calis", "nedir")
    ):
        return _REPLIES["eslesme_nasil"]

    if "teklif" in t:
        return _REPLIES["teklif"]

    if ("motor" in t and "araba" in t) or "motor mu" in t or "araba mı" in t:
        return _REPLIES["motor_araba"]
    if "motor" in t and "araba" not in t and "otomobil" not in t:
        return _REPLIES["motor"]
    if "araba" in t or "otomobil" in t:
        return _REPLIES["araba"]

    if ("sürücü" in t or "surucu" in t) and any(
        k in t for k in ("kabul", "onay", "onayla", "tamaml")
    ):
        return _REPLIES["rol_kabul_netligi"]

    if "yolcu" in t and (
        "seç" in t or "sec" in t or "nasıl" in t or "nasil" in t or "ne yap" in t
    ):
        return _REPLIES["yolcu_sec"]

    if "sürücü" in t or "surucu" in t:
        return _REPLIES["surucu_sec"]

    if "güven" in t or "guven" in t:
        return _REPLIES["guvenlik"]

    if "mesaj" in t:
        return _REPLIES["mesaj"]

    if "iptal" in t:
        return _REPLIES["iptal"]

    if "şehir" in t or "sehir" in t:
        return _REPLIES["sehir_ici"]

    if _has_eslesme(t):
        return _REPLIES["eslesme_genel"]

    return _FALLBACK_GENERIC


def _high_confidence_flow_reply(user_message: str) -> str | None:
    """
    Answer engine kaçırırsa eşleşme/rol sorularında sabit, doğru Türkçe yanıt.
    get_leylek_zeka_reply içinde answer_engine sonrasında kullanılır (katalog öncelikli).
    """
    t = _normalize_for_match(user_message)
    if not t:
        return None
    if any(
        p in t
        for p in (
            "kim kabul",
            "kabul eden kim",
            "yolcu mu kabul",
            "sürücü mü kabul",
            "surucu mu kabul",
            "sürücü kabul eder",
            "surucu kabul eder",
            "sürücü onaylar",
            "surucu onaylar",
            "eşleşmeyi kim",
            "eslesmeyi kim",
            "ilk kabul",
            "ilk kabul eden",
            "talebi kabul",
            "talep kabul",
            "kabul edince eşleş",
            "kabul edince esles",
            "sürücü talebi kabul",
            "surucu talebi kabul",
        )
    ):
        return _REPLIES["rol_kabul_netligi"]
    if any(
        p in t
        for p in (
            "kim teklif",
            "teklifi kim",
            "teklif kimden",
            "hangi taraf teklif",
            "teklif hangi taraftan",
            "yolcu teklif",
            "yolcu gönderir mi teklif",
            "yolcu gonderir mi teklif",
            "yolcu teklif gönder",
            "yolcu teklif gonder",
        )
    ):
        return _REPLIES["kim_teklif"]
    if _has_eslesme(t) and any(
        w in t
        for w in (
            "nasıl",
            "nasil",
            "oluyor",
            "çalışır",
            "calisir",
            "çalış",
            "calis",
            "nedir",
        )
    ):
        return _REPLIES["eslesme_nasil"]
    return None


def _build_chat_messages(history: list[dict[str, Any]], user_message: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for turn in history[-20:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        out.append({"role": role, "content": content})
    out.append({"role": "user", "content": user_message.strip()})
    return out


def _extract_openai_text(data: Any) -> str:
    """
    OpenAI Responses API -> text extraction.
    Expected shape:
      { output: [ { content: [ { type: "output_text", text: "..." }, ... ] }, ... ] }
    """
    try:
        out = data.get("output") or []
        parts: list[str] = []
        for item in out:
            for c in (item or {}).get("content") or []:
                if isinstance(c, dict) and c.get("type") in ("output_text", "text"):
                    t = c.get("text")
                    if isinstance(t, str) and t.strip():
                        parts.append(t.strip())
        return "\n".join(parts).strip()
    except Exception:
        return ""


async def _call_openai(
    *,
    user_message: str,
    history: list[dict[str, Any]] | None,
    system_extra: str = "",
) -> str:
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise LeylekZekaError("no_api_key")

    text = (user_message or "").strip()
    if not text:
        raise LeylekZekaError("empty")

    hist = history or []
    messages = _build_chat_messages(hist, text)

    system = LEYLEK_ZEKA_SYSTEM + (system_extra or "")
    model = (os.getenv("OPENAI_MODEL") or OPENAI_DEFAULT_MODEL).strip() or OPENAI_DEFAULT_MODEL

    # Responses API format (text-only)
    input_items: list[dict[str, Any]] = [
        {"role": "system", "content": [{"type": "input_text", "text": system}]}
    ]

    for m in messages:
        role = m.get("role")
        content = (m.get("content") or "").strip()

        if role in ("user", "assistant") and content:
            ctype = "output_text" if role == "assistant" else "input_text"
            input_items.append(
                {
                    "role": role,
                    "content": [{"type": ctype, "text": content}],
                }
            )

    payload = {
        "model": model,
        "input": input_items,
        "max_output_tokens": 1024,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SEC) as client:
            resp = await client.post(OPENAI_URL, json=payload, headers=headers)
    except httpx.TimeoutException:
        logger.warning("Leylek Zeka: OpenAI timeout (%ss)", REQUEST_TIMEOUT_SEC)
        raise LeylekZekaError("timeout")
    except httpx.RequestError as e:
        logger.warning("Leylek Zeka: istek hatası: %s", e)
        raise LeylekZekaError("request_error")

    if resp.status_code != 200:
        logger.warning(
            "Leylek Zeka: OpenAI HTTP %s — %s",
            resp.status_code,
            resp.text[:500],
        )
        raise LeylekZekaError("bad_status")

    try:
        data = resp.json()
    except Exception:
        raise LeylekZekaError("bad_json")

    reply = _extract_openai_text(data)
    if not reply:
        raise LeylekZekaError("empty_reply")
    return reply


def _keyword_reply_is_manifest_backed(reply: str) -> bool:
    """True when keyword fallback returned a known product canon (not generic unknown)."""
    raw = (reply or "").strip()
    if not raw or raw == _FALLBACK_GENERIC.strip():
        return False
    return raw in set(_REPLIES.values()) or raw == _ESLESME_VE_ROL.strip()


async def get_leylek_zeka_reply(
    *,
    user_message: str,
    history: list[dict[str, Any]] | None,
    context: dict[str, Any] | None = None,
) -> tuple[str, Source, AnswerEngineMeta | None, LeylekZekaResponseMetadata]:
    """
    Öncelik: operation_snapshot → answer_engine (katalog) → yüksek güven eşleşme kanonu →
    admin KB (feature flag) → OpenAI (anahtar varsa) → Türkçe fallback.

    Eşleşme/rol için answer_engine isabeti, genel yüksek güven metninden önce gelir;
    katalog kaçırırsa doğru _ESLESME_VE_ROL / rol kabul kanonu kullanılır.
    Tüm kullanıcıya dönen metinler marka/yasak iddia korumasından geçer (kaynak etiketi korunur).
    Dördüncü dönüş: additive grounded response metadata (mevcut alanları değiştirmez).
    """
    text = (user_message or "").strip()
    if not text:
        guard = evaluate_user_visible_reply(_FALLBACK_GENERIC)
        contract = build_leylek_zeka_response_metadata(
            source="fallback",
            origin="empty",
            guard=guard,
            user_message=text,
        )
        return guard.reply, "fallback", None, contract

    def _emit_and_return(
        reply: str,
        source: Source,
        meta: AnswerEngineMeta | None,
        *,
        hit: bool,
        intent_id: str | None,
        origin: ReplyOrigin,
        live_state_used: bool = False,
        account_context_used: bool = False,
        source_version_override: str | None = None,
        manifest_backed_keyword: bool = False,
    ) -> tuple[str, Source, AnswerEngineMeta | None, LeylekZekaResponseMetadata]:
        guard = evaluate_user_visible_reply(reply)
        contract = build_leylek_zeka_response_metadata(
            source=source,
            origin=origin,
            intent_id=intent_id,
            deterministic=bool(meta and meta.get("deterministic")),
            guard=guard,
            live_state_used=live_state_used,
            account_context_used=account_context_used,
            source_version_override=source_version_override,
            manifest_backed_keyword=manifest_backed_keyword,
            user_message=text,
        )
        _emit_answer_engine_telemetry(
            hit=hit,
            intent_id=intent_id,
            response_source=source,
            context=context,
            user_message=text,
        )
        return guard.reply, source, meta, contract

    op_hit = _try_operation_snapshot_reply(text, context)
    if op_hit is not None:
        reply_text, op_meta = op_hit
        operation = _support_operation_from_context(context) or {}
        op_ver = str(operation.get("schema_version") or "").strip() or None
        return _emit_and_return(
            reply_text,
            "operation_snapshot",
            op_meta,
            hit=True,
            intent_id=op_meta["intent_id"],
            origin="operation_snapshot",
            live_state_used=True,
            account_context_used=True,
            source_version_override=op_ver,
        )

    resolved = try_resolve(text, context)
    if resolved is not None:
        meta: AnswerEngineMeta = {
            "intent_id": resolved["intent_id"],
            "deterministic": True,
        }
        return _emit_and_return(
            resolved["text"],
            "answer_engine",
            meta,
            hit=True,
            intent_id=resolved["intent_id"],
            origin="answer_engine",
        )

    flow_hit = _high_confidence_flow_reply(text)
    if flow_hit is not None:
        return _emit_and_return(
            flow_hit,
            "fallback",
            None,
            hit=False,
            intent_id=None,
            origin="high_confidence",
        )

    kb_hit = try_match_admin_kb(text)
    if kb_hit:
        return _emit_and_return(
            kb_hit,
            "admin_kb",
            None,
            hit=False,
            intent_id=None,
            origin="admin_kb",
        )

    system_extra = _context_system_addon(context)

    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    logger.info("Leylek Zeka: OPENAI_API_KEY %s", "var" if api_key else "yok")
    if not api_key:
        logger.info("Leylek Zeka: OPENAI_API_KEY yok — fallback yanıt")
        fb = fallback_reply(text, context)
        return _emit_and_return(
            fb,
            "fallback",
            None,
            hit=False,
            intent_id=None,
            origin="keyword_fallback",
            manifest_backed_keyword=_keyword_reply_is_manifest_backed(fb),
        )

    try:
        reply = await _call_openai(
            user_message=text,
            history=history,
            system_extra=system_extra,
        )
        logger.info("Leylek Zeka: OpenAI request başarılı")
        return _emit_and_return(
            reply,
            "openai",
            None,
            hit=False,
            intent_id=None,
            origin="openai",
        )
    except LeylekZekaError as e:
        logger.info("Leylek Zeka: OpenAI kullanılamadı (%s) — fallback", e)
        fb = fallback_reply(text, context)
        return _emit_and_return(
            fb,
            "fallback",
            None,
            hit=False,
            intent_id=None,
            origin="keyword_fallback",
            manifest_backed_keyword=_keyword_reply_is_manifest_backed(fb),
        )


async def call_leylek_zeka(
    *,
    user_message: str,
    history: list[dict[str, Any]] | None,
    context: dict[str, Any] | None = None,
) -> str:
    reply, _src, _meta, _contract = await get_leylek_zeka_reply(
        user_message=user_message, history=history, context=context
    )
    return reply
