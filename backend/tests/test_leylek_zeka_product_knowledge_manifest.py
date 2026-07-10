"""
Leylek Zeka product knowledge manifest — pure unit tests (no network / DB).
"""
from __future__ import annotations

import dataclasses

import pytest

from services.leylek_zeka.product_knowledge_manifest import (
    LeylekZekaProductKnowledgeManifest,
    find_forbidden_user_terms,
    get_leylek_zeka_product_manifest,
    get_manifest_release_version,
    get_supported_product_fact,
    get_unavailable_feature,
    is_forbidden_claim,
    is_forbidden_user_term,
)


def test_manifest_identity() -> None:
    m = get_leylek_zeka_product_manifest()
    assert isinstance(m, LeylekZekaProductKnowledgeManifest)
    assert m.product_name == "Leylek Yolculuk"
    assert m.company_name == "Karekod Teknoloji ve Yazılım A.Ş."
    assert m.assistant_name == "Leylek Zeka"
    assert m.live_api_host == "https://api.karekodteknoloji.com"
    assert "api.karekodteknoloji.com" in m.live_api_host
    assert m.support_email == "info@karekodteknoloji.com"
    assert m.support_phone == "0850 307 80 29"


def test_public_urls_on_karekod_host() -> None:
    m = get_leylek_zeka_product_manifest()
    for url in (
        m.public_product_url,
        m.public_privacy_url,
        m.public_terms_url,
        m.public_kvkk_url,
        m.public_account_deletion_url,
    ):
        assert url.startswith("https://karekodteknoloji.com/")
        assert "leylektag.com" not in url.replace("karekodteknoloji.com", "")


def test_old_api_and_domain_forbidden() -> None:
    assert is_forbidden_user_term("Bağlan: https://api.leylektag.com/api")
    assert "api.leylektag.com" in find_forbidden_user_terms(
        "API adresi api.leylektag.com olmalı"
    )
    assert is_forbidden_user_term("Gizlilik için leylektag.com adresine bakın")
    assert "leylektag.com" in find_forbidden_user_terms("https://www.leylektag.com/gizlilik")
    # Official product path on Karekod host is not the old public host.
    assert "leylektag.com" not in find_forbidden_user_terms(
        "Ürün: https://karekodteknoloji.com/urunler/leylektag"
    )
    assert "LeylekTAG" not in find_forbidden_user_terms(
        "https://karekodteknoloji.com/urunler/leylektag"
    )


def test_brand_protection_user_reply() -> None:
    assert is_forbidden_user_term("LeylekTAG uygulamasında eşleşme şöyle")
    assert is_forbidden_user_term("Leylek TAG ile yolculuk")
    assert "TAG" in find_forbidden_user_terms("Şehir içi normal TAG akışı")
    assert is_forbidden_user_term("normal TAG yolculuğu")


def test_technical_identifiers_not_flagged_on_technical_surface() -> None:
    for tech in (
        "com.leylektag.app",
        "leylektag://open",
        "tags",
        "tag",
    ):
        assert find_forbidden_user_terms(tech, surface="technical") == ()
        assert not is_forbidden_user_term(tech, surface="technical")


def test_technical_package_not_brand_hit_in_user_reply() -> None:
    # Package / scheme strings must not be treated as product brand "LeylekTAG".
    assert find_forbidden_user_terms("com.leylektag.app") == ()
    assert find_forbidden_user_terms("leylektag://ride/1") == ()


def test_payment_truth() -> None:
    m = get_leylek_zeka_product_manifest()
    pm = m.payment_model
    assert pm.card_payment_available is False
    assert pm.card_payment_coming_soon_allowed is False
    assert pm.platform_collects_in_app_card_payment is False
    assert pm.per_ride_contribution_may_be_agreed is True
    assert pm.cash_iban_contribution_confirmation_may_exist is True
    assert get_unavailable_feature("in_app_card_payment") is not None
    assert is_forbidden_claim("card_payment_available")
    assert is_forbidden_claim("card_payment_coming_soon")
    assert is_forbidden_user_term("Kart ödeme yakında gelecek")


def test_earnings_truth() -> None:
    m = get_leylek_zeka_product_manifest()
    assert m.driver_model.earnings_dashboard_exists is False
    assert m.product_positioning.earnings_guaranteed is False
    th = m.trip_history_policy
    assert th.is_operational_ride_log is True
    assert th.shows_earnings_revenue_wallet_or_tl_totals is False
    assert th.shows_daily_weekly_monthly_earnings_summaries is False
    assert get_unavailable_feature("earnings_dashboard") is not None
    assert is_forbidden_claim("earnings_dashboard_available")
    assert is_forbidden_claim("earnings_guaranteed")
    assert is_forbidden_user_term("Sürücü kazanç paneli burada")
    assert is_forbidden_user_term("Bugün şu kadar kazandın: 500 TL")


