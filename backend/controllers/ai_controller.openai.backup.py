"""
Leylek Zeka — OpenAI ve OPENAI_API_KEY yokken / hata halinde hazır Türkçe yanıtlar.
Eşleşme/socket/harita koduna dokunulmaz.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from typing import Any, Literal, Optional, TypedDict

import httpx

from services.answer_engine import try_resolve
from services.answer_engine.telemetry import emit_answer_engine_resolution

logger = logging.getLogger("server")

OPENAI_URL = "https://api.openai.com/v1/responses"
# Hızlı/ucuz varsayılan model; opsiyonel override: OPENAI_MODEL
OPENAI_DEFAULT_MODEL = "gpt-4o-mini"
REQUEST_TIMEOUT_SEC = 5.0
RATE_LIMIT_SEC = 5.0

# Not: HTTP response formatı bozulmasın diye model kaynağını "claude" etiketiyle döndürmeye devam ediyoruz.
Source = Literal["claude", "fallback", "answer_engine"]


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
    """Yalnızca source=answer_engine iken HTTP yanıtına yansır; tek try_resolve sonucu."""

    intent_id: str
    deterministic: Literal[True]


LEYLEK_ZEKA_SYSTEM = (
    "Sen LeylekTag uygulamasının yapay zeka asistanısın.\n"
    "Adın Leylek Zeka.\n"
    "Kullanıcılara:\n"
    "- eşleşme\n"
    "- teklif gönderme\n"
    "- sürücü seçimi\n"
    "- araç seçimi\n"
    "- şehir içi kullanım\n"
    "- güvenlik\n"
    "konularında yardımcı ol.\n"
    "Kısa ve net cevap ver.\n"
    "Türkçe konuş."
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
    ):
        v = ctx.get(k)
        if v is None or v == "":
            continue
        parts.append(f"{k}={v}")
    if not parts:
        return ""
    return "\n[Kullanıcı bağlamı — kişisel veri yok] " + ", ".join(parts) + "\nBu bağlama uygun, kısa yardım ver."


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
    """Küçük harf + fazla boşlukları sadeleştir (Türkçe karakterler korunur)."""
    t = (text or "").strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t


_REPLIES: dict[str, str] = {
    "eslesme_gelmedi": (
        "Şehir içinde eşleşme, o an çevrendeki uygun yolcu veya sürücü yoğunluğuna bağlıdır; "
        "bazen birkaç dakika sürebilir veya rota dışı kalındığında teklif sayısı azalabilir.\n\n"
        "Konum izninin açık olduğundan, internetinin stabil olduğundan ve uygulamanın arka planda "
        "kapanmadığından emin ol. Gerekirse talebi iptal edip adres veya araç tercihini netleştirerek "
        "yeniden başlatabilirsin.\n\n"
        "İstersen adım adım anlatayım."
    ),
    "eslesme_nasil": (
        "LeylekTag şehir içi hareket için çalışır: yolcu olarak talebini oluşturur veya sürücü olarak "
        "müsait olduğunu işaretlersin; sistem haritadaki konumuna göre uygun eşleşmeleri sırayla sunar.\n\n"
        "Doğru rol, güncel konum ve net bir kalkış/varış tercihi eşleşmeyi hızlandırır. "
        "Ekranda çıkan teklif veya yönlendirmeleri takip etmen yeterli.\n\n"
        "İstersen bu ekranı birlikte ilerleyelim."
    ),
    "eslesme_genel": (
        "Eşleşme, talebini veya müsaitliğini uygulamaya ilettiğinde LeylekTag’in seni çevrendeki "
        "uygun kullanıcıyla buluşturmasıdır; süreç uygulama içindeki teklif ve onay adımlarıyla ilerler.\n\n"
        "Şehir içi kullanımda konumun ne kadar güncelse öneriler o kadar isabetli olur.\n\n"
        "İstersen adım adım anlatayım."
    ),
    "teklif": (
        "Teklif, karşı tarafa gidecek net bir yanıt veya fiyat/şart özetidir: ilgili ekranda sunulan "
        "seçeneklerden birini işaretleyip onayladığında teklifin iletilir.\n\n"
        "Göndermeden önce süreyi, ücreti veya rota özetini ekranda bir kez daha kontrol etmeni öneririm; "
        "vazgeçmek istersen genelde aynı ekrandan geri dönebilirsin.\n\n"
        "İstersen bu ekranı birlikte ilerleyelim."
    ),
    "motor_araba": (
        "LeylekTag’te talebini veya sürücü profilini oluştururken araç tipini (örneğin motor veya otomobil) "
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
        "LeylekTag şehir içi rotalarda sana uygun sürücü veya yolcu önerilerini buna göre sıralar.\n\n"
        "Kapasite veya bagaj ihtiyacın varsa bunu not düşmek eşleşmeyi netleştirir.\n\n"
        "İstersen hangi araç tipinin daha uygun olduğunu söyleyeyim."
    ),
    "surucu_sec": (
        "Yolcu olarak, sana sunulan sürücü kartında süre, rota özeti ve profil bilgilerini kontrol et; "
        "uygun gördüğünde onayla dediğinde eşleşme tamamlanır.\n\n"
        "Bulutlu veya belirsiz bir detay varsa teklifi kabul etmeden önce uygulama içi mesajla netleştirmeni öneririm.\n\n"
        "İstersen bu ekranı birlikte ilerleyelim."
    ),
    "yolcu_sec": (
        "Sürücü olarak gelen talebi harita ve özet bilgilerle inceleyip kabul ettiğinde yolcuyla "
        "eşleşmiş olursun; yolculuk adımları uygulama içinden devam eder.\n\n"
        "Kalkış noktası veya güzergâh net değilse kabul öncesi mesajlaştırmak hem güven hem zaman kazandırır.\n\n"
        "İstersen adım adım anlatayım."
    ),
    "guvenlik": (
        "LeylekTag’te yolculuğu uygulama üzerinden takip etmeni, karşı tarafın profil ve araç bilgilerini "
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
        "LeylekTag şehir içi kısa mesafeler için optimize edilir: konumunu paylaşırsın, talebini veya "
        "müsaitliğini işaretlersin; harita üzerinden yakın eşleşmeler önerilir.\n\n"
        "Yoğun saatlerde birkaç dakika beklemek normaldir; rota veya çıkış noktanı netleştirmek süreyi kısaltır.\n\n"
        "İstersen bu ekranı birlikte ilerleyelim."
    ),
}

_FALLBACK_GENERIC = (
    "Şu an sana LeylekTag içindeki akışlara göre kısa yanıtlar veriyorum. "
    "Eşleşme, teklif, araç tipi, güvenlik, iptal veya şehir içi kullanım için sorunu birkaç kelimeyle yazabilir "
    "veya alttaki önerilen sorulardan birine dokunabilirsin.\n\n"
    "İstersen adım adım anlatayım."
)


def _has_eslesme(t: str) -> bool:
    return "eşleş" in t or "esles" in t


def fallback_reply(user_message: str, context: Optional[dict[str, Any]] = None) -> str:
    """OPENAI_API_KEY yokken veya model kullanılamazken doğal Türkçe hazır yanıt."""
    t = _normalize_for_match(user_message)
    if not t:
        return _FALLBACK_GENERIC

    ctx = context if isinstance(context, dict) else None
    if ctx:
        if ctx.get("isWaitingMatch") or (ctx.get("flowHint") in ("passenger_matching", "passenger_offer_waiting")):
            if _has_eslesme(t) or "bekle" in t or "teklif" in t:
                return _REPLIES["eslesme_gelmedi"]
        if ctx.get("flowHint") == "driver_offer_compose" and "teklif" in t:
            return _REPLIES["teklif"]
        if ctx.get("flowHint") == "role-select" and ("rol" in t or "sürücü" in t or "yolcu" in t):
            return (
                "Rol seçimi hesabının akışını belirler: yolcu talep oluşturur, sürücü teklif alır/gönderir. "
                "İhtiyacına uygun olanı seçebilirsin; sonra profilinde araç veya talep tercihlerini netleştirmen eşleşmeyi kolaylaştırır."
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

    if _has_eslesme(t) and "nasıl" in t:
        return _REPLIES["eslesme_nasil"]

    if "teklif" in t:
        return _REPLIES["teklif"]

    if ("motor" in t and "araba" in t) or "motor mu" in t or "araba mı" in t:
        return _REPLIES["motor_araba"]
    if "motor" in t and "araba" not in t and "otomobil" not in t:
        return _REPLIES["motor"]
    if "araba" in t or "otomobil" in t:
        return _REPLIES["araba"]

    if "sürücü" in t or "surucu" in t:
        return _REPLIES["surucu_sec"]

    if "yolcu" in t and ("seç" in t or "sec" in t or "nasıl" in t):
        return _REPLIES["yolcu_sec"]

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


async def get_leylek_zeka_reply(
    *,
    user_message: str,
    history: list[dict[str, Any]] | None,
    context: dict[str, Any] | None = None,
) -> tuple[str, Source, AnswerEngineMeta | None]:
    """
    Claude anahtarı varsa ve çağrı başarılıysa claude; aksi halde hata vermeden fallback.
    context: opsiyonel bağlama duyarlı yardım (USER_HELP_MODE).
    Üçüncü dönüş: yalnızca Answer Engine eşleşmesinde intent_id + deterministic (HTTP opsiyonel alanları).
    """
    text = (user_message or "").strip()
    if not text:
        return _FALLBACK_GENERIC, "fallback", None

    resolved = try_resolve(text, context)
    if resolved is not None:
        meta: AnswerEngineMeta = {
            "intent_id": resolved["intent_id"],
            "deterministic": True,
        }
        _emit_answer_engine_telemetry(
            hit=True,
            intent_id=resolved["intent_id"],
            response_source="answer_engine",
            context=context,
            user_message=text,
        )
        return resolved["text"], "answer_engine", meta

    system_extra = _context_system_addon(context)

    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    logger.info("Leylek Zeka: OPENAI_API_KEY %s", "var" if api_key else "yok")
    if not api_key:
        logger.info("Leylek Zeka: OPENAI_API_KEY yok — fallback yanıt")
        _emit_answer_engine_telemetry(
            hit=False,
            intent_id=None,
            response_source="fallback",
            context=context,
            user_message=text,
        )
        return fallback_reply(text, context), "fallback", None

    try:
        reply = await _call_openai(
            user_message=text,
            history=history,
            system_extra=system_extra,
        )
        logger.info("Leylek Zeka: OpenAI request başarılı")
        _emit_answer_engine_telemetry(
            hit=False,
            intent_id=None,
            response_source="claude",
            context=context,
            user_message=text,
        )
        return reply, "claude", None
    except LeylekZekaError as e:
        logger.info("Leylek Zeka: OpenAI kullanılamadı (%s) — fallback", e)
        _emit_answer_engine_telemetry(
            hit=False,
            intent_id=None,
            response_source="fallback",
            context=context,
            user_message=text,
        )
        return fallback_reply(text, context), "fallback", None


async def call_leylek_zeka(
    *,
    user_message: str,
    history: list[dict[str, Any]] | None,
    context: dict[str, Any] | None = None,
) -> str:
    reply, _src, _meta = await get_leylek_zeka_reply(
        user_message=user_message, history=history, context=context
    )
    return reply

