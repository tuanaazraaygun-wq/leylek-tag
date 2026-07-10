"""
Leylek Zeka — ai_controller yerel doğrulama (ağ çağrısı yok).
Canlı deploy öncesi: backend dizininde `py -3 -m pytest tests/test_ai_controller_leylek_flow.py -v`
"""
from __future__ import annotations

import asyncio
import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ağ / OpenAI tetiklenmesin
os.environ.pop("OPENAI_API_KEY", None)

_STALE_MATCH_PHRASES = (
    "sürücüler talebi kabul ettiğinde",
    "sürücü talebi kabul ettiğinde",
    "ilk kabul eden sürücü",
    "sürücü kabul edince eşleşme",
    "talebi kabul ederek eşleşmeye",
    "uygun talebi kabul ederek eşleşmeye",
)

_FORBIDDEN_BRAND = (
    "LeylekTag",
    "Leylek TAG",
    "LeylekTAG",
)


def _assert_match_canon(reply: str) -> None:
    low = reply.lower()
    assert "teklif" in low
    assert "yolcu" in low
    assert "kabul" in low
    assert "sürücü" in low or "surucu" in low
    for stale in _STALE_MATCH_PHRASES:
        assert stale not in low, f"stale phrase present: {stale!r}"
    for brand in _FORBIDDEN_BRAND:
        assert brand not in reply
    # Standalone product TAG (not inside other words)
    assert " TAG " not in f" {reply} "
    assert not reply.strip().startswith("TAG ")
    assert "Leylek Yolculuk" in reply or "teklif" in low


def test_high_confidence_eslesme_nasil() -> None:
    from controllers import ai_controller

    r = ai_controller._high_confidence_flow_reply("Eşleşme nasıl çalışır?")
    assert r is not None
    assert r == ai_controller._ESLESME_VE_ROL
    _assert_match_canon(r)
    assert "Yolcu uygulama üzerinden bir yolculuk talebi oluşturur" in r
    assert "Sürücü yolcuya teklif gönderir" in r
    assert "yalnızca yolcunun teklifi kabul etmesiyle" in r


def test_high_confidence_eslesme_nasil_oluyor_casing() -> None:
    from controllers.ai_controller import _high_confidence_flow_reply

    for q in (
        "Eşleşme nasıl oluyor?",
        "eşleşme nasıl oluyor?",
        "eslesme nasil oluyor?",
        "Eşleşme nasıl oluyor??",
    ):
        r = _high_confidence_flow_reply(q)
        assert r is not None, q
        _assert_match_canon(r)


def test_high_confidence_kim_teklif() -> None:
    from controllers.ai_controller import _high_confidence_flow_reply

    r = _high_confidence_flow_reply("Teklifi kim gönderir?")
    assert r is not None
    assert "sürücü" in r.lower()
    assert "yolcu" in r.lower()
    assert "teklif" in r.lower()
    for brand in _FORBIDDEN_BRAND:
        assert brand not in r


def test_high_confidence_kim_kabul() -> None:
    from controllers.ai_controller import _high_confidence_flow_reply

    r = _high_confidence_flow_reply("Eşleşmeyi kim kabul eder?")
    assert r is not None
    assert "yolcu" in r.lower()
    _assert_match_canon(r)


def test_high_confidence_driver_accept_myth() -> None:
    from controllers.ai_controller import _high_confidence_flow_reply

    for q in (
        "Sürücü talebi kabul edince eşleşiyor muyuz?",
        "İlk kabul eden sürücü mü eşleşir?",
        "Kim kabul ediyor?",
    ):
        r = _high_confidence_flow_reply(q)
        assert r is not None, q
        _assert_match_canon(r)
        low = r.lower()
        assert "yolcudadır" in low or "yalnızca yolcu" in low or "otomatik eşleşmez" in low


def test_fallback_surucu_kabul_not_passenger_offer() -> None:
    from controllers.ai_controller import fallback_reply

    r = fallback_reply("Sürücü mü kabul ediyor?")
    _assert_match_canon(r)


def test_fallback_role_answers() -> None:
    from controllers.ai_controller import fallback_reply

    driver = fallback_reply("Sürücü ne yapıyor?")
    _assert_match_canon(driver)
    assert "teklif gönder" in driver.lower()

    passenger = fallback_reply("Yolcu ne yapıyor?")
    _assert_match_canon(passenger)
    assert "talep" in passenger.lower()

    choose = fallback_reply("Yolcu sürücüyü nasıl seçiyor?")
    _assert_match_canon(choose)
    assert "teklif" in choose.lower()


