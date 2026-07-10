"""
Leylek Zeka feature-knowledge intents — deterministic, manifest-backed (no network).
"""
from __future__ import annotations

import asyncio

import pytest

from controllers import ai_controller
from services.answer_engine import try_resolve
from services.answer_engine.feature_intents import FEATURE_INTENT_DEFINITIONS
from services.leylek_zeka.product_knowledge_manifest import (
    get_leylek_zeka_product_manifest,
    get_manifest_release_version,
)
from services.leylek_zeka.reply_guard import (
    is_user_reply_policy_violation,
    find_user_reply_policy_violations,
)


def _assert_safe_reply(text: str) -> None:
    assert text
    assert not is_user_reply_policy_violation(text), find_user_reply_policy_violations(text)
    low = text.lower()
    assert "leylektag" not in low.replace("karekodteknoloji.com/urunler/leylektag", "")
    assert "api.leylektag.com" not in low
    assert "kart ödeme yakında" not in low
    assert "kart odeme yakinda" not in low
    # Must not pitch purchase / earnings panel as available
    assert "paket satın al" not in low
    assert "paket satin al" not in low
    assert "sürücü kazanç paneli" not in low
    assert "surucu kazanc paneli" not in low
    assert "driver-verify" not in low


@pytest.mark.parametrize(
    "qid",
    [i.id for i in FEATURE_INTENT_DEFINITIONS],
)
def test_feature_intent_templates_pass_reply_guard(qid: str) -> None:
    intent = next(i for i in FEATURE_INTENT_DEFINITIONS if i.id == qid)
    _assert_safe_reply(intent.default_template)
    if intent.voice_default_template:
        _assert_safe_reply(intent.voice_default_template)


def test_product_identity() -> None:
    m = get_leylek_zeka_product_manifest()
    for q in (
        "Uygulamanın adı ne?",
        "Bu uygulamanın adı ne?",
        "Şirket kim?",
        "API adresi ne?",
        "LeylekTag mi Leylek Yolculuk mu?",
    ):
        hit = try_resolve(q, None)
        assert hit is not None, q
        assert hit["intent_id"] == "product_identity"
        assert hit["deterministic"] is True
        assert m.product_name in hit["text"]
        assert m.company_name in hit["text"]
        assert "api.karekodteknoloji.com" in hit["text"]
        assert "api.leylektag.com" not in hit["text"] or "önerilmez" in hit["text"]
        _assert_safe_reply(hit["text"])


def test_vehicle_registry() -> None:
    for q in (
        "Araçlarım nerede?",
        "İkinci araç nasıl eklenir?",
        "Hem araba hem motosiklet ekleyebilir miyim?",
        "Pending aracı tekrar gönderebilir miyim?",
        "driver-verify nerede?",
    ):
        hit = try_resolve(q, None)
        assert hit is not None, q
        assert hit["intent_id"] == "vehicle_registry_araclarim"
        text = hit["text"]
        assert "/driver-vehicles" in text
        assert "bağımsız" in text.lower() or "bagimsiz" in text.lower() or "birbirinden" in text.lower()
        assert "yeniden gönderilmez" in text.lower() or "yeniden gonderilmez" in text.lower()
        assert "kaldırılmıştır" in text.lower() or "kaldirilmistir" in text.lower()
        assert "driver-verify" not in text.lower()
        _assert_safe_reply(text)


def test_map_behavior() -> None:
    for q in (
        "Sürücü paneli nasıl çalışıyor?",
        "Harita neden yakın?",
        "Harita neden kendi kendine uzaklaşmıyor?",
        "Haritayı uzaklaştırabilir miyim?",
    ):
        hit = try_resolve(q, None)
        assert hit is not None, q
        assert hit["intent_id"] == "driver_panel_map_behavior"
        text = hit["text"].lower()
        assert "harita" in text
        assert "sokak" in text
        assert "pinch" in text or "pan" in text or "kullanıcı" in text or "kullanici" in text
        assert "navigasyon" in text or "turn-by-turn" in text or "heading" in text
        _assert_safe_reply(hit["text"])


def test_payment_card_and_contribution() -> None:
    card = try_resolve("Kartla ödeme var mı?", None)
    assert card is not None
    assert card["intent_id"] == "card_payment_unavailable"
    assert "yok" in card["text"].lower() or "yapılamaz" in card["text"].lower() or "yapilamaz" in card["text"].lower()
    assert "yakında gelecek" not in card["text"].lower() and "yakinda gelecek" not in card["text"].lower()
    assert "kart ödeme yakında" not in card["text"].lower()
    _assert_safe_reply(card["text"])

    soon = try_resolve("Kart ödeme ne zaman gelecek?", None)
    assert soon is not None
    assert soon["intent_id"] == "card_payment_unavailable"
    _assert_safe_reply(soon["text"])

    contrib = try_resolve("Katkı payı nedir?", None)
    assert contrib is not None
    assert contrib["intent_id"] == "contribution_payment_model"
    assert "iban" in contrib["text"].lower() or "nakit" in contrib["text"].lower()
    assert "/contribution-iban" in contrib["text"]
    _assert_safe_reply(contrib["text"])


def test_package_unavailable() -> None:
    hit = try_resolve("Paket satın alabilir miyim?", None)
    assert hit is not None
    assert hit["intent_id"] == "driver_package_unavailable"
    text = hit["text"].lower()
    assert "iap" in text or "uygulama içi" in text or "uygulama ici" in text
    assert "bilgilendirme" in text
    _assert_safe_reply(hit["text"])


