"""
Leylek Zeka — server-verified account / trip context (read-only, PII-minimized).

Frontend hints are never authoritative. Missing or ambiguous data → unknown / fail-closed.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Mapping, Optional, TypedDict

from services.answer_engine.normalize import normalize_query
from services.trip_lifecycle_support_context import resolve_user_id_for_tags_sync
from supabase_client import get_supabase

logger = logging.getLogger(__name__)

VERIFIED_CONTEXT_SOURCE_VERSION = "verified_context_v1"

RoleState = Literal["guest", "passenger", "driver", "both", "unknown"]
KycState = Literal["not_started", "pending", "approved", "rejected", "unknown"]
VehicleApprovalState = Literal[
    "not_submitted", "pending", "approved", "rejected", "unknown"
]
ActiveVehicleType = Literal["car", "motorcycle"]
DriverAccessState = Literal["active", "inactive", "unknown"]
TripState = Literal[
    "none",
    "request_open",
    "offers_received",
    "matched",
    "boarding",
    "ongoing",
    "completion_pending",
    "completed",
    "unknown",
]

ACCOUNT_REFUSAL = (
    "Doğrulayamadım. Hesap, araç onayı, KYC veya erişim durumunu doğrulanmış veri olmadan "
    "söyleyemem. Lütfen uygulama içindeki ilgili ekranı kontrol edin; çözülmezse Destek’e yazın."
)

TRIP_REFUSAL = (
    "Doğrulayamadım. Şu anki eşleşme veya yolculuk durumunu doğrulanmış canlı veri olmadan "
    "söyleyemem. Aktif yolculuk ekranını kontrol edin; gerekirse Destek’e yazın."
)

BLOCKED_ACCOUNT = "account_state_verified_without_api"
BLOCKED_TRIP = "trip_state_verified_without_api"


@dataclass(frozen=True)
class LeylekZekaVerifiedContext:
    authenticated: bool
    role: RoleState
    driver_kyc_state: KycState
    car_approval_state: VehicleApprovalState
    motorcycle_approval_state: VehicleApprovalState
    active_vehicle_type: Optional[ActiveVehicleType]
    driver_access_state: DriverAccessState
    current_trip_state: TripState
    current_trip_id_present: bool
    verified_fields: tuple[str, ...]
    source_version: Optional[str]


class VerifiedPersonalHit(TypedDict):
    intent_id: str
    text: str
    category: Literal["account", "live_trip"]
    account_context_used: bool
    live_state_used: bool
    requires_support: bool
    suggested_route: Optional[str]
    blocked_claim_reason: Optional[str]
    source_version: Optional[str]


def guest_verified_context() -> LeylekZekaVerifiedContext:
    return LeylekZekaVerifiedContext(
        authenticated=False,
        role="guest",
        driver_kyc_state="unknown",
        car_approval_state="unknown",
        motorcycle_approval_state="unknown",
        active_vehicle_type=None,
        driver_access_state="unknown",
        current_trip_state="unknown",
        current_trip_id_present=False,
        verified_fields=("authenticated", "role"),
        source_version=None,
    )


def verified_context_to_public_dict(ctx: LeylekZekaVerifiedContext) -> dict[str, Any]:
    """Serialize for request context — no raw user/trip/document IDs."""
    return {
        "authenticated": ctx.authenticated,
        "role": ctx.role,
        "driver_kyc_state": ctx.driver_kyc_state,
        "car_approval_state": ctx.car_approval_state,
        "motorcycle_approval_state": ctx.motorcycle_approval_state,
        "active_vehicle_type": ctx.active_vehicle_type,
        "driver_access_state": ctx.driver_access_state,
        "current_trip_state": ctx.current_trip_state,
        "current_trip_id_present": ctx.current_trip_id_present,
        "verified_fields": list(ctx.verified_fields),
        "source_version": ctx.source_version,
    }


def parse_verified_context(raw: Any) -> Optional[LeylekZekaVerifiedContext]:
    if not isinstance(raw, dict):
        return None
    try:
        fields = raw.get("verified_fields") or ()
        if isinstance(fields, list):
            fields_t = tuple(str(x) for x in fields)
        elif isinstance(fields, tuple):
            fields_t = tuple(str(x) for x in fields)
        else:
            fields_t = ()
        avt = raw.get("active_vehicle_type")
        if avt not in ("car", "motorcycle", None):
            avt = None
        return LeylekZekaVerifiedContext(
            authenticated=bool(raw.get("authenticated")),
            role=_as_role(raw.get("role")),
            driver_kyc_state=_as_kyc(raw.get("driver_kyc_state")),
            car_approval_state=_as_vehicle(raw.get("car_approval_state")),
            motorcycle_approval_state=_as_vehicle(raw.get("motorcycle_approval_state")),
            active_vehicle_type=avt,  # type: ignore[arg-type]
            driver_access_state=_as_access(raw.get("driver_access_state")),
            current_trip_state=_as_trip(raw.get("current_trip_state")),
            current_trip_id_present=bool(raw.get("current_trip_id_present")),
            verified_fields=fields_t,
            source_version=(str(raw["source_version"]).strip() if raw.get("source_version") else None),
        )
    except Exception:
        logger.debug("parse_verified_context failed", exc_info=True)
        return None


def fetch_user_verified_account_row_sync(resolved_jwt_sub: str) -> Optional[dict[str, Any]]:
    """Minimal users row for Zeka verified context. Sync — call via asyncio.to_thread."""
    sb = get_supabase()
    if not sb:
        return None
    rid = resolve_user_id_for_tags_sync(resolved_jwt_sub)
    if not rid:
        return None
    try:
        r = (
            sb.table("users")
            .select("driver_details, driver_active_until")
            .eq("id", rid)
            .limit(1)
            .execute()
        )
        if r.data:
            return dict(r.data[0])
    except Exception:
        logger.warning("fetch_user_verified_account_row_sync failed", exc_info=True)
    return None


def build_verified_context(
    *,
    authenticated: bool,
    user_row: Optional[Mapping[str, Any]],
    trip_payload: Optional[Mapping[str, Any]],
    source_version: Optional[str] = None,
) -> LeylekZekaVerifiedContext:
    if not authenticated:
        return guest_verified_context()

    ver = (source_version or "").strip() or VERIFIED_CONTEXT_SOURCE_VERSION
    verified: list[str] = ["authenticated"]

    role: RoleState = "unknown"
    kyc: KycState = "unknown"
    car: VehicleApprovalState = "unknown"
    moto: VehicleApprovalState = "unknown"
    active: Optional[ActiveVehicleType] = None
    access: DriverAccessState = "unknown"

    if user_row is not None:
        dd = _driver_details_as_dict(user_row)
        role = _infer_role_from_details(dd)
        verified.append("role")
        kyc = _map_kyc_state(dd)
        if kyc != "unknown":
            verified.append("driver_kyc_state")
        car = _map_vehicle_approval(dd, "car")
        if car != "unknown":
            verified.append("car_approval_state")
        moto = _map_vehicle_approval(dd, "motorcycle")
        if moto != "unknown":
            verified.append("motorcycle_approval_state")
        active = _map_active_vehicle(dd)
        if active is not None:
            verified.append("active_vehicle_type")
        access = _map_driver_access(user_row.get("driver_active_until"))
        if access != "unknown":
            verified.append("driver_access_state")
    else:
        # Auth present but account row missing → role unknown (fail-closed for personal claims)
        role = "unknown"
        verified.append("role")

    trip_state: TripState = "unknown"
    trip_id_present = False
    if trip_payload is not None:
        trip_state, trip_id_present = _map_trip_from_support_trip(trip_payload)
        if trip_state != "unknown":
            verified.append("current_trip_state")
        verified.append("current_trip_id_present")

    return LeylekZekaVerifiedContext(
        authenticated=True,
        role=role,
        driver_kyc_state=kyc,
        car_approval_state=car,
        motorcycle_approval_state=moto,
        active_vehicle_type=active,
        driver_access_state=access,
        current_trip_state=trip_state,
        current_trip_id_present=trip_id_present,
        verified_fields=tuple(dict.fromkeys(verified)),
        source_version=ver,
    )


def try_resolve_verified_personal(
    message: str,
    verified_raw: Any,
) -> Optional[VerifiedPersonalHit]:
    """
    Deterministic personal answers from verified context only.
    Returns None when the message is not a covered personal question.
    """
    t = normalize_query(message)
    if not t:
        return None

    ctx = parse_verified_context(verified_raw) if verified_raw is not None else None
    if ctx is None:
        ctx = guest_verified_context()

    # --- Trip questions ---
    if _matches(t, _TRIP_PHRASES):
        return _answer_trip(ctx)

    # --- Role ---
    if _matches(t, _ROLE_PHRASES):
        return _answer_role(ctx)

    # --- KYC ---
    if _matches(t, _KYC_PHRASES):
        return _answer_kyc(ctx)

    # --- Vehicle summary / both ---
    if _matches(t, _VEHICLE_SUMMARY_PHRASES):
        return _answer_vehicle_summary(ctx)

    # --- Car ---
    if _matches(t, _CAR_PHRASES):
        return _answer_car(ctx)

    # --- Motorcycle ---
    if _matches(t, _MOTO_PHRASES):
        return _answer_moto(ctx)

    # --- Active vehicle ---
    if _matches(t, _ACTIVE_VEHICLE_PHRASES):
        return _answer_active_vehicle(ctx)

    # --- Driver access / package ---
    if _matches(t, _ACCESS_PHRASES):
        return _answer_access(ctx)

    # Generic personal account phrases (fallback refuse when not more specific)
    if _matches(t, _GENERIC_ACCOUNT_PHRASES):
        return _account_refuse(ctx)

    return None


# --- Phrase banks ---

_TRIP_PHRASES = (
    "şu an eşleşmem var mı",
    "su an eslesmem var mi",
    "eşleşmem var mı",
    "eslesmem var mi",
    "aktif yolculuğum var mı",
    "aktif yolculugum var mi",
    "yolculuk durumum ne",
    "yolculuk hangi aşamada",
    "yolculuk hangi asamada",
    "şu anki eşleşmem",
    "su anki eslesmem",
    "mevcut yolculuğum",
    "mevcut yolculugum",
    "teklif geldi mi",
    "biniş doğrulandı mı",
    "binis dogrulandi mi",
    "yolculuk başladı mı",
    "yolculuk basladi mi",
    "yolculuk tamamlandı mı",
    "yolculuk tamamlandi mi",
)

_ROLE_PHRASES = (
    "ben yolcu muyum",
    "ben sürücü müyüm",
    "ben surucu muyum",
    "rolüm ne",
    "rolum ne",
    "hesap rolüm",
    "hesap rolum",
    "yolcu mu sürücü mü",
    "yolcu mu surucu mu",
)

_KYC_PHRASES = (
    "kyc durumum",
    "kyc onaylandı mı",
    "kyc onaylandi mi",
    "kyc onaylı mı",
    "kyc onayli mi",
    "sürücü doğrulamam onaylandı mı",
    "surucu dogrulamam onaylandi mi",
    "kimlik doğrulamam onaylandı mı",
    "kimlik dogrulamam onaylandi mi",
    "belgelerim bekliyor mu",
    "başvurum reddedildi mi",
    "basvurum reddedildi mi",
    "başvurum onaylandı mı",
    "basvurum onaylandi mi",
)

_CAR_PHRASES = (
    "arabam onaylı mı",
    "arabam onayli mi",
    "arabam onaylandı mı",
    "arabam onaylandi mi",
    "otomobilim onaylı mı",
    "otomobilim onayli mi",
)

_MOTO_PHRASES = (
    "motorum onaylı mı",
    "motorum onayli mi",
    "motosikletim onaylı mı",
    "motosikletim onayli mi",
    "motorum onaylandı mı",
    "motorum onaylandi mi",
)

_VEHICLE_SUMMARY_PHRASES = (
    "ikisi de onaylı mı",
    "ikisi de onayli mi",
    "her iki araç onaylı mı",
    "her iki arac onayli mi",
    "aracım onaylı mı",
    "aracim onayli mi",
    "aracım onaylandı mı",
    "aracim onaylandi mi",
    "ikinci aracı tekrar gönderebilir miyim",
    "ikinci araci tekrar gonderebilir miyim",
    "pending aracı tekrar",
    "pending araci tekrar",
)

_ACTIVE_VEHICLE_PHRASES = (
    "hangi araçla çevrimiçi",
    "hangi aracla cevrimici",
    "aktif araç tipim",
    "aktif arac tipim",
    "hangi aracım aktif",
    "hangi aracim aktif",
)

_ACCESS_PHRASES = (
    "sürücü erişimim aktif mi",
    "surucu erisimim aktif mi",
    "erişimim açık mı",
    "erisimim acik mi",
    "paketim aktif mi",
    "neden çevrimiçi olamıyorum",
    "neden cevrimici olamiyorum",
    "çevrimiçi olamıyorum",
    "cevrimici olamiyorum",
)

_GENERIC_ACCOUNT_PHRASES = (
    "hesabım onaylandı mı",
    "hesabim onaylandi mi",
)


def _matches(t: str, phrases: tuple[str, ...]) -> bool:
    return any(normalize_query(p) in t for p in phrases)


def _field_verified(ctx: LeylekZekaVerifiedContext, name: str) -> bool:
    return name in ctx.verified_fields


def _account_refuse(
    ctx: LeylekZekaVerifiedContext,
    *,
    route: str = "/support",
    reason: str = BLOCKED_ACCOUNT,
) -> VerifiedPersonalHit:
    return VerifiedPersonalHit(
        intent_id="account_state_unverified",
        text=ACCOUNT_REFUSAL,
        category="account",
        account_context_used=False,
        live_state_used=False,
        requires_support=True,
        suggested_route=route,
        blocked_claim_reason=reason,
        source_version=None,
    )


def _trip_refuse(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    return VerifiedPersonalHit(
        intent_id="live_trip_state_unverified",
        text=TRIP_REFUSAL,
        category="live_trip",
        account_context_used=False,
        live_state_used=False,
        requires_support=True,
        suggested_route="/support",
        blocked_claim_reason=BLOCKED_TRIP,
        source_version=None,
    )


def _ok_account(
    *,
    intent_id: str,
    text: str,
    ctx: LeylekZekaVerifiedContext,
    route: Optional[str] = None,
    requires_support: bool = False,
) -> VerifiedPersonalHit:
    return VerifiedPersonalHit(
        intent_id=intent_id,
        text=text,
        category="account",
        account_context_used=True,
        live_state_used=False,
        requires_support=requires_support,
        suggested_route=route,
        blocked_claim_reason=None,
        source_version=ctx.source_version,
    )


def _ok_trip(
    *,
    intent_id: str,
    text: str,
    ctx: LeylekZekaVerifiedContext,
) -> VerifiedPersonalHit:
    return VerifiedPersonalHit(
        intent_id=intent_id,
        text=text,
        category="live_trip",
        account_context_used=bool(ctx.authenticated),
        live_state_used=True,
        requires_support=False,
        suggested_route=None,
        blocked_claim_reason=None,
        source_version=ctx.source_version,
    )


def _can_answer_driver_fields(ctx: LeylekZekaVerifiedContext) -> bool:
    return ctx.authenticated and ctx.role in ("driver", "both")


def _answer_role(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated:
        return _account_refuse(ctx)
    if ctx.role == "unknown" or not _field_verified(ctx, "role"):
        return _account_refuse(ctx)
    labels = {
        "guest": "Misafir (oturum yok).",
        "passenger": "Hesabınız yolcu olarak kayıtlı görünüyor.",
        "driver": "Hesabınız sürücü olarak kayıtlı görünüyor.",
        "both": "Hesabınız hem yolcu hem sürücü kullanımına uygun görünüyor.",
    }
    text = f"Rol\n\n{labels.get(ctx.role, 'Rol doğrulanamadı.')}\nBu bilgi sunucu tarafındaki hesap kaydına dayanır."
    return _ok_account(intent_id="verified_role", text=text, ctx=ctx)


def _answer_trip(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated:
        return _trip_refuse(ctx)
    if not _field_verified(ctx, "current_trip_state") or ctx.current_trip_state == "unknown":
        return _trip_refuse(ctx)

    state = ctx.current_trip_state
    lines = {
        "none": "Şu an aktif bir yolculuk veya eşleşmeniz yok.",
        "request_open": "Açık bir yolculuk talebiniz var; teklif aşamasına geçilmemiş olabilir.",
        "offers_received": "Talebinize teklif gelmiş durumda; henüz eşleşme tamamlanmamış olabilir.",
        "matched": "Eşleşmeniz var; biniş doğrulaması henüz tamamlanmamış olabilir.",
        "boarding": "Eşleşme sonrası biniş doğrulama aşamasındasınız.",
        "ongoing": "Yolculuğunuz devam ediyor.",
        "completion_pending": "Yolculuk bitirme onayı bekleniyor.",
        "completed": "Yolculuk tamamlanmış görünüyor.",
    }
    body = lines.get(state, "Yolculuk durumu doğrulanamadı.")
    text = f"Yolculuk durumu\n\n{body}\nBu özet doğrulanmış canlı yolculuk kaydına dayanır; ham kimlik numarası paylaşılmaz."
    return _ok_trip(intent_id="verified_current_trip_state", text=text, ctx=ctx)


def _answer_kyc(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated:
        return _account_refuse(ctx)
    if ctx.role == "unknown":
        return _account_refuse(ctx)
    if not _can_answer_driver_fields(ctx):
        # Passenger-only: do not invent driver KYC
        return _account_refuse(ctx)
    if not _field_verified(ctx, "driver_kyc_state") or ctx.driver_kyc_state == "unknown":
        return _account_refuse(ctx)

    st = ctx.driver_kyc_state
    if st == "pending":
        text = (
            "KYC durumu\n\nSürücü doğrulama başvurunuz incelemede (pending).\n"
            "İnceleme süresi tahmin edilmez.\nAraç/kimlik işlemleri için: /driver-vehicles"
        )
        return _ok_account(
            intent_id="verified_driver_kyc_state",
            text=text,
            ctx=ctx,
            route="/driver-vehicles",
        )
    if st == "approved":
        text = (
            "KYC durumu\n\nSürücü kimlik doğrulamanız onaylı görünüyor.\n"
            "Bu, otomobil ve motosikletin ikisinin de onaylı olduğu anlamına gelmez; "
            "araç onayları ayrıdır.\nDetay: /driver-vehicles"
        )
        return _ok_account(
            intent_id="verified_driver_kyc_state",
            text=text,
            ctx=ctx,
            route="/driver-vehicles",
        )
    if st == "rejected":
        text = (
            "KYC durumu\n\nSürücü doğrulama başvurunuz reddedilmiş görünüyor.\n"
            "İç not veya belge ayrıntısı paylaşılmaz.\nYeniden başvuru için: /driver-vehicles"
        )
        return _ok_account(
            intent_id="verified_driver_kyc_state",
            text=text,
            ctx=ctx,
            route="/driver-vehicles",
            requires_support=True,
        )
    # not_started
    text = (
        "KYC durumu\n\nSürücü kimlik doğrulaması başlatılmamış görünüyor.\n"
        "Başlatmak için: /driver-vehicles"
    )
    return _ok_account(
        intent_id="verified_driver_kyc_state",
        text=text,
        ctx=ctx,
        route="/driver-vehicles",
    )


def _vehicle_line(kind_tr: str, state: VehicleApprovalState) -> str:
    if state == "approved":
        return f"{kind_tr}: onaylı"
    if state == "pending":
        return (
            f"{kind_tr}: incelemede (pending). Bekleyen tip yeniden gönderilmez. "
            "Durum için /driver-vehicles"
        )
    if state == "rejected":
        return f"{kind_tr}: reddedilmiş. Yeniden başvuru için /driver-vehicles"
    if state == "not_submitted":
        return f"{kind_tr}: henüz gönderilmemiş. Başvuru için /driver-vehicles"
    return f"{kind_tr}: doğrulanamadı"


def _answer_car(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated or not _can_answer_driver_fields(ctx):
        return _account_refuse(ctx)
    if not _field_verified(ctx, "car_approval_state") or ctx.car_approval_state == "unknown":
        return _account_refuse(ctx)
    text = (
        "Otomobil onayı\n\n"
        + _vehicle_line("Otomobil", ctx.car_approval_state)
        + "\nMotosiklet onayı bundan çıkarılmaz; onaylar bağımsızdır."
    )
    return _ok_account(
        intent_id="verified_car_approval_state",
        text=text,
        ctx=ctx,
        route="/driver-vehicles",
    )


def _answer_moto(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated or not _can_answer_driver_fields(ctx):
        return _account_refuse(ctx)
    if (
        not _field_verified(ctx, "motorcycle_approval_state")
        or ctx.motorcycle_approval_state == "unknown"
    ):
        return _account_refuse(ctx)
    text = (
        "Motosiklet onayı\n\n"
        + _vehicle_line("Motosiklet", ctx.motorcycle_approval_state)
        + "\nOtomobil onayı bundan çıkarılmaz; onaylar bağımsızdır."
    )
    return _ok_account(
        intent_id="verified_motorcycle_approval_state",
        text=text,
        ctx=ctx,
        route="/driver-vehicles",
    )


def _answer_vehicle_summary(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated or not _can_answer_driver_fields(ctx):
        return _account_refuse(ctx)
    car_ok = _field_verified(ctx, "car_approval_state") and ctx.car_approval_state != "unknown"
    moto_ok = (
        _field_verified(ctx, "motorcycle_approval_state")
        and ctx.motorcycle_approval_state != "unknown"
    )
    if not car_ok and not moto_ok:
        return _account_refuse(ctx)

    parts = ["Araç onay özeti\n"]
    if car_ok:
        parts.append(_vehicle_line("Otomobil", ctx.car_approval_state))
    else:
        parts.append("Otomobil: doğrulanamadı")
    if moto_ok:
        parts.append(_vehicle_line("Motosiklet", ctx.motorcycle_approval_state))
    else:
        parts.append("Motosiklet: doğrulanamadı")
    parts.append(
        "Onaylar bağımsızdır; biri onaylıyken diğeri eksik olabilir. "
        "Bekleyen (pending) tip yeniden gönderilmez. Eski /driver-verify yolu kullanılmaz. "
        "İşlemler: /driver-vehicles"
    )
    return _ok_account(
        intent_id="verified_vehicle_summary",
        text="\n".join(parts),
        ctx=ctx,
        route="/driver-vehicles",
    )


def _answer_active_vehicle(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated or not _can_answer_driver_fields(ctx):
        return _account_refuse(ctx)
    if not _field_verified(ctx, "active_vehicle_type") or ctx.active_vehicle_type is None:
        return _account_refuse(ctx)
    label = "otomobil" if ctx.active_vehicle_type == "car" else "motosiklet"
    # Unapproved type cannot be stated as active
    if ctx.active_vehicle_type == "car" and ctx.car_approval_state in (
        "pending",
        "rejected",
        "not_submitted",
    ):
        return _account_refuse(ctx)
    if ctx.active_vehicle_type == "motorcycle" and ctx.motorcycle_approval_state in (
        "pending",
        "rejected",
        "not_submitted",
    ):
        return _account_refuse(ctx)
    text = (
        f"Aktif araç\n\nDoğrulanmış aktif araç tipiniz: {label}.\n"
        "Onaylanmamış tip aktif olamaz. Değiştirmek için: /driver-vehicles"
    )
    return _ok_account(
        intent_id="verified_active_vehicle_type",
        text=text,
        ctx=ctx,
        route="/driver-vehicles",
    )


def _answer_access(ctx: LeylekZekaVerifiedContext) -> VerifiedPersonalHit:
    if not ctx.authenticated:
        return _account_refuse(ctx)
    if ctx.role == "unknown":
        return _account_refuse(ctx)
    if not _can_answer_driver_fields(ctx):
        return _account_refuse(ctx)
    if not _field_verified(ctx, "driver_access_state") or ctx.driver_access_state == "unknown":
        return _account_refuse(ctx)

    if ctx.driver_access_state == "active":
        text = (
            "Sürücü erişimi\n\nSürücü erişiminiz aktif görünüyor.\n"
            "Bu yanıt yalnızca erişim durumunu bildirir; ücret veya uygulama içi paket satışı iddiası yoktur."
        )
    else:
        text = (
            "Sürücü erişimi\n\nSürücü erişiminiz şu an aktif değil görünüyor.\n"
            "Ücret veya uygulama içi paket satışı önerilmez. Gerekirse Destek: /support"
        )
    return _ok_account(
        intent_id="verified_driver_access_state",
        text=text,
        ctx=ctx,
        route="/support" if ctx.driver_access_state == "inactive" else None,
        requires_support=ctx.driver_access_state == "inactive",
    )


# --- Mapping helpers (mirror KYC status semantics; no PII) ---


def _driver_details_as_dict(user_row: Mapping[str, Any]) -> dict[str, Any]:
    dd = user_row.get("driver_details")
    if isinstance(dd, dict):
        return dd
    if isinstance(dd, str) and dd.strip():
        try:
            parsed = json.loads(dd)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


def _canonical_vehicle_kind(value: Any) -> Optional[ActiveVehicleType]:
    s = str(value or "").strip().lower()
    if s == "car":
        return "car"
    if s in ("motorcycle", "motor", "moto"):
        return "motorcycle"
    return None


def _normalize_approved_kinds(raw: Any) -> list[ActiveVehicleType]:
    out: list[ActiveVehicleType] = []
    parsed: Any = raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw.strip())
        except Exception:
            parsed = None
    seq = parsed if isinstance(parsed, list) else raw if isinstance(raw, list) else None
    if isinstance(seq, list):
        for x in seq:
            c = _canonical_vehicle_kind(x)
            if c and c not in out:
                out.append(c)
    return out


def _approved_kinds(dd: dict[str, Any]) -> list[ActiveVehicleType]:
    norm = _normalize_approved_kinds(dd.get("approved_vehicle_kinds"))
    if norm:
        return norm
    if str(dd.get("kyc_status") or "").strip().lower() == "approved":
        one = _canonical_vehicle_kind(dd.get("kyc_vehicle_kind"))
        return [one] if one else []
    return []


def _pending_kind(dd: dict[str, Any]) -> Optional[ActiveVehicleType]:
    if str(dd.get("kyc_status") or "").strip().lower() != "pending":
        return None
    return _canonical_vehicle_kind(dd.get("pending_vehicle_kind")) or _canonical_vehicle_kind(
        dd.get("kyc_vehicle_kind")
    )


def _has_driver_indicators(dd: dict[str, Any]) -> bool:
    if not dd:
        return False
    if str(dd.get("kyc_status") or "").strip():
        return True
    if _approved_kinds(dd):
        return True
    if dd.get("vehicle_kind") or dd.get("kyc_vehicle_kind") or dd.get("pending_vehicle_kind"):
        return True
    if dd.get("is_verified") is True:
        return True
    return False


def _infer_role_from_details(dd: dict[str, Any]) -> RoleState:
    if _has_driver_indicators(dd):
        return "both"
    return "passenger"


def _map_kyc_state(dd: dict[str, Any]) -> KycState:
    if not dd and not _has_driver_indicators(dd):
        return "not_started"
    raw = str(dd.get("kyc_status") or "").strip().lower()
    if raw in ("pending",):
        return "pending"
    if raw in ("rejected", "rejected_permanently"):
        return "rejected"
    if raw == "approved" or _approved_kinds(dd):
        return "approved"
    if raw in ("none", "", "not_started") or not raw:
        if _approved_kinds(dd):
            return "approved"
        if not _has_driver_indicators(dd):
            return "not_started"
        return "not_started"
    return "unknown"


def _map_vehicle_approval(dd: dict[str, Any], kind: ActiveVehicleType) -> VehicleApprovalState:
    approved = _approved_kinds(dd)
    if kind in approved:
        return "approved"
    pending = _pending_kind(dd)
    if pending == kind:
        return "pending"
    raw = str(dd.get("kyc_status") or "").strip().lower()
    if raw in ("rejected", "rejected_permanently"):
        # Rejection applies to last submitted kind when known
        last = _canonical_vehicle_kind(dd.get("kyc_vehicle_kind")) or _canonical_vehicle_kind(
            dd.get("pending_vehicle_kind")
        )
        if last == kind:
            return "rejected"
        if last is None and not approved:
            # Ambiguous which type was rejected
            return "unknown"
    # Never submitted this kind
    if not _has_driver_indicators(dd):
        return "not_submitted"
    if kind not in approved and pending != kind:
        return "not_submitted"
    return "unknown"


def _map_active_vehicle(dd: dict[str, Any]) -> Optional[ActiveVehicleType]:
    vk = _canonical_vehicle_kind(dd.get("vehicle_kind"))
    if not vk:
        return None
    approved = _approved_kinds(dd)
    if approved and vk not in approved:
        # Unapproved type must not be stated as active
        return None
    return vk


def _map_driver_access(raw_until: Any) -> DriverAccessState:
    if raw_until is None or raw_until == "":
        return "unknown"
    try:
        s = str(raw_until).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return "active" if dt > now else "inactive"
    except Exception:
        return "unknown"


def _map_trip_from_support_trip(trip: Mapping[str, Any]) -> tuple[TripState, bool]:
    lifecycle = str(trip.get("lifecycle") or "").strip().lower()
    tag_id = trip.get("tag_id")
    present = bool(tag_id)
    mapping: dict[str, TripState] = {
        "none": "none",
        "tag_created": "request_open",
        "offer": "offers_received",
        "matched": "matched",
        "boarding": "boarding",
        "in_progress": "ongoing",
        "ending": "completion_pending",
        "completed": "completed",
        "force_ended": "completed",
        "cancelled": "none",
        "unknown": "unknown",
    }
    state = mapping.get(lifecycle, "unknown")
    if state == "none":
        present = False
    return state, present


def _as_role(v: Any) -> RoleState:
    s = str(v or "").strip().lower()
    if s in ("guest", "passenger", "driver", "both", "unknown"):
        return s  # type: ignore[return-value]
    return "unknown"


def _as_kyc(v: Any) -> KycState:
    s = str(v or "").strip().lower()
    if s in ("not_started", "pending", "approved", "rejected", "unknown"):
        return s  # type: ignore[return-value]
    return "unknown"


def _as_vehicle(v: Any) -> VehicleApprovalState:
    s = str(v or "").strip().lower()
    if s in ("not_submitted", "pending", "approved", "rejected", "unknown"):
        return s  # type: ignore[return-value]
    return "unknown"


def _as_access(v: Any) -> DriverAccessState:
    s = str(v or "").strip().lower()
    if s in ("active", "inactive", "unknown"):
        return s  # type: ignore[return-value]
    return "unknown"


def _as_trip(v: Any) -> TripState:
    s = str(v or "").strip().lower()
    if s in (
        "none",
        "request_open",
        "offers_received",
        "matched",
        "boarding",
        "ongoing",
        "completion_pending",
        "completed",
        "unknown",
    ):
        return s  # type: ignore[return-value]
    return "unknown"
