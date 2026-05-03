"""
Supabase client — backend yalnızca SERVICE ROLE ile çalışır.

- create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Anon / public key bu süreçte tablo DML için kullanılmaz (RLS nedeniyle update 0 satır riski).
"""

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

_ROOT = Path(__file__).parent
# Keep env loading consistent with server.py (ops may use /etc/leylektag.env)
try:
    load_dotenv("/etc/leylektag.env", override=True)
except Exception:
    pass
load_dotenv(_ROOT / ".env", override=True)

logger = logging.getLogger(__name__)


def _strip_env(value: Optional[str]) -> str:
    return (value or "").strip()


SUPABASE_URL = _strip_env(os.getenv("SUPABASE_URL", ""))
# Öncelik: SUPABASE_SERVICE_ROLE_KEY; bazı ortamlarda SUPABASE_SERVICE_KEY kullanılıyor
SUPABASE_SERVICE_ROLE_KEY = _strip_env(
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_SERVICE_KEY", "")
)

# İki ayrı service-role instance: verify_otp kullanıcı JWT'si ile PostgREST'i kirletir (RLS).
# Tablo/storage işlemleri yalnız _db_client üzerinden; verify_otp yalnız _auth_session_client'ta.
_db_client: Optional[Client] = None
_auth_session_client: Optional[Client] = None


def init_supabase() -> bool:
    """İki ayrı service-role client: DB (RLS bypass) ve auth mint (verify_otp izole)."""
    global _db_client, _auth_session_client
    _db_client = None
    _auth_session_client = None

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error(
            "❌ Supabase: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY zorunlu. "
            "Backend'de anon key kullanılmaz; eksik anahtarla tag update/select başarısız olur."
        )
        return False

    try:
        _db_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        _auth_session_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info(
            "✅ Supabase service role: DB client + auth-session client (ayrı instance, RLS kirlenmesi yok)"
        )
        return True
    except Exception as e:
        logger.exception("❌ Supabase create_client hatası: %s", e)
        return False


def get_supabase() -> Optional[Client]:
    """PostgREST / Storage — service role; bu client üzerinde verify_otp/sign_in çağırma."""
    return _db_client


def get_supabase_auth_session_client() -> Optional[Client]:
    """Yalnız mint_supabase_session_tokens: admin + verify_otp. DB için get_supabase() kullan."""
    return _auth_session_client


def get_supabase_admin() -> Client | None:
    """Geriye uyumluluk: storage/admin işlemleri için DB service role client."""
    return _db_client


# ==================== STORAGE FUNCTIONS ====================


async def upload_file_to_storage(
    bucket: str,
    file_path: str,
    file_data: bytes,
    content_type: str = "image/jpeg",
) -> dict:
    """
    Supabase Storage'a dosya yükle (service role).
    """
    try:
        client = get_supabase_admin()
        if not client:
            return {"success": False, "error": "Supabase bağlantısı yok"}

        client.storage.from_(bucket).upload(
            path=file_path,
            file=file_data,
            file_options={"content-type": content_type, "upsert": "true"},
        )

        public_url = client.storage.from_(bucket).get_public_url(file_path)

        logger.info("📁 Dosya yüklendi: %s/%s", bucket, file_path)
        return {"success": True, "url": public_url, "path": file_path}

    except Exception as e:
        logger.error("❌ Dosya yükleme hatası: %s", e)
        return {"success": False, "error": str(e)}


async def delete_file_from_storage(bucket: str, file_path: str) -> dict:
    """Storage'dan dosya sil (service role)."""
    try:
        client = get_supabase_admin()
        if not client:
            return {"success": False, "error": "Supabase bağlantısı yok"}

        client.storage.from_(bucket).remove([file_path])
        logger.info("🗑️ Dosya silindi: %s/%s", bucket, file_path)
        return {"success": True}

    except Exception as e:
        logger.error("❌ Dosya silme hatası: %s", e)
        return {"success": False, "error": str(e)}


# ==================== REALTIME CHANNEL HELPERS ====================


def get_realtime_channel_name(channel_type: str, identifier: str) -> str:
    """Realtime channel adı oluştur."""
    return f"leylek_{channel_type}_{identifier}"


REALTIME_TABLES = {
    "locations": """
        CREATE TABLE IF NOT EXISTS locations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            heading DOUBLE PRECISION,
            speed DOUBLE PRECISION,
            trip_id TEXT,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER PUBLICATION supabase_realtime ADD TABLE locations;

        CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
        CREATE INDEX IF NOT EXISTS idx_locations_trip_id ON locations(trip_id);
    """,
    "trip_events": """
        CREATE TABLE IF NOT EXISTS trip_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            trip_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            data JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER PUBLICATION supabase_realtime ADD TABLE trip_events;

        CREATE INDEX IF NOT EXISTS idx_trip_events_trip_id ON trip_events(trip_id);
    """,
}
