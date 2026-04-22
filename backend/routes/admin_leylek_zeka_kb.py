"""

Admin — Leylek Zeka runtime bilgi kartları (KB). Yazma/liste yalnızca Bearer + admin.

Okuma (eşleşme) ai_controller içinde feature flag ile; bu modülde yok.



Doğal dil (yalnızca admin): POST .../nl-turn — kural tabanlı; mevcut CRUD helper'larını kullanır.

"""

from __future__ import annotations



import logging

import re

from datetime import datetime, timezone

from typing import Annotated, Any, Optional

from uuid import UUID



from fastapi import APIRouter, Depends, HTTPException, Query

from pydantic import BaseModel, Field, field_validator



from routes.admin_ai import require_admin_user



logger = logging.getLogger("server")



router = APIRouter(prefix="/admin/leylek-zeka-kb", tags=["admin-leylek-zeka-kb"])



_MAX_BODY = 8000

_MAX_PHRASE = 500

_MAX_PHRASES = 40

_NL_MESSAGE_MAX = 12_000



_UUID_RE = re.compile(

    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",

    re.IGNORECASE,

)





def _utc_now_iso() -> str:

    return datetime.now(timezone.utc).isoformat()





def _sb():

    import server as srv



    sb = getattr(srv, "supabase", None)

    if sb is None:

        raise HTTPException(status_code=503, detail="Servis hazır değil")

    return sb





class KbItemCreate(BaseModel):

    trigger_phrases: list[str] = Field(..., min_length=1, max_length=_MAX_PHRASES)

    body: str = Field(..., min_length=1, max_length=_MAX_BODY)

    priority: int = Field(default=0, ge=-32768, le=32767)



    @field_validator("trigger_phrases")

    @classmethod

    def _phrases(cls, v: list[str]) -> list[str]:

        out: list[str] = []

        for p in v:

            t = (p or "").strip()

            if not t:

                continue

            if len(t) > _MAX_PHRASE:

                raise ValueError(f"Tetikleyici en fazla {_MAX_PHRASE} karakter")

            out.append(t)

        if not out:

            raise ValueError("En az bir geçerli tetikleyici gerekli")

        return out





class KbItemPatch(BaseModel):

    trigger_phrases: Optional[list[str]] = Field(None, max_length=_MAX_PHRASES)

    body: Optional[str] = Field(None, min_length=1, max_length=_MAX_BODY)

    priority: Optional[int] = Field(None, ge=-32768, le=32767)



    @field_validator("trigger_phrases")

    @classmethod

    def _phrases_opt(cls, v: Optional[list[str]]) -> Optional[list[str]]:

        if v is None:

            return None

        out: list[str] = []

        for p in v:

            t = (p or "").strip()

            if not t:

                continue

            if len(t) > _MAX_PHRASE:

                raise ValueError(f"Tetikleyici en fazla {_MAX_PHRASE} karakter")

            out.append(t)

        if not out:

            raise ValueError("En az bir geçerli tetikleyici gerekli")

        return out





def _parse_uuid(item_id: str) -> str:

    try:

        return str(UUID(item_id))

    except ValueError as e:

        raise HTTPException(status_code=422, detail="Geçersiz id") from e





def _kb_insert(admin_uid: str, phrases: list[str], body: str, priority: int = 0) -> dict[str, Any]:

    validated = KbItemCreate(trigger_phrases=phrases, body=body, priority=priority)

    sb = _sb()

    row = {

        "trigger_phrases": validated.trigger_phrases,

        "body": validated.body.strip(),

        "priority": int(validated.priority),

        "is_active": True,

        "created_by_user_id": admin_uid,

        "updated_by_user_id": admin_uid,

        "created_at": _utc_now_iso(),

        "updated_at": _utc_now_iso(),

    }

    try:

        ins = sb.table("leylek_zeka_kb_items").insert(row).execute()

        data = ins.data

        if not data:

            raise HTTPException(status_code=500, detail="Kayıt oluşturulamadı")

        return data[0] if isinstance(data, list) else data

    except HTTPException:

        raise

    except Exception as e:

        logger.warning("admin_kb create: %s", e)

        raise HTTPException(status_code=500, detail="Kayıt oluşturulamadı") from e





