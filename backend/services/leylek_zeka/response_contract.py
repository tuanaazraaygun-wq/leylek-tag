"""
Leylek Zeka — additive grounded response metadata (deterministic, no I/O).

Builds only the new contract fields. Does not alter reply text or legacy source labels.
"""
from __future__ import annotations

from typing import Literal, TypedDict

from .product_knowledge_manifest import get_manifest_release_version
from .reply_guard import ReplyGuardResult

Confidence = Literal["high", "medium", "low", "none"]
Category = Literal[
    "product",
    "account",
    "live_trip",
    "legal_support",
    "safety",
    "unavailable",
    "general",
]
SafetyLevel = Literal["normal", "elevated", "emergency"]
ReplyOrigin = Literal[
    "answer_engine",
    "high_confidence",
    "operation_snapshot",
    "admin_kb",
    "openai",
    "keyword_fallback",
    "empty",
]

KNOWN_SUPPORT_ROUTES: frozenset[str] = frozenset(
    {
        "/driver-vehicles",
        "/trust-center",
        "/privacy",
        "/kvkk",
        "/terms-user",
        "/terms-driver",
        "/identity-verification",
        "/contribution-iban",
        "/community-guidelines",
        "/delete-account",
        "/support",
        "/history",
        "/settings-hub",
    }
)

# Deterministic topic → in-app route (only known routes).
TOPIC_SUPPORT_ROUTES: dict[str, str] = {
    "driver_vehicles": "/driver-vehicles",
    "privacy": "/privacy",
    "kvkk": "/kvkk",
    "terms_user": "/terms-user",
    "terms_driver": "/terms-driver",
    "identity_verification": "/identity-verification",
    "contribution_iban": "/contribution-iban",
    "community_guidelines": "/community-guidelines",
    "delete_account": "/delete-account",
    "trust_center": "/trust-center",
    "support": "/support",
    "history": "/history",
    "settings_hub": "/settings-hub",
}

