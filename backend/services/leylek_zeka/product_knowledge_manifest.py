"""
Leylek Zeka — versioned product truth manifest (SSOT).

Deterministic Python data only. No DB, env mutation, network, or LLM wiring.
Later patches may consume this for prompts, catalog, admin KB validation, and guards.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from types import MappingProxyType
from typing import Literal, Mapping

# ---------------------------------------------------------------------------
# Nested immutable sections
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProductPositioning:
    summary: str
    voluntary_ride_and_cost_sharing: bool
    is_taxi_company: bool
    is_transportation_operator: bool
    earnings_guaranteed: bool


@dataclass(frozen=True)
class PaymentModel:
    summary: str
    per_ride_contribution_may_be_agreed: bool
    cash_iban_contribution_confirmation_may_exist: bool
    platform_collects_in_app_card_payment: bool
    card_payment_available: bool
    card_payment_coming_soon_allowed: bool


@dataclass(frozen=True)
class DriverModel:
    summary: str
    panel_v2_map_first: bool
    map_starts_street_level_zoom: bool
    user_controls_pan_and_pinch_zoom: bool
    map_must_not_repeatedly_auto_zoom: bool
    earnings_dashboard_exists: bool


@dataclass(frozen=True)
class VehicleRegistry:
    summary: str
    settings_path: str
    car_and_motorcycle_approvals_independent: bool
    missing_or_rejected_type_may_start_driver_kyc: bool
    pending_type_must_not_be_resubmitted: bool
    legacy_driver_verify_route_exists: bool
    unapproved_types_cannot_become_active: bool


@dataclass(frozen=True)
class MapBehavior:
    summary: str
    driver_panel_map_first: bool
    street_level_initial_zoom: bool
    user_controlled_pan_pinch: bool
    no_repeated_auto_zoom: bool


@dataclass(frozen=True)
class TripHistoryPolicy:
    summary: str
    is_operational_ride_log: bool
    shows_earnings_revenue_wallet_or_tl_totals: bool
    shows_daily_weekly_monthly_earnings_summaries: bool


@dataclass(frozen=True)
class LegalDocuments:
    summary: str
    in_app_registry_are_production_documents: bool
    may_be_described_as_draft: bool
    account_deletion_exists: bool
    documents: tuple[str, ...]


@dataclass(frozen=True)
class UnavailableFeature:
    id: str
    summary: str


@dataclass(frozen=True)
class SupportedFeatureFact:
    id: str
    summary: str


@dataclass(frozen=True)
class LeylekZekaProductKnowledgeManifest:
    """Immutable product truth contract for Leylek Zeka."""

    schema_version: str
    release_version: str
    last_updated: str
    product_name: str
    company_name: str
    assistant_name: str
    live_api_host: str
    public_product_url: str
    public_privacy_url: str
    public_terms_url: str
    public_kvkk_url: str
    public_account_deletion_url: str
    support_email: str
    support_phone: str
    product_positioning: ProductPositioning
    payment_model: PaymentModel
    driver_model: DriverModel
    vehicle_registry: VehicleRegistry
    map_behavior: MapBehavior
    trip_history_policy: TripHistoryPolicy
    legal_documents: LegalDocuments
    unavailable_features: tuple[UnavailableFeature, ...]
    forbidden_user_terms: tuple[str, ...]
    forbidden_claims: tuple[str, ...]
    supported_feature_facts: tuple[SupportedFeatureFact, ...]


SurfaceKind = Literal["user_reply", "technical"]

# ---------------------------------------------------------------------------
# Canonical constants (immutable)
# ---------------------------------------------------------------------------

_SCHEMA_VERSION = "1"
_RELEASE_VERSION = "v2-prep.zeka-manifest.1"
_LAST_UPDATED = "2026-07-10"

_FORBIDDEN_USER_TERMS: tuple[str, ...] = (
    "LeylekTAG",
    "Leylek TAG",
    "TAG",  # standalone product nickname — detected via word-boundary helper
    "api.leylektag.com",
    "leylektag.com",  # as recommended public/legal host (not path segment)
    "driver-verify",
    "sürücü kazanç paneli",
    "bugün şu kadar kazandın",
    "kart ödeme yakında",
    "paket satın al",
    "taslak",  # legal documents described as draft
)

_FORBIDDEN_CLAIMS: tuple[str, ...] = (
    "card_payment_available",
    "card_payment_coming_soon",
    "package_purchase_available",
    "earnings_dashboard_available",
    "earnings_guaranteed",
    "account_state_verified_without_api",
    "kyc_status_verified_without_api",
    "trip_state_verified_without_api",
    "action_completed_without_success_response",
    "approval_time_guaranteed",
    "driver_availability_invented",
    "eta_invented",
    "refund_outcome_invented",
    "complaint_resolution_invented",
    "legal_outcome_guaranteed",
)

_UNAVAILABLE_FEATURES: tuple[UnavailableFeature, ...] = (
    UnavailableFeature(
        id="in_app_card_payment",
        summary="Uygulama içi kart tahsilatı yoktur; kartla ödeme yapılamaz.",
    ),
    UnavailableFeature(
        id="driver_package_purchase_iap",
        summary="Sürücü paketi için uygulama içi ödeme (IAP) mevcut değildir.",
    ),
    UnavailableFeature(
        id="earnings_dashboard",
        summary="Ayrı bir sürücü gelir özeti veya kazanç ekranı yoktur.",
    ),
    UnavailableFeature(
        id="legacy_driver_verify_route",
        summary="Eski sürücü doğrulama rotası kaldırılmıştır; kullanılmaz.",
    ),
    UnavailableFeature(
        id="zeka_automatic_action_completion",
        summary="Leylek Zeka, API başarı yanıtı olmadan işlem tamamlandı iddiasında bulunamaz.",
    ),
)

_SUPPORTED_FEATURE_FACTS: tuple[SupportedFeatureFact, ...] = (
    SupportedFeatureFact(
        id="product_identity",
        summary="Tüketici ürün adı Leylek Yolculuk; asistan Leylek Zeka; şirket Karekod Teknoloji ve Yazılım A.Ş.",
    ),
    SupportedFeatureFact(
        id="live_api_host",
        summary="Canlı API https://api.karekodteknoloji.com adresindedir; eski host önerilmez.",
    ),
    SupportedFeatureFact(
        id="contribution_cash_iban",
        summary="Yolculuk başına katkı tutarı kararlaştırılabilir; nakit veya IBAN katkı onayı olabilir.",
    ),
    SupportedFeatureFact(
        id="driver_panel_v2_map_first",
        summary="Sürücü Paneli V2 harita önceliklidir; sokak seviyesi zoom; pan/pinch kullanıcıda; tekrarlayan otomatik zoom yok.",
    ),
    SupportedFeatureFact(
        id="driver_map_camera_control",
        summary=(
            "GPS güncellemesi işaretçi/veriyi taşır; kamera pan ve pinch kullanıcı kontrolündedir. "
            "Yeniden ortala sokak seviyesi merkeze döner. Normal eşleşmede kamera kullanıcıda kalır; "
            "aktif adım adım navigasyonda dinamik heading/zoom olabilir. Harita her zaman otomatik takip etmez."
        ),
    ),
    SupportedFeatureFact(
        id="vehicle_registry_araclarim",
        summary="Araç kaydı Ayarlar → Araçlarım altındadır; otomobil ve motosiklet onayları bağımsızdır.",
    ),
    SupportedFeatureFact(
        id="vehicle_kyc_pending_no_resubmit",
        summary="Eksik/reddedilen araç tipi DriverKYCScreen başlatabilir; bekleyen tip yeniden gönderilmez.",
    ),
    SupportedFeatureFact(
        id="trip_history_operational_log",
        summary="Yolculuk geçmişi operasyonel kayıttır; kazanç, cüzdan veya TL toplamı göstermez.",
    ),
    SupportedFeatureFact(
        id="legal_registry_production",
        summary="Uygulama içi yasal kayıt belgeleri üretim belgeleridir; taslak değildir; hesap silme mevcuttur.",
    ),
    SupportedFeatureFact(
        id="support_contacts",
        summary="Destek: info@karekodteknoloji.com ve 0850 307 80 29.",
    ),
    SupportedFeatureFact(
        id="positioning_not_taxi",
        summary="Gönüllü yolculuk ve masraf paylaşımı platformudur; taksi şirketi veya taşıma işletmecisi değildir; kazanç garantisi yoktur.",
    ),
)

_MANIFEST = LeylekZekaProductKnowledgeManifest(
    schema_version=_SCHEMA_VERSION,
    release_version=_RELEASE_VERSION,
    last_updated=_LAST_UPDATED,
    product_name="Leylek Yolculuk",
    company_name="Karekod Teknoloji ve Yazılım A.Ş.",
    assistant_name="Leylek Zeka",
    live_api_host="https://api.karekodteknoloji.com",
    public_product_url="https://karekodteknoloji.com/urunler/leylektag",
    public_privacy_url="https://karekodteknoloji.com/gizlilik-politikasi",
    public_terms_url="https://karekodteknoloji.com/kullanim-sartlari",
    public_kvkk_url="https://karekodteknoloji.com/kvkk",
    public_account_deletion_url="https://karekodteknoloji.com/hesap-silme",
    support_email="info@karekodteknoloji.com",
    support_phone="0850 307 80 29",
    product_positioning=ProductPositioning(
        summary=(
            "Gönüllü yolculuk ve masraf paylaşımı platformu. "
            "Taksi şirketi veya taşıma işletmecisi değildir; kazanç garantisi vermez."
        ),
        voluntary_ride_and_cost_sharing=True,
        is_taxi_company=False,
        is_transportation_operator=False,
        earnings_guaranteed=False,
    ),
    payment_model=PaymentModel(
        summary=(
            "Yolculuk başına katkı tutarı kararlaştırılabilir; nakit veya IBAN katkı onayı olabilir. "
            "Platform uygulama içi kart ödemesi tahsil etmez; kart ödeme yoktur ve "
            "onaylı ürün bayrağı olmadan 'yakında' denmez."
        ),
        per_ride_contribution_may_be_agreed=True,
        cash_iban_contribution_confirmation_may_exist=True,
        platform_collects_in_app_card_payment=False,
        card_payment_available=False,
        card_payment_coming_soon_allowed=False,
    ),
    driver_model=DriverModel(
        summary=(
            "Sürücü Paneli V2 harita önceliklidir; harita sokak seviyesi zoom ile açılır; "
            "pan ve pinch kullanıcı kontrolündedir; tekrarlayan otomatik zoom olmamalıdır. "
            "Sürücü kazanç paneli yoktur."
        ),
        panel_v2_map_first=True,
        map_starts_street_level_zoom=True,
        user_controls_pan_and_pinch_zoom=True,
        map_must_not_repeatedly_auto_zoom=True,
        earnings_dashboard_exists=False,
    ),
    vehicle_registry=VehicleRegistry(
        summary=(
            "Araç kaydı Ayarlar → Araçlarım altındadır. Otomobil ve motosiklet onayları bağımsızdır. "
            "Eksik veya reddedilen tip DriverKYCScreen başlatabilir; bekleyen tip yeniden gönderilmez. "
            "Eski /driver-verify rotası yoktur; onaylanmamış tip aktif olamaz."
        ),
        settings_path="Settings → Araçlarım",
        car_and_motorcycle_approvals_independent=True,
        missing_or_rejected_type_may_start_driver_kyc=True,
        pending_type_must_not_be_resubmitted=True,
        legacy_driver_verify_route_exists=False,
        unapproved_types_cannot_become_active=True,
    ),
    map_behavior=MapBehavior(
        summary=(
            "Sürücü paneli harita öncelikli; başlangıç zoom sokak seviyesi; "
            "pan/pinch kullanıcıda; tekrarlayan otomatik zoom yok."
        ),
        driver_panel_map_first=True,
        street_level_initial_zoom=True,
        user_controlled_pan_pinch=True,
        no_repeated_auto_zoom=True,
    ),
    trip_history_policy=TripHistoryPolicy(
        summary=(
            "Yolculuk geçmişi operasyonel yolculuk kaydıdır. "
            "Kazanç, gelir, cüzdan veya TL toplamı göstermez; "
            "günlük/haftalık/aylık kazanç özeti yoktur."
        ),
        is_operational_ride_log=True,
        shows_earnings_revenue_wallet_or_tl_totals=False,
        shows_daily_weekly_monthly_earnings_summaries=False,
    ),
    legal_documents=LegalDocuments(
        summary=(
            "Uygulama içi yasal kayıt belgeleri üretim belgeleridir; taslak değildir. "
            "Hesap silme mevcuttur. Kullanıcı şartları, sürücü şartları, gizlilik, KVKK, "
            "kimlik doğrulama, katkı/IBAN ve topluluk kuralları vardır."
        ),
        in_app_registry_are_production_documents=True,
        may_be_described_as_draft=False,
        account_deletion_exists=True,
        documents=(
            "user_terms",
            "driver_terms",
            "privacy",
            "kvkk",
            "identity_verification",
            "contribution_iban",
            "community_rules",
            "account_deletion",
        ),
    ),
    unavailable_features=_UNAVAILABLE_FEATURES,
    forbidden_user_terms=_FORBIDDEN_USER_TERMS,
    forbidden_claims=_FORBIDDEN_CLAIMS,
    supported_feature_facts=_SUPPORTED_FEATURE_FACTS,
)

_FORBIDDEN_CLAIM_SET: frozenset[str] = frozenset(_FORBIDDEN_CLAIMS)

_UNAVAILABLE_BY_ID: Mapping[str, UnavailableFeature] = MappingProxyType(
    {f.id: f for f in _UNAVAILABLE_FEATURES}
)

_SUPPORTED_FACT_BY_ID: Mapping[str, SupportedFeatureFact] = MappingProxyType(
    {f.id: f for f in _SUPPORTED_FEATURE_FACTS}
)

# Phrase detectors (user_reply). Longer / more specific first.
_PHRASE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "Leylek TAG",
        re.compile(r"leylek\s+tag", re.IGNORECASE),
    ),
    (
        "LeylekTAG",
        # Product brand compact form — not package id, scheme, or *.leylektag.com host.
        # Not URL path segment (.../leylektag) via lookbehind on '/'.
        re.compile(
            r"(?<![a-z0-9./])leylektag(?!\.app\b)(?!\.com\b)(?!://)",
            re.IGNORECASE,
        ),
    ),
    (
        "api.leylektag.com",
        re.compile(r"\bapi\.leylektag\.com\b", re.IGNORECASE),
    ),
    (
        "leylektag.com",
        # Host only — not karekodteknoloji.com/.../leylektag path segment.
        re.compile(
            r"(?<![a-z0-9-])(?:https?://)?(?:www\.)?leylektag\.com\b",
            re.IGNORECASE,
        ),
    ),
    (
        "driver-verify",
        re.compile(r"(?<![a-z0-9])/?driver-verify(?![a-z0-9])", re.IGNORECASE),
    ),
    (
        "sürücü kazanç paneli",
        re.compile(r"s[uü]r[uü]c[uü]\s+kazan[cç]\s+paneli", re.IGNORECASE),
    ),
    (
        "bugün şu kadar kazandın",
        re.compile(
            r"bug[uü]n\s+.+\s+kazand[iı]n|bug[uü]n\s+[sş]u\s+kadar\s+kazand",
            re.IGNORECASE,
        ),
    ),
    (
        "kart ödeme yakında",
        re.compile(r"kart\s+[oö]deme\s+yak[iı]nda", re.IGNORECASE),
    ),
    (
        "paket satın al",
        re.compile(r"paket\s+sat[iı]n\s+al", re.IGNORECASE),
    ),
    (
        "taslak",
        # Legal draft wording — whole word; allow "taslak değil(dir)".
        re.compile(r"\btaslak\b(?!\s+de[gğ]il)", re.IGNORECASE),
    ),
)

# Standalone product "TAG" — word boundary; not inside leylektag / package ids.
_STANDALONE_TAG_RE = re.compile(r"(?<![a-z0-9_])TAG(?![a-z0-9_])", re.IGNORECASE)

_BRAND_HOST_LABELS = frozenset(
    {"Leylek TAG", "LeylekTAG", "api.leylektag.com", "leylektag.com", "TAG"}
)


def _fold_for_match(text: str) -> str:
    """NFKC normalize; preserve Turkish letters for phrase regexes that use character classes."""
    return unicodedata.normalize("NFKC", text or "")


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def get_leylek_zeka_product_manifest() -> LeylekZekaProductKnowledgeManifest:
    """Return the canonical immutable manifest (frozen dataclass singleton)."""
    return _MANIFEST


def get_manifest_release_version() -> str:
    return _MANIFEST.release_version


def find_forbidden_user_terms(
    text: str,
    *,
    surface: SurfaceKind = "user_reply",
) -> tuple[str, ...]:
    """
    Return forbidden terminology labels found in text (stable order).

    surface="user_reply": full brand / host / claim-phrase scan for assistant answers.
    surface="technical": skip brand/host detectors so package ids, deep links,
    Firebase names, and table names (e.g. tags) are not falsely rejected.
    """
    raw = _fold_for_match(text)
    if not raw.strip():
        return ()

    hits: list[str] = []
    seen: set[str] = set()

    for label, pattern in _PHRASE_PATTERNS:
        if surface == "technical" and label in _BRAND_HOST_LABELS:
            continue
        if pattern.search(raw) and label not in seen:
            hits.append(label)
            seen.add(label)

    if surface == "user_reply":
        scrubbed = raw
        scrubbed = re.sub(r"(?i)leylek\s+tag", " ", scrubbed)
        scrubbed = re.sub(r"(?i)leylektag", " ", scrubbed)
        scrubbed = re.sub(r"(?i)api\.leylektag\.com", " ", scrubbed)
        scrubbed = re.sub(r"(?i)(?:https?://)?(?:www\.)?leylektag\.com", " ", scrubbed)
        if _STANDALONE_TAG_RE.search(scrubbed) and "TAG" not in seen:
            hits.append("TAG")
            seen.add("TAG")

    return tuple(hits)


def is_forbidden_user_term(
    text: str,
    *,
    surface: SurfaceKind = "user_reply",
) -> bool:
    return bool(find_forbidden_user_terms(text, surface=surface))


def is_forbidden_claim(claim_id: str) -> bool:
    cid = (claim_id or "").strip()
    if not cid:
        return False
    return cid in _FORBIDDEN_CLAIM_SET


def get_supported_product_fact(fact_id: str) -> SupportedFeatureFact | None:
    fid = (fact_id or "").strip()
    if not fid:
        return None
    return _SUPPORTED_FACT_BY_ID.get(fid)


def get_unavailable_feature(feature_id: str) -> UnavailableFeature | None:
    fid = (feature_id or "").strip()
    if not fid:
        return None
    return _UNAVAILABLE_BY_ID.get(fid)