def _kb_deactivate(admin_uid: str, item_id: str) -> dict[str, Any]:

    uid = _parse_uuid(item_id)

    sb = _sb()

    updates = {

        "is_active": False,

        "updated_by_user_id": admin_uid,

        "updated_at": _utc_now_iso(),

    }

    try:

        res = sb.table("leylek_zeka_kb_items").update(updates).eq("id", uid).execute()

        data = res.data

        if not data:

            raise HTTPException(status_code=404, detail="Kayıt bulunamadı")

        return data[0] if isinstance(data, list) else data

    except HTTPException:

        raise

    except Exception as e:

        logger.warning("admin_kb deactivate: %s", e)

        raise HTTPException(status_code=500, detail="Pasifleştirme başarısız") from e





def _kb_list(active_only: bool, limit: int, offset: int) -> dict[str, Any]:

    sb = _sb()

    try:

        q = sb.table("leylek_zeka_kb_items").select("*").order("updated_at", desc=True)

        if active_only:

            q = q.eq("is_active", True)

        res = q.range(offset, offset + limit - 1).execute()

        return {"items": res.data or [], "limit": limit, "offset": offset}

    except Exception as e:

        logger.warning("admin_kb list: %s", e)

        raise HTTPException(status_code=500, detail="Liste alınamadı") from e





def _kb_rows_for_search(limit: int = 250) -> list[dict[str, Any]]:

    sb = _sb()

    try:

        res = sb.table("leylek_zeka_kb_items").select("*").order("updated_at", desc=True).limit(limit).execute()

        return list(res.data or [])

    except Exception as e:

        logger.warning("admin_kb search fetch: %s", e)

        raise HTTPException(status_code=500, detail="Arama verisi alınamadı") from e





def _row_matches_query(row: dict[str, Any], q: str) -> bool:

    if not q:

        return False

    ql = q.lower()

    bid = str(row.get("id") or "").lower()

    if ql in bid:

        return True

    body = str(row.get("body") or "").lower()

    if ql in body:

        return True

    phrases = row.get("trigger_phrases") or []

    if isinstance(phrases, (list, tuple)):

        for p in phrases:

            if isinstance(p, str) and ql in p.lower():

                return True

    return False





