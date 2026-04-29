import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getGoogleMapsApiKey,
  googleGeocodeText,
  googlePlacesAutocompleteMerged,
  googlePlaceDetailsLatLng,
  type GoogleAutocompleteBias,
  type GoogleAutocompletePrediction,
} from '../lib/googlePlaces';

// Türkiye şehirlerinin koordinatları ve bounding box'ları
const CITY_DATA: { [key: string]: { lat: number; lng: number; bbox: string } } = {
  'İstanbul': { lat: 41.0082, lng: 28.9784, bbox: '28.5,40.8,29.9,41.7' },
  'Ankara': { lat: 39.9334, lng: 32.8597, bbox: '32.2,39.5,33.5,40.4' },
  'İzmir': { lat: 38.4237, lng: 27.1428, bbox: '26.5,38.0,27.8,39.0' },
  'Bursa': { lat: 40.1885, lng: 29.0610, bbox: '28.4,39.8,30.0,40.6' },
  'Antalya': { lat: 36.8969, lng: 30.7133, bbox: '29.8,36.1,32.5,37.5' },
  'Adana': { lat: 37.0000, lng: 35.3213, bbox: '34.5,36.5,36.2,38.0' },
  'Konya': { lat: 37.8746, lng: 32.4932, bbox: '31.5,36.8,34.5,38.8' },
  'Gaziantep': { lat: 37.0662, lng: 37.3833, bbox: '36.5,36.5,38.2,37.8' },
  'Şanlıurfa': { lat: 37.1591, lng: 38.7969, bbox: '38.0,36.5,40.5,38.0' },
  'Kocaeli': { lat: 40.8533, lng: 29.8815, bbox: '29.3,40.5,30.5,41.2' },
  'Mersin': { lat: 36.8000, lng: 34.6333, bbox: '33.5,36.0,35.5,37.5' },
  'Diyarbakır': { lat: 37.9144, lng: 40.2306, bbox: '39.5,37.3,41.2,38.8' },
  'Hatay': { lat: 36.4018, lng: 36.3498, bbox: '35.5,35.8,37.0,37.0' },
  'Manisa': { lat: 38.6191, lng: 27.4289, bbox: '27.0,38.2,28.5,39.2' },
  'Kayseri': { lat: 38.7312, lng: 35.4787, bbox: '34.5,38.0,36.5,39.5' },
  'Samsun': { lat: 41.2867, lng: 36.3300, bbox: '35.5,40.8,37.2,41.8' },
  'Balıkesir': { lat: 39.6484, lng: 27.8826, bbox: '27.0,39.0,29.0,40.5' },
  'Kahramanmaraş': { lat: 37.5858, lng: 36.9371, bbox: '36.2,37.0,37.8,38.3' },
  'Van': { lat: 38.4891, lng: 43.4089, bbox: '42.5,37.8,44.5,39.5' },
  'Aydın': { lat: 37.8560, lng: 27.8416, bbox: '27.0,37.3,28.8,38.5' },
  'Denizli': { lat: 37.7765, lng: 29.0864, bbox: '28.5,37.2,30.0,38.3' },
  'Sakarya': { lat: 40.7569, lng: 30.3780, bbox: '29.8,40.3,31.0,41.2' },
  'Tekirdağ': { lat: 40.9833, lng: 27.5167, bbox: '26.5,40.5,28.5,41.5' },
  'Muğla': { lat: 37.2153, lng: 28.3636, bbox: '27.5,36.5,29.5,37.8' },
  'Eskişehir': { lat: 39.7767, lng: 30.5206, bbox: '29.8,39.0,31.5,40.5' },
  'Mardin': { lat: 37.3212, lng: 40.7245, bbox: '40.0,36.8,41.5,37.8' },
  'Trabzon': { lat: 41.0027, lng: 39.7168, bbox: '38.8,40.5,40.5,41.5' },
  'Malatya': { lat: 38.3552, lng: 38.3095, bbox: '37.5,37.8,39.2,38.9' },
  'Erzurum': { lat: 39.9043, lng: 41.2679, bbox: '40.3,39.3,42.5,40.5' },
  'Adıyaman': { lat: 37.7648, lng: 38.2786, bbox: '37.4,37.3,38.8,38.2' },
};