def test_get_leylek_flow_when_engine_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """try_resolve kapalıyken yüksek güven akışı + dönüş şekli."""
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        with patch.object(ai_controller, "try_resolve", return_value=None):
            reply, source, meta, _contract = await ai_controller.get_leylek_zeka_reply(
                user_message="Eşleşme nasıl çalışır?",
                history=[],
                context=None,
            )
        assert source == "fallback"
        assert meta is None
        assert isinstance(reply, str) and len(reply) > 20
        _assert_match_canon(reply)

    asyncio.run(_run())


def test_get_leylek_answer_engine_before_high_confidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Katalog isabeti, genel yüksek güven metninden önce gelir; akışlar çelişmez."""
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        reply, source, meta, _contract = await ai_controller.get_leylek_zeka_reply(
            user_message="Eşleşme nasıl çalışır?",
            history=[],
            context=None,
        )
        assert source == "answer_engine"
        assert meta is not None
        assert meta["intent_id"] == "how_matching_works"
        _assert_match_canon(reply)
        assert "Sürücü teklif gönderir" in reply or "sürücü teklif" in reply.lower()
        assert "Sürücüler talebi kabul ettiğinde eşleşme sağlanır" not in reply

    asyncio.run(_run())


def test_high_confidence_and_catalog_do_not_contradict() -> None:
    from controllers import ai_controller
    from services.answer_engine.catalog import MATCHING_WORKS

    hc = ai_controller._ESLESME_VE_ROL
    _assert_match_canon(hc)
    _assert_match_canon(MATCHING_WORKS)
    for text in (hc, MATCHING_WORKS):
        low = text.lower()
        assert "teklif" in low
        assert "kabul" in low
        assert "sürücüler talebi kabul ettiğinde" not in low


def test_get_leylek_generic_fallback_no_engine_no_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        with patch.object(ai_controller, "try_resolve", return_value=None):
            reply, source, meta, _contract = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_nohit_xyz_99123__",
                history=[],
                context=None,
            )
        assert source == "fallback"
        assert meta is None
        assert isinstance(reply, str) and len(reply) > 5

    asyncio.run(_run())


def test_admin_kb_after_answer_engine_before_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    """ADMIN_KB_READ_ENABLED açıkken admin KB, answer_engine yokken OpenAI'dan önce döner."""
    from controllers import ai_controller

    monkeypatch.setenv("ADMIN_KB_READ_ENABLED", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-dummy")

    async def _run() -> None:
        with (
            patch.object(ai_controller, "try_resolve", return_value=None),
            patch.object(ai_controller, "try_match_admin_kb", return_value="Kart yanıtı"),
            patch.object(ai_controller, "_call_openai", new_callable=AsyncMock) as m_openai,
        ):
            m_openai.side_effect = AssertionError("OpenAI çağrılmamalı")
            reply, source, meta, _contract = await ai_controller.get_leylek_zeka_reply(
                user_message="özel kb tetik ifadesi",
                history=[],
                context=None,
            )
        assert source == "admin_kb"
        assert meta is None
        assert reply == "Kart yanıtı"

    asyncio.run(_run())


def test_route_post_leylekzeka_smoke(monkeypatch: pytest.MonkeyPatch) -> None:
    """POST /api/ai/leylekzeka — OpenAI yok; katalog eşleşme yanıtı (rate limit devre dışı)."""
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
    assert data.get("success") is True
    assert data.get("source") == "answer_engine"
    reply = data.get("reply", "")
    _assert_match_canon(reply)
    assert "teklif" in reply.lower()


def test_get_leylek_openai_success_source_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    """OPENAI var: model yanıtı source=openai (Claude değil)."""
    from controllers import ai_controller

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-dummy")

    async def fake_openai(**_kwargs: object) -> str:
        return "Merhaba, OpenAI."

    async def _run() -> None:
        with (
            patch.object(ai_controller, "try_resolve", return_value=None),
            patch.object(ai_controller, "_call_openai", new=fake_openai),
        ):
            reply, source, meta, _contract = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_nohit_xyz_openai_src__",
                history=[],
                context=None,
            )
        assert source == "openai"
        assert meta is None
        assert reply == "Merhaba, OpenAI."

    asyncio.run(_run())


def test_extract_openai_text_sample() -> None:
    from controllers.ai_controller import _extract_openai_text

    sample = {
        "output": [
            {
                "content": [
                    {"type": "output_text", "text": "  Merhaba  "},
                ]
            }
        ]
    }
    assert _extract_openai_text(sample) == "Merhaba"