def _handle_nl_turn(message: str, admin_uid: str) -> dict[str, Any]:

    raw = (message or "").strip()

    if not raw:

        return {

            "kind": "clarify",

            "assistant_text": "Boş mesaj. Örnek: listele | ara kurye | öğren a, b >>> yanıt | unut <uuid>",

        }



    tl = raw.lower()

    first_token = tl.split()[0] if tl.split() else ""



    # --- listele ---

    if tl in ("listele", "list", "göster", "hepsi") or first_token in ("listele", "list", "göster"):

        data = _kb_list(active_only=False, limit=80, offset=0)

        n = len(data["items"])

        return {

            "kind": "list_result",

            "assistant_text": f"Toplam {n} kayıt listelendi (son güncellenenler önce).",

            "items": data["items"],

            "limit": data["limit"],

            "offset": data["offset"],

        }



    # --- ara ---

    ara_m = re.match(r"^\s*(ara)\s*:\s*(.+)$", raw, re.IGNORECASE) or re.match(

        r"^\s*(ara)\s+(.+)$", raw, re.IGNORECASE

    )

    if ara_m:

        q = (ara_m.group(2) or "").strip()

        if len(q) < 2:

            return {

                "kind": "clarify",

                "assistant_text": "Arama için en az 2 karakter yazın. Örnek: ara kurye",

            }

        rows = _kb_rows_for_search()

        hits = [r for r in rows if _row_matches_query(r, q)][:50]

        return {

            "kind": "search_result",

            "assistant_text": f"“{q}” için {len(hits)} eşleşme (en fazla 50 gösterilir).",

            "query": q,

            "items": hits,

        }



    # --- öğren ---

    learn_m = re.match(r"^\s*(öğren|öğret|ekle)\s*", raw, re.IGNORECASE)

    if learn_m:

        rest = raw[learn_m.end() :].strip()

        if not rest:

            return {

                "kind": "clarify",

                "assistant_text": (

                    "Eksik bilgi. Şablon: öğren tetik1, tetik2 >>> kullanıcıya gösterilecek kısa yanıt\n"

                    "veya iki satır: birinci satırda virgüllü tetikleyiciler, sonraki satırlarda gövde."

                ),

            }

        triggers: list[str] = []

        body = ""

        if ">>>" in rest:

            left, _, right = rest.partition(">>>")

            triggers = [x.strip() for x in left.split(",") if x.strip()]

            body = right.strip()

        elif "\n" in rest:

            line0, rest_body = rest.split("\n", 1)

            triggers = [x.strip() for x in line0.split(",") if x.strip()]

            body = rest_body.strip()

        else:

            return {

                "kind": "clarify",

                "assistant_text": (

                    "Tetikleyici ve gövde ayrılamadı. Kullanın: öğren a, b >>> yanıt metni\n"

                    "veya ilk satır tetikleyiciler (virgülle), ikinci satırdan itibaren gövde."

                ),

            }

        if not triggers or not body:

            return {

                "kind": "clarify",

                "assistant_text": (

                    "En az bir tetikleyici ve boş olmayan bir yanıt gövdesi gerekli. "

                    "Örnek: öğren kurye, kurye leylek >>> Kurye teslimatı hakkında bilgi burada."

                ),

            }

        try:

            item = _kb_insert(admin_uid, triggers, body, 0)

        except HTTPException as e:

            return {

                "kind": "clarify",

                "assistant_text": f"Kayıt oluşturulamadı: {e.detail}",

            }

        return {

            "kind": "executed",

            "assistant_text": f"Yeni bilgi kartı oluşturuldu (id: {item.get('id')}).",

            "crud": {"op": "create"},

            "item": item,

        }



    # --- unut (uuid veya tek metin eşleşmesi) ---

    unut_m = re.match(r"^\s*(şunu\s+unut|sunu\s+unut|unut)\s*:?\s*(.+)$", raw, re.IGNORECASE)

    single_line = raw.strip()

    if _UUID_RE.match(single_line):

        try:

            item = _kb_deactivate(admin_uid, single_line)

        except HTTPException as e:

            if e.status_code == 404:

                return {"kind": "clarify", "assistant_text": "Bu id için kayıt bulunamadı."}

            return {"kind": "clarify", "assistant_text": f"İşlem başarısız: {e.detail}"}

        return {

            "kind": "executed",

            "assistant_text": f"Kayıt pasifleştirildi (id: {item.get('id')}).",

            "crud": {"op": "deactivate"},

            "item": item,

        }



    if unut_m:

        tail = (unut_m.group(2) or "").strip()

        if not tail:

            return {

                "kind": "clarify",

                "assistant_text": "Ne unutulacak? Örnek: unut <uuid> veya: unut kurye",

            }

        if _UUID_RE.match(tail):

            try:

                item = _kb_deactivate(admin_uid, tail)

            except HTTPException as e:

                if e.status_code == 404:

                    return {"kind": "clarify", "assistant_text": "Bu id için kayıt bulunamadı."}

                return {"kind": "clarify", "assistant_text": f"İşlem başarısız: {e.detail}"}

            return {

                "kind": "executed",

                "assistant_text": f"Kayıt pasifleştirildi (id: {item.get('id')}).",

                "crud": {"op": "deactivate"},

                "item": item,

            }

        rows = _kb_rows_for_search()

        matches = [r for r in rows if r.get("is_active", True) and _row_matches_query(r, tail)]

        if len(matches) == 0:

            return {

                "kind": "clarify",

                "assistant_text": f"Aktif kayıt içinde “{tail}” eşleşmedi. Önce “ara {tail}” deneyin veya tam UUID kullanın.",

            }

        if len(matches) > 1:

            lines = []

            for i, r in enumerate(matches[:8], 1):

                rid = r.get("id")

                snippet = (str(r.get("body") or ""))[:80].replace("\n", " ")

                lines.append(f"{i}) {rid} — {snippet}")

            more = f"\n… ve {len(matches) - 8} kayıt daha." if len(matches) > 8 else ""

            return {

                "kind": "clarify",

                "assistant_text": (

                    f"Birden fazla aktif eşleşme ({len(matches)}). Tam UUID ile tekrar yazın:\n"

                    + "\n".join(lines)

                    + more

                ),

                "items": matches[:8],

            }

        mid = str(matches[0].get("id"))

        item = _kb_deactivate(admin_uid, mid)

        return {

            "kind": "executed",

            "assistant_text": f"Tek eşleşme pasifleştirildi (id: {item.get('id')}).",

            "crud": {"op": "deactivate"},

            "item": item,

        }



    return {

        "kind": "clarify",

        "assistant_text": (

            "Anlaşılamadı. Komutlar: listele | ara <metin> | öğren t1, t2 >>> <yanıt> | unut <uuid>\n"

            "veya: unut <aranacak_kelime> (yalnızca tek aktif eşleşme varsa pasifleştirir)."

        ),

    }





