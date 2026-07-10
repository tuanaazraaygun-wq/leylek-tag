"""
Leylek Zeka brand + forbidden-claim guard — pure unit tests (no network / DB).
"""
from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from services.answer_engine.catalog import (
    GUVEN_AL_EXPLAINED,
    LEYLEKTAG_COMPANY_INFO,
    MATCHING_WORKS,
    TAG_VS_INTERCITY_LEYLEK_OFFER,
)
from services.leylek_zeka.product_knowledge_manifest import (
    find_forbidden_user_terms,
    get_leylek_zeka_product_manifest,
)
from services.leylek_zeka.reply_guard import (
    admin_kb_body_allowed,
    find_forbidden_claim_hits,
    find_user_reply_policy_violations,
    guard_user_visible_reply,
    is_user_reply_policy_violation,
    safe_fail_closed_reply,
)


def test_brand_identity_allowed() -> None:
    m = get_leylek_zeka_product_manifest()
    assert m.product_name == "Leylek Yolculuk"
    assert m.assistant_name == "Leylek Zeka"
    assert m.company_name == "Karekod Teknoloji ve Yazılım A.Ş."
    assert not is_user_reply_policy_violation(
        f"{m.product_name} asistanı {m.assistant_name} yardımcı olur."
    )


def test_brand_drift_rejected() -> None:
    assert "LeylekTAG" in find_forbidden_user_terms("LeylekTAG uygulamasında")
    assert "Leylek TAG" in find_forbidden_user_terms("Leylek TAG ile yolculuk")
    assert "TAG" in find_forbidden_user_terms("Şehir içi normal TAG akışı")
    guarded = guard_user_visible_reply("LeylekTag ile eşleşirsiniz.")
    assert guarded == safe_fail_closed_reply()
    assert "LeylekTag" not in guarded
    assert "Leylek Yolculuk" in MATCHING_WORKS
    assert "LeylekTag" not in MATCHING_WORKS
    assert "LeylekTag" not in LEYLEKTAG_COMPANY_INFO
    assert " TAG " not in f" {TAG_VS_INTERCITY_LEYLEK_OFFER} "
    assert " TAG " not in f" {GUVEN_AL_EXPLAINED} "


def test_hosts_policy() -> None:
    assert "api.leylektag.com" in find_forbidden_user_terms(
        "API: https://api.leylektag.com"
    )
    assert "leylektag.com" in find_forbidden_user_terms(
        "Destek için leylektag.com adresine bakın"
    )
    m = get_leylek_zeka_product_manifest()
    assert not is_user_reply_policy_violation(
        f"Canlı API: {m.live_api_host}"
    )
    assert not is_user_reply_policy_violation(
        f"Gizlilik: {m.public_privacy_url}"
    )
    assert "api.karekodteknoloji.com" in m.live_api_host
    assert m.public_privacy_url.startswith("https://karekodteknoloji.com/")


def test_forbidden_payment_and_package_claims() -> None:
    assert "card_payment_available" in find_forbidden_claim_hits(
        "Kart ile ödeme yapabilirsiniz."
    )
    assert "card_payment_coming_soon" in find_forbidden_claim_hits(
        "Kart ödeme yakında gelecek."
    )
    assert "package_purchase_available" in find_forbidden_claim_hits(
        "Paket satın al menüsünden alabilirsiniz."
    )
    assert is_user_reply_policy_violation("Kartla ödeyebilirsiniz.")
    assert guard_user_visible_reply("Kart ödeme yakında") == safe_fail_closed_reply()


def test_forbidden_earnings_and_draft_claims() -> None:
    assert "earnings_dashboard_available" in find_forbidden_claim_hits(
        "Sürücü kazanç paneli burada."
    )
    assert "earnings_guaranteed" in find_forbidden_claim_hits(
        "Kazanç garantisi verilir."
    )
    assert "taslak" in find_forbidden_user_terms("Bu belge taslak durumundadır")
    assert "taslak" not in find_forbidden_user_terms(
        "Belgeler taslak değildir; üretim belgeleridir."
    )


