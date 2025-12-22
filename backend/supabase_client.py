"""
Supabase Client for Leylek TAG Backend
Real-time ve Storage özellikleri için kullanılır
MongoDB ana database olarak kalır
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Supabase clients
supabase_client: Client = None
supabase_admin: Client = None


def init_supabase():
    """Supabase client'larını başlat"""
    global supabase_client, supabase_admin
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        logger.warning("⚠️ Supabase credentials eksik, Supabase özellikleri devre dışı")
        return False
    
    try:
        # Normal client (anon key ile)
        supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        
        # Admin client (service role ile) - Storage ve admin işlemleri için
        if SUPABASE_SERVICE_ROLE_KEY:
            supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        logger.info("✅ Supabase bağlantısı başarılı")
        return True
    except Exception as e:
        logger.error(f"❌ Supabase bağlantı hatası: {e}")
        return False


def get_supabase() -> Client:
    """Normal Supabase client'ı döndür"""
    global supabase_client
    if supabase_client is None:
        init_supabase()
    return supabase_client


def get_supabase_admin() -> Client:
    """Admin Supabase client'ı döndür (service role)"""
    global supabase_admin
    if supabase_admin is None:
        init_supabase()
    return supabase_admin


# ==================== STORAGE FUNCTIONS ====================

async def upload_file_to_storage(
    bucket: str,
    file_path: str,
    file_data: bytes,
    content_type: str = "image/jpeg"
) -> dict:
    """
    Supabase Storage'a dosya yükle
    
    Args:
        bucket: Storage bucket adı (örn: 'profile-photos', 'vehicle-photos')
        file_path: Dosya yolu (örn: 'user_123/profile.jpg')
        file_data: Dosya içeriği (bytes)
        content_type: MIME type
    
    Returns:
        {"success": True, "url": "public_url"} veya {"success": False, "error": "..."}
    """
    try:
        client = get_supabase_admin()
        if not client:
            return {"success": False, "error": "Supabase bağlantısı yok"}
        
        # Dosyayı yükle
        response = client.storage.from_(bucket).upload(
            path=file_path,
            file=file_data,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        
        # Public URL al
        public_url = client.storage.from_(bucket).get_public_url(file_path)
        
        logger.info(f"📁 Dosya yüklendi: {bucket}/{file_path}")
        return {"success": True, "url": public_url, "path": file_path}
        
    except Exception as e:
        logger.error(f"❌ Dosya yükleme hatası: {e}")
        return {"success": False, "error": str(e)}


async def delete_file_from_storage(bucket: str, file_path: str) -> dict:
    """Storage'dan dosya sil"""
    try:
        client = get_supabase_admin()
        if not client:
            return {"success": False, "error": "Supabase bağlantısı yok"}
        
        client.storage.from_(bucket).remove([file_path])
        logger.info(f"🗑️ Dosya silindi: {bucket}/{file_path}")
        return {"success": True}
        
    except Exception as e:
        logger.error(f"❌ Dosya silme hatası: {e}")
        return {"success": False, "error": str(e)}


# ==================== REALTIME CHANNEL HELPERS ====================

def get_realtime_channel_name(channel_type: str, identifier: str) -> str:
    """
    Realtime channel adı oluştur
    
    channel_type: 'trip', 'location', 'chat'
    identifier: tag_id, user_id, vs.
    """
    return f"leylek_{channel_type}_{identifier}"


# ==================== SUPABASE TABLES (Opsiyonel - Sadece real-time için) ====================
# NOT: Ana veriler hala MongoDB'de, bu tablolar sadece real-time sync için

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
        
        -- Enable realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE locations;
        
        -- Index for fast lookups
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
        
        -- Enable realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE trip_events;
        
        -- Index
        CREATE INDEX IF NOT EXISTS idx_trip_events_trip_id ON trip_events(trip_id);
    """
}


# Initialize on import
init_supabase()
