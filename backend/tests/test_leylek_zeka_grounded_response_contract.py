"""
Leylek Zeka grounded response contract — additive metadata (no network / DB writes).
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.leylek_zeka.product_knowledge_manifest import get_manifest_release_version
from services.leylek_zeka.reply_guard import (
    evaluate_user_visible_reply,
    safe_fail_closed_reply,
)
from services.leylek_zeka.response_contract import (
    build_leylek_zeka_response_metadata,
    classify_message_topic,
    map_support_route_for_topic,
)

_CONTRACT_KEYS = (
    "grounded",
    "confidence",
    "category",
    "source_version",
    "requires_support",
    "suggested_route",
    "blocked_claim_reason",
    "live_state_used",
    "account_context_used",
    "safety_level",
)


def _assert_contract_keys(data: dict) -> None:
    for k in _CONTRACT_KEYS:
        assert k in data


# --- Pure mappers ---


def test_legal_support_route_mapping() -> None:
    assert map_support_route_for_topic("privacy") == "/privacy"
    assert map_support_route_for_topic("kvkk") == "/kvkk"
    assert map_support_route_for_topic("terms_user") == "/terms-user"
    assert map_support_route_for_topic("terms_driver") == "/terms-driver"
    assert map_support_route_for_topic("delete_account") == "/delete-account"
    assert map_support_route_for_topic("trust_center") == "/trust-center"
    assert map_support_route_for_topic("general_legal") == "/trust-center"
    assert map_support_route_for_topic("invented_route") is None


def test_vehicle_route_mapping() -> None:
    assert map_support_route_for_topic("driver_vehicles") == "/driver-vehicles"
    assert map_support_route_for_topic("araçlarım") == "/driver-vehicles"
    assert map_support_route_for_topic("second_vehicle") == "/driver-vehicles"
    assert classify_message_topic("Araçlarım ekranında ikinci araç nasıl eklerim?") == (
        "driver_vehicles"
    )


def test_message_topic_legal_and_safety() -> None:
    assert classify_message_topic("Gizlilik politikası nerede?") == "privacy"
    assert classify_message_topic("KVKK metni") == "kvkk"
    assert classify_message_topic("Güven Al nedir, 112?") == "guven_al"


# --- Builder source mapping ---


def test_builder_answer_engine_matching() -> None:
    meta = build_leylek_zeka_response_metadata(
        source="answer_engine",
        origin="answer_engine",
        intent_id="how_matching_works",
        deterministic=True,
    )
    assert meta["grounded"] is True
    assert meta["confidence"] == "high"
    assert meta["source_version"] == get_manifest_release_version()
    assert meta["category"] == "product"
    assert meta["live_state_used"] is False
    assert meta["account_context_used"] is False


def test_builder_high_confidence_canon() -> None:
    meta = build_leylek_zeka_response_metadata(
        source="fallback",
        origin="high_confidence",
    )
    assert meta["grounded"] is True
    assert meta["confidence"] == "high"
    assert meta["category"] == "product"
    assert meta["source_version"] == get_manifest_release_version()


def test_builder_operation_snapshot() -> None:
    meta = build_leylek_zeka_response_metadata(
        source="operation_snapshot",
        origin="operation_snapshot",
        live_state_used=True,
        account_context_used=True,
        source_version_override="1",
    )
    assert meta["grounded"] is True
    assert meta["confidence"] == "high"
    assert meta["category"] == "live_trip"
    assert meta["live_state_used"] is True
    assert meta["account_context_used"] is True
    assert meta["source_version"] == "1"


def test_builder_admin_kb_safe() -> None:
    meta = build_leylek_zeka_response_metadata(
        source="admin_kb",
        origin="admin_kb",
    )
    assert meta["grounded"] is True
    assert meta["confidence"] == "medium"
    assert meta["source_version"] == get_manifest_release_version()
    assert meta["live_state_used"] is False
    assert meta["account_context_used"] is False


def test_builder_openai_ungrounded() -> None:
    meta = build_leylek_zeka_response_metadata(
        source="openai",
        origin="openai",
        # Frontend hints must not flip verified flags — builder ignores them unless passed
        live_state_used=False,
        account_context_used=False,
        user_message="Merhaba",
    )
    assert meta["grounded"] is False
    assert meta["confidence"] == "low"
    assert meta["source_version"] is None
    assert meta["live_state_used"] is False
    assert meta["account_context_used"] is False


def test_builder_openai_ignores_frontend_hint_flags_when_forced_false() -> None:
    """OpenAI origin always clears verified context flags."""
    meta = build_leylek_zeka_response_metadata(
        source="openai",
        origin="openai",
        live_state_used=True,  # caller mistake — openai path must not claim verified use
        account_context_used=True,
    )
    assert meta["live_state_used"] is False
    assert meta["account_context_used"] is False


# --- Guard metadata ---


def test_guard_card_payment_metadata() -> None:
    guard = evaluate_user_visible_reply("Kart ile ödeme yapabilirsiniz.")
    assert guard.blocked is True
    assert guard.blocked_claim_reason == "card_payment_available"
    assert guard.category_hint == "unavailable"
    assert guard.reply == safe_fail_closed_reply()
    meta = build_leylek_zeka_response_metadata(
        source="openai",
        origin="openai",
        guard=guard,
    )
    assert meta["grounded"] is True
    assert meta["confidence"] == "high"
    assert meta["category"] == "unavailable"
    assert meta["blocked_claim_reason"] == "card_payment_available"


def test_guard_old_host_brand_reason() -> None:
    guard = evaluate_user_visible_reply("API: https://api.leylektag.com")
    assert guard.blocked is True
    assert guard.blocked_claim_reason
    meta = build_leylek_zeka_response_metadata(
        source="admin_kb",
        origin="admin_kb",
        guard=guard,
    )
    assert meta["blocked_claim_reason"]
    assert meta["grounded"] is True
    assert meta["confidence"] == "high"


def test_guard_unverified_kyc_account() -> None:
    guard = evaluate_user_visible_reply("KYC onaylandı, hesabınız doğrulandı.")
    assert guard.blocked is True
    assert guard.blocked_claim_reason in (
        "kyc_status_verified_without_api",
        "account_state_verified_without_api",
    )
    meta = build_leylek_zeka_response_metadata(
        source="openai",
        origin="openai",
        guard=guard,
    )
    assert meta["category"] == "account"
    assert meta["requires_support"] is True
    assert meta["suggested_route"] == "/support"
    assert meta["account_context_used"] is False
    assert meta["grounded"] is True
    assert meta["confidence"] == "high"


def test_guard_unverified_trip() -> None:
    guard = evaluate_user_visible_reply("Yolculuğunuz eşleşti, aktif yolculuğunuz var.")
    assert guard.blocked is True
    assert guard.blocked_claim_reason == "trip_state_verified_without_api"
    meta = build_leylek_zeka_response_metadata(
        source="openai",
        origin="openai",
        guard=guard,
    )
    assert meta["category"] == "live_trip"
    assert meta["requires_support"] is True
    assert meta["suggested_route"] == "/support"
    assert meta["live_state_used"] is False


def test_builder_unverified_overrides() -> None:
    meta = build_leylek_zeka_response_metadata(
        source="fallback",
        origin="keyword_fallback",
        category_override="account",
        requires_support_override=True,
        suggested_route_override="/support",
        blocked_claim_reason_override="account_state_verified_without_api",
        account_context_used=False,
    )
    assert meta["category"] == "account"
    assert meta["requires_support"] is True
    assert meta["suggested_route"] == "/support"
    assert meta["blocked_claim_reason"] == "account_state_verified_without_api"
    assert meta["account_context_used"] is False


def test_safety_guven_al_emergency() -> None:
    meta = build_leylek_zeka_response_metadata(
        source="answer_engine",
        origin="answer_engine",
        intent_id="guven_al_explained",
        deterministic=True,
    )
    assert meta["category"] == "safety"
    assert meta["safety_level"] == "emergency"


# --- Controller / route integration ---


def test_controller_answer_engine_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
            user_message="Eşleşme nasıl çalışır?",
            history=[],
            context=None,
        )
        assert source == "answer_engine"
        assert meta is not None
        assert meta["intent_id"] == "how_matching_works"
        assert "teklif" in reply.lower()
        assert contract["grounded"] is True
        assert contract["confidence"] == "high"
        assert contract["category"] == "product"
        assert contract["source_version"] == get_manifest_release_version()
        assert contract["live_state_used"] is False
        assert contract["account_context_used"] is False

    asyncio.run(_run())


def test_controller_high_confidence_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        with patch.object(ai_controller, "try_resolve", return_value=None):
            reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
                user_message="Eşleşme nasıl oluyor?",
                history=[],
                context=None,
            )
        assert source == "fallback"
        assert meta is None
        assert reply
        assert contract["grounded"] is True
        assert contract["confidence"] == "high"
        assert contract["category"] == "product"

    asyncio.run(_run())


def test_controller_operation_snapshot_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    ctx = {
        "support_context": {
            "operation": {
                "kind": "driver_demand",
                "message_hint": "Yakında talep sinyali var.",
                "schema_version": "1",
            }
        },
        "operationAwareness": True,
        "flowHint": "driver_online",
    }

    async def _run() -> None:
        with patch.object(
            ai_controller,
            "_should_use_operation_snapshot_short_circuit",
            return_value=True,
        ):
            reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
                user_message="Nereye gitmeliyim, talep var mı?",
                history=[],
                context=ctx,
            )
        assert source == "operation_snapshot"
        assert "talep" in reply.lower() or "sinyal" in reply.lower()
        assert contract["grounded"] is True
        assert contract["confidence"] == "high"
        assert contract["category"] == "live_trip"
        assert contract["live_state_used"] is True
        assert contract["account_context_used"] is True
        assert contract["source_version"] == "1"

    asyncio.run(_run())


def test_controller_openai_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-dummy")

    async def fake_openai(**_kwargs: object) -> str:
        return "Merhaba, genel yardım."

    async def _run() -> None:
        with (
            patch.object(ai_controller, "try_resolve", return_value=None),
            patch.object(ai_controller, "_high_confidence_flow_reply", return_value=None),
            patch.object(ai_controller, "try_match_admin_kb", return_value=None),
            patch.object(ai_controller, "_call_openai", new=fake_openai),
        ):
            reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_nohit_xyz_contract__",
                history=[],
                context={
                    "isDriver": True,
                    "flowHint": "passenger_matching",
                    "stageLabel": "searching",
                },
            )
        assert source == "openai"
        assert reply == "Merhaba, genel yardım."
        assert meta is None
        assert contract["grounded"] is False
        assert contract["confidence"] == "low"
        assert contract["source_version"] is None
        assert contract["live_state_used"] is False
        assert contract["account_context_used"] is False

    asyncio.run(_run())


def test_controller_openai_card_claim_guarded(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-dummy")

    async def fake_openai(**_kwargs: object) -> str:
        return "Kart ile ödeme yapabilirsiniz."

    async def _run() -> None:
        with (
            patch.object(ai_controller, "try_resolve", return_value=None),
            patch.object(ai_controller, "_high_confidence_flow_reply", return_value=None),
            patch.object(ai_controller, "try_match_admin_kb", return_value=None),
            patch.object(ai_controller, "_call_openai", new=fake_openai),
        ):
            reply, source, _meta, contract = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_card_claim__",
                history=[],
                context=None,
            )
        assert source == "openai"
        assert reply == safe_fail_closed_reply()
        assert contract["category"] == "unavailable"
        assert contract["blocked_claim_reason"] == "card_payment_available"
        assert contract["grounded"] is True
        assert contract["confidence"] == "high"

    asyncio.run(_run())


def test_controller_admin_kb_safe_and_unsafe(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller
    from services.admin_leylek_zeka_kb import admin_kb_body_allowed

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert admin_kb_body_allowed("Güvenli ürün bilgisi.") is True
    assert admin_kb_body_allowed("Kart ile ödeme yapabilirsiniz.") is False

    async def _run() -> None:
        with (
            patch.object(ai_controller, "try_resolve", return_value=None),
            patch.object(ai_controller, "_high_confidence_flow_reply", return_value=None),
            patch.object(
                ai_controller, "try_match_admin_kb", return_value="Güvenli ürün bilgisi."
            ),
        ):
            reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_admin_kb__",
                history=[],
                context=None,
            )
        assert source == "admin_kb"
        assert meta is None
        assert reply == "Güvenli ürün bilgisi."
        assert contract["grounded"] is True
        assert contract["confidence"] == "medium"

    asyncio.run(_run())


def test_route_leylekzeka_backward_compatible(monkeypatch: pytest.MonkeyPatch) -> None:
    import routes.ai as routes_ai

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(routes_ai, "enforce_rate_limit", AsyncMock())

    from routes.ai import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    res = client.post("/api/ai/leylekzeka", json={"message": "Eşleşme nasıl çalışır?"})
    assert res.status_code == 200
    data = res.json()
    assert data.get("ok") is True
    assert data.get("success") is True
    assert data.get("source") == "answer_engine"
    assert data.get("mode")
    assert "reply" in data
    assert data.get("intent_id") == "how_matching_works"
    assert data.get("deterministic") is True
    _assert_contract_keys(data)
    assert data["grounded"] is True
    assert data["confidence"] == "high"
    assert data["category"] == "product"
    assert data["source_version"] == get_manifest_release_version()
    assert "teklif" in data["reply"].lower()


def test_route_chat_shares_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    """POST /api/ai/chat uses the same run_leylek_zeka_chat serializer when mounted."""
    import routes.ai as routes_ai

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(routes_ai, "enforce_rate_limit", AsyncMock())

    from routes.ai import LeylekZekaRequest, run_leylek_zeka_chat
    from starlette.requests import Request

    async def _run() -> None:
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/ai/chat",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
        request = Request(scope)
        body = LeylekZekaRequest(message="Eşleşme nasıl çalışır?")
        data = await run_leylek_zeka_chat(body, request)
        assert data["ok"] is True
        assert data["success"] is True
        assert data["source"] == "answer_engine"
        _assert_contract_keys(data)
        assert data["grounded"] is True
        assert data["category"] == "product"

    asyncio.run(_run())


def test_vehicle_suggested_route_on_keyword_path(monkeypatch: pytest.MonkeyPatch) -> None:
    meta = build_leylek_zeka_response_metadata(
        source="fallback",
        origin="keyword_fallback",
        manifest_backed_keyword=True,
        user_message="Araçlarım ekranında ikinci araç ekleme",
    )
    assert meta["suggested_route"] == "/driver-vehicles"
    assert meta["category"] == "product"
