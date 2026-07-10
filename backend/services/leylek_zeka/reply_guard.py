"""
Leylek Zeka — deterministic user-reply policy guard (no I/O).

Uses the product knowledge manifest for forbidden terminology.
Adds affirmative forbidden-claim phrase detectors for fail-closed replies.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable

from .product_knowledge_manifest import (
    find_forbidden_user_terms,
    get_leylek_zeka_product_manifest,
    is_forbidden_claim,
)

_SAFE_FAIL_CLOSED = (
    "Doğrulayamadım. Bu konuda kesin veya güncel bilgi veremiyorum. "
    "Lütfen uygulama içindeki ilgili ekranı kontrol edin veya destek kanallarını kullanın."
)

# Affirmative claim language only — denials like "yoktur / söylenmez" should not match.
_FORBIDDEN_CLAIM_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "card_payment_available",
        re.compile(
            r"(?i)("
            r"kart\s+(ile\s+)?[oö]deme\s+(yapabilir|mevcut|m[uü]mk[uü]n|aktif)|"
            r"kartla\s+[oö]deyebilir|"
            r"uygulama\s+i[cç]i\s+kart\s+[oö]deme\s+(var|mevcut|yap[iı]l[iı]r)|"
            r"kredi\s+kart[iı]\s+ile\s+[oö]de"
            r")",
        ),
    ),
    (
        "card_payment_coming_soon",
        re.compile(
            r"(?i)("
            r"kart\s+[oö]deme\s+yak[iı]nda|"
            r"kartla\s+[oö]deme\s+yak[iı]nda|"
            r"[oö]deme\s+(yak[iı]nda|çok\s+yak[iı]nda)\s+(gelecek|gelir|aktif)"
            r")",
        ),
    ),
    (
        "package_purchase_available",
        re.compile(
            r"(?i)("
            r"paket\s+sat[iı]n\s+al(abilir|abilirsiniz|ın|in)?|"
            r"uygulama\s+i[cç]i\s+(sat[iı]n\s+alma|ödeme|iap)\s+(var|mevcut|yap[iı]l[iı]r)|"
            r"s[uü]r[uü]c[uü]\s+paketi\s+(sat[iı]n|alabilir)"
            r")",
        ),
    ),
    (
        "earnings_dashboard_available",
        re.compile(
            r"(?i)("
            r"s[uü]r[uü]c[uü]\s+kazan[cç]\s+paneli|"
            r"kazan[cç]\s+(paneli|dashboard|[oö]zeti)\s+(var|mevcut|a[cç][iı]n)|"
            r"g[uü]nl[uü]k\s+kazan[cç]\s+[oö]zet"
            r")",
        ),
    ),
    (
        "earnings_guaranteed",
        re.compile(
            r"(?i)("
            r"kazan[cç]\s+garantisi\s+(var|verilir|mevcut|sa[gğ]lar)|"
            r"garanti\s+kazan[cç]\s+(sa[gğ]lar|verilir|mevcut)|"
            r"bug[uü]n\s+.+\s+kazand[iı]n"
            r")",
        ),
    ),
    (
        "account_state_verified_without_api",
        re.compile(
            r"(?i)("
            r"hesab[iı]n[iı]z\s+(onayland[iı]|do[gğ]ruland[iı]|aktif\s+edildi)|"
            r"hesap\s+durumunuz[uü]\s+(onaylad[iı]m|do[gğ]rulad[iı]m)"
            r")",
        ),
    ),
    (
        "kyc_status_verified_without_api",
        re.compile(
            r"(?i)("
            r"kyc\s+(onayland[iı]|reddedildi|beklemede)|"
            r"kimlik\s+do[gğ]rulaman[iı]z\s+(onayland[iı]|tamamland[iı])|"
            r"s[uü]r[uü]c[uü]\s+ba[sş]vurunuz\s+onayland[iı]"
            r")",
        ),
    ),
    (
        "trip_state_verified_without_api",
        re.compile(
            r"(?i)("
            r"yolculu[gğ]unuz\s+(e[sş]le[sş]ti|ba[sş]lad[iı]|bitti|iptal\s+edildi)|"
            r"aktif\s+yolculu[gğ]unuz\s+var|"
            r"tag\s+durumunuz\s+"
            r")",
        ),
    ),
    (
        "action_completed_without_success_response",
        re.compile(
            r"(?i)("
            r"(i[sş]lemi|kayd[iı]|[oö]demeyi|iptali)\s+(tamamlad[iı]m|ger[cç]ekle[sş]tirdim)|"
            r"ba[sş]ar[iı]yla\s+(tamamlad[iı]m|olu[sş]turdum|g[oö]nderdim)|"
            r"api\s+olmadan\s+i[sş]lem\s+tamam"
            r")",
        ),
    ),
    (
        "approval_time_guaranteed",
        re.compile(
            r"(?i)("
            r"onay\s+(s[uü]resi|mutlaka)\s+\d+|"
            r"\d+\s*(saat|g[uü]n|dakika)\s+i[cç]inde\s+onaylan(acak|ır)|"
            r"garanti\s+onay\s+s[uü]resi"
            r")",
        ),
    ),
    (
        "driver_availability_invented",
        re.compile(
            r"(?i)("
            r"[cç]evrenizde\s+\d+\s+s[uü]r[uü]c[uü]|"
            r"\d+\s+s[uü]r[uü]c[uü]\s+(haz[iı]r|m[uü]sait|var)|"
            r"kesin\s+s[uü]r[uü]c[uü]\s+bulunur"
            r")",
        ),
    ),
    (
        "eta_invented",
        re.compile(
            r"(?i)("
            r"(eta|var[iı][sş])\s*:?\s*\d+\s*(dk|dakika|min)|"
            r"\d+\s*dakika\s+i[cç]inde\s+(gelecek|ula[sş]acak)|"
            r"kesin\s+s[uü]re\s+\d+\s*dakika"
            r")",
        ),
    ),
    (
        "refund_outcome_invented",
        re.compile(
            r"(?i)("
            r"iadeniz\s+(onayland[iı]|yap[iı]ld[iı]|yat[iı]r[iı]ld[iı])|"
            r"paran[iı]z\s+(iade\s+edildi|geri\s+yat[iı]r[iı]ld[iı])|"
            r"refund\s+(approved|completed)"
            r")",
        ),
    ),
    (
        "complaint_resolution_invented",
        re.compile(
            r"(?i)("
            r"[sş]ikayetinizi\s+([cç][oö]zd[uü]m|sonu[cç]land[iı]rd[iı]m|kabul\s+ettim)|"
            r"[sş]ikayet\s+sonucu\s+(lehinize|aleyhinize)|"
            r"kar[sş][iı]\s+taraf[iı]\s+cezaland[iı]rd[iı]m"
            r")",
        ),
    ),
    (
        "legal_outcome_guaranteed",
        re.compile(
            r"(?i)("
            r"hukuken\s+(garanti|kesin)|"
            r"yasal\s+olarak\s+(hakl[iı]s[iı]n[iı]z|su[cç]lusunuz)|"
            r"mahkeme\s+sonucu\s+"
            r")",
        ),
    ),
)


def _fold(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "")


def find_forbidden_claim_hits(text: str) -> tuple[str, ...]:
    """Return forbidden claim ids whose affirmative patterns appear in text."""
    raw = _fold(text)
    if not raw.strip():
        return ()
    hits: list[str] = []
    seen: set[str] = set()
    for claim_id, pattern in _FORBIDDEN_CLAIM_PATTERNS:
        if not is_forbidden_claim(claim_id):
            continue
        if pattern.search(raw) and claim_id not in seen:
            hits.append(claim_id)
            seen.add(claim_id)
    return tuple(hits)


def find_user_reply_policy_violations(text: str) -> tuple[str, ...]:
    """
    Combined policy hits for a user-visible reply.
    Labels are forbidden-term labels and/or claim ids.
    """
    terms = find_forbidden_user_terms(text, surface="user_reply")
    claims = find_forbidden_claim_hits(text)
    # Stable: terms first (manifest order), then claims.
    out: list[str] = []
    seen: set[str] = set()
    for item in (*terms, *claims):
        if item not in seen:
            out.append(item)
            seen.add(item)
    return tuple(out)


def is_user_reply_policy_violation(text: str) -> bool:
    return bool(find_user_reply_policy_violations(text))


def safe_fail_closed_reply() -> str:
    return _SAFE_FAIL_CLOSED


def guard_user_visible_reply(text: str) -> str:
    """
    If reply violates brand/claim policy, replace with fail-closed copy.
    Empty input stays empty (caller handles).
    """
    raw = (text or "").strip()
    if not raw:
        return text or ""
    if is_user_reply_policy_violation(raw):
        return _SAFE_FAIL_CLOSED
    return text


def admin_kb_body_allowed(body: str) -> bool:
    """Admin KB bodies must pass the same user-visible policy."""
    return not is_user_reply_policy_violation(body or "")


def brand_identity_snippet() -> str:
    """Short identity block for system prompt (from manifest SSOT)."""
    m = get_leylek_zeka_product_manifest()
    return (
        f"Ürün adı: {m.product_name}. Asistan: {m.assistant_name}. "
        f"Şirket: {m.company_name}. Canlı API: {m.live_api_host}. "
        f"Destek: {m.support_email}, {m.support_phone}."
    )


def unsupported_feature_policy_snippet() -> str:
    m = get_leylek_zeka_product_manifest()
    lines = [
        "Desteklenmeyen / uydurulmayacak konular:",
        "- Uygulama içi kart ödeme yok; 'kart ödeme yakında' deme.",
        "- Sürücü paket satın alma / IAP yok.",
        "- Kazanç paneli ve kazanç garantisi yok.",
        "- Hesap, KYC veya yolculuk durumunu API/doğrulanmış bağlam olmadan iddia etme.",
        "- API başarı yanıtı olmadan işlem tamamlandı deme.",
        "- ETA, sürücü sayısı, iade sonucu, şikayet sonucu veya hukuki sonucu uydurma.",
        f"- Eski API/host önerme: api.leylektag.com veya leylektag.com. Doğru host: {m.live_api_host}.",
        "- Bilmediğin veya doğrulayamadığın konuda 'Doğrulayamadım.' de.",
    ]
    return "\n".join(lines)


def any_violation_in(texts: Iterable[str]) -> bool:
    return any(is_user_reply_policy_violation(t) for t in texts)
