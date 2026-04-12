"""
Leylek Zeka KB girişleri — asıl kaynak Supabase `leylek_zeka_kb_entry`.

Bellek içi liste yalnızca geçici yardımcıdır; okuma yolu öncelikle veritabanıdır.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

logger = logging.getLogger("server")

KB_TABLE = "leylek_zeka_kb_entry"

# Geçici: aynı process içi tutarlılık (Supabase yazısı başarısız olursa son çare).
_runtime_entries: list[dict[str, Any]] = []


def _supabase():
    try:
        from supabase_client import get_supabase, init_supabase

        sb = get_supabase()
        if sb is None:
            init_supabase()
            sb = get_supabase()
        return sb
    except Exception:
        logger.debug("leylek_zeka_entry_service: supabase import failed", exc_info=True)
        return None


def _normalize_row(row: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(row, dict):
        return None
    rid = row.get("id")
    rt = row.get("record_type")
    body = row.get("body")
    if rid is None or rt is None or body is None:
        return None
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except Exception:
            return None
    if not isinstance(body, dict):
        return None
    active = row.get("is_active", True)
    if active is False:
        return None
    return {
        "id": str(rid),
        "record_type": str(rt),
        "body": body,
        "is_active": bool(active),
    }


def _fetch_from_supabase() -> list[dict[str, Any]]:
    sb = _supabase()
    if sb is None:
        return []
    try:
        res = (
            sb.table(KB_TABLE)
            .select("id, record_type, body, is_active")
            .eq("is_active", True)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        out: list[dict[str, Any]] = []
        for raw in rows:
            n = _normalize_row(raw if isinstance(raw, dict) else {})
            if n and n["record_type"] in ("faq", "product_fact"):
                out.append(n)
        return out
    except Exception as e:
        logger.warning("leylek_zeka_entry_service: Supabase okuma başarısız: %s", e)
        return []


def list_entries() -> list[dict[str, Any]]:
    """Aktif KB kayıtları — önce Supabase, yanında geçici bellek kayıtları (yalnızca DB’de olmayan id’ler)."""
    db_rows = _fetch_from_supabase()
    seen = {e["id"] for e in db_rows}
    extra = [e for e in _runtime_entries if e.get("id") not in seen and e.get("is_active", True)]
    return db_rows + extra


def _insert_supabase(entry: dict[str, Any]) -> bool:
    sb = _supabase()
    if sb is None:
        return False
    row = {
        "id": entry["id"],
        "record_type": entry["record_type"],
        "body": entry["body"],
        "is_active": bool(entry.get("is_active", True)),
    }
    try:
        sb.table(KB_TABLE).insert(row).execute()
        return True
    except Exception as e:
        logger.warning("leylek_zeka_entry_service: Supabase insert başarısız: %s", e)
        return False


def publish_draft(draft: dict[str, Any]) -> dict[str, Any]:
    """Onaylı taslağı KB girişi yapar — önce Supabase, başarısızsa geçici bellek."""
    draft_id = str(draft.get("id") or uuid.uuid4())
    entry_id = f"entry-{draft_id}" if not str(draft_id).startswith("entry-") else str(draft_id)
    body = dict(draft.get("body") or {})
    rt = str(draft.get("record_type") or "")
    kws = draft.get("match_keywords") or []
    if rt == "product_fact" and kws:
        body["keywords"] = list(kws)
    entry = {
        "id": entry_id,
        "record_type": rt,
        "body": body,
        "is_active": True,
    }
    if _insert_supabase(entry):
        return entry
    logger.warning("leylek_zeka_entry_service: KB Supabase’e yazılamadı, geçici belleğe alınıyor: %s", entry_id)
    _runtime_entries.append(dict(entry))
    return entry


def deactivate_entry(entry_id: str) -> dict[str, Any] | None:
    sb = _supabase()
    if sb is not None:
        try:
            sb.table(KB_TABLE).update({"is_active": False}).eq("id", entry_id).execute()
        except Exception as e:
            logger.warning("leylek_zeka_entry_service: Supabase deactivate başarısız: %s", e)
    for entry in _runtime_entries:
        if entry.get("id") == entry_id:
            entry["is_active"] = False
            return dict(entry)
    return {"id": entry_id, "record_type": "?", "body": {}, "is_active": False}