def test_earnings_and_history() -> None:
    earn = try_resolve("Bugün ne kadar kazandım?", None)
    assert earn is not None
    assert earn["intent_id"] == "earnings_dashboard_unavailable"
    assert "tl" not in earn["text"].lower() or "toplam" in earn["text"].lower()
    assert "/history" in earn["text"]
    _assert_safe_reply(earn["text"])

    hist = try_resolve("Yolculuk geçmişi nerede?", None)
    assert hist is not None
    assert hist["intent_id"] == "trip_history_operational"
    assert "/history" in hist["text"]
    assert "operasyonel" in hist["text"].lower()
    _assert_safe_reply(hist["text"])


def test_legal_routes() -> None:
    cases = (
        ("Gizlilik politikası nerede?", "legal_privacy", "/privacy"),
        ("KVKK nerede?", "legal_kvkk", "/kvkk"),
        ("Kullanıcı sözleşmesi nerede?", "legal_terms_user", "/terms-user"),
        ("Sürücü sözleşmesi nerede?", "legal_terms_driver", "/terms-driver"),
        ("Kimlik doğrulama metni nerede?", "legal_identity_verification", "/identity-verification"),
        ("Katkı/IBAN belgesi nerede?", "legal_contribution_iban", "/contribution-iban"),
        ("Topluluk kuralları nerede?", "legal_community_guidelines", "/community-guidelines"),
        ("Hesabımı nasıl silerim?", "legal_delete_account", "/delete-account"),
        ("Belgeler taslak mı?", "legal_trust_center", "/trust-center"),
    )
    for q, intent_id, route in cases:
        hit = try_resolve(q, None)
        assert hit is not None, q
        assert hit["intent_id"] == intent_id, q
        assert route in hit["text"], q
        assert "taslak değildir" in hit["text"].lower() or intent_id.startswith("legal_")
        _assert_safe_reply(hit["text"])


def test_support_contacts() -> None:
    m = get_leylek_zeka_product_manifest()
    for q in (
        "Destek numarası ne?",
        "Destek maili ne?",
        "Şikayetimi nereye bildirebilirim?",
    ):
        hit = try_resolve(q, None)
        assert hit is not None, q
        assert hit["intent_id"] == "support_contacts"
        assert m.support_email in hit["text"]
        assert m.support_phone in hit["text"]
        assert "/support" in hit["text"]
        assert "çözdüm" not in hit["text"].lower() and "sonuçlandırdım" not in hit["text"].lower()
        _assert_safe_reply(hit["text"])


def test_unavailable_summary() -> None:
    hit = try_resolve("Şu anda olmayan özellikler neler?", None)
    assert hit is not None
    assert hit["intent_id"] == "unavailable_features_summary"
    low = hit["text"].lower()
    assert "kart" in low
    assert "iap" in low or "paket" in low
    assert "gelir" in low or "kazanç" in low or "kazanc" in low
    _assert_safe_reply(hit["text"])


def test_account_and_live_fail_closed_metadata() -> None:
    async def _run() -> None:
        cases = (
            ("Aracım onaylı mı?", "account_state_unverified", "account"),
            ("KYC onaylandı mı?", "account_state_unverified", "account"),
            ("Paketim aktif mi?", "account_state_unverified", "account"),
            ("Neden çevrimiçi olamıyorum?", "account_state_unverified", "account"),
            ("Şu an eşleşmem var mı?", "live_trip_state_unverified", "live_trip"),
        )
        for q, intent_id, category in cases:
            reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
                user_message=q,
                history=[],
                context={"isDriver": True, "flowHint": "driver_online"},
            )
            assert source == "answer_engine", q
            assert meta is not None and meta["intent_id"] == intent_id, q
            assert "Doğrulayamadım" in reply, q
            assert contract["grounded"] is True
            assert contract["confidence"] == "high"
            assert contract["category"] == category
            assert contract["requires_support"] is True
            assert contract["suggested_route"] == "/support"
            assert contract["account_context_used"] is False
            assert contract["live_state_used"] is False
            assert contract["source_version"] == get_manifest_release_version()
            assert contract["blocked_claim_reason"]
            _assert_safe_reply(reply)

    asyncio.run(_run())


def test_feature_intent_contract_metadata_product() -> None:
    async def _run() -> None:
        reply, source, meta, contract = await ai_controller.get_leylek_zeka_reply(
            user_message="Araçlarım nerede?",
            history=[],
            context=None,
        )
        assert source == "answer_engine"
        assert meta and meta["intent_id"] == "vehicle_registry_araclarim"
        assert contract["grounded"] is True
        assert contract["confidence"] == "high"
        assert contract["category"] == "product"
        assert contract["suggested_route"] == "/driver-vehicles"
        assert contract["source_version"] == get_manifest_release_version()
        assert "/driver-vehicles" in reply

    asyncio.run(_run())


def test_matching_canon_not_regressed() -> None:
    hit = try_resolve("Eşleşme nasıl çalışır?", None)
    assert hit is not None
    assert hit["intent_id"] == "how_matching_works"
    low = hit["text"].lower()
    assert "teklif" in low
    assert "yolcu" in low
    assert "kabul" in low
