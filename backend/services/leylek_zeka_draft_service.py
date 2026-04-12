"""In-memory draft queue for Leylek Zeka KB (no DB)."""

from . import leylek_zeka_kb_service as kb
from . import leylek_zeka_entry_service as entry_service

drafts = []
_next_draft_n = 0


def _new_id():
    global _next_draft_n
    _next_draft_n += 1
    return f"draft-{_next_draft_n}"


def create_draft(record_type, body, keywords):
    if not kb.validate_record_type(record_type):
        raise ValueError("invalid record_type")
    cleaned_body = kb.validate_body(record_type, body)
    kws = kb.normalize_keywords(keywords or [])
    draft = {
        "id": _new_id(),
        "record_type": record_type,
        "body": cleaned_body,
        "status": "pending",
        "match_keywords": kws,
    }
    drafts.append(draft)
    return draft


def list_drafts():
    return list(drafts)


def get_draft(draft_id):
    for d in drafts:
        if d.get("id") == draft_id:
            return d
    return None


def approve_draft(draft_id):
    d = get_draft(draft_id)
    if d is None:
        return None
    d["status"] = "approved"
    entry = entry_service.publish_draft(d)
    return {"draft": d, "entry": entry}


def reject_draft(draft_id):
    d = get_draft(draft_id)
    if d is None:
        return None
    d["status"] = "rejected"
    return d