/** Kayıtlı şehir adı CITY_DATA anahtarıyla birebir olmayabilir (büyük/küçük harf vb.) */
function foldTrAscii(raw: string): string {
  return raw
    .trim()
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normCityNeedle(raw: string): string {
  return foldTrAscii(raw).toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

/** Karşılaştırma için Türkçe toleranslı normalize */
export function normalizeText(s: string): string {
  return foldTrAscii(String(s || ''))
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCityDataKey(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (CITY_DATA[t]) return t;
  const lower = t.toLocaleLowerCase('tr-TR');
  const folded = normCityNeedle(t);
  for (const k of Object.keys(CITY_DATA)) {
    if (k.toLocaleLowerCase('tr-TR') === lower) return k;
    if (normCityNeedle(k) === folded) return k;
  }
  return null;
}

/** Kayıtlı şehir adından merkez koordinatı — yolcu hedef modalı harita merkezi için (`app/index.tsx` PassengerDashboard). */
export function getRegisteredCityCenter(raw: string): { latitude: number; longitude: number } | null {
  const key = resolveCityDataKey(raw);
  if (!key) return null;
  const d = CITY_DATA[key];
  return { latitude: d.lat, longitude: d.lng };
}

/**
 * CITY_DATA.bbox saklanışı: min_lon,min_lat,max_lon,max_lat (SW → NE köşeleri).
 * Nominatim viewbox: sol (west), üst (north), sağ (east), alt (south) =
 * min_lon, max_lat, max_lon, min_lat
 */
function parseStoredCityBbox(bbox: string): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null {
  const p = bbox.split(',').map((x) => Number.parseFloat(x.trim()));
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  return { minLon: p[0], minLat: p[1], maxLon: p[2], maxLat: p[3] };
}

function pointInStoredCityBbox(lat: number, lon: number, bbox: string): boolean {
  const b = parseStoredCityBbox(bbox);
  if (!b) return false;
  return lon >= b.minLon && lon <= b.maxLon && lat >= b.minLat && lat <= b.maxLat;
}

/**
 * Muhabbet teklif uçları: nokta kayıtlı şehir bbox içinde mi.
 * Şehir CITY_DATA’da yoksa true (yalnızca arama sıkılığına güvenilir).
 */
export function isLatLngWithinRegisteredCity(cityLabel: string, lat: number, lng: number): boolean {
  const key = resolveCityDataKey(cityLabel);
  if (!key) return true;
  return pointInStoredCityBbox(lat, lng, CITY_DATA[key].bbox);
}

/** Nominatim `viewbox=` parametresi (left,top,right,bottom). */
function nominatimViewboxFromStoredBbox(bbox: string): string | null {
  const b = parseStoredCityBbox(bbox);
  if (!b) return null;
  return `${b.minLon},${b.maxLat},${b.maxLon},${b.minLat}`;
}

function gpsBiasViewbox(lat: number, lng: number, deltaDeg: number): string {
  const left = lng - deltaDeg;
  const right = lng + deltaDeg;
  const top = lat + deltaDeg;
  const bottom = lat - deltaDeg;
  return `${left},${top},${right},${bottom}`;
}

/** Kullanıcı sorguda başka bir ili açıkça yazdıysa (ör. seyahat), o ilin bbox’ı kullanılır */
function explicitOtherMajorCityKeyFromQuery(query: string, homeKey: string | null): string | null {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  const qFolded = normCityNeedle(query);
  if (q.length < 3) return null;
  for (const k of Object.keys(CITY_DATA)) {
    if (homeKey && k === homeKey) continue;
    if (q.includes(k.toLocaleLowerCase('tr-TR')) || qFolded.includes(normCityNeedle(k))) return k;
  }
  return null;
}

/** Kelime sınırına yakın eşleşme — includes("Ankara") ⊂ "Çankaya" tuzaklarını önler */
function queryContainsWholeCity(query: string, cityName: string): boolean {
  const c = cityName.trim();
  if (!c) return false;
  const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\s,])${esc}([\\s,]|$)`, 'iu');
  return re.test(query.trim());
}

function queryHasTurkiyeSuffix(text: string): boolean {
  const t = text.trim();
  return /\bt[uü]rkiye\b/i.test(t) || /\bt[uü]rk\b/i.test(t);
}

/**
 * Şehir ve ülke bağlamı ekler; şehir zaten ayrı bir kelime olarak yazılmışsa tekrar eklemez.
 */
export function normalizePlaceQuery(query: string, city: string): string {
  const q0 = query.trim().replace(/\s+/g, ' ');
  if (!q0) return '';
  const cityTrim = city.trim();
  let q = q0;
  if (cityTrim && !queryContainsWholeCity(q0, cityTrim)) {
    q = `${q0}, ${cityTrim}`;
  }
  if (!queryHasTurkiyeSuffix(q)) {
    q = `${q}, Türkiye`;
  }
  return q.replace(/\s*,\s*/g, ', ').trim();
}

/**
 * Fallback sırası (yinelenenler çıkarılır):
 * 1) ham metin
 * 2) normalizePlaceQuery (şehir + Türkiye)
 * 3) explicit "... şehir, Türkiye"
 * 4) şehir Ankara ise "... Ankara, Türkiye"
 * 5) ascii + Turkey yedekleri
 */
function buildOrderedSearchVariants(
  rawInput: string,
  cityLabel: string,
  forcedCityKey: string | null,
  forceCityInSearch: boolean,
): string[] {
  const head = rawInput.trim().replace(/\s+/g, ' ');
  if (!head) return [];
  if (!forceCityInSearch) return [head];

  const effectiveCity = (forcedCityKey || cityLabel || '').trim();
  const ordered: string[] = [head];

  if (effectiveCity) {
    ordered.push(normalizePlaceQuery(head, effectiveCity));
    ordered.push(`${head}, ${effectiveCity}, Türkiye`);
    const resolved = resolveCityDataKey(effectiveCity);
    if (resolved === 'Ankara') {
      ordered.push(`${head}, Ankara, Türkiye`);
    }
    ordered.push(`${foldTrAscii(head)} ${foldTrAscii(effectiveCity)} Turkey`);
  } else {
    ordered.push(`${foldTrAscii(head)} Turkey`);
  }

  const seen = new Set<string>();
  return ordered
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => {
      if (!s) return false;
      const key = normCityNeedle(s);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pointInGpsBiasBox(
  lat: number,
  lon: number,
  biasLat: number,
  biasLng: number,
  deltaDeg: number,
): boolean {
  return (
    lat >= biasLat - deltaDeg &&
    lat <= biasLat + deltaDeg &&
    lon >= biasLng - deltaDeg &&
    lon <= biasLng + deltaDeg
  );
}

export type LocalityFilterOpts = {
  strictCityBounds: boolean;
  cityLabel: string;
  effectiveCityKey: string | null;
  cityDataEffective: { bbox: string } | null;
  biasLatitude?: number;
  biasLongitude?: number;
  biasDeltaDeg: number;
  usedBiasOnlyBbox: boolean;
  rawQueryLower?: string;
};

function passesStrictLocality(item: PlaceResult, opts: LocalityFilterOpts): boolean {
  if (!opts.strictCityBounds) return true;

  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  const needle = (opts.effectiveCityKey || opts.cityLabel || '').trim();

  if (opts.cityDataEffective && opts.effectiveCityKey) {
    if (pointInStoredCityBbox(lat, lon, opts.cityDataEffective.bbox)) return true;
    if (needle && nominatimResultInCityLabel(item, needle)) return true;
    return false;
  }

  if (
    opts.usedBiasOnlyBbox &&
    opts.biasLatitude != null &&
    opts.biasLongitude != null &&
    Number.isFinite(opts.biasLatitude) &&
    Number.isFinite(opts.biasLongitude)
  ) {
    if (pointInGpsBiasBox(lat, lon, opts.biasLatitude, opts.biasLongitude, opts.biasDeltaDeg)) return true;
    if (needle && nominatimResultInCityLabel(item, needle)) return true;
    return false;
  }

  if (needle && nominatimResultInCityLabel(item, needle)) return true;
  return true;
}

/** strict ile sıfır sonuçsa; bbox içi + ilçe/sokak tipi veya şehir etiketi ile gevşetilir */
function passesSoftLocality(item: PlaceResult, opts: LocalityFilterOpts): boolean {
  if (!opts.strictCityBounds) return true;
  if (passesStrictLocality(item, opts)) return true;

  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  const needle = (opts.effectiveCityKey || opts.cityLabel || '').trim();
  if (needle && nominatimResultInCityLabel(item, needle)) return true;

  const t = (item.type || '').toLowerCase();
  const finer =
    ['neighbourhood', 'suburb', 'quarter', 'road', 'residential', 'living_street', 'pedestrian'].includes(t) ||
    t === 'house' ||
    t === 'building' ||
    (item.class || '').toLowerCase() === 'highway';

  if (opts.cityDataEffective && opts.effectiveCityKey && finer && pointInStoredCityBbox(lat, lon, opts.cityDataEffective.bbox)) {
    return true;
  }

  const ql = (opts.rawQueryLower || '').trim();
  if (ql.length >= 3 && opts.cityDataEffective && opts.effectiveCityKey) {
    const dn = (item.display_name || '').toLocaleLowerCase('tr-TR');
    const words = ql.split(/\s+/).filter((w) => w.length >= 3);
    if (words.some((w) => dn.includes(w)) && pointInStoredCityBbox(lat, lon, opts.cityDataEffective.bbox)) {
      return urbanRankTier(item) <= 6;
    }
  }

  return false;
}

function computeLocalSortScore(
  item: PlaceResult,
  queryInput: string,
  biasLatitude?: number,
  biasLongitude?: number,
  cityNeedle?: string,
): number {
  if (item.source === 'google') {
    const types = item.google_types || [];
    let tr = 5;
    if (types.some((t) => ['street_address', 'route', 'premise', 'subpremise'].includes(t))) tr = 0;
    else if (types.some((t) => ['sublocality_level_1', 'neighborhood', 'sublocality'].includes(t))) tr = 1;
    else if (types.includes('establishment') || types.includes('point_of_interest')) tr = 2;
    const txt = (item.display_name || '').toLocaleLowerCase('tr-TR');
    const ql = queryInput.trim().toLocaleLowerCase('tr-TR');
    const prefixBoost = ql.length >= 2 && txt.includes(ql) ? -2 : 0;
    let score = tr * 18 + prefixBoost;
    const cn = (cityNeedle || '').trim().toLocaleLowerCase('tr-TR');
    if (cn && txt.includes(cn)) score -= 5;
    return score;
  }

  const tier = urbanRankTier(item);
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  let distKm = 0;
  if (
    biasLatitude != null &&
    biasLongitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Number.isFinite(biasLatitude) &&
    Number.isFinite(biasLongitude)
  ) {
    distKm = haversineKm(biasLatitude, biasLongitude, lat, lon);
  }
  const imp = typeof item.importance === 'number' ? item.importance : 0;
  const streetBoost = numericStreetMatchesQuery(item, queryInput) ? -3.2 : 0;
  const qLower = queryInput.trim().toLocaleLowerCase('tr-TR');
  const nameLower = (item.display_name || '').toLocaleLowerCase('tr-TR');
  const tokenBoost =
    qLower.length >= 3 && nameLower.includes(qLower)
      ? -1.2
      :     qLower.length >= 3 && qLower.split(/\s+/).filter((w) => w.length > 2).some((w) => nameLower.includes(w))
        ? -0.6
        : 0;

  let score = tier * 12 + distKm * 0.92 - imp * 3.2 + streetBoost + tokenBoost;
  const cn = (cityNeedle || '').trim().toLocaleLowerCase('tr-TR');
  if (cn && nameLower.includes(cn)) score -= 5;
  return score;
}

// Mahalle popüler aramaları - her şehir için
const POPULAR_PLACES: { [key: string]: string[] } = {
  'İstanbul': ['Kadıköy', 'Beşiktaş', 'Şişli', 'Bakırköy', 'Ümraniye', 'Üsküdar', 'Fatih', 'Beyoğlu', 'Ataşehir', 'Maltepe'],
  'Ankara': ['Çankaya', 'Keçiören', 'Mamak', 'Yenimahalle', 'Etimesgut', 'Sincan', 'Altındağ', 'Pursaklar', 'Gölbaşı', 'Batıkent'],
  'İzmir': ['Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Bayraklı', 'Çiğli', 'Alsancak', 'Narlıdere', 'Gaziemir', 'Balçova'],
  'Bursa': ['Osmangazi', 'Yıldırım', 'Nilüfer', 'Mudanya', 'Gemlik', 'İnegöl', 'Görükle', 'Kestel'],
  'Antalya': ['Muratpaşa', 'Kepez', 'Konyaaltı', 'Lara', 'Alanya', 'Manavgat', 'Side', 'Belek'],
};

interface PlaceResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class?: string;
  importance?: number;
  /** nominatim varsayılan; google seçiminde Place Details ile koordinat alınır */
  source?: 'nominatim' | 'google';
  google_place_id?: string;
  structured_main?: string;
  structured_secondary?: string;
  google_types?: string[];
  address?: {
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    district?: string;
    city?: string;
    city_district?: string;
    town?: string;
    municipality?: string;
    county?: string;
    road?: string;
    amenity?: string;
    shop?: string;
    office?: string;
    tourism?: string;
  };
}

function dedupePlaceResults(rows: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const item of rows) {
    const id = String(item.place_id || `${item.lat},${item.lon}`);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/** Düşük skor = listede daha üst */
function textSimilarityRankScore(displayRaw: string, queryRaw: string, cityNeedle: string): number {
  const dn = normalizeText(displayRaw);
  const qn = normalizeText(queryRaw);
  const cn = normalizeText(cityNeedle);
  let score = 100;
  if (qn.length >= 2) {
    if (dn.startsWith(qn)) score -= 38;
    else if (dn.includes(qn)) score -= 22;
    else {
      for (const w of qn.split(/\s+/).filter((x) => x.length >= 2)) {
        if (dn.includes(w)) score -= 7;
      }
    }
  }
  if (cn.length >= 2 && dn.includes(cn)) score -= 16;
  return score;
}

function pickRawFallbackTop(rows: PlaceResult[], queryInput: string, cityNeedle: string, limit: number): PlaceResult[] {
  const d = dedupePlaceResults(rows);
  if (d.length === 0) return [];
  const sorted = [...d].sort(
    (a, b) =>
      textSimilarityRankScore(a.display_name || '', queryInput, cityNeedle) -
      textSimilarityRankScore(b.display_name || '', queryInput, cityNeedle),
  );
  return sorted.slice(0, limit);
}

export interface PlaceDetails {
  address: string;
  latitude: number;
  longitude: number;
}

function mapGooglePredictionToPlaceResult(p: GoogleAutocompletePrediction): PlaceResult {
  const st = p.structured_formatting;
  return {
    place_id: p.place_id,
    display_name: p.description,
    lat: '0',
    lon: '0',
    type: p.types?.[0] || 'establishment',
    class: 'google',
    source: 'google',
    google_place_id: p.place_id,
    structured_main: st?.main_text,
    structured_secondary: st?.secondary_text,
    google_types: p.types,
  };
}

function buildGooglePlacesBias(
  effectiveCityKey: string | null,
  explicitOtherKey: string | null,
  biasLatitude: number | undefined,
  biasLongitude: number | undefined,
  strictCityBounds: boolean,
): GoogleAutocompleteBias | null {
  if (explicitOtherKey && CITY_DATA[explicitOtherKey]) {
    const d = CITY_DATA[explicitOtherKey];
    return {
      latitude: d.lat,
      longitude: d.lng,
      radiusMeters: 65000,
      strictBounds: false,
    };
  }
  if (
    biasLatitude != null &&
    biasLongitude != null &&
    Number.isFinite(biasLatitude) &&
    Number.isFinite(biasLongitude)
  ) {
    return {
      latitude: biasLatitude,
      longitude: biasLongitude,
      radiusMeters: strictCityBounds ? 44000 : 38000,
      strictBounds,
    };
  }
  if (effectiveCityKey && CITY_DATA[effectiveCityKey]) {
    const d = CITY_DATA[effectiveCityKey];
    return {
      latitude: d.lat,
      longitude: d.lng,
      radiusMeters: strictCityBounds ? 52000 : 58000,
      strictBounds: !!strictCityBounds,
    };
  }
  return null;
}

/** strictCityBounds: OSM adres + display_name içinde şehir / ilçe eşleşmesi */
function nominatimResultInCityLabel(item: PlaceResult, cityNeedle: string): boolean {
  const nl = normalizeText(cityNeedle);
  if (!nl) return true;
  const dn = normalizeText(item.display_name || '');
  if (dn.includes(nl)) return true;
  const legacyNl = cityNeedle.trim().toLocaleLowerCase('tr-TR');
  const legacyDn = (item.display_name || '').toLocaleLowerCase('tr-TR');
  if (legacyNl && legacyDn.includes(legacyNl)) return true;
  const a = (item.address || {}) as Record<string, string | undefined>;
  for (const k of [
    'city',
    'town',
    'municipality',
    'city_district',
    'district',
    'county',
    'village',
    'suburb',
    'neighbourhood',
    'quarter',
    'state',
    'province',
  ] as const) {
    const v = a[k];
    if (typeof v === 'string' && normalizeText(v).includes(nl)) return true;
  }
  return false;
}

const POI_TYPE_BONUS = new Set([
  'embassy',
  'place_of_worship',
  'police',
  'school',
  'university',
  'college',
  'hospital',
  'clinic',
  'pharmacy',
  'mall',
  'department_store',
  'shopping_centre',
  'marketplace',
  'courthouse',
  'townhall',
  'public_building',
]);

/** Düşük = listede üstte (şehir içi adres ve POI için ayrılmış) */
function urbanRankTier(item: PlaceResult): number {
  const t = (item.type || '').toLowerCase();
  const c = (item.class || '').toLowerCase();
  const dn = item.display_name || '';
  const addr = item.address || {};

  const roadHint =
    /\b(sokak|sokağı|cadde|caddesi|bulvar|bulvarı|mah\.?|mahalle|sk\.|cd\.)\b/i.test(dn) || !!addr.road;

  if (t === 'house' || t === 'building') return 0;
  if (roadHint || t === 'road' || t === 'residential' || t === 'living_street' || t === 'pedestrian')
    return 1;
  if (t === 'neighbourhood' || t === 'suburb' || t === 'quarter') return 2;

  if (POI_TYPE_BONUS.has(t) || (c === 'amenity' && POI_TYPE_BONUS.has(t))) return 3;
  if (
    c === 'amenity' ||
    c === 'shop' ||
    c === 'office' ||
    c === 'tourism' ||
    c === 'historic' ||
    c === 'leisure'
  )
    return 4;

  if (t === 'village' || t === 'hamlet' || t === 'farm') return 5;
  if (t === 'town' || t === 'city' || t === 'administrative') return 9;
  return 6;
}

/** Liste sırası: ilçe/mahalle → sokak/yol → konut → diğer */
function localityDisplayRank(item: PlaceResult): number {
  const t = (item.type || '').toLowerCase();
  const c = (item.class || '').toLowerCase();
  if (['neighbourhood', 'suburb', 'quarter'].includes(t)) return 0;
  if (['road', 'residential', 'living_street', 'pedestrian'].includes(t) || c === 'highway') return 1;
  if (t === 'house' || t === 'building') return 2;
  const ut = urbanRankTier(item);
  if (ut <= 4) return 3;
  return 4;
}

function numericStreetMatchesQuery(item: PlaceResult, queryRaw: string): boolean {
  const m = queryRaw.trim().match(/^(\d{1,5})\b/);
  if (!m) return false;
  const num = m[1];
  const dn = (item.display_name || '').toLowerCase();
  const road = (item.address?.road || '').toLowerCase();
  return dn.includes(num) || road.includes(num);
}

/** Liste ve çipler için tek yerden layout — küçük ekranda sıkışmayı azaltır */
const LAYOUT = {
  inputMinHeight: 52,
  predictionListMin: 200,
  predictionListMax: 380,
  /** Ekran yüksekliğinin oranı (öneri listesi tavanı) */
  predictionMaxHeightRatio: 0.42,
  popularChipMinHeight: 40,
} as const;

/** Geçici teşhis bayrağı — prod’da kapalı; kaldırmak için bu blok + searchDiag kullanımını silmek yeterli */
const SHOW_PLACES_DIAG = process.env.EXPO_PUBLIC_PLACES_DIAG === '1';

type PlaceSearchDiagCode =
  | 'google_error'
  | 'nominatim_http'
  | 'nominatim_empty'
  | 'filtered_empty'
  | 'both_empty'
  | 'unknown';

type PlaceSearchDiag = { code: PlaceSearchDiagCode; hint?: string };

/** Geçici teşhis: tek satır JSON, cihazlar arası autocomplete farkları için */
function acDiag(event: string, payload: Record<string, unknown>) {
  if (!SHOW_PLACES_DIAG) return;
  console.log(`[${event}]`, JSON.stringify({ event, ...payload }));
}

interface PlacesAutocompleteProps {
  placeholder?: string;
  onPlaceSelected: (place: PlaceDetails) => void;
  initialValue?: string;
  city?: string;
  /** true: ilçe/mahalle popüler çipleri gösterme (hedef seçim modalı) */
  hidePopularChips?: boolean;
  /** Hedef modalı: koyu cam / neon çerçeve */
  visualVariant?: 'default' | 'tech';
  /** Öneri listesi arama kutusunun üstünde (yukarı doğru açılır) */
  suggestionsFirst?: boolean;
  /** Daha fazla sonuç; şehir viewbox sınırı gevşetilir */
  widerSearch?: boolean;
  /** true: şehir biliniyorsa her zaman viewbox ile sınırla (hedef seçim — tüm TR önerilerini kes) */
  strictCityBounds?: boolean;
  /** Şehir CITY_DATA’da yoksa bile bounded kutu: bulunduğu konum etrafı (mahalle önerileri yerelde kalsın) */
  biasLatitude?: number;
  biasLongitude?: number;
  /** bias kutusu yarı genişliği (derece); ~0.34 ≈ 35–40 km */
  biasDeltaDeg?: number;
  /** Hedef modalı: arama kutusu daha yüksek */
  inputSize?: 'default' | 'large';
  /** Öneri listesi tavanına eklenecek piksel */
  predictionMaxHeightBonus?: number;
  /** Muhabbet endpoint picker: şehir bağlamını metin aramasına da ekle. */
  forceCityInSearch?: boolean;
}

export default function PlacesAutocomplete({
  placeholder = 'Mahalle, sokak veya mekan ara...',
  onPlaceSelected,
  initialValue = '',
  city = '',
  hidePopularChips = false,
  visualVariant = 'default',
  suggestionsFirst = false,
  widerSearch = false,
  strictCityBounds = false,
  biasLatitude,
  biasLongitude,
  biasDeltaDeg = 0.34,
  inputSize = 'default',
  predictionMaxHeightBonus = 0,
  forceCityInSearch = false,
}: PlacesAutocompleteProps) {
  const { height: windowHeight } = useWindowDimensions();
  const tech = visualVariant === 'tech';
  const predictionsMaxHeight = Math.round(
    Math.max(
      tech ? 120 : LAYOUT.predictionListMin,
      Math.min(
        LAYOUT.predictionListMax + (tech ? 100 : 0) + predictionMaxHeightBonus,
        Math.round(windowHeight * (tech ? 0.4 : LAYOUT.predictionMaxHeightRatio)) + predictionMaxHeightBonus,
      ),
    ),
  );
  const predictionBoxDims = tech
    ? {
        maxHeight: predictionsMaxHeight,
        minHeight: Math.min(172, Math.round(predictionsMaxHeight * 0.42)),
      }
    : { maxHeight: predictionsMaxHeight };
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showPopular, setShowPopular] = useState(true);
  /** Geçici: boş sonuç nedeni (yalnız SHOW_PLACES_DIAG açıkken dolar / gösterilir) */
  const [searchDiag, setSearchDiag] = useState<PlaceSearchDiag | null>(null);
  /** Tüm arama varyantları denendikten sonra true — “sonuç yok” mesajı için */
  const [searchRoundDone, setSearchRoundDone] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Artan kimlik: tamamlanan arama yanıtı yalnızca en son isteğe aitse state günceller (yarış / boş liste). */
  const autocompleteRequestIdRef = useRef(0);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      autocompleteRequestIdRef.current += 1;
      setPredictions([]);
      setShowPredictions(false);
      setShowPopular(true);
      setLoading(false);
      setSearchRoundDone(false);
      if (SHOW_PLACES_DIAG) setSearchDiag(null);
      return;
    }

    setShowPopular(false);
    const debounceMs = getGoogleMapsApiKey() ? 200 : widerSearch ? 220 : 280;
    debounceRef.current = setTimeout(() => {
      void searchPlaces(query);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, widerSearch, city, strictCityBounds, biasLatitude, biasLongitude, biasDeltaDeg, forceCityInSearch]);

  /** Önce Google Places (Autocomplete + Details ile koordinat); boş / hata → Nominatim (mevcut mantık). */
  const searchPlaces = async (input: string) => {
    const requestId = ++autocompleteRequestIdRef.current;
    setSearchRoundDone(false);
    setLoading(true);
    const apiKey = getGoogleMapsApiKey();
    let googleHadError = false;
    let googleErrorHint: string | undefined;
    let googleRawLen: number | null = null;
    let enteredNominatim = false;
    let anyNomRaw = false;
    let nomFinalLenBeforeCap = 0;
    if (SHOW_PLACES_DIAG) setSearchDiag(null);
    try {
      const cityKeyHome = resolveCityDataKey(city);
      const cityLabel = cityKeyHome || city.trim();
      const explicitOtherKey = explicitOtherMajorCityKeyFromQuery(input, cityKeyHome);
      const effectiveCityKey = explicitOtherKey || cityKeyHome;
      const cityDataEffective = effectiveCityKey ? CITY_DATA[effectiveCityKey] : null;
      const searchVariants = buildOrderedSearchVariants(input, cityLabel, explicitOtherKey, forceCityInSearch);
      const primarySearchQuery = searchVariants[0] || input.trim();
      const sortNeedle = effectiveCityKey || cityLabel;
        const compareRows = (a: PlaceResult, b: PlaceResult): number => {
          const lr = localityDisplayRank(a) - localityDisplayRank(b);
          if (lr !== 0) return lr;
          const sn = normalizeText(sortNeedle);
          if (sn.length >= 2) {
            const da = normalizeText(a.display_name || '').includes(sn);
            const db = normalizeText(b.display_name || '').includes(sn);
            if (da !== db) return da ? -1 : 1;
          }
          const sa = textSimilarityRankScore(a.display_name || '', input, sortNeedle);
          const sb = textSimilarityRankScore(b.display_name || '', input, sortNeedle);
          if (sa !== sb) return sa - sb;
          return (
            computeLocalSortScore(a, input, biasLatitude, biasLongitude, sortNeedle) -
            computeLocalSortScore(b, input, biasLatitude, biasLongitude, sortNeedle)
          );
        };

      acDiag('AUTOCOMPLETE_INPUT', {
        query: input.trim(),
        city_label: cityLabel || null,
        bias_lat_present: biasLatitude != null && Number.isFinite(biasLatitude),
        bias_lng_present: biasLongitude != null && Number.isFinite(biasLongitude),
        strict_city_bounds: strictCityBounds,
        request_id: requestId,
      });

      let filtered: PlaceResult[] = [];

      if (apiKey) {
        try {
          const gBias = buildGooglePlacesBias(
            effectiveCityKey,
            explicitOtherKey,
            biasLatitude,
            biasLongitude,
            strictCityBounds,
          );

          googleAuto: for (const qTry of searchVariants) {
            acDiag('AUTOCOMPLETE_PROVIDER_START', {
              provider: 'google_autocomplete',
              query: qTry,
              city_label: cityLabel || null,
              request_id: requestId,
            });
            const raw = await googlePlacesAutocompleteMerged(qTry, apiKey, gBias);
            if (requestId !== autocompleteRequestIdRef.current) {
              return;
            }
            if (raw.length > 0) {
              googleRawLen = raw.length;
              let nextFiltered = raw.map(mapGooglePredictionToPlaceResult);
              nextFiltered.sort(compareRows);
              const gCap = widerSearch && !strictCityBounds ? 24 : strictCityBounds ? 20 : 14;
              filtered = nextFiltered.slice(0, gCap);
              acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
                provider: 'google',
                query: qTry,
                city_label: cityLabel || null,
                raw_result_count: raw.length,
                final_result_count: filtered.length,
                error_message: null,
                request_id: requestId,
              });
              break googleAuto;
            }
          }

          if (filtered.length === 0) {
            const geoOpts: LocalityFilterOpts = {
              strictCityBounds,
              cityLabel,
              effectiveCityKey,
              cityDataEffective,
              biasLatitude,
              biasLongitude,
              biasDeltaDeg,
              usedBiasOnlyBbox: false,
              rawQueryLower: input.trim().toLocaleLowerCase('tr-TR'),
            };

            googleGeo: for (const qTry of searchVariants) {
              try {
                acDiag('AUTOCOMPLETE_PROVIDER_START', {
                  provider: 'google_geocode',
                  query: qTry,
                  city_label: cityLabel || null,
                  request_id: requestId,
                });
                const geocoded = await googleGeocodeText(qTry, apiKey, gBias);
                if (requestId !== autocompleteRequestIdRef.current) {
                  return;
                }
                googleRawLen = googleRawLen ?? geocoded.length;
                const geoMapped = geocoded.map((r, ix) => ({
                  place_id: r.placeId || `google_geocode_${ix}_${r.lat}_${r.lng}`,
                  display_name: r.formattedAddress,
                  lat: String(r.lat),
                  lon: String(r.lng),
                  type: r.types?.[0] || 'geocode',
                  class: 'google_geocode',
                  google_types: r.types,
                }));
                let geoFiltered = geoMapped.filter((item) => passesStrictLocality(item, geoOpts));
                if (geoFiltered.length === 0 && strictCityBounds) {
                  geoFiltered = geoMapped.filter((item) => passesSoftLocality(item, geoOpts));
                }
                if (geoFiltered.length === 0 && geoMapped.length > 0) {
                  geoFiltered = pickRawFallbackTop(geoMapped, input, sortNeedle, 10);
                }
                geoFiltered.sort(compareRows);
                filtered = geoFiltered;
                acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
                  provider: 'google',
                  query: qTry,
                  city_label: cityLabel || null,
                  raw_result_count: geoMapped.length,
                  final_result_count: filtered.length,
                  error_message: null,
                  request_id: requestId,
                });
                if (filtered.length > 0) break googleGeo;
              } catch {
                filtered = [];
              }
            }
          }
        } catch (gErr) {
          const msg = gErr instanceof Error ? gErr.message : String(gErr);
          googleHadError = true;
          googleErrorHint = msg.slice(0, 160);
          acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
            provider: 'google',
            query: primarySearchQuery,
            city_label: cityLabel || null,
            raw_result_count: 0,
            final_result_count: 0,
            error_message: msg,
            request_id: requestId,
          });
          filtered = [];
        }
      }

      if (filtered.length === 0) {
        enteredNominatim = true;
        acDiag('AUTOCOMPLETE_FALLBACK_START', {
          provider: 'nominatim',
          query: primarySearchQuery,
          city_label: cityLabel || null,
          had_google_key: !!apiKey,
          request_id: requestId,
        });
        const limitPrimary =
          widerSearch && !strictCityBounds ? 22 : strictCityBounds ? 20 : 12;

        const buildUrl = (queryText: string, bounded: boolean, lim: number) => {
          let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            queryText,
          )}&countrycodes=tr&addressdetails=1&extratags=1&limit=${lim}&accept-language=tr`;

          let bboxParam: string | null = null;
          const useRegisteredCityBbox = !!(cityDataEffective && (!widerSearch || strictCityBounds));
          let usedBiasOnlyBbox = false;

          if (useRegisteredCityBbox) {
            bboxParam = nominatimViewboxFromStoredBbox(cityDataEffective!.bbox);
          } else if (
            strictCityBounds &&
            biasLatitude != null &&
            biasLongitude != null &&
            Number.isFinite(biasLatitude) &&
            Number.isFinite(biasLongitude)
          ) {
            bboxParam = gpsBiasViewbox(biasLatitude, biasLongitude, biasDeltaDeg);
            usedBiasOnlyBbox = true;
          }

          if (bboxParam && bounded) {
            url += `&viewbox=${bboxParam}&bounded=1`;
          }

          return { url, usedBiasOnlyBbox };
        };

        const runFetch = async (queryText: string, bounded: boolean, lim: number) => {
          const { url } = buildUrl(queryText, bounded, lim);
          const response = await fetch(url, {
            headers: { 'User-Agent': 'LeylekTAG-App/1.0' },
          });
          if (!response.ok) {
            throw new Error(`nominatim_http_${response.status}`);
          }
          const data: PlaceResult[] = await response.json();
          return Array.isArray(data) ? data : [];
        };

        const { usedBiasOnlyBbox } = buildUrl(primarySearchQuery, true, limitPrimary);

        const localityOptsBase: LocalityFilterOpts = {
          strictCityBounds,
          cityLabel,
          effectiveCityKey,
          cityDataEffective,
          biasLatitude,
          biasLongitude,
          biasDeltaDeg,
          usedBiasOnlyBbox,
          rawQueryLower: input.trim().toLocaleLowerCase('tr-TR'),
        };

        const filterAndRank = (rows: PlaceResult[]) => {
          let rowsIn = rows.filter((item) => !['country', 'state'].includes(item.type));
          const afterTypeFilter = rowsIn;

          if (strictCityBounds) {
            const before = rowsIn.length;
            const strictRows = rowsIn.filter((item) => passesStrictLocality(item, localityOptsBase));
            const softRows = rowsIn.filter((item) => passesSoftLocality(item, localityOptsBase));
            rowsIn = strictRows.length > 0 ? strictRows : softRows;
            if (before > rowsIn.length) {
              acDiag('AUTOCOMPLETE_FILTERED_OUT', {
                provider: 'nominatim',
                query: input.trim(),
                city_label: cityLabel || null,
                raw_result_count: before,
                final_result_count: rowsIn.length,
                reason: strictRows.length > 0 ? 'strict_city_bounds' : 'soft_city_bounds',
                filtered_out_count: before - rowsIn.length,
                request_id: requestId,
              });
            }
          }

          const seen = new Set<string>();
          const beforeDedup = rowsIn.length;
          rowsIn = rowsIn.filter((item) => {
            const id = String(item.place_id || `${item.lat},${item.lon}`);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          if (beforeDedup > rowsIn.length) {
            acDiag('AUTOCOMPLETE_FILTERED_OUT', {
              provider: 'nominatim',
              query: input.trim(),
              city_label: cityLabel || null,
              raw_result_count: beforeDedup,
              final_result_count: rowsIn.length,
              reason: 'dedupe',
              filtered_out_count: beforeDedup - rowsIn.length,
              request_id: requestId,
            });
          }

          if (rowsIn.length === 0 && afterTypeFilter.length > 0) {
            rowsIn = pickRawFallbackTop(afterTypeFilter, input, sortNeedle, 10);
          }

          rowsIn.sort(compareRows);

          return rowsIn;
        };

        let nom: PlaceResult[] = [];
        const pooledBounded: PlaceResult[] = [];

        for (const variant of searchVariants) {
          const boundedRows = await runFetch(variant, true, Math.max(8, limitPrimary));
          if (requestId !== autocompleteRequestIdRef.current) {
            return;
          }
          anyNomRaw = anyNomRaw || boundedRows.length > 0;
          pooledBounded.push(...boundedRows);
          nom = filterAndRank(boundedRows);
          if (nom.length > 0) break;
        }

        if (nom.length === 0 && pooledBounded.length > 0) {
          nom = filterAndRank(dedupePlaceResults(pooledBounded));
        }

        acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
          provider: 'nominatim',
          query: input.trim(),
          city_label: cityLabel || null,
          raw_result_count: pooledBounded.length,
          final_result_count: nom.length,
          phase: 'raw_fetch_bounded',
          request_id: requestId,
        });

        if (nom.length < 5 && strictCityBounds) {
          const looseAll: PlaceResult[] = [];
          for (const variant of searchVariants) {
            const looseRows = await runFetch(variant, false, 35);
            if (requestId !== autocompleteRequestIdRef.current) {
              return;
            }
            looseAll.push(...looseRows);
            anyNomRaw = anyNomRaw || looseRows.length > 0;
            if (looseRows.length > 0 && looseAll.length >= 24) break;
          }
          const byId = new Map<string, PlaceResult>();
          for (const r of [...dedupePlaceResults(pooledBounded), ...looseAll]) {
            const id = String(r.place_id || `${r.lat},${r.lon}`);
            if (!byId.has(id)) byId.set(id, r);
          }
          nom = filterAndRank(Array.from(byId.values()));
        }

        const nCap = widerSearch && !strictCityBounds ? 20 : strictCityBounds ? 18 : 12;
        nomFinalLenBeforeCap = nom.length;
        filtered = nom.slice(0, nCap);
        acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
          provider: 'nominatim',
          query: input.trim(),
          city_label: cityLabel || null,
          raw_result_count: nom.length,
          final_result_count: filtered.length,
          phase: 'after_cap',
          request_id: requestId,
        });
      }

      if (requestId !== autocompleteRequestIdRef.current) {
        return;
      }

      if (SHOW_PLACES_DIAG) {
        if (filtered.length > 0) {
          setSearchDiag(null);
        } else {
          let code: PlaceSearchDiagCode = 'unknown';
          let hint: string | undefined;
          if (enteredNominatim && anyNomRaw && nomFinalLenBeforeCap === 0) {
            code = 'filtered_empty';
          } else if (googleHadError) {
            code = 'google_error';
            hint = googleErrorHint;
          } else if (enteredNominatim && !anyNomRaw) {
            if (apiKey && !googleHadError && googleRawLen === 0) {
              code = 'both_empty';
            } else {
              code = 'nominatim_empty';
            }
          } else {
            code = 'unknown';
          }
          const payload: PlaceSearchDiag = hint ? { code, hint } : { code };
          setSearchDiag(payload);
          acDiag('AUTOCOMPLETE_DIAG', {
            ...payload,
            request_id: requestId,
            query: input.trim(),
          });
        }
      }

      acDiag('AUTOCOMPLETE_RENDER_RESULTS', {
        query: input.trim(),
        provider: filtered.length > 0 && filtered[0]?.source === 'google' ? 'google' : filtered.length > 0 ? 'nominatim' : 'none',
        raw_result_count: filtered.length,
        final_result_count: filtered.length,
        city_label: cityKeyHome || city.trim() || null,
        bias_lat_present: biasLatitude != null && Number.isFinite(biasLatitude),
        bias_lng_present: biasLongitude != null && Number.isFinite(biasLongitude),
        request_id: requestId,
      });
      if (filtered.length > 0) {
        setPredictions(filtered);
        setShowPredictions(true);
      } else {
        setPredictions([]);
        /** Boş sonuçta da liste alanı açık kalsın; aksi halde "sonuç yok" UI hiç görünmez */
        setShowPredictions(true);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
        provider: 'nominatim',
        query: input.trim(),
        raw_result_count: 0,
        final_result_count: 0,
        error_message: msg,
        request_id: requestId,
      });
      if (requestId === autocompleteRequestIdRef.current) {
        setPredictions([]);
        setShowPredictions(true);
        if (SHOW_PLACES_DIAG) {
          const hint = msg.slice(0, 160);
          const isNomHttp = hint.startsWith('nominatim_http_');
          const payload: PlaceSearchDiag = isNomHttp
            ? { code: 'nominatim_http', hint }
            : { code: 'unknown', hint };
          setSearchDiag(payload);
          acDiag('AUTOCOMPLETE_DIAG', {
            ...payload,
            request_id: requestId,
            query: input.trim(),
          });
        }
      }
    } finally {
      if (requestId === autocompleteRequestIdRef.current) {
        setLoading(false);
        setSearchRoundDone(true);
      }
    }
  };

  // Sonuç formatla
  const formatAddress = (item: PlaceResult): { main: string; secondary: string } => {
    if (item.structured_main) {
      return {
        main: item.structured_main,
        secondary: item.structured_secondary || '',
      };
    }
    const parts = item.display_name.split(',').map((p) => p.trim());

    const main = parts[0] || item.display_name;

    const secondary = parts.slice(1, 4).join(', ');

    return { main, secondary };
  };

  // Seçim işlemi
  const handleSelectPrediction = async (item: PlaceResult) => {
    if (!tech) {
      Keyboard.dismiss();
    }

    const formatted = formatAddress(item);

    if (item.source === 'google' && item.google_place_id) {
      const key = getGoogleMapsApiKey();
      if (!key) {
        return;
      }
      setLoading(true);
      try {
        const det = await googlePlaceDetailsLatLng(item.google_place_id, key);
        setQuery(formatted.main);
        setShowPredictions(false);
        setShowPopular(false);
        setPredictions([]);
        onPlaceSelected({
          address: det.formattedAddress || item.display_name,
          latitude: det.lat,
          longitude: det.lng,
        });
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
      return;
    }

    setQuery(formatted.main);
    setShowPredictions(false);
    setShowPopular(false);
    setPredictions([]);

    onPlaceSelected({
      address: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    });
  };

  // Popüler mahalle seçimi
  const handleSelectPopular = async (placeName: string) => {
    setLoading(true);
    Keyboard.dismiss();
    
    try {
      const searchQuery = city.trim()
        ? normalizePlaceQuery(placeName, city.trim())
        : `${placeName}, Türkiye`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=tr&limit=1&accept-language=tr`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'LeylekTAG-App/1.0' }
      });
      
      const data: PlaceResult[] = await response.json();
      
      if (data && data.length > 0) {
        const item = data[0];
        setQuery(placeName);
        setShowPredictions(false);
        setShowPopular(false);
        
        onPlaceSelected({
          address: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        });
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  const clearInput = () => {
    setQuery('');
    setPredictions([]);
    setShowPredictions(false);
    setShowPopular(true);
    setSearchRoundDone(false);
  };

  // Popüler yerler listesi
  const popularCityKey = resolveCityDataKey(city);
  const popularPlaces =
    hidePopularChips || !popularCityKey || !POPULAR_PLACES[popularCityKey]
      ? []
      : POPULAR_PLACES[popularCityKey];

  return (
    <View style={[styles.container, tech && suggestionsFirst && styles.containerTechSuggestionsFirst]}>
      {/* Öneriler — hedef modalında üstte */}
      {tech && suggestionsFirst
        ? showPredictions &&
          predictions.length > 0 && (
            <View
              style={[
                styles.predictionsContainer,
                tech && styles.predictionsContainerTech,
                tech && styles.predictionsAboveInput,
                predictionBoxDims,
              ]}
            >
              <FlatList
                data={predictions}
                keyExtractor={(item) => item.place_id}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const formatted = formatAddress(item);
                  return (
                    <TouchableOpacity
                      style={[styles.predictionItem, tech && styles.predictionItemTech]}
                      onPress={() => void handleSelectPrediction(item)}
                    >
                      <View style={[styles.iconContainer, tech && styles.iconContainerTech]}>
                        <Ionicons name="location" size={22} color={tech ? '#38BDF8' : '#3FA9F5'} />
                      </View>
                      <View style={styles.predictionTextContainer}>
                        <Text
                          style={[styles.predictionMainText, tech && styles.predictionMainTextTech]}
                          numberOfLines={2}
                        >
                          {formatted.main}
                        </Text>
                        <Text
                          style={[
                            styles.predictionSecondaryText,
                            tech && styles.predictionSecondaryTextTech,
                          ]}
                          numberOfLines={2}
                        >
                          {formatted.secondary}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={tech ? '#64748B' : '#CCC'} />
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => (
                  <View style={[styles.separator, tech && styles.separatorTech]} />
                )}
              />
            </View>
          )
        : null}

      {/* Arama Kutusu */}
      <View
        style={[
          styles.inputContainer,
          tech && styles.inputContainerTech,
          tech && inputSize === 'large' && styles.inputContainerTechLarge,
        ]}
      >
        <Ionicons
          name="search"
          size={inputSize === 'large' ? 22 : 20}
          color={tech ? '#38BDF8' : '#3FA9F5'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.input, tech && styles.inputTech, tech && inputSize === 'large' && styles.inputTechLarge]}
          placeholder={placeholder}
          placeholderTextColor={tech ? 'rgba(148, 163, 184, 0.95)' : '#999'}
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
          returnKeyType="search"
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={tech ? '#38BDF8' : '#3FA9F5'}
            style={styles.loader}
          />
        )}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={clearInput} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={tech ? '#94A3B8' : '#999'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Popüler Mahalleler */}
      {showPopular && popularPlaces.length > 0 && !hidePopularChips && (
        <View style={styles.popularContainer}>
          <Text style={styles.popularTitle}>📍 {city} Popüler Yerler</Text>
          <View style={styles.popularGrid}>
            {popularPlaces.map((place, index) => (
              <TouchableOpacity
                key={index}
                style={styles.popularChip}
                onPress={() => handleSelectPopular(place)}
              >
                <Text style={styles.popularChipText}>{place}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Öneriler — varsayılan: input altında */}
      {showPredictions && predictions.length > 0 && !(tech && suggestionsFirst) && (
        <View
          style={[
            styles.predictionsContainer,
            tech && styles.predictionsContainerTech,
            predictionBoxDims,
          ]}
        >
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item }) => {
              const formatted = formatAddress(item);
              return (
                <TouchableOpacity
                  style={[styles.predictionItem, tech && styles.predictionItemTech]}
                  onPress={() => void handleSelectPrediction(item)}
                >
                  <View style={[styles.iconContainer, tech && styles.iconContainerTech]}>
                    <Ionicons name="location" size={22} color={tech ? '#38BDF8' : '#3FA9F5'} />
                  </View>
                  <View style={styles.predictionTextContainer}>
                    <Text
                      style={[styles.predictionMainText, tech && styles.predictionMainTextTech]}
                      numberOfLines={2}
                    >
                      {formatted.main}
                    </Text>
                    <Text
                      style={[styles.predictionSecondaryText, tech && styles.predictionSecondaryTextTech]}
                      numberOfLines={2}
                    >
                      {formatted.secondary}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={tech ? '#64748B' : '#CCC'} />
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, tech && styles.separatorTech]} />
            )}
          />
        </View>
      )}

      {/* Sonuç Bulunamadı — yalnızca tüm arama varyantları tamamlandıktan sonra */}
      {showPredictions && predictions.length === 0 && query.length >= 2 && !loading && searchRoundDone && (
        <View style={[styles.noResultsContainer, tech && styles.noResultsContainerTech]}>
          <Ionicons name="location-outline" size={48} color={tech ? '#475569' : '#DDD'} />
          <Text style={[styles.noResultsText, tech && styles.noResultsTextTech]}>Sonuç bulunamadı</Text>
          <Text style={[styles.noResultsHint, tech && styles.noResultsHintTech]}>
            Daha açık yazmayı deneyin. Örn: Çankaya, Ankara
          </Text>
          {SHOW_PLACES_DIAG && searchDiag ? (
            <Text style={[styles.noResultsDiag, tech && styles.noResultsDiagTech]} numberOfLines={2}>
              {`diag: ${searchDiag.code}${searchDiag.hint ? ` · ${searchDiag.hint}` : ''}`}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  containerTechSuggestionsFirst: {
    flexGrow: 1,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: LAYOUT.inputMinHeight,
    paddingVertical: Platform.OS === 'android' ? 4 : 0,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputContainerTech: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(56, 189, 248, 0.55)',
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 56,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  inputTech: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F1F5F9',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  inputContainerTechLarge: {
    minHeight: 62,
    borderRadius: 18,
    paddingVertical: Platform.OS === 'android' ? 6 : 4,
  },
  inputTechLarge: {
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  loader: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
  },
  
  // Popüler yerler
  popularContainer: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  popularTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 14,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  popularChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: LAYOUT.popularChipMinHeight,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  popularChipText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  
  // Öneriler
  predictionsContainer: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  predictionsContainerTech: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 16,
    marginTop: 12,
  },
  predictionsAboveInput: {
    marginTop: 0,
    marginBottom: 10,
    flexGrow: 1,
    minHeight: 120,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  predictionItemTech: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerTech: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  predictionTextContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
  },
  predictionMainText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  predictionMainTextTech: {
    color: '#F8FAFC',
  },
  predictionSecondaryText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  predictionSecondaryTextTech: {
    color: '#94A3B8',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 66,
  },
  separatorTech: {
    backgroundColor: 'rgba(51, 65, 85, 0.9)',
    marginLeft: 66,
  },
  
  // Sonuç yok
  noResultsContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noResultsContainerTech: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginTop: 12,
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  noResultsTextTech: {
    color: '#CBD5E1',
  },
  noResultsHint: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
  },
  noResultsHintTech: {
    color: '#64748B',
  },
  noResultsDiag: {
    marginTop: 8,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  noResultsDiagTech: {
    color: '#475569',
  },
});