# Existing answer-engine intent → category / safety / route hints (matching unchanged).
INTENT_CONTRACT_HINTS: dict[str, dict[str, str]] = {
    "how_matching_works": {"category": "product"},
    "who_sends_offer": {"category": "product"},
    "how_to_send_offer": {"category": "product"},
    "how_passenger_accepts_driver": {"category": "product"},
    "how_driver_accepts_request": {"category": "product"},
    "match_not_happening": {"category": "product"},
    "tag_vs_intercity_leylek_offer": {"category": "product"},
    "intercity_leylek_offer": {"category": "product"},
    "leylektag_company_info": {"category": "product"},
    "how_to_cancel_request_or_trip": {"category": "product"},
    "how_in_app_messaging_works": {"category": "product"},
    "guven_al_explained": {"category": "safety", "safety_level": "emergency"},
    "safety_and_trust_basics": {"category": "safety", "safety_level": "elevated"},
    "complaint_feedback_intake": {
        "category": "legal_support",
        "safety_level": "elevated",
        "suggested_route": "/support",
        "requires_support": "true",
    },
    # Feature-knowledge intents
    "product_identity": {"category": "product"},
    "vehicle_registry_araclarim": {
        "category": "product",
        "suggested_route": "/driver-vehicles",
    },
    "driver_panel_map_behavior": {"category": "product"},
    "card_payment_unavailable": {"category": "unavailable"},
    "contribution_payment_model": {
        "category": "product",
        "suggested_route": "/contribution-iban",
    },
    "driver_package_unavailable": {"category": "unavailable"},
    "earnings_dashboard_unavailable": {
        "category": "unavailable",
        "suggested_route": "/history",
    },
    "trip_history_operational": {
        "category": "product",
        "suggested_route": "/history",
    },
    "legal_privacy": {
        "category": "legal_support",
        "suggested_route": "/privacy",
    },
    "legal_kvkk": {
        "category": "legal_support",
        "suggested_route": "/kvkk",
    },
    "legal_terms_user": {
        "category": "legal_support",
        "suggested_route": "/terms-user",
    },
    "legal_terms_driver": {
        "category": "legal_support",
        "suggested_route": "/terms-driver",
    },
    "legal_identity_verification": {
        "category": "legal_support",
        "suggested_route": "/identity-verification",
    },
    "legal_contribution_iban": {
        "category": "legal_support",
        "suggested_route": "/contribution-iban",
    },
    "legal_community_guidelines": {
        "category": "legal_support",
        "suggested_route": "/community-guidelines",
    },
    "legal_delete_account": {
        "category": "legal_support",
        "suggested_route": "/delete-account",
        "safety_level": "elevated",
    },
    "legal_trust_center": {
        "category": "legal_support",
        "suggested_route": "/trust-center",
    },
    "support_contacts": {
        "category": "legal_support",
        "suggested_route": "/support",
        "requires_support": "true",
    },
    "unavailable_features_summary": {"category": "unavailable"},
    "account_state_unverified": {
        "category": "account",
        "requires_support": "true",
        "suggested_route": "/support",
        "blocked_claim_reason": "account_state_verified_without_api",
        "safety_level": "elevated",
    },
    "live_trip_state_unverified": {
        "category": "live_trip",
        "requires_support": "true",
        "suggested_route": "/support",
        "blocked_claim_reason": "trip_state_verified_without_api",
        "safety_level": "elevated",
    },
    # Verified personal context intents
    "verified_role": {"category": "account"},
    "verified_current_trip_state": {"category": "live_trip"},
    "verified_driver_kyc_state": {
        "category": "account",
        "suggested_route": "/driver-vehicles",
    },
    "verified_car_approval_state": {
        "category": "account",
        "suggested_route": "/driver-vehicles",
    },
    "verified_motorcycle_approval_state": {
        "category": "account",
        "suggested_route": "/driver-vehicles",
    },
    "verified_vehicle_summary": {
        "category": "account",
        "suggested_route": "/driver-vehicles",
    },
    "verified_active_vehicle_type": {
        "category": "account",
        "suggested_route": "/driver-vehicles",
    },
    "verified_driver_access_state": {"category": "account"},
}

_VERIFIED_ACCOUNT_INTENTS = frozenset(
    {
        "verified_role",
        "verified_driver_kyc_state",
        "verified_car_approval_state",
        "verified_motorcycle_approval_state",
        "verified_vehicle_summary",
        "verified_active_vehicle_type",
        "verified_driver_access_state",
    }
)
_VERIFIED_TRIP_INTENTS = frozenset({"verified_current_trip_state"})
_UNVERIFIED_REFUSAL_INTENTS = frozenset(
    {"account_state_unverified", "live_trip_state_unverified"}
)

_UNAVAILABLE_CLAIM_REASONS = frozenset(
    {
        "card_payment_available",
        "card_payment_coming_soon",
        "package_purchase_available",
        "earnings_dashboard_available",
        "earnings_guaranteed",
    }
)
_ACCOUNT_CLAIM_REASONS = frozenset(
    {
        "account_state_verified_without_api",
        "kyc_status_verified_without_api",
    }
)
_LIVE_CLAIM_REASONS = frozenset({"trip_state_verified_without_api"})
_ELEVATED_CLAIM_REASONS = frozenset(
    {
        "complaint_resolution_invented",
        "legal_outcome_guaranteed",
        "refund_outcome_invented",
    }
)


class LeylekZekaResponseMetadata(TypedDict):
    grounded: bool
    confidence: Confidence
    category: Category
    source_version: str | None
    requires_support: bool
    suggested_route: str | None
    blocked_claim_reason: str | None
    live_state_used: bool
    account_context_used: bool
    safety_level: SafetyLevel


def normalize_support_route(route: str | None) -> str | None:
    if not route:
        return None
    r = str(route).strip()
    if not r:
        return None
    if not r.startswith("/"):
        r = "/" + r
    return r if r in KNOWN_SUPPORT_ROUTES else None


