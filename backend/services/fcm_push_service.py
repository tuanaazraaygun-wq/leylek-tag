"""
Firebase Cloud Messaging (FCM) via firebase-admin — birincil push taşıması (Android).
FCM HTTP v1'e Admin SDK üzerinden gider; service account ile OAuth yönetilir.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Mapping, Optional, Tuple

logger = logging.getLogger(__name__)

_initialized = False

try:
    from expo_push_channels import expo_android_channel_id_for_data
except ImportError:

    def expo_android_channel_id_for_data(_data):  # type: ignore
        return "default"


def _stringify_fcm_data(data: Optional[Mapping[str, Any]]) -> Dict[str, str]:
    """FCM data: tüm değerler string olmalı (Expo ile aynı sözleşme)."""
    if not data:
        return {}
    out: Dict[str, str] = {}
    for k, v in data.items():
        if v is None:
            continue
        key = str(k)
        if isinstance(v, (dict, list)):
            out[key] = json.dumps(v, ensure_ascii=False)
        elif isinstance(v, bool):
            out[key] = "true" if v else "false"
        else:
            out[key] = str(v)
    return out


def is_probable_fcm_registration_token(token: Optional[str]) -> bool:
    """Expo token değil, makul uzunlukta native FCM registration token heuristiği."""
    if not token or not isinstance(token, str):
        return False
    t = token.strip()
    if len(t) < 32:
        return False
    if t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken["):
        return False
    # FCM registration tokens are typically URL-safe base64-ish without spaces
    if re.search(r"\s", t):
        return False
    return True


def is_fcm_configured() -> bool:
    path = (os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
    raw = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    return bool(path) or bool(raw)


def _ensure_app() -> bool:
    global _initialized
    if _initialized:
        return True
    try:
        import firebase_admin
        from firebase_admin import credentials

        path = (os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
        raw_json = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
        cred = None
        if raw_json:
            try:
                cred = credentials.Certificate(json.loads(raw_json))
            except json.JSONDecodeError as e:
                logger.warning("FCM: FIREBASE_SERVICE_ACCOUNT_JSON geçersiz JSON: %s", e)
                return False
        elif path and os.path.isfile(path):
            cred = credentials.Certificate(path)
        else:
            logger.warning(
                "FCM: credential yok — FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS "
                "veya FIREBASE_SERVICE_ACCOUNT_JSON ayarlayın."
            )
            return False
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        _initialized = True
        return True
    except Exception as e:
        logger.warning("FCM: firebase_admin init başarısız: %s", e)
        return False


def send_fcm_notification_sync(
    token: str,
    title: str,
    body: str,
    data: Optional[Mapping[str, Any]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Tek cihaza FCM gönderir. Sync (async event loop içinde asyncio.to_thread ile çağrılmalı).
    Dönüş: (ok, error_code) — error_code örn. unregistered, not_configured, send_failed
    """
    if not is_probable_fcm_registration_token(token):
        return False, "invalid_fcm_token_format"
    if not _ensure_app():
        return False, "not_configured"
    try:
        from firebase_admin import messaging

        str_data = _stringify_fcm_data(data)
        ch = expo_android_channel_id_for_data(str_data) or "default"
        msg = messaging.Message(
            token=token.strip(),
            notification=messaging.Notification(title=title or "", body=body or ""),
            data=str_data,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id=ch,
                    sound="default",
                ),
            ),
        )
        messaging.send(msg)
        return True, None
    except Exception as e:
        err_s = str(e).lower()
        if "registration-token-not-registered" in err_s or "not a valid fcm registration token" in err_s:
            logger.warning("PUSH_TOKEN_INVALIDATED transport=fcm reason=%s", e)
            return False, "unregistered"
        if "requested entity was not found" in err_s:
            logger.warning("PUSH_TOKEN_INVALIDATED transport=fcm reason=%s", e)
            return False, "unregistered"
        logger.warning("PUSH_SEND_ERROR transport=fcm err=%s", e)
        return False, "send_failed"
