"""
Firebase Cloud Messaging (FCM) via firebase-admin — birincil push taşıması (Android).
FCM HTTP v1'e Admin SDK üzerinden gider; service account ile OAuth yönetilir.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
from typing import Any, Dict, Mapping, Optional, Tuple

logger = logging.getLogger(__name__)

_init_lock = threading.Lock()
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


def _mask_token(token: str) -> str:
    t = token.strip()
    if len(t) <= 12:
        return "***"
    return f"{t[:8]}...{t[-4:]}"


def _required_sa_fields_present(info: Mapping[str, Any]) -> bool:
    return bool(info.get("project_id") and info.get("private_key") and info.get("client_email"))


def _load_service_account_info() -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Service account JSON'u env veya dosyadan okur ve doğrular.
    Dönüş: (info_dict, error_reason) — başarıda error_reason None.
    """
    raw_json = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    if raw_json:
        try:
            info = json.loads(raw_json)
        except json.JSONDecodeError as e:
            return None, f"FIREBASE_SERVICE_ACCOUNT_JSON invalid_json: {e}"
        if not isinstance(info, dict):
            return None, "FIREBASE_SERVICE_ACCOUNT_JSON not_object"
        if not _required_sa_fields_present(info):
            return None, "FIREBASE_SERVICE_ACCOUNT_JSON missing_required_fields"
        return dict(info), None

    path = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        or ""
    ).strip()
    if not path:
        return None, "no_credentials_env"
    if not os.path.isfile(path):
        return None, "service_account_file_not_found"
    try:
        with open(path, encoding="utf-8") as fh:
            info = json.load(fh)
    except OSError as e:
        return None, f"service_account_file_unreadable: {e}"
    except json.JSONDecodeError as e:
        return None, f"service_account_file_invalid_json: {e}"
    if not isinstance(info, dict):
        return None, "service_account_file_not_object"
    if not _required_sa_fields_present(info):
        return None, "service_account_file_missing_required_fields"
    return dict(info), None


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
    info, _err = _load_service_account_info()
    return info is not None


def _is_auth_credential_error(err_s: str) -> bool:
    needles = (
        "missing required authentication credential",
        "invalid authentication credentials",
        "could not load the default credentials",
        "application default credentials",
        "unauthenticated",
        "401 unauthorized",
        "403 forbidden",
        "permission denied",
        "invalid_grant",
        "account not found",
    )
    return any(n in err_s for n in needles)


def _ensure_app_unlocked() -> bool:
    """firebase_admin init — _init_lock altında çağrılmalı."""
    global _initialized
    if _initialized:
        return True
    try:
        import firebase_admin
        from firebase_admin import credentials

        info, err = _load_service_account_info()
        if not info:
            logger.warning("FCM: credential okunamadı — %s", err or "unknown")
            return False

        cred = credentials.Certificate(info)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        project_id = str(info.get("project_id") or "").strip()
        if project_id:
            logger.info("FCM: firebase_admin initialized project_id=%s", project_id)
        else:
            logger.info("FCM: firebase_admin initialized project_id=unknown")
        _initialized = True
        return True
    except Exception as e:
        logger.warning("FCM: firebase_admin init başarısız: %s", e)
        return False


def _ensure_app() -> bool:
    with _init_lock:
        return _ensure_app_unlocked()


def send_fcm_notification_sync(
    token: str,
    title: str,
    body: str,
    data: Optional[Mapping[str, Any]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Tek cihaza FCM gönderir. Sync (async event loop içinde asyncio.to_thread ile çağrılmalı).
    Dönüş: (ok, error_code) — error_code örn. unregistered, not_configured, auth_failed, send_failed
    """
    if not is_probable_fcm_registration_token(token):
        return False, "invalid_fcm_token_format"
    token_clean = token.strip()
    masked = _mask_token(token_clean)

    with _init_lock:
        if not _ensure_app_unlocked():
            return False, "not_configured"
        try:
            from firebase_admin import messaging

            str_data = _stringify_fcm_data(data)
            ch = expo_android_channel_id_for_data(str_data) or "default"
            msg = messaging.Message(
                token=token_clean,
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
                logger.warning(
                    "PUSH_TOKEN_INVALIDATED transport=fcm reason=%s token=%s",
                    e,
                    masked,
                )
                return False, "unregistered"
            if "requested entity was not found" in err_s:
                logger.warning(
                    "PUSH_TOKEN_INVALIDATED transport=fcm reason=%s token=%s",
                    e,
                    masked,
                )
                return False, "unregistered"
            if _is_auth_credential_error(err_s):
                logger.error(
                    "PUSH_SEND_ERROR transport=fcm err_class=auth_credential err=%s token=%s",
                    e,
                    masked,
                )
                return False, "auth_failed"
            logger.warning(
                "PUSH_SEND_ERROR transport=fcm err_class=send_failed err=%s token=%s",
                e,
                masked,
            )
            return False, "send_failed"
