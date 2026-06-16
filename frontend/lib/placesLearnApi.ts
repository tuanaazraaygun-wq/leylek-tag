import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { getPlacesSearchApiRoot } from './backendConfig';

export type PlacesLearnPayload = {
  display_name: string;
  normalized_query?: string;
  city?: string;
  district?: string;
  latitude: number;
  longitude: number;
  provider?: string;
};

const TR_LAT_MIN = 35.0;
const TR_LAT_MAX = 43.0;
const TR_LNG_MIN = 25.0;
const TR_LNG_MAX = 46.0;

function isInTurkeyBbox(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) < 1e-6 && Math.abs(longitude) < 1e-6) return false;
  return (
    TR_LAT_MIN <= latitude &&
    latitude <= TR_LAT_MAX &&
    TR_LNG_MIN <= longitude &&
    longitude <= TR_LNG_MAX
  );
}

export function deriveNormalizedQueryFromDisplayName(displayName: string): string {
  const trimmed = (displayName || '').trim();
  if (!trimmed) return '';
  const head = (trimmed.split(',')[0] || trimmed).trim();
  return head.length >= 2 ? head : trimmed.slice(0, 128);
}

/**
 * Fire-and-forget POST /api/places/learn — anonim harita onayı kaydı.
 * Hata veya endpoint yokluğu sessiz; çağıran await etmemeli.
 */
export function learnAddressFromMapConfirm(payload: PlacesLearnPayload): void {
  const display_name = (payload.display_name || '').trim();
  const normalized_query =
    (payload.normalized_query || '').trim() ||
    deriveNormalizedQueryFromDisplayName(display_name);
  const latitude = payload.latitude;
  const longitude = payload.longitude;

  if (display_name.length < 5 || normalized_query.length < 2) return;
  if (!isInTurkeyBbox(latitude, longitude)) return;

  const body = {
    display_name,
    normalized_query,
    city: (payload.city || '').trim(),
    district: (payload.district || '').trim(),
    latitude,
    longitude,
    provider: payload.provider || 'map_confirm',
  };

  void (async () => {
    try {
      const root = String(getPlacesSearchApiRoot() || '')
        .trim()
        .replace(/\/+$/, '');
      if (!root) return;
      await fetchWithTimeout(`${root}/places/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeoutMs: 8000,
      });
    } catch {
      /* silent — UI ve route commit etkilenmez */
    }
  })();
}