class NlTurnBody(BaseModel):

    message: str = Field(..., min_length=1, max_length=_NL_MESSAGE_MAX)





@router.post("/nl-turn")

async def nl_turn(

    body: NlTurnBody,

    admin_uid: Annotated[str, Depends(require_admin_user)],

) -> dict[str, Any]:

    """Kural tabanlı doğal dil; yalnızca admin. Mevcut KB CRUD ile aynı tablo/validasyon."""

    out = _handle_nl_turn(body.message, admin_uid)

    return {"ok": True, **out}





@router.post("/items")

async def create_kb_item(

    body: KbItemCreate,

    admin_uid: Annotated[str, Depends(require_admin_user)],

) -> dict[str, Any]:

    item = _kb_insert(admin_uid, body.trigger_phrases, body.body, body.priority)

    return {"ok": True, "item": item}





@router.patch("/items/{item_id}")

async def patch_kb_item(

    item_id: str,

    body: KbItemPatch,

    admin_uid: Annotated[str, Depends(require_admin_user)],

) -> dict[str, Any]:

    uid = _parse_uuid(item_id)

    sb = _sb()

    updates: dict[str, Any] = {"updated_by_user_id": admin_uid, "updated_at": _utc_now_iso()}

    if body.trigger_phrases is not None:

        updates["trigger_phrases"] = body.trigger_phrases

    if body.body is not None:

        updates["body"] = body.body.strip()

    if body.priority is not None:

        updates["priority"] = int(body.priority)

    if len(updates) <= 2:

        raise HTTPException(status_code=400, detail="Güncellenecek alan yok")

    try:

        res = sb.table("leylek_zeka_kb_items").update(updates).eq("id", uid).execute()

        data = res.data

        if not data:

            raise HTTPException(status_code=404, detail="Kayıt bulunamadı")

        return {"ok": True, "item": data[0] if isinstance(data, list) else data}

    except HTTPException:

        raise

    except Exception as e:

        logger.warning("admin_kb patch: %s", e)

        raise HTTPException(status_code=500, detail="Güncelleme başarısız") from e





@router.post("/items/{item_id}/deactivate")

async def deactivate_kb_item(

    item_id: str,

    admin_uid: Annotated[str, Depends(require_admin_user)],

) -> dict[str, Any]:

    item = _kb_deactivate(admin_uid, item_id)

    return {"ok": True, "item": item}





@router.get("/items")

async def list_kb_items(

    admin_uid: Annotated[str, Depends(require_admin_user)],

    active_only: bool = Query(default=False),

    limit: int = Query(default=50, ge=1, le=200),

    offset: int = Query(default=0, ge=0, le=10_000),

) -> dict[str, Any]:

    _ = admin_uid

    data = _kb_list(active_only, limit, offset)

    return {"ok": True, **data}


