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
load_dotenv(_ROOT / ".env")

logger = logging.getLogger(__name__)


def _strip_env(value: Optional[str]) -> str:
    return (value or "").strip()


SUPABASE_URL = _strip_env(os.getenv("SUPABASE_URL", ""))
# Öncelik: SUPABASE_SERVICE_ROLE_KEY; bazı ortamlarda SUPABASE_SERVICE_KEY kullanılıyor
SUPABASE_SERVICE_ROLE_KEY = _strip_env(
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_SERVICE_KEY", "")
)

# Tek backend client (service role)
_backend_client: Optional[Client] = None


def init_supabase() -> bool:
    """Service role ile tek client oluşturur. Anon key ile client açılmaz."""
    global _backend_client
    _backend_client = None

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error(
            "❌ Supabase: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY zorunlu. "
            "Backend'de anon key kullanılmaz; eksik anahtarla tag update/select başarısız olur."
        )
        return False

    try:
        _backend_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("✅ Supabase service role client hazır (create_client URL + SERVICE_ROLE_KEY)")
        return True
    except Exception as e:
        logger.exception("❌ Supabase create_client hatası: %s", e)
        return False


def get_supabase() -> Optional[Client]:
    """Sunucu tarafı DML için tek client (service role)."""
    return _backend_client


def get_supabase_admin() -> Client | None:
    """Geriye uyumluluk: storage/admin işlemleri için aynı service role client."""
    return _backend_client


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
