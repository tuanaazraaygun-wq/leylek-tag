/**
 * Alış–bırakış için yol mesafesi: önce Google Directions (isteğe bağlı anahtar),
 * sonra herkese açık OSRM, en sonda kuş uçuşu × 1.3 (yalnızca son çare).
 */

export type TripRoadSource = 'google' | 'osrm' | 'crow_fallback';

export async function fetchOsrmTripKmMin(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): Promise<{ distance_km: number; duration_min: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=false`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LeylekTAG-App/1.0' } });
    const data = await res.json();
    if (data?.code !== 'Ok' || !data?.routes?.[0]) return null;
    const r = data.routes[0];
    const distanceM = Number(r.distance) || 0;
    const durationS = Number(r.duration) || 0;
    return {
      distance_km: Math.round((distanceM / 1000) * 10) / 10,
      duration_min: Math.max(1, Math.ceil(durationS / 60)),
    };
  } catch {
    return null;
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function fetchGoogleDirectionsTripKmMin(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string,
): Promise<{ distance_km: number; duration_min: number } | null> {
  const key = (apiKey || '').trim();
  if (!key) return null;
  const base =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${encodeURIComponent(key)}`;
  const tryUrls = [
    `${base}&departure_time=now&traffic_model=best_guess`,
    base,
  ];
  try {
    for (const url of tryUrls) {
      const response = await fetch(url);
      const data = await response.json();
      if (data?.status === 'OK' && data?.routes?.length > 0) {
        const leg = data.routes[0].legs[0];
        const distanceKm = leg.distance.value / 1000;
        const dur = leg.duration_in_traffic || leg.duration;
        const durationMin = Math.ceil(dur.value / 60);
        return {
          distance_km: Math.round(distanceKm * 10) / 10,
          duration_min: Math.max(1, durationMin),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveTripRoadKmMin(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  googleApiKey: string,
): Promise<{ distance_km: number; duration_min: number; source: TripRoadSource }> {
  const g = await fetchGoogleDirectionsTripKmMin(
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    googleApiKey,
  );
  if (g) {
    return { ...g, source: 'google' };
  }
  const o = await fetchOsrmTripKmMin(pickupLat, pickupLng, dropoffLat, dropoffLng);
  if (o) {
    return { ...o, source: 'osrm' };
  }
  const crowKm = haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const approxRoad = Math.max(1, Number((crowKm * 1.3).toFixed(1)));
  return {
    distance_km: approxRoad,
    duration_min: Math.max(5, Math.round((approxRoad / 30) * 60)),
    source: 'crow_fallback',
  };
}
