"""
Route Service - Rota Hesaplama ve Cache
OSRM API ile rota hesaplama, Redis + bellek fallback (Faz 1, REDIS_CACHE)
"""

import asyncio
import math
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
import logging

from redis_cache import (
    cache_delete,
    cache_get,
    cache_set,
    memory_entry_count,
    redis_cache_enabled,
    trim_memory_namespace,
)

logger = logging.getLogger(__name__)

# ==================== ROUTE CACHE ====================
# Faz 1: Redis namespace "route" (+ bellek yedek). Eski ROUTE_CACHE dict kaldırıldı.
# Key: "driver_id:passenger_id" veya "lat1,lng1:lat2,lng2"
# Value: {distance_km, duration_min, geometry, cached_at}

ROUTE_CACHE_NS = "route"
CACHE_TTL_SECONDS = 300  # 5 dakika cache
MAX_CACHE_SIZE = 1000  # Maksimum bellek fallback boyutu


def _get_cache_key(lat1: float, lng1: float, lat2: float, lng2: float) -> str:
    """Koordinatları cache key'e çevir (2 ondalık hassasiyet - ~1km)"""
    return f"{lat1:.2f},{lng1:.2f}:{lat2:.2f},{lng2:.2f}"


def _get_pair_cache_key(driver_id: str, passenger_id: str) -> str:
    """Sürücü-yolcu çifti için cache key"""
    return f"pair:{driver_id}:{passenger_id}"


def _is_cache_valid(cached_at: str) -> bool:
    """Bellek fallback girişleri için TTL (Redis hit'te setex zaten süresi yönetir)."""
    try:
        cached_time = datetime.fromisoformat(cached_at)
        return datetime.utcnow() - cached_time < timedelta(seconds=CACHE_TTL_SECONDS)
    except Exception:
        return False


def _route_cache_read(key: str) -> Optional[dict]:
    """Redis → bellek; geçersiz cached_at ise None."""
    cached = cache_get(ROUTE_CACHE_NS, key)
    if not isinstance(cached, dict):
        return None
    if _is_cache_valid(cached.get("cached_at", "")):
        return cached
    cache_delete(ROUTE_CACHE_NS, key)
    return None


def _route_cache_write(key: str, value: dict) -> None:
    """Redis setex + bellek çift yazım."""
    cache_set(ROUTE_CACHE_NS, key, value, CACHE_TTL_SECONDS)


def _cleanup_old_cache():
    """Bellek fallback taşmasını kırp (Redis kendi TTL ile temizler)."""
    trim_memory_namespace(
        ROUTE_CACHE_NS,
        MAX_CACHE_SIZE,
        max(1, MAX_CACHE_SIZE // 5),
    )
    if memory_entry_count(ROUTE_CACHE_NS) > MAX_CACHE_SIZE:
        logger.info(
            "🧹 Route bellek cache kırpıldı (ns=%s, kalan≈%s, redis=%s)",
            ROUTE_CACHE_NS,
            memory_entry_count(ROUTE_CACHE_NS),
            redis_cache_enabled(),
        )


# ==================== OSRM API ====================

async def get_route_cached(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    driver_id: Optional[str] = None,
    passenger_id: Optional[str] = None
) -> Optional[dict]:
    """
    Rota bilgisi al - önce cache'e bak, yoksa OSRM'den al
    
    Returns:
        {
            "distance_km": float,
            "duration_min": int,
            "geometry": str (polyline),
            "from_cache": bool
        }
    """
    
    # 1. Sürücü-yolcu çifti cache'i kontrol et
    if driver_id and passenger_id:
        pair_key = _get_pair_cache_key(driver_id, passenger_id)
        cached = _route_cache_read(pair_key)
        if cached:
            logger.info(f"✅ Cache HIT (pair): {driver_id[:8]}:{passenger_id[:8]}")
            return {**cached, "from_cache": True}
    
    # 2. Koordinat bazlı cache kontrol et
    coord_key = _get_cache_key(start_lat, start_lng, end_lat, end_lng)
    cached = _route_cache_read(coord_key)
    if cached:
        logger.info(f"✅ Cache HIT (coord): {coord_key}")
        return {**cached, "from_cache": True}
    
    # 3. Cache'de yok - OSRM'den al
    try:
        url = f"https://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=polyline"
        
        async with httpx.AsyncClient(http2=False, timeout=5.0) as client:
            response = await client.get(url)
            data = response.json()
        
        if data.get('code') == 'Ok' and data.get('routes'):
            route = data['routes'][0]
            
            dist_m = float(route.get("distance", 0) or 0)
            dur_s = float(route.get("duration", 0) or 0)
            result = {
                "distance_km": round(dist_m / 1000, 3),
                "duration_min": max(1, math.ceil(dur_s / 60)),
                "geometry": route.get('geometry', ''),
                "cached_at": datetime.utcnow().isoformat()
            }
            
            # Cache'e kaydet (Redis + bellek)
            _route_cache_write(coord_key, result)
            if driver_id and passenger_id:
                _route_cache_write(_get_pair_cache_key(driver_id, passenger_id), result)
            
            # Bellek fallback temizliği
            _cleanup_old_cache()
            
            logger.info(f"📍 OSRM: {result['distance_km']}km, {result['duration_min']}dk")
            return {**result, "from_cache": False}
            
    except asyncio.TimeoutError:
        logger.warning("⏱️ OSRM timeout")
    except Exception as e:
        logger.error(f"OSRM error: {e}")
    
    return None


async def get_route_for_offer(
    driver_lat: float,
    driver_lng: float,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: Optional[float] = None,
    dropoff_lng: Optional[float] = None,
    driver_id: Optional[str] = None,
    passenger_id: Optional[str] = None
) -> dict:
    """
    Teklif için tüm rota bilgilerini hesapla (paralel)
    
    Returns:
        {
            "to_passenger": {distance_km, duration_min, geometry},
            "to_destination": {distance_km, duration_min, geometry} | None
        }
    """
    
    tasks = [
        get_route_cached(driver_lat, driver_lng, pickup_lat, pickup_lng, driver_id, passenger_id)
    ]
    
    if dropoff_lat and dropoff_lng:
        tasks.append(
            get_route_cached(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        )
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    to_passenger = results[0] if not isinstance(results[0], Exception) else None
    to_destination = results[1] if len(results) > 1 and not isinstance(results[1], Exception) else None
    
    return {
        "to_passenger": to_passenger,
        "to_destination": to_destination
    }


def invalidate_pair_cache(driver_id: str, passenger_id: str):
    """Sürücü-yolcu çifti cache'ini invalidate et (Redis + bellek)."""
    pair_key = _get_pair_cache_key(driver_id, passenger_id)
    cache_delete(ROUTE_CACHE_NS, pair_key)
    logger.info(f"🗑️ Cache invalidated: {driver_id[:8]}:{passenger_id[:8]}")


def get_cache_stats() -> dict:
    """Cache istatistikleri (bellek fallback + Redis bayrağı)."""
    return {
        "total_entries": memory_entry_count(ROUTE_CACHE_NS),
        "max_size": MAX_CACHE_SIZE,
        "ttl_seconds": CACHE_TTL_SECONDS,
        "redis_cache_enabled": redis_cache_enabled(),
        "namespace": ROUTE_CACHE_NS,
    }