def map_support_route_for_topic(topic: str) -> str | None:
    """Map a known legal/product topic id to an in-app route."""
    key = (topic or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "gizlilik": "privacy",
        "privacy_policy": "privacy",
        "user_terms": "terms_user",
        "terms": "terms_user",
        "driver_terms": "terms_driver",
        "araclarim": "driver_vehicles",
        "araçlarım": "driver_vehicles",
        "second_vehicle": "driver_vehicles",
        "vehicle_registry": "driver_vehicles",
        "iban": "contribution_iban",
        "contribution": "contribution_iban",
        "community_rules": "community_guidelines",
        "account_deletion": "delete_account",
        "hesap_sil": "delete_account",
        "legal_hub": "trust_center",
        "general_legal": "trust_center",
    }
    key = aliases.get(key, key)
    return normalize_support_route(TOPIC_SUPPORT_ROUTES.get(key))


def classify_message_topic(user_message: str) -> str | None:
    """
    Deterministic topic id from user text (no LLM).
    Used for route/category hints when intent metadata is absent.
    """
    t = (user_message or "").strip().lower()
    if not t:
        return None
    t = t.replace("İ", "i").replace("I", "i")
    # Safety / emergency first
    if any(
        p in t
        for p in (
            "güven al",
            "guven al",
            "112",
            "acil durum",
            "hemen tehlike",
            "immediate danger",
        )
    ):
        return "guven_al"
    if any(p in t for p in ("hesap sil", "hesabımı sil", "hesabimi sil", "delete account")):
        return "delete_account"
    if "kvkk" in t:
        return "kvkk"
    if any(p in t for p in ("gizlilik", "privacy")):
        return "privacy"
    if any(p in t for p in ("sürücü sözleş", "surucu sozles", "sürücü şart", "surucu sart", "driver terms")):
        return "terms_driver"
    if any(p in t for p in ("kullanıcı sözleş", "kullanici sozles", "kullanıcı şart", "terms-user", "user terms")):
        return "terms_user"
    if any(p in t for p in ("kimlik doğrula", "kimlik dogrula", "identity verification")):
        return "identity_verification"
    if any(p in t for p in ("iban", "katkı", "katki", "contribution")):
        return "contribution_iban"
    if any(p in t for p in ("topluluk kural", "community guideline", "community rules")):
        return "community_guidelines"
    if any(
        p in t
        for p in (
            "araçlarım",
            "araclarim",
            "ikinci araç",
            "ikinci arac",
            "araç kayıt",
            "arac kayit",
            "vehicle registry",
        )
    ):
        return "driver_vehicles"
    if any(p in t for p in ("güven merkezi", "guven merkezi", "trust center", "yasal", "hukuk")):
        return "trust_center"
    if any(p in t for p in ("geçmiş", "gecmis", "yolculuk geçmiş", "history")):
        return "history"
    if any(
        p in t
        for p in (
            "kart ödeme",
            "kart odeme",
            "kredi kart",
            "paket satın",
            "paket satin",
            "kazanç panel",
            "kazanc panel",
        )
    ):
        return "unavailable_feature"
    if any(p in t for p in ("kyc", "hesap durum", "onay durum", "doğrulama durum", "dogrulama durum")):
        return "account_state"
    if any(
        p in t
        for p in (
            "aktif yolculuk",
            "şu anki eşleş",
            "su anki esles",
            "mevcut yolculuk",
            "trip state",
            "yolculuk durum",
        )
    ):
        return "live_trip_state"
    return None


def category_for_topic(topic: str | None) -> Category | None:
    if not topic:
        return None
    if topic in ("guven_al",):
        return "safety"
    if topic in ("account_state",):
        return "account"
    if topic in ("live_trip_state",):
        return "live_trip"
    if topic in ("unavailable_feature",):
        return "unavailable"
    if topic in (
        "privacy",
        "kvkk",
        "terms_user",
        "terms_driver",
        "identity_verification",
        "contribution_iban",
        "community_guidelines",
        "delete_account",
        "trust_center",
    ):
        return "legal_support"
    if topic in ("driver_vehicles", "history"):
        return "product"
    return None


