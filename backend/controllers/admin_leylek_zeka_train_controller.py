"""
Admin — Leylek Zeka eğitim oturumu + KB taslak/yayıın (Supabase).

İlk tur: HTTP katmanı ince; iş mantığı `services.leylek_zeka_kb_service`.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import HTTPException

from services import leylek_zeka_kb_service as kb

logger = logging.getLogger("server")


def _map_error(e: Exception) -> HTTPException:
    if isinstance(e, ValueError):
        return HTTPException(status_code=400, detail=str(e))
    if isinstance(e, RuntimeError):
        msg = str(e) or "Servis hatası"
        if "Supabase client yok" in msg:
            return HTTPException(status_code=503, detail=msg)
        return HTTPException(status_code=500, detail=msg)
    logger.exception("admin_leylek_zeka_train: beklenmeyen hata")
    return HTTPException(status_code=500, detail="İşlem başarısız")


def ctrl_create_session(*, admin_uid: str, title: Optional[str]) -> dict[str, Any]:
    try:
        return kb.create_train_session(created_by=admin_uid, title=title)
    except Exception as e:
        raise _map_error(e) from e


def ctrl_list_sessions(*, limit: int) -> list[dict[str, Any]]:
    try:
        return kb.list_train_sessions(limit=limit)
    except Exception as e:
        raise _map_error(e) from e


def ctrl_get_session(session_id: str) -> dict[str, Any]:
    try:
        row = kb.get_train_session(session_id)
        if not row:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise _map_error(e) from e


def ctrl_append_message(
    *, session_id: str, role: kb.MessageRole, content: str
) -> dict[str, Any]:
    try:
        if not kb.get_train_session(session_id):
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        return kb.append_train_message(session_id=session_id, role=role, content=content)
    except HTTPException:
        raise
    except Exception as e:
        raise _map_error(e) from e


def ctrl_list_messages(*, session_id: str, limit: int) -> list[dict[str, Any]]:
    try:
        if not kb.get_train_session(session_id):
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        return kb.list_train_messages(session_id=session_id, limit=limit)
    except HTTPException:
        raise
    except Exception as e:
        raise _map_error(e) from e


def ctrl_create_draft(
    *,
    admin_uid: str,
    record_type: str,
    body: dict[str, Any],
    session_id: Optional[str],
) -> dict[str, Any]:
    try:
        if session_id and not kb.get_train_session(session_id):
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        return kb.create_kb_draft(
            created_by=admin_uid,
            record_type=record_type,
            body=body,
            session_id=session_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise _map_error(e) from e


def ctrl_list_drafts(
    *,
    session_id: Optional[str],
    record_type: Optional[str],
    status: Optional[str],
    limit: int,
) -> list[dict[str, Any]]:
    try:
        return kb.list_kb_drafts(
            session_id=session_id,
            record_type=record_type,
            status=status,
            limit=limit,
        )
    except Exception as e:
        raise _map_error(e) from e


def ctrl_publish_draft(*, admin_uid: str, draft_id: str) -> dict[str, Any]:
    try:
        return kb.publish_kb_draft(draft_id=draft_id, actor_id=admin_uid)
    except Exception as e:
        raise _map_error(e) from e


def ctrl_list_entries(
    *,
    record_type: Optional[str],
    is_active: Optional[bool],
    limit: int,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    try:
        eff_active: Optional[bool] = is_active
        if include_inactive:
            eff_active = None
        return kb.list_kb_entries(
            record_type=record_type, is_active=eff_active, limit=limit
        )
    except Exception as e:
        raise _map_error(e) from e


def ctrl_set_entry_active(
    *, admin_uid: str, entry_id: str, is_active: bool
) -> dict[str, Any]:
    try:
        return kb.set_kb_entry_active(
            entry_id=entry_id, is_active=is_active, actor_id=admin_uid
        )
    except Exception as e:
        raise _map_error(e) from e


def ctrl_list_audit(*, limit: int) -> list[dict[str, Any]]:
    try:
        return kb.list_kb_audit(limit=limit)
    except Exception as e:
        raise _map_error(e) from e
