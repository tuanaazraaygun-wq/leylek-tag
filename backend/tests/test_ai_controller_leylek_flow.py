"""
Leylek Zeka — ai_controller yerel doğrulama (ağ çağrısı yok).
Canlı deploy öncesi: backend dizininde `py -3 -m pytest tests/test_ai_controller_leylek_flow.py -v`
"""
from __future__ import annotations

import asyncio
import os
from unittest.mock import patch

import pytest

# Ağ / OpenAI tetiklenmesin
os.environ.pop("OPENAI_API_KEY", None)


def test_high_confidence_eslesme_nasil() -> None:
    from controllers.ai_controller import _high_confidence_flow_reply

    r = _high_confidence_flow_reply("Eşleşme nasıl çalışır?")
    assert r is not None
    assert "Yakındaki" in r
    assert "Yolcu talep" in r
    assert "Sürücü teklif" in r


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
    assert "yolcu" in r.lower()


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
            reply, source, meta = await ai_controller.get_leylek_zeka_reply(
                user_message="Eşleşme nasıl çalışır?",
                history=[],
                context=None,
            )
        assert source == "fallback"
        assert meta is None
        assert isinstance(reply, str) and len(reply) > 20
        assert "Yakındaki" in reply

    asyncio.run(_run())


def test_get_leylek_generic_fallback_no_engine_no_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    async def _run() -> None:
        with patch.object(ai_controller, "try_resolve", return_value=None):
            reply, source, meta = await ai_controller.get_leylek_zeka_reply(
                user_message="__leylek_unique_nohit_xyz_99123__",
                history=[],
                context=None,
            )
        assert source == "fallback"
        assert meta is None
        assert isinstance(reply, str) and len(reply) > 5

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
