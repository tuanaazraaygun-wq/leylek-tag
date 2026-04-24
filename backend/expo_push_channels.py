"""
Expo Android: channelId, data.type ile eşlenir (uygulama _layout'ta kanalları oluşturur).
"""
from typing import Any, Mapping, Optional

EXPO_OFFERS_CHANNEL_TYPES = frozenset(
    {
        "new_offer",
        "match_found",
        "match_confirmed",
        "kyc_approved",
        "kyc_rejected",
        "new_ride_request",
        "matched",
        "driver_on_the_way",
        "driver_arrived",
        "trip_started",
        "trip_completed",
        "driver_accepted",
        "ride_completed",
    }
)

# Leylek Muhabbeti — uygulama Android’de `match` kanalını oluşturur (usePushNotifications)
EXPO_MUHABBET_CHANNEL_TYPES = frozenset(
    {
        "muhabbet_message",
        "leylek_pair_match_request",
        "leylek_key_match_completed",
    }
)

# Gelen arama vb. — uygulama usePushNotifications + _layout ile `calls` kanalını oluşturur
EXPO_CALLS_CHANNEL_TYPES = frozenset(
    {
        "incoming_call",
        "missed_call",
        "call_ended",
        "call_missed",
    }
)


def expo_android_channel_id_for_type(notification_type: Optional[Any]) -> str:
    if notification_type is None:
        return "default"
    s = str(notification_type).strip()
    # Uygulama yönlendirme payload'ı (client: chat | match | offer)
    if s == "chat":
        return "default"
    if s in ("match", "offer"):
        return "offers"
    if s in EXPO_CALLS_CHANNEL_TYPES:
        return "calls"
    if s in EXPO_MUHABBET_CHANNEL_TYPES:
        return "match"
    if s in EXPO_OFFERS_CHANNEL_TYPES:
        return "offers"
    return "default"


def expo_android_channel_id_for_data(data: Optional[Mapping[str, Any]]) -> str:
    if not data:
        return "default"
    return expo_android_channel_id_for_type(data.get("type"))
