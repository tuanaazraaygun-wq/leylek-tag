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


def test_high_confidence_eslesme_nasil() -> None:
    from controllers import ai_controller

    r = ai_controller._high_confidence_flow_reply("Eşleşme nasıl çalışır?")
    assert r is not None
    assert r == ai_controller._ESLESME_VE_ROL
    assert "2.\tSistem trafik" in r
    assert "yolcu teklifini" in r.lower() or "yolcu teklif" in r.lower()


def test_high_confidence_kim_teklif() -> None:
    from controllers.ai_controller import _high_confidence_flow_reply

    r = _high_confidence_flow_reply("Teklifi kim gönderir?")
    assert r is not None
    assert "sürücü" in r.lower()
    assert "yolcu" in r.lower()


def test_high_confidence_kim_kabul() -> None:
    from controllers.ai_controller import _high_confidence_flow_reply

    r = _high_confidence_flow_reply("Eşleşmeyi kim kabul eder?")
    assert r is not None
    assert "sürücü" in r.lower()


def test_fallback_surucu_kabul_not_passenger_offer() -> None:
    from controllers.ai_controller import fallback_reply

    r = fallback_reply("Sürücü mü kabul ediyor?")
    assert "yolcu" in r.lower()
    assert "sürücü" in r.lower()


def test_get_leylek_flow_when_engine_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """try_resolve kapalıyken yüksek güven akışı + dönüş şekli."""
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        with patch.object(ai_controller, "try_resolve", return_value=None):
            reply, source, meta, extra = await ai_controller.get_leylek_zeka_reply(
                user_message="Eşleşme nasıl çalışır?",
                history=[],
                context=None,
            )
        assert source == "fallback"
        assert meta is None
        assert extra is None
        assert isinstance(reply, str) and len(reply) > 20
        assert "Sistem trafik" in reply

    asyncio.run(_run())


def test_get_leylek_eslesme_canonical_before_answer_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    """OPENAI yok: answer_engine kataloğu olsa bile önce sabit _ESLESME_VE_ROL (tek akış metni)."""
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        reply, source, meta, extra = await ai_controller.get_leylek_zeka_reply(
            user_message="Eşleşme nasıl çalışır?",
            history=[],
            context=None,
        )
        assert source == "fallback"
        assert meta is None
        assert extra is None
        assert reply == ai_controller._ESLESME_VE_ROL
        assert "3.\tYolcu teklifini gönderir." in reply

    asyncio.run(_run())


def test_get_leylek_generic_fallback_no_engine_no_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        with patch.object(ai_controller, "try_resolve", return_value=None):
            reply, source, meta, extra = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_nohit_xyz_99123__",
                history=[],
                context=None,
            )
        assert source == "fallback"
        assert meta is None
        assert extra is None
        assert isinstance(reply, str) and len(reply) > 5

    asyncio.run(_run())


def test_route_post_leylekzeka_smoke(monkeypatch: pytest.MonkeyPatch) -> None:
    """POST /api/ai/leylekzeka — OpenAI yok; sabit akış yanıtı (rate limit devre dışı)."""
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
    assert data.get("source") == "fallback"
    assert "5.\tBir sürücü teklifi kabul ederse eşleşme oluşur." in data.get("reply", "")


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
            reply, source, meta, extra = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_nohit_xyz_openai_src__",
                history=[],
                context=None,
            )
        assert source == "openai"
        assert meta is None
        assert extra is None
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


def test_admin_live_learning_candidate_requires_approval() -> None:
    from controllers import ai_controller

    async def _run() -> None:
        reply, source, meta, extra = await ai_controller.get_leylek_zeka_reply(
            user_message="LeylekTag taşıma değildir, paylaşımlı yolculuk platformudur.",
            history=[],
            context=None,
            admin_authenticated=True,
        )
        assert source == "kb"
        assert meta is None
        assert extra is not None
        assert extra.get("requires_approval") is True
        assert "öğreneyim" in (reply or "").lower()
        cand = extra.get("learning_candidate") or {}
        assert "question" in cand and "answer" in cand
        assert "taşıma" in cand["answer"].lower() or "tasima" in cand["answer"].lower()

    asyncio.run(_run())


def test_non_admin_no_learning_candidate_on_same_message(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        reply, source, meta, extra = await ai_controller.get_leylek_zeka_reply(
            user_message="LeylekTag taşıma değildir, paylaşımlı yolculuk platformudur.",
            history=[],
            context=None,
            admin_authenticated=False,
        )
        assert extra is None

    asyncio.run(_run())
