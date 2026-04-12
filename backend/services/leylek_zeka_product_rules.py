"""
Leylek Zeka KB — ürün kuralları (uzunluk, boşluk, liste sınırları).

`record_type` + ham JSON gövdesi için normalize + doğrulama; DB'ye yazmadan önce
`leylek_zeka_kb_service` tarafından kullanılır.
"""
from __future__ import annotations

import re
from typing import Any

_WS_RE = re.compile(r"\s+")

# İlk tur: makul üst sınırlar (ileride env ile genişletilebilir).
MAX_PRODUCT_FACT_CHARS = 12_000
MAX_FAQ_FIELD_CHARS = 8_000
MAX_PHRASE_ITEM_CHARS = 500
MAX_PHRASES = 200
MAX_PAIRS = 200
MAX_INSTEAD_USE_CHARS = 2_000


def _collapse_ws(s: str) -> str:
    t = (s or "").strip()
    return _WS_RE.sub(" ", t).strip()


def normalize_product_fact(body: dict[str, Any]) -> dict[str, Any]:
    text = _collapse_ws(str(body.get("text") or ""))
    if not text:
        raise ValueError("product_fact: text boş olamaz")
    if len(text) > MAX_PRODUCT_FACT_CHARS:
        raise ValueError(f"product_fact: text en fazla {MAX_PRODUCT_FACT_CHARS} karakter")
    return {"text": text}


def normalize_faq(body: dict[str, Any]) -> dict[str, Any]:
    q = _collapse_ws(str(body.get("question") or ""))
    a = _collapse_ws(str(body.get("answer") or ""))
    if not q:
        raise ValueError("faq: question boş olamaz")
    if not a:
        raise ValueError("faq: answer boş olamaz")
    if len(q) > MAX_FAQ_FIELD_CHARS or len(a) > MAX_FAQ_FIELD_CHARS:
        raise ValueError(f"faq: alanlar en fazla {MAX_FAQ_FIELD_CHARS} karakter")
    return {"question": q, "answer": a}


def normalize_forbidden_phrase(body: dict[str, Any]) -> dict[str, Any]:
    raw = body.get("phrases")
    if not isinstance(raw, list):
        raise ValueError("forbidden_phrase: phrases bir dizi olmalı")
    if len(raw) > MAX_PHRASES:
        raise ValueError(f"forbidden_phrase: en fazla {MAX_PHRASES} ifade")
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        p = _collapse_ws(str(item or ""))
        if not p:
            continue
        if len(p) > MAX_PHRASE_ITEM_CHARS:
            raise ValueError(f"forbidden_phrase: tek ifade en fazla {MAX_PHRASE_ITEM_CHARS} karakter")
        key = p.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    if not out:
        raise ValueError("forbidden_phrase: en az bir geçerli ifade gerekli")
    return {"phrases": out}


def normalize_preferred_phrase(body: dict[str, Any]) -> dict[str, Any]:
    raw = body.get("pairs")
    if not isinstance(raw, list):
        raise ValueError("preferred_phrase: pairs bir dizi olmalı")
    if len(raw) > MAX_PAIRS:
        raise ValueError(f"preferred_phrase: en fazla {MAX_PAIRS} çift")
    pairs: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for row in raw:
        if not isinstance(row, dict):
            raise ValueError("preferred_phrase: her çift bir nesne olmalı")
        inst = _collapse_ws(str(row.get("instead_of") or ""))
        use = _collapse_ws(str(row.get("use") or ""))
        if not inst or not use:
            raise ValueError("preferred_phrase: instead_of ve use dolu olmalı")
        if len(inst) > MAX_INSTEAD_USE_CHARS or len(use) > MAX_INSTEAD_USE_CHARS:
            raise ValueError(
                f"preferred_phrase: instead_of/use en fazla {MAX_INSTEAD_USE_CHARS} karakter"
            )
        key = (inst.casefold(), use.casefold())
        if key in seen:
            continue
        seen.add(key)
        pairs.append({"instead_of": inst, "use": use})
    if not pairs:
        raise ValueError("preferred_phrase: en az bir çift gerekli")
    return {"pairs": pairs}


def normalize_kb_body(record_type: str, body: dict[str, Any]) -> dict[str, Any]:
    if record_type == "product_fact":
        return normalize_product_fact(body)
    if record_type == "faq":
        return normalize_faq(body)
    if record_type == "forbidden_phrase":
        return normalize_forbidden_phrase(body)
    if record_type == "preferred_phrase":
        return normalize_preferred_phrase(body)
    raise ValueError(f"Bilinmeyen record_type: {record_type}")
