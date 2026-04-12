"""
Admin canlı öğrenme — kural tabanlı soru üretimi (OpenAI zorunlu değil).

Yanlış pozitifleri azaltmak için hem uzunluk hem 'öğretme sinyali' gerekir.
"""

from __future__ import annotations

import re

_TEACHING_MARKERS = (
    " değildir",
    " degildir",
    " demektir",
    " anlamına gel",
    " anlamina gel",
    " platform",
    " butonu",
    " özelliği",
    " ozelligi",
    " sağlar",
    " saglar",
    " sağlıyor",
    " sagliyor",
    " yapmaz",
    " içerir",
    " icerir",
    " kullanılır",
    " kullanilir",
    " paylaşımlı",
    " paylasimli",
    " doğrulama",
    " dogrulama",
    " işlevi",
    " islevi",
    " içindir",
    " icerindir",
    " şudur",
    " sudur",
    " şöyle",
    " soyle",
)

_QUESTIONISH_PREFIXES = (
    "ne ",
    "nasıl",
    "nasil",
    "neden",
    "kim ",
    "hangi",
    "kaç",
    "kac",
    "nerede",
    "nereden",
    "olur mu",
    "mümkün",
    "mumkun",
)

_GREETING_OR_CHITCHAT = (
    "merhaba",
    "selam",
    "sa ",
    "sa.",
    "günaydın",
    "gunaydin",
    "iyi akşamlar",
    "iyi aksamlar",
    "eyvallah",
    "teşekkür",
    "tesekkur",
    "tamam",
    "peki",
    "olur",
    "evet",
    "hayır",
    "hayir",
)


def is_admin_teaching_statement(text: str) -> bool:
    """Düz bilgi / tanım cümlesi gibi görünüyorsa True (soru:/cevap: dışı)."""
    raw = (text or "").strip()
    if len(raw) < 26:
        return False
    tl = raw.lower()
    if "soru:" in tl or "cevap:" in tl:
        return False
    if len(raw) < 180 and raw.strip().endswith("?"):
        first = tl.split()[0] if tl.split() else ""
        if any(first.startswith(p.rstrip()) for p in _QUESTIONISH_PREFIXES):
            return False
    if any(tl.startswith(g) for g in _GREETING_OR_CHITCHAT):
        return False
    if any(m in tl for m in _TEACHING_MARKERS):
        return True
    if len(raw) >= 52 and "?" not in raw and ("," in raw or ";" in raw or " ve " in tl):
        return True
    return False


def rule_based_question_from_statement(text: str) -> str | None:
    """Bilgi cümlesinden KB eşleşmesi için kısa soru metni (küçük harf, soru işareti opsiyonel)."""
    raw = (text or "").strip()
    if len(raw) < 8:
        return None
    low = raw.lower()

    for sep in (" değildir", " degildir"):
        if sep in low:
            i = low.index(sep)
            subj = raw[:i].strip(" ,.;:")
            if len(subj) >= 4:
                return f"{subj.lower()} nedir"

    m = re.search(
        r"^(.{5,140}?)\s+(sağlar|saglar|sağlıyor|sagliyor|yapar|eder|ederiz|sunar|içerir|icerir|gösterir|gosterir)\b",
        raw,
        re.IGNORECASE | re.UNICODE,
    )
    if m:
        head = m.group(1).strip(" ,.;:")
        if len(head) >= 5:
            return f"{head.lower()} ne işe yarar"

    first = re.split(r"[.;\n]", raw)[0].strip(" ,.;:")
    if len(first) >= 12 and len(first) <= 140:
        words = first.split()
        if len(words) >= 4:
            chunk = " ".join(words[:12]).lower()
            return f"{chunk} nedir"
    return None
