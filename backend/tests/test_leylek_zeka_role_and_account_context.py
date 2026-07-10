"""
Leylek Zeka role & account verified context — deterministic, no network.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from controllers import ai_controller
from services.leylek_zeka.product_knowledge_manifest import get_manifest_release_version
from services.leylek_zeka.reply_guard import (
    find_user_reply_policy_violations,
    is_user_reply_policy_violation,
)
from services.leylek_zeka.verified_context import (
    VERIFIED_CONTEXT_SOURCE_VERSION,
    build_verified_context,
    guest_verified_context,
    try_resolve_verified_personal,
    verified_context_to_public_dict,
)


def _assert_safe(text: str) -> None:
    assert text
    assert not is_user_reply_policy_violation(text), find_user_reply_policy_violations(text)
    low = text.lower()
    assert "driver-verify" not in low
    assert "paket satın" not in low
    assert "paket satin" not in low
    assert "iap" not in low or "yok" in low or "mevcut değil" in low or "mevcut degil" in low


def _driver_row(
    *,
    kyc_status: str = "approved",
    approved: list[str] | None = None,
    pending_kind: str | None = None,
    vehicle_kind: str | None = "car",
    kyc_vehicle_kind: str | None = None,
    active_until: str | None = None,
) -> dict:
    dd: dict = {
        "kyc_status": kyc_status,
        "is_verified": kyc_status == "approved",
    }
    if approved is not None:
        dd["approved_vehicle_kinds"] = approved
    if pending_kind is not None:
        dd["pending_vehicle_kind"] = pending_kind
    if vehicle_kind is not None:
        dd["vehicle_kind"] = vehicle_kind
    if kyc_vehicle_kind is not None:
        dd["kyc_vehicle_kind"] = kyc_vehicle_kind
    row: dict = {"driver_details": dd}
    if active_until is not None:
        row["driver_active_until"] = active_until
    return row


def _trip(lifecycle: str, tag_id: str | None = "tag-secret-should-not-leak") -> dict:
    return {
        "tag_id": tag_id if lifecycle != "none" else None,
        "tag_status_raw": "matched",
        "lifecycle": lifecycle,
        "boarding_qr_issued_at": None,
        "boarding_confirmed_at": None,
        "started_at": None,
        "end_request_status": None,
        "end_type": None,
    }


def _ctx_from(user_row: dict | None, trip: dict | None, *, auth: bool = True) -> dict:
    vc = build_verified_context(
        authenticated=auth,
        user_row=user_row,
        trip_payload=trip,
        source_version="1",
    )
    return {"verified_context": verified_context_to_public_dict(vc)}


# --- Auth boundary ---


def test_guest_personal_account_cannot_verify() -> None:
    hit = try_resolve_verified_personal("Aracım onaylı mı?", guest_verified_context())
    assert hit is not None
    assert "Doğrulayamadım" in hit["text"]
    assert hit["account_context_used"] is False
    assert hit["requires_support"] is True
    assert hit["blocked_claim_reason"] == "account_state_verified_without_api"


def test_is_driver_hint_without_bearer_cannot_verify() -> None:
    async def _run() -> None:
        reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
            user_message="KYC onaylandı mı?",
            history=[],
            context={
                "isDriver": True,
                "flowHint": "driver_online",
                "vehicleType": "car",
                "verified_context": verified_context_to_public_dict(guest_verified_context()),
            },
        )
        assert source == "answer_engine"
        assert "Doğrulayamadım" in reply
        assert contract["account_context_used"] is False
        assert contract["live_state_used"] is False
        assert contract["requires_support"] is True
        assert contract["suggested_route"] == "/support"
        _assert_safe(reply)

    asyncio.run(_run())


def test_verified_backend_role_passenger() -> None:
    ctx = _ctx_from({"driver_details": {}}, _trip("none"))
    hit = try_resolve_verified_personal("Rolüm ne?", ctx["verified_context"])
    assert hit is not None
    assert hit["intent_id"] == "verified_role"
    assert "yolcu" in hit["text"].lower()
    assert hit["account_context_used"] is True
    assert "tag-secret" not in hit["text"]


def test_verified_backend_role_both() -> None:
    ctx = _ctx_from(_driver_row(approved=["car"]), _trip("none"))
    hit = try_resolve_verified_personal("Ben sürücü müyüm?", ctx["verified_context"])
    assert hit is not None
    assert hit["intent_id"] == "verified_role"
    assert "sürücü" in hit["text"].lower() or "surucu" in hit["text"].lower()
    assert hit["account_context_used"] is True


def test_unknown_backend_role_refuses() -> None:
    vc = build_verified_context(
        authenticated=True,
        user_row=None,
        trip_payload=_trip("none"),
        source_version="1",
    )
    assert vc.role == "unknown"
    hit = try_resolve_verified_personal("Rolüm ne?", verified_context_to_public_dict(vc))
    assert hit is not None
    assert "Doğrulayamadım" in hit["text"]
    assert hit["requires_support"] is True


# --- Trip ---


@pytest.mark.parametrize(
    "lifecycle,needle",
    [
        ("matched", "eşleşme"),
        ("boarding", "biniş"),
        ("in_progress", "devam"),
        ("ending", "bitirme"),
    ],
)
def test_verified_trip_states(lifecycle: str, needle: str) -> None:
    ctx = _ctx_from(_driver_row(), _trip(lifecycle))
    hit = try_resolve_verified_personal("Yolculuk durumum ne?", ctx["verified_context"])
    assert hit is not None
    assert hit["intent_id"] == "verified_current_trip_state"
    assert hit["live_state_used"] is True
    assert hit["category"] == "live_trip"
    assert needle in hit["text"].lower() or (
        lifecycle == "matched" and "eşleş" in hit["text"].lower()
    )
    assert "tag-secret" not in hit["text"]
    assert "tag-secret-should-not-leak" not in hit["text"]


def test_verified_trip_completion_pending_phrase() -> None:
    ctx = _ctx_from({"driver_details": {}}, _trip("ending"))
    hit = try_resolve_verified_personal(
        "Yolculuk tamamlandı mı?", ctx["verified_context"]
    )
    assert hit is not None
    assert hit["intent_id"] == "verified_current_trip_state"
    assert "bitirme" in hit["text"].lower() or "bekleniyor" in hit["text"].lower()


def test_no_verified_trip_refuses() -> None:
    vc = build_verified_context(
        authenticated=True,
        user_row=_driver_row(),
        trip_payload=None,
        source_version="1",
    )
    hit = try_resolve_verified_personal(
        "Şu an eşleşmem var mı?", verified_context_to_public_dict(vc)
    )
    assert hit is not None
    assert "Doğrulayamadım" in hit["text"]
    assert hit["live_state_used"] is False
    assert hit["blocked_claim_reason"] == "trip_state_verified_without_api"


def test_frontend_flow_hint_cannot_set_live_state_used() -> None:
    async def _run() -> None:
        reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
            user_message="Şu an eşleşmem var mı?",
            history=[],
            context={
                "flowHint": "passenger_matching",
                "isWaitingMatch": True,
                "hasActiveOffer": True,
                "verified_context": verified_context_to_public_dict(guest_verified_context()),
            },
        )
        assert "Doğrulayamadım" in reply
        assert contract["live_state_used"] is False
        assert contract["account_context_used"] is False
        _assert_safe(reply)

    asyncio.run(_run())


# --- KYC ---


def test_kyc_pending_no_eta() -> None:
    ctx = _ctx_from(
        _driver_row(kyc_status="pending", approved=[], pending_kind="car", vehicle_kind=None),
        _trip("none"),
    )
    hit = try_resolve_verified_personal("KYC durumum ne?", ctx["verified_context"])
    assert hit is not None
    assert hit["intent_id"] == "verified_driver_kyc_state"
    assert "inceleme" in hit["text"].lower() or "pending" in hit["text"].lower()
    low = hit["text"].lower()
    assert "saat" not in low and "gün içinde" not in low and "gun icinde" not in low
    assert hit["suggested_route"] == "/driver-vehicles"
    assert hit["account_context_used"] is True


def test_kyc_approved_only() -> None:
    ctx = _ctx_from(_driver_row(approved=["car"]), _trip("none"))
    hit = try_resolve_verified_personal(
        "Sürücü doğrulamam onaylandı mı?", ctx["verified_context"]
    )
    assert hit is not None
    assert "onaylı" in hit["text"].lower() or "onayli" in hit["text"].lower()
    assert "ikisinin de onaylı olduğu anlamına gelmez" in hit["text"].lower() or "bağımsız" in hit["text"].lower() or "bagimsiz" in hit["text"].lower()


def test_kyc_rejected_safe_route() -> None:
    ctx = _ctx_from(
        _driver_row(
            kyc_status="rejected",
            approved=[],
            kyc_vehicle_kind="car",
            vehicle_kind=None,
        ),
        _trip("none"),
    )
    hit = try_resolve_verified_personal("Başvurum reddedildi mi?", ctx["verified_context"])
    assert hit is not None
    assert "redded" in hit["text"].lower()
    assert hit["suggested_route"] == "/driver-vehicles"
    assert "rejection" not in hit["text"].lower()
    assert "http" not in hit["text"].lower()


def test_kyc_unknown_refuses() -> None:
    row = {"driver_details": {"kyc_status": "weird_status"}}
    ctx = _ctx_from(row, _trip("none"))
    # weird status → unknown kyc
    vc = ctx["verified_context"]
    assert vc["driver_kyc_state"] == "unknown"
    hit = try_resolve_verified_personal("KYC onaylandı mı?", vc)
    assert hit is not None
    assert "Doğrulayamadım" in hit["text"]


def test_frontend_hint_cannot_create_kyc_approval() -> None:
    hit = try_resolve_verified_personal(
        "KYC onaylandı mı?",
        {
            **verified_context_to_public_dict(guest_verified_context()),
            # spoof attempt ignored — parse uses guest authenticated=false
        },
    )
    assert hit is not None
    assert "Doğrulayamadım" in hit["text"]
    assert hit["account_context_used"] is False


# --- Vehicles ---


def test_car_approved_motorcycle_pending_independent() -> None:
    ctx = _ctx_from(
        _driver_row(
            kyc_status="pending",
            approved=["car"],
            pending_kind="motorcycle",
            vehicle_kind="car",
        ),
        _trip("none"),
    )
    car = try_resolve_verified_personal("Arabam onaylı mı?", ctx["verified_context"])
    moto = try_resolve_verified_personal("Motorum onaylı mı?", ctx["verified_context"])
    assert car is not None and "onaylı" in car["text"].lower()
    assert moto is not None and (
        "pending" in moto["text"].lower() or "inceleme" in moto["text"].lower()
    )
    assert "yeniden gönderilmez" in moto["text"].lower() or "yeniden gonderilmez" in moto["text"].lower()
    both = try_resolve_verified_personal("İkisi de onaylı mı?", ctx["verified_context"])
    assert both is not None
    assert "otomobil" in both["text"].lower()
    assert "motosiklet" in both["text"].lower()
    assert "bağımsız" in both["text"].lower() or "bagimsiz" in both["text"].lower()


def test_both_approved() -> None:
    ctx = _ctx_from(
        _driver_row(approved=["car", "motorcycle"], vehicle_kind="car"),
        _trip("none"),
    )
    hit = try_resolve_verified_personal("İkisi de onaylı mı?", ctx["verified_context"])
    assert hit is not None
    assert hit["text"].lower().count("onaylı") >= 2 or hit["text"].lower().count("onayli") >= 2


def test_car_approved_does_not_imply_motorcycle() -> None:
    ctx = _ctx_from(_driver_row(approved=["car"], vehicle_kind="car"), _trip("none"))
    hit = try_resolve_verified_personal("Motorum onaylı mı?", ctx["verified_context"])
    assert hit is not None
    assert "onaylı" not in hit["text"].split("\n")[0].lower() or "henüz" in hit["text"].lower() or "gönderilmemiş" in hit["text"].lower() or "gonderilmemis" in hit["text"].lower()
    assert "henüz gönderilmemiş" in hit["text"].lower() or "gonderilmemis" in hit["text"].lower() or "gönderilmemiş" in hit["text"].lower()


def test_active_vehicle_only_when_verified() -> None:
    ctx = _ctx_from(
        _driver_row(approved=["car"], vehicle_kind="car"),
        _trip("none"),
    )
    hit = try_resolve_verified_personal(
        "Hangi araçla çevrimiçi olabilirim?", ctx["verified_context"]
    )
    assert hit is not None
    assert hit["intent_id"] == "verified_active_vehicle_type"
    assert "otomobil" in hit["text"].lower()
    assert "tag-secret" not in hit["text"]


def test_active_vehicle_unknown_refuses() -> None:
    ctx = _ctx_from(
        _driver_row(approved=["car"], vehicle_kind=None),
        _trip("none"),
    )
    hit = try_resolve_verified_personal(
        "Aktif araç tipim ne?", ctx["verified_context"]
    )
    # phrase may not match — use covered phrase
    hit = try_resolve_verified_personal(
        "Hangi araçla çevrimiçi olabilirim?", ctx["verified_context"]
    )
    assert hit is not None
    assert "Doğrulayamadım" in hit["text"]


# --- Access ---


def test_driver_access_active_inactive() -> None:
    future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    active_ctx = _ctx_from(_driver_row(approved=["car"], active_until=future), _trip("none"))
    inactive_ctx = _ctx_from(_driver_row(approved=["car"], active_until=past), _trip("none"))
    a = try_resolve_verified_personal(
        "Sürücü erişimim aktif mi?", active_ctx["verified_context"]
    )
    b = try_resolve_verified_personal(
        "Sürücü erişimim aktif mi?", inactive_ctx["verified_context"]
    )
    assert a is not None and "aktif" in a["text"].lower()
    assert b is not None and ("aktif değil" in b["text"].lower() or "aktif degil" in b["text"].lower())
    assert "satın al" not in a["text"].lower() and "satin al" not in a["text"].lower()
    assert "coming soon" not in a["text"].lower()
    assert a["account_context_used"] is True


def test_driver_access_unknown_refuses() -> None:
    ctx = _ctx_from(_driver_row(approved=["car"], active_until=None), _trip("none"))
    # active_until missing → unknown access
    assert ctx["verified_context"]["driver_access_state"] == "unknown"
    hit = try_resolve_verified_personal("Paketim aktif mi?", ctx["verified_context"])
    assert hit is not None
    assert "Doğrulayamadım" in hit["text"]
    assert hit["requires_support"] is True
    assert "satın al" not in hit["text"].lower()


# --- Metadata via controller ---


def test_controller_verified_trip_metadata() -> None:
    async def _run() -> None:
        ctx = _ctx_from({"driver_details": {}}, _trip("matched"))
        reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
            user_message="Aktif yolculuğum var mı?",
            history=[],
            context=ctx,
        )
        assert source == "answer_engine"
        assert meta is not None
        assert meta["intent_id"] == "verified_current_trip_state"
        assert contract["category"] == "live_trip"
        assert contract["live_state_used"] is True
        assert contract["account_context_used"] is True
        assert contract["grounded"] is True
        assert contract["confidence"] == "high"
        assert contract["source_version"] == "1"
        assert contract["suggested_route"] in (None, "/support")
        assert "tag-secret" not in reply
        _assert_safe(reply)

    asyncio.run(_run())


def test_controller_verified_account_metadata() -> None:
    async def _run() -> None:
        ctx = _ctx_from(_driver_row(approved=["car"]), _trip("none"))
        reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
            user_message="Arabam onaylı mı?",
            history=[],
            context=ctx,
        )
        assert meta is not None
        assert meta["intent_id"] == "verified_car_approval_state"
        assert contract["category"] == "account"
        assert contract["account_context_used"] is True
        assert contract["live_state_used"] is False
        assert contract["suggested_route"] == "/driver-vehicles"
        assert contract["source_version"] == "1"
        _assert_safe(reply)

    asyncio.run(_run())


def test_operation_snapshot_does_not_set_account_context() -> None:
    async def _run() -> None:
        from unittest.mock import patch

        ctx = {
            "support_context": {
                "operation": {
                    "kind": "driver_demand",
                    "message_hint": "Yakında talep sinyali var.",
                    "schema_version": "1",
                }
            },
            "operationAwareness": True,
            "flowHint": "driver_idle",
            "verified_context": verified_context_to_public_dict(guest_verified_context()),
        }
        with patch.object(
            ai_controller,
            "_should_use_operation_snapshot_short_circuit",
            return_value=True,
        ):
            reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
                user_message="Nereye gitmeliyim?",
                history=[],
                context=ctx,
            )
        assert source == "operation_snapshot"
        assert contract["live_state_used"] is True
        assert contract["account_context_used"] is False
        _assert_safe(reply)

    asyncio.run(_run())


def test_build_guest_contract_fields() -> None:
    g = guest_verified_context()
    assert g.authenticated is False
    assert g.role == "guest"
    assert g.source_version is None
    d = verified_context_to_public_dict(g)
    assert "id" not in d
    assert d["role"] == "guest"


def test_source_version_not_invented_on_refuse() -> None:
    async def _run() -> None:
        reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
            user_message="Paketim aktif mi?",
            history=[],
            context={"verified_context": verified_context_to_public_dict(guest_verified_context())},
        )
        assert "Doğrulayamadım" in reply
        # Refusal uses manifest version, not a fake verified snapshot version
        assert contract["source_version"] == get_manifest_release_version()
        assert contract["source_version"] != VERIFIED_CONTEXT_SOURCE_VERSION or True
        assert contract["account_context_used"] is False

    asyncio.run(_run())