def test_live_state_and_action_claims_blocked() -> None:
    assert "trip_state_verified_without_api" in find_forbidden_claim_hits(
        "Yolculuğunuz eşleşti."
    )
    assert "kyc_status_verified_without_api" in find_forbidden_claim_hits(
        "KYC onaylandı."
    )
    assert "account_state_verified_without_api" in find_forbidden_claim_hits(
        "Hesabınız onaylandı."
    )
    assert "action_completed_without_success_response" in find_forbidden_claim_hits(
        "İşlemi tamamladım."
    )


def test_admin_kb_body_gate() -> None:
    assert admin_kb_body_allowed("Leylek Yolculuk eşleşmesi teklif ile çalışır.")
    assert not admin_kb_body_allowed("LeylekTag ile kart ödeme yapabilirsiniz.")
    assert not admin_kb_body_allowed("Paket satın alabilirsiniz.")


def test_fallbacks_and_system_have_no_old_brand() -> None:
    from controllers import ai_controller

    for key, text in ai_controller._REPLIES.items():
        assert "LeylekTag" not in text, key
        assert "Leylek TAG" not in text, key
        assert not is_user_reply_policy_violation(text), (
            key,
            find_user_reply_policy_violations(text),
        )
    assert "LeylekTag" not in ai_controller._FALLBACK_GENERIC
    assert "Leylek Yolculuk" in ai_controller._FALLBACK_GENERIC
    assert "Leylek Yolculuk" in ai_controller.LEYLEK_ZEKA_SYSTEM
    assert "Karekod Teknoloji ve Yazılım A.Ş." in ai_controller.LEYLEK_ZEKA_SYSTEM
    assert "Doğrulayamadım" in ai_controller.LEYLEK_ZEKA_SYSTEM


def test_guard_preserves_source_on_openai_violation(monkeypatch: pytest.MonkeyPatch) -> None:
    from controllers import ai_controller

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-dummy")

    async def fake_openai(**_kwargs: object) -> str:
        return "LeylekTag ile kart ödeme yapabilirsiniz."

    async def _run() -> None:
        with (
            patch.object(ai_controller, "try_resolve", return_value=None),
            patch.object(ai_controller, "_high_confidence_flow_reply", return_value=None),
            patch.object(ai_controller, "try_match_admin_kb", return_value=None),
            patch.object(ai_controller, "_call_openai", new=fake_openai),
        ):
            reply, source, meta, _contract = await ai_controller.get_leylek_zeka_reply(
                user_message="__brand_guard_openai_probe__",
                history=[],
                context=None,
            )
        assert source == "openai"
        assert meta is None
        assert reply == safe_fail_closed_reply()
        assert "LeylekTag" not in reply

    asyncio.run(_run())


def test_admin_kb_skips_forbidden_body(monkeypatch: pytest.MonkeyPatch) -> None:
    import services.admin_leylek_zeka_kb as kb

    class _FakeExec:
        def __init__(self, data):
            self.data = data

        def execute(self):
            return self

    class _FakeQuery:
        def __init__(self, data):
            self._data = data

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _FakeExec(self._data)

    class _FakeSB:
        def table(self, _name):
            return _FakeQuery(
                [
                    {
                        "trigger_phrases": ["özel kb tetik"],
                        "body": "LeylekTag ile paket satın alabilirsiniz.",
                        "priority": 10,
                    },
                    {
                        "trigger_phrases": ["özel kb tetik"],
                        "body": "Leylek Yolculuk eşleşmesi teklif ile tamamlanır.",
                        "priority": 5,
                    },
                ]
            )

    monkeypatch.setenv("ADMIN_KB_READ_ENABLED", "1")
    monkeypatch.setattr(kb, "admin_kb_read_enabled", lambda: True)

    import types
    import sys

    fake_server = types.SimpleNamespace(supabase=_FakeSB())
    monkeypatch.setitem(sys.modules, "server", fake_server)

    hit = kb.try_match_admin_kb("özel kb tetik ifadesi")
    assert hit is not None
    assert "Leylek Yolculuk" in hit
    assert "LeylekTag" not in hit
    assert "paket" not in hit.lower()
