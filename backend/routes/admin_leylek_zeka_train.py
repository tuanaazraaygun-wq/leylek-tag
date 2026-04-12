"""
Admin — Leylek Zeka KB / eğitim oturumu (Bearer + admin).

Önek: /api/admin/leylek-zeka/train/...
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from controllers import admin_leylek_zeka_train_controller as train_ctrl
from routes.admin_ai import require_admin_user

router = APIRouter(prefix="/admin/leylek-zeka/train", tags=["admin-leylek-zeka-train"])


# --- session ---


class TrainSessionCreateBody(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)


@router.post("/sessions")
async def create_train_session(
    body: TrainSessionCreateBody,
    admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    return train_ctrl.ctrl_create_session(admin_uid=admin_uid, title=body.title)


@router.get("/sessions")
async def list_train_sessions(
    admin_uid: Annotated[str, Depends(require_admin_user)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    _ = admin_uid
    return train_ctrl.ctrl_list_sessions(limit=limit)


@router.get("/sessions/{session_id}")
async def get_train_session(
    session_id: str,
    admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    _ = admin_uid
    return train_ctrl.ctrl_get_session(session_id)


class TrainMessageCreateBody(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=120_000)


@router.post("/sessions/{session_id}/messages")
async def append_train_message(
    session_id: str,
    body: TrainMessageCreateBody,
    admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    _ = admin_uid
    return train_ctrl.ctrl_append_message(
        session_id=session_id, role=body.role, content=body.content
    )


@router.get("/sessions/{session_id}/messages")
async def list_train_messages(
    session_id: str,
    admin_uid: Annotated[str, Depends(require_admin_user)],
    limit: int = Query(default=200, ge=1, le=500),
) -> list[dict[str, Any]]:
    _ = admin_uid
    return train_ctrl.ctrl_list_messages(session_id=session_id, limit=limit)


# --- kb draft / entry ---


class KbDraftCreateBody(BaseModel):
    record_type: Literal["product_fact", "faq", "forbidden_phrase", "preferred_phrase"]
    body: dict[str, Any]
    session_id: Optional[str] = None


@router.post("/drafts")
async def create_kb_draft(
    body: KbDraftCreateBody,
    admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    return train_ctrl.ctrl_create_draft(
        admin_uid=admin_uid,
        record_type=body.record_type,
        body=body.body,
        session_id=body.session_id,
    )


@router.get("/drafts")
async def list_kb_drafts(
    admin_uid: Annotated[str, Depends(require_admin_user)],
    session_id: Optional[str] = None,
    record_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict[str, Any]]:
    _ = admin_uid
    return train_ctrl.ctrl_list_drafts(
        session_id=session_id, record_type=record_type, status=status, limit=limit
    )


@router.post("/drafts/{draft_id}/publish")
async def publish_kb_draft(
    draft_id: str,
    admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    return train_ctrl.ctrl_publish_draft(admin_uid=admin_uid, draft_id=draft_id)


@router.get("/entries")
async def list_kb_entries(
    admin_uid: Annotated[str, Depends(require_admin_user)],
    record_type: Optional[str] = None,
    is_active: Optional[bool] = Query(
        default=True,
        description="Varsayılan yalnızca aktif kayıtlar. include_inactive=1 ile tümü.",
    ),
    include_inactive: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[dict[str, Any]]:
    _ = admin_uid
    return train_ctrl.ctrl_list_entries(
        record_type=record_type,
        is_active=is_active,
        limit=limit,
        include_inactive=include_inactive,
    )


class KbEntryPatchBody(BaseModel):
    is_active: bool


@router.patch("/entries/{entry_id}")
async def patch_kb_entry(
    entry_id: str,
    body: KbEntryPatchBody,
    admin_uid: Annotated[str, Depends(require_admin_user)],
) -> dict[str, Any]:
    return train_ctrl.ctrl_set_entry_active(
        admin_uid=admin_uid, entry_id=entry_id, is_active=body.is_active
    )


@router.get("/audit")
async def list_kb_audit(
    admin_uid: Annotated[str, Depends(require_admin_user)],
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict[str, Any]]:
    _ = admin_uid
    return train_ctrl.ctrl_list_audit(limit=limit)