def _hints_for_blocked_reason(reason: str | None) -> tuple[Category, bool, str | None, SafetyLevel]:
    if not reason:
        return "general", False, None, "normal"
    if reason in _UNAVAILABLE_CLAIM_REASONS:
        return "unavailable", False, None, "normal"
    if reason in _ACCOUNT_CLAIM_REASONS:
        return "account", True, "/support", "elevated"
    if reason in _LIVE_CLAIM_REASONS:
        return "live_trip", True, "/support", "elevated"
    if reason in _ELEVATED_CLAIM_REASONS:
        return "legal_support", True, "/support", "elevated"
    # Brand / host / other term labels
    lower = reason.lower()
    if any(x in lower for x in ("leylektag", "leylek tag", "api.leylektag", "tag")):
        return "product", False, None, "normal"
    return "general", False, None, "normal"


def build_leylek_zeka_response_metadata(
    *,
    source: str,
    origin: ReplyOrigin,
    intent_id: str | None = None,
    deterministic: bool = False,
    guard: ReplyGuardResult | None = None,
    live_state_used: bool = False,
    account_context_used: bool = False,
    source_version_override: str | None = None,
    manifest_backed_keyword: bool = False,
    user_message: str | None = None,
    category_override: Category | None = None,
    suggested_route_override: str | None = None,
    requires_support_override: bool | None = None,
    safety_level_override: SafetyLevel | None = None,
    blocked_claim_reason_override: str | None = None,
) -> LeylekZekaResponseMetadata:
    """
    Pure deterministic metadata builder for additive Leylek Zeka response fields.
    Frontend hints must not set live_state_used / account_context_used — callers pass verified flags only.
    """
    manifest_ver = get_manifest_release_version()
    topic = classify_message_topic(user_message or "")

    grounded = False
    confidence: Confidence = "none"
    category: Category = "general"
    source_version: str | None = None
    requires_support = False
    suggested_route: str | None = None
    blocked_claim_reason: str | None = None
    safety_level: SafetyLevel = "normal"
    live_used = bool(live_state_used)
    account_used = bool(account_context_used)

    if origin == "answer_engine":
        grounded = True
        confidence = "high"
        source_version = manifest_ver
        category = "product"
        hints = INTENT_CONTRACT_HINTS.get(intent_id or "") or {}
        if hints.get("category") in (
            "product",
            "account",
            "live_trip",
            "legal_support",
            "safety",
            "unavailable",
            "general",
        ):
            category = hints["category"]  # type: ignore[assignment]
        if hints.get("safety_level") in ("normal", "elevated", "emergency"):
            safety_level = hints["safety_level"]  # type: ignore[assignment]
        if hints.get("suggested_route"):
            suggested_route = normalize_support_route(hints["suggested_route"])
        if hints.get("requires_support") == "true":
            requires_support = True
        if hints.get("blocked_claim_reason"):
            blocked_claim_reason = hints["blocked_claim_reason"]
        # Fail-closed refusals must not claim verified context was used.
        if intent_id in _UNVERIFIED_REFUSAL_INTENTS:
            account_used = False
            if intent_id == "live_trip_state_unverified":
                live_used = False
        elif intent_id in _VERIFIED_ACCOUNT_INTENTS:
            account_used = bool(account_context_used)
            if source_version_override:
                source_version = source_version_override.strip() or source_version
        elif intent_id in _VERIFIED_TRIP_INTENTS:
            live_used = bool(live_state_used)
            account_used = bool(account_context_used)
            if source_version_override:
                source_version = source_version_override.strip() or source_version
        elif category == "account":
            account_used = False
    elif origin == "high_confidence":
        grounded = True
        confidence = "high"
        source_version = manifest_ver
        category = "product"
    elif origin == "operation_snapshot":
        grounded = True
        confidence = "high"
        category = "live_trip"
        live_used = True
        # Ops demand/availability is live ops data — not account/KYC/vehicle context.
        account_used = False
        source_version = (source_version_override or "").strip() or manifest_ver
    elif origin == "admin_kb":
        grounded = True
        confidence = "medium"
        source_version = (source_version_override or "").strip() or manifest_ver
        category = "product"
        topic_cat = category_for_topic(topic)
        if topic_cat in ("legal_support", "product"):
            category = topic_cat
    elif origin == "openai":
        grounded = False
        confidence = "low"
        source_version = None
        live_used = False
        account_used = False
        category = category_for_topic(topic) or "general"
    elif origin in ("keyword_fallback", "empty"):
        if manifest_backed_keyword:
            grounded = True
            confidence = "medium"
            source_version = manifest_ver
            category = category_for_topic(topic) or "product"
        else:
            grounded = False
            confidence = "low" if origin == "keyword_fallback" else "none"
            source_version = None
            category = category_for_topic(topic) or "general"
    else:
        grounded = False
        confidence = "low"
        source_version = None

    # Topic-based route hints; category only when origin has no stronger intent mapping
    if topic:
        if suggested_route is None:
            route = map_support_route_for_topic(topic)
            if route:
                suggested_route = route
        if origin not in ("operation_snapshot", "high_confidence", "answer_engine"):
            if topic == "guven_al":
                category = "safety"
                safety_level = "emergency"
            elif topic == "unavailable_feature":
                category = "unavailable"
            elif topic == "account_state":
                category = "account"
            elif topic == "live_trip_state":
                category = "live_trip"
            elif topic == "delete_account":
                safety_level = "elevated"
                category = "legal_support"
            else:
                topic_cat = category_for_topic(topic)
                if topic_cat:
                    category = topic_cat
        elif origin == "answer_engine" and topic == "guven_al":
            category = "safety"
            safety_level = "emergency"

    # Guard / policy refusal overlay (fail-closed reply keeps source label; metadata reflects refusal)
    if guard is not None and guard.blocked:
        grounded = True
        confidence = "high"
        blocked_claim_reason = guard.blocked_claim_reason
        g_cat, g_support, g_route, g_safety = _hints_for_blocked_reason(guard.blocked_claim_reason)
        category = guard.category_hint or g_cat
        requires_support = bool(guard.requires_support or g_support)
        suggested_route = normalize_support_route(
            guard.suggested_route or g_route or ("/support" if requires_support else None)
        )
        safety_level = guard.safety_level_hint or g_safety
        if requires_support and not suggested_route:
            suggested_route = "/support"
        # Refusal itself is manifest-backed policy text
        if source_version is None:
            source_version = manifest_ver
        if category == "account":
            account_used = False
        if category == "live_trip":
            live_used = False

    if category_override is not None:
        category = category_override
    if suggested_route_override is not None:
        suggested_route = normalize_support_route(suggested_route_override)
    if requires_support_override is not None:
        requires_support = requires_support_override
        if requires_support and not suggested_route:
            suggested_route = "/support"
    if safety_level_override is not None:
        safety_level = safety_level_override
    if blocked_claim_reason_override is not None:
        blocked_claim_reason = blocked_claim_reason_override

    # Never invent routes
    suggested_route = normalize_support_route(suggested_route)

    # source arg kept for future mapping; origin drives classification today
    _ = (source, deterministic)

    return LeylekZekaResponseMetadata(
        grounded=grounded,
        confidence=confidence,
        category=category,
        source_version=source_version,
        requires_support=requires_support,
        suggested_route=suggested_route,
        blocked_claim_reason=blocked_claim_reason,
        live_state_used=live_used,
        account_context_used=account_used,
        safety_level=safety_level,
    )
