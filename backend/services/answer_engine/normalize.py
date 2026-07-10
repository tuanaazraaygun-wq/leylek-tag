"""
Sorgu normalizasyonu — ai_controller._normalize_for_match ile aynı kural (çift kaynak senkron).
"""
from __future__ import annotations

import re


def normalize_query(text: str) -> str:
    t = (text or "").strip()
    # Python default lower: 'İ' → 'i̇' (combining) — alt dizgi eşleşmesini kırar.
    t = t.replace("İ", "i").replace("I", "i")
    t = t.lower()
    t = re.sub(r"\s+", " ", t)
    return t
