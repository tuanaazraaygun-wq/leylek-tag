"""Pure helpers for Leylek Zeka KB records (no I/O, no DB)."""

_ALLOWED_RECORD_TYPES = frozenset(
    {"product_fact", "faq", "forbidden_phrase", "preferred_phrase"}
)


def validate_record_type(record_type):
    return record_type in _ALLOWED_RECORD_TYPES


def normalize_text(text):
    if text is None:
        return ""
    s = str(text).strip()
    if not s:
        return ""
    return " ".join(s.split())


def normalize_keywords(items):
    if not items:
        return []
    seen = set()
    out = []
    for item in items:
        raw = "" if item is None else str(item)
        key = normalize_text(raw.lower())
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def validate_body(record_type, body):
    if not validate_record_type(record_type):
        raise ValueError("invalid record_type")
    if not isinstance(body, dict):
        raise ValueError("body must be a dict")

    if record_type == "product_fact":
        if "text" not in body:
            raise ValueError("product_fact requires key 'text'")
        return {"text": normalize_text(body.get("text"))}

    if record_type == "faq":
        if "question" not in body or "answer" not in body:
            raise ValueError("faq requires keys 'question' and 'answer'")
        return {
            "question": normalize_text(body.get("question")),
            "answer": normalize_text(body.get("answer")),
        }

    if record_type == "forbidden_phrase":
        phrases = body.get("phrases")
        if not isinstance(phrases, list):
            raise ValueError("forbidden_phrase requires 'phrases' as a list")
        cleaned = []
        seen = set()
        for p in phrases:
            t = normalize_text(p)
            if not t or t in seen:
                continue
            seen.add(t)
            cleaned.append(t)
        return {"phrases": cleaned}

    if record_type == "preferred_phrase":
        pairs = body.get("pairs")
        if not isinstance(pairs, list):
            raise ValueError("preferred_phrase requires 'pairs' as a list")
        cleaned_pairs = []
        for i, pair in enumerate(pairs):
            if not isinstance(pair, dict):
                raise ValueError(f"pairs[{i}] must be an object/dict")
            if "instead_of" not in pair or "use" not in pair:
                raise ValueError(
                    f"pairs[{i}] must have keys 'instead_of' and 'use'"
                )
            cleaned_pairs.append(
                {
                    "instead_of": normalize_text(pair.get("instead_of")),
                    "use": normalize_text(pair.get("use")),
                }
            )
        return {"pairs": cleaned_pairs}

    raise ValueError("invalid record_type")
