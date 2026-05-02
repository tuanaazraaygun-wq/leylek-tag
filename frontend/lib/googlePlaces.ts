/**
 * Google Places (legacy REST) — Autocomplete + Place Details.
 * Anahtar: app.json ios/android googleMaps config veya EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 */
import Constants from 'expo-constants';

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export function getGoogleMapsApiKey(): string {
  const fromEnv = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() : '';
  if (fromEnv) return fromEnv;
  const ios = Constants.expoConfig?.ios?.config as { googleMapsApiKey?: string } | undefined;
  const android = Constants.expoConfig?.android?.config as { googleMaps?: { apiKey?: string } } | undefined;
  return (ios?.googleMapsApiKey || android?.googleMaps?.apiKey || '').trim();
}

export interface GoogleAutocompletePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
  types?: string[];
}

interface GoogleAutocompleteResponse {
  predictions?: GoogleAutocompletePrediction[];
  status: string;
  error_message?: string;
}

interface GoogleDetailsResponse {
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
  status: string;
  error_message?: string;
}

interface GoogleGeocodeResponse {
  results?: {
    formatted_address?: string;
    place_id?: string;
    types?: string[];
    geometry?: { location?: { lat: number; lng: number } };
  }[];
  status: string;
  error_message?: string;
}

export type GoogleAutocompleteBias = {
  latitude: number;
  longitude: number;
  /** ~25–50 km şehir içi; metre */
  radiusMeters: number;
  strictBounds: boolean;
};

async function fetchAutocompleteRaw(
  input: string,
  apiKey: string,
  opts: {
    language: string;
    types?: string;
    bias?: GoogleAutocompleteBias | null;
  },
): Promise<GoogleAutocompletePrediction[]> {
  const params = new URLSearchParams({
    input: input.trim(),
    key: apiKey,
    language: opts.language,
    components: 'country:tr',
  });
  if (opts.types) params.set('types', opts.types);
  if (opts.bias) {
    params.set('location', `${opts.bias.latitude},${opts.bias.longitude}`);
    params.set('radius', String(Math.min(50000, Math.max(5000, opts.bias.radiusMeters))));
    if (opts.bias.strictBounds) params.set('strictbounds', 'true');
  }

  const url = `${AUTOCOMPLETE_URL}?${params.toString()}`;
  const res = await fetch(url);
  const data = (await res.json()) as GoogleAutocompleteResponse;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      [data.error_message || '', data.status || 'places_autocomplete_failed'].filter(Boolean).join(' | '),
    );
  }
  return data.predictions || [];
}

/** Legacy API tek istekte tek `types`; adres + kurum için iki çağrı birleştirilir. */
export async function googlePlacesAutocompleteMerged(
  input: string,
  apiKey: string,
  bias: GoogleAutocompleteBias | null,
): Promise<GoogleAutocompletePrediction[]> {
  const lang = 'tr';
  const logFail = (branch: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      '[AUTOCOMPLETE_PROVIDER_RESULT]',
      JSON.stringify({
        event: 'AUTOCOMPLETE_PROVIDER_RESULT',
        provider: 'google',
        query: input.trim(),
        branch,
        raw_result_count: 0,
        final_result_count: 0,
        error_message: msg,
      }),
    );
  };
  const [geo, est, regions, address] = await Promise.all([
    fetchAutocompleteRaw(input, apiKey, { language: lang, types: 'geocode', bias }).catch((e) => {
      logFail('geocode', e);
      return [];
    }),
    fetchAutocompleteRaw(input, apiKey, { language: lang, types: 'establishment', bias }).catch((e) => {
      logFail('establishment', e);
      return [];
    }),
    fetchAutocompleteRaw(input, apiKey, { language: lang, types: '(regions)', bias }).catch((e) => {
      logFail('regions', e);
      return [];
    }),
    fetchAutocompleteRaw(input, apiKey, { language: lang, types: 'address', bias }).catch((e) => {
      logFail('address', e);
      return [];
    }),
  ]);

  const byId = new Map<string, GoogleAutocompletePrediction>();
  const push = (p: GoogleAutocompletePrediction) => {
    if (!byId.has(p.place_id)) byId.set(p.place_id, p);
  };
  geo.forEach(push);
  est.forEach(push);
  regions.forEach(push);
  address.forEach(push);
  return Array.from(byId.values());
}

export async function googlePlaceDetailsLatLng(
  placeId: string,
  apiKey: string,
): Promise<{ lat: number; lng: number; formattedAddress: string }> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: 'geometry/location,formatted_address',
    language: 'tr',
  });
  const res = await fetch(`${DETAILS_URL}?${params.toString()}`);
  const data = (await res.json()) as GoogleDetailsResponse;
  if (data.status !== 'OK' || !data.result?.geometry?.location) {
    throw new Error(data.error_message || data.status || 'place_details_failed');
  }
  const loc = data.result.geometry.location;
  return {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: data.result.formatted_address || '',
  };
}

export async function googleGeocodeText(
  address: string,
  apiKey: string,
  bias: GoogleAutocompleteBias | null,
): Promise<{ lat: number; lng: number; formattedAddress: string; placeId?: string; types?: string[] }[]> {
  const params = new URLSearchParams({
    address: address.trim(),
    key: apiKey,
    language: 'tr',
    components: 'country:TR',
  });
  if (bias) {
    const latDelta = Math.max(0.04, Math.min(0.65, bias.radiusMeters / 111_000));
    const lngDelta = latDelta / Math.max(0.35, Math.cos((bias.latitude * Math.PI) / 180));
    params.set(
      'bounds',
      `${bias.latitude - latDelta},${bias.longitude - lngDelta}|${bias.latitude + latDelta},${bias.longitude + lngDelta}`,
    );
  }
  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  const data = (await res.json()) as GoogleGeocodeResponse;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || data.status || 'geocode_failed');
  }
  return (data.results || [])
    .map((r) => ({
      lat: Number(r.geometry?.location?.lat),
      lng: Number(r.geometry?.location?.lng),
      formattedAddress: r.formatted_address || '',
      placeId: r.place_id,
      types: r.types,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && !!r.formattedAddress);
}