def test_vehicle_registry_truth() -> None:
    m = get_leylek_zeka_product_manifest()
    vr = m.vehicle_registry
    assert "Araçlarım" in vr.settings_path
    assert vr.car_and_motorcycle_approvals_independent is True
    assert vr.pending_type_must_not_be_resubmitted is True
    assert vr.legacy_driver_verify_route_exists is False
    assert vr.unapproved_types_cannot_become_active is True
    assert vr.missing_or_rejected_type_may_start_driver_kyc is True
    assert get_unavailable_feature("legacy_driver_verify_route") is not None
    assert is_forbidden_user_term("Aç /driver-verify sayfasını")


def test_map_and_driver_model() -> None:
    m = get_leylek_zeka_product_manifest()
    assert m.driver_model.panel_v2_map_first is True
    assert m.driver_model.map_starts_street_level_zoom is True
    assert m.driver_model.user_controls_pan_and_pinch_zoom is True
    assert m.driver_model.map_must_not_repeatedly_auto_zoom is True
    assert m.map_behavior.no_repeated_auto_zoom is True
    fact = get_supported_product_fact("driver_panel_v2_map_first")
    assert fact is not None
    assert "harita" in fact.summary.lower()


def test_legal_truth() -> None:
    m = get_leylek_zeka_product_manifest()
    legal = m.legal_documents
    assert legal.in_app_registry_are_production_documents is True
    assert legal.may_be_described_as_draft is False
    assert legal.account_deletion_exists is True
    for doc in (
        "user_terms",
        "driver_terms",
        "privacy",
        "kvkk",
        "identity_verification",
        "contribution_iban",
        "community_rules",
        "account_deletion",
    ):
        assert doc in legal.documents
    assert is_forbidden_user_term("Bu belge taslak durumundadır")
    assert not is_forbidden_user_term("Belgeler taslak değildir")
    assert is_forbidden_claim("legal_outcome_guaranteed")


def test_action_and_live_state_forbidden_claims() -> None:
    for cid in (
        "action_completed_without_success_response",
        "account_state_verified_without_api",
        "kyc_status_verified_without_api",
        "trip_state_verified_without_api",
        "driver_availability_invented",
        "eta_invented",
        "refund_outcome_invented",
        "complaint_resolution_invented",
        "approval_time_guaranteed",
    ):
        assert is_forbidden_claim(cid) is True
    assert is_forbidden_claim("not_a_real_claim") is False
    assert is_forbidden_claim("") is False
    assert get_unavailable_feature("zeka_automatic_action_completion") is not None


def test_package_purchase_unavailable() -> None:
    assert get_unavailable_feature("driver_package_purchase_iap") is not None
    assert is_forbidden_claim("package_purchase_available")
    assert is_forbidden_user_term("Paket satın al menüsünden alabilirsiniz")


def test_versioning_stable() -> None:
    m = get_leylek_zeka_product_manifest()
    assert m.schema_version == "1"
    assert m.release_version == "v2-prep.zeka-manifest.1"
    assert get_manifest_release_version() == m.release_version
    assert m.last_updated == "2026-07-10"
    assert m.schema_version.strip()
    assert m.release_version.strip()


def test_immutability_no_mutation_leakage() -> None:
    m = get_leylek_zeka_product_manifest()
    with pytest.raises(dataclasses.FrozenInstanceError):
        m.product_name = "Other"  # type: ignore[misc]
    with pytest.raises(dataclasses.FrozenInstanceError):
        m.payment_model.card_payment_available = True  # type: ignore[misc]
    m2 = get_leylek_zeka_product_manifest()
    assert m is m2
    assert m.product_name == "Leylek Yolculuk"


def test_supported_and_unavailable_lookups() -> None:
    assert get_supported_product_fact("missing") is None
    assert get_unavailable_feature("") is None
    fact = get_supported_product_fact("contribution_cash_iban")
    assert fact is not None
    assert "IBAN" in fact.summary or "iban" in fact.summary.lower()


def test_positioning_flags() -> None:
    p = get_leylek_zeka_product_manifest().product_positioning
    assert p.voluntary_ride_and_cost_sharing is True
    assert p.is_taxi_company is False
    assert p.is_transportation_operator is False
    assert p.earnings_guaranteed is False
