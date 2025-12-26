"""
Route Service - Rota Hesaplama ve Cache
OSRM API ile rota hesaplama, Redis benzeri in-memory cache
"""

import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

# ==================== ROUTE CACHE ====================
# Key: "driver_id:passenger_id" veya "lat1,lng1:lat2,lng2"
# Value: {distance_km, duration_min, geometry, cached_at}

ROUTE_CACHE: Dict[str, dict] = {}
CACHE_TTL_SECONDS = 300  # 5 dakika cache
MAX_CACHE_SIZE = 1000  # Maksimum cache boyutu


def _get_cache_key(lat1: float, lng1: float, lat2: float, lng2: float) -> str:
    """Koordinatları cache key'e çevir (2 ondalık hassasiyet - ~1km)"""
    return f"{lat1:.2f},{lng1:.2f}:{lat2:.2f},{lng2:.2f}"


def _get_pair_cache_key(driver_id: str, passenger_id: str) -> str:
    """Sürücü-yolcu çifti için cache key"""
    return f"pair:{driver_id}:{passenger_id}"


def _is_cache_valid(cached_at: str) -> bool:
    """Cache'in geçerli olup olmadığını kontrol et"""
    try:
        cached_time = datetime.fromisoformat(cached_at)
        return datetime.utcnow() - cached_time < timedelta(seconds=CACHE_TTL_SECONDS)
    except:
        return False


def _cleanup_old_cache():
    """Eski cache girişlerini temizle"""
    global ROUTE_CACHE
    if len(ROUTE_CACHE) > MAX_CACHE_SIZE:
        # En eski %20'yi sil
        sorted_keys = sorted(
            ROUTE_CACHE.keys(),
            key=lambda k: ROUTE_CACHE[k].get('cached_at', ''),
        )
        keys_to_delete = sorted_keys[:len(sorted_keys) // 5]
        for key in keys_to_delete:
            del ROUTE_CACHE[key]
        logger.info(f"🧹 Cache temizlendi: {len(keys_to_delete)} giriş silindi")


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
        if pair_key in ROUTE_CACHE:
            cached = ROUTE_CACHE[pair_key]
            if _is_cache_valid(cached.get('cached_at', '')):
                logger.info(f"✅ Cache HIT (pair): {driver_id[:8]}:{passenger_id[:8]}")
                return {**cached, "from_cache": True}
    
    # 2. Koordinat bazlı cache kontrol et
    coord_key = _get_cache_key(start_lat, start_lng, end_lat, end_lng)
    if coord_key in ROUTE_CACHE:
        cached = ROUTE_CACHE[coord_key]
        if _is_cache_valid(cached.get('cached_at', '')):
            logger.info(f"✅ Cache HIT (coord): {coord_key}")
            return {**cached, "from_cache": True}
    
    # 3. Cache'de yok - OSRM'den al
    try:
        url = f"https://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=polyline"
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            data = response.json()
        
        if data.get('code') == 'Ok' and data.get('routes'):
            route = data['routes'][0]
            
            result = {
                "distance_km": round(route['distance'] / 1000, 2),
                "duration_min": round(route['duration'] / 60),
                "geometry": route.get('geometry', ''),
                "cached_at": datetime.utcnow().isoformat()
            }
            
            # Cache'e kaydet
            ROUTE_CACHE[coord_key] = result
            if driver_id and passenger_id:
                ROUTE_CACHE[_get_pair_cache_key(driver_id, passenger_id)] = result
            
            # Cache temizliği
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
    """Sürücü-yolcu çifti cache'ini invalidate et"""
    pair_key = _get_pair_cache_key(driver_id, passenger_id)
    if pair_key in ROUTE_CACHE:
        del ROUTE_CACHE[pair_key]
        logger.info(f"🗑️ Cache invalidated: {driver_id[:8]}:{passenger_id[:8]}")


def get_cache_stats() -> dict:
    """Cache istatistikleri"""
    return {
        "total_entries": len(ROUTE_CACHE),
        "max_size": MAX_CACHE_SIZE,
        "ttl_seconds": CACHE_TTL_SECONDS
    }
