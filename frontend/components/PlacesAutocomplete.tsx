import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
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
  'Ağrı': { lat: 39.7191, lng: 43.0503, bbox: '42.45,39.20,44.55,40.15' },
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

/** Lifecycle + son başarılı cache anahtarı: sorgu + şehir prop */
function placesSearchStableKey(queryTrim: string, cityRaw: string): string {
  return `${normCityNeedle(queryTrim)}|${normCityNeedle(String(cityRaw || '').trim())}`;
}

/** replayOnBiasChange: GPS titreşiminde tick artmasın — anlamlı konum sıçraması için yeterince kaba grid */
function roundPlacesReplayCoord(n: number | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1e4) / 1e4;
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

/**
 * Muhabbet şehir dışı / uç nokta — hızlı merkez seçimleri (arama kutusu tasarımına dokunmadan).
 */
export type MuhabbetQuickPickPlace = { label: string; latitude: number; longitude: number };

export function buildMuhabbetQuickPickSuggestions(effectiveCityLabel: string): MuhabbetQuickPickPlace[] {
  const globalOrdered: MuhabbetQuickPickPlace[] = [
    { label: 'Ankara Merkez', latitude: CITY_DATA.Ankara.lat, longitude: CITY_DATA.Ankara.lng },
    { label: 'İstanbul (Avrupa Yakası)', latitude: 41.0369, longitude: 28.985 },
    { label: 'İstanbul (Anadolu Yakası)', latitude: 40.9903, longitude: 29.0266 },
    { label: 'İzmir Merkez', latitude: CITY_DATA.İzmir.lat, longitude: CITY_DATA.İzmir.lng },
    { label: 'Bursa Merkez', latitude: CITY_DATA.Bursa.lat, longitude: CITY_DATA.Bursa.lng },
    { label: 'Antalya Merkez', latitude: CITY_DATA.Antalya.lat, longitude: CITY_DATA.Antalya.lng },
    { label: 'Adana Merkez', latitude: CITY_DATA.Adana.lat, longitude: CITY_DATA.Adana.lng },
    { label: 'Konya Merkez', latitude: CITY_DATA.Konya.lat, longitude: CITY_DATA.Konya.lng },
    { label: 'Gaziantep Merkez', latitude: CITY_DATA.Gaziantep.lat, longitude: CITY_DATA.Gaziantep.lng },
    { label: 'Mersin Merkez', latitude: CITY_DATA.Mersin.lat, longitude: CITY_DATA.Mersin.lng },
  ];

  const seen = new Set<string>();
  const out: MuhabbetQuickPickPlace[] = [];

  const ct = effectiveCityLabel.trim();
  const activeKey = ct ? resolveCityDataKey(ct) : null;
  if (activeKey && CITY_DATA[activeKey]) {
    const ml = `${activeKey} Merkez`;
    const k = normalizeText(ml);
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ label: ml, latitude: CITY_DATA[activeKey].lat, longitude: CITY_DATA[activeKey].lng });
    }
  } else if (ct) {
    const registered = getRegisteredCityCenter(ct);
    if (registered) {
      const titled =
        ct.length > 0 ? `${ct.charAt(0).toLocaleUpperCase('tr-TR')}${ct.slice(1)} Merkez` : 'Merkez';
      const nk = normalizeText(titled);
      if (!seen.has(nk)) {
        seen.add(nk);
        out.push({ label: titled, latitude: registered.latitude, longitude: registered.longitude });
      }
    }
  }

  for (const r of globalOrdered) {
    const k = normalizeText(r.label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }

  return out;
}

function prependCityQualifiedSearchVariants(
  rawInput: string,
  effectiveCityKey: string | null,
  explicitOtherKey: string | null,
  existing: string[],
): string[] {
  const cityKey = explicitOtherKey || effectiveCityKey;
  if (!cityKey || !CITY_DATA[cityKey]) return existing;

  const head = rawInput.trim().replace(/\s+/g, ' ');
  if (head.length < 2) return existing;

  const cityName = cityKey;
  const nHead = normalizeText(head);
  if (nHead.includes(normalizeText(cityName))) return existing;
  if (/\bt[uü]rkiye\b/i.test(head) || /\bturkey\b/i.test(head)) return existing;

  const extras: string[] = [
    `${head}, ${cityName}, Türkiye`,
    `${head} İlçesi, ${cityName}, Türkiye`,
    `${head} Mahallesi, ${cityName}, Türkiye`,
    `${foldTrAscii(head)}, ${foldTrAscii(cityName)}, Turkey`,
  ];

  if (cityKey === 'Ankara' && nHead.includes('cankaya')) {
    extras.push(
      'Çankaya, Ankara, Türkiye',
      'Cankaya, Ankara, Türkiye',
      'Çankaya Mahallesi, Ankara, Türkiye',
      'Cankaya Mahallesi, Ankara, Türkiye',
      'Çankaya İlçesi, Ankara, Türkiye',
      'Cankaya İlçesi, Ankara, Türkiye',
      'Cankaya, Ankara, Turkey',
    );
  }
  if (cityKey === 'İstanbul' && nHead.includes('fatih')) {
    extras.push('Fatih, İstanbul, Türkiye', 'Fatih İlçesi, İstanbul, Türkiye', 'Fatih Mahallesi, İstanbul, Türkiye');
  }

  const seen = new Set(existing.map((s) => normCityNeedle(s)));
  const front: string[] = [];
  for (const s of extras) {
    const t = s.trim().replace(/\s+/g, ' ');
    const kk = normCityNeedle(t);
    if (!kk || seen.has(kk)) continue;
    seen.add(kk);
    front.push(t);
  }
  return [...front, ...existing];
}

/**
 * Tek başına sayı ile başlayan sorguda (446, 446 sokak…) OSM/Google için şehir bağlamı sık sık gerekiyor.
 * `cityTrim` dolu olmalı; çıktı `prependCityQualifiedSearchVariants` sonrasına eklenir.
 */
function prependNumericStreetSearchVariants(
  rawInput: string,
  cityTrim: string,
  explicitOtherKey: string | null,
  effectiveCityKey: string | null,
  existing: string[],
): string[] {
  const cityKey = explicitOtherKey || effectiveCityKey;
  if (!cityTrim.trim() || !cityKey || !CITY_DATA[cityKey]) return existing;

  const head = rawInput.trim().replace(/\s+/g, ' ');
  const mNum = /^(\d{1,5})\b/.exec(head);
  if (!mNum) return existing;

  const cityName = cityKey;
  const num = mNum[1];
  const rawVariants = [
    `${num}, ${cityName}, Türkiye`,
    `${num} Sokak, ${cityName}, Türkiye`,
    `${num}. Sokak, ${cityName}, Türkiye`,
    `${num} Cadde, ${cityName}, Türkiye`,
    `${num}. Cadde, ${cityName}, Türkiye`,
    `${num} Caddesi, ${cityName}, Türkiye`,
    `${num} Mahallesi, ${cityName}, Türkiye`,
  ];

  const seen = new Set(existing.map((s) => normCityNeedle(s)));
  const front: string[] = [];
  for (const s of rawVariants) {
    const t = s.trim().replace(/\s+/g, ' ');
    const kk = normCityNeedle(t);
    if (!kk || seen.has(kk)) continue;
    seen.add(kk);
    front.push(t);
  }
  return [...front, ...existing];
}

/** Tek turda çok fazla provider isteği yöneltmeyelim (Google merged = 4×/varyant). */
const PLACES_SEARCH_VARIANT_CAP = 5;
/** Google autocomplete+geocode+loose: en fazla bu kadar farklı dize */
const PLACES_GOOGLE_VARIANT_ATTEMPT_CAP = 2;
/** Nominatim bounded/loose: en fazla bu kadar sorgu */
const PLACES_NOMINATIM_VARIANT_ATTEMPT_CAP = 2;

/**
 * Ham + prepend sonrası listeyi 4–5 güçlü varyanta indirir:
 * ham → şehir,Türkiye → Çankaya (Ankara) → sayı+sokak/cad… → geri kalan sırayla dolum.
 */
function capPlacesSearchVariants(
  full: string[],
  rawInput: string,
  cityLabel: string,
  effectiveCityKey: string | null,
): string[] {
  const head = rawInput.trim().replace(/\s+/g, ' ');
  if (head.length < 2) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  const tryAdd = (s: string): void => {
    if (out.length >= PLACES_SEARCH_VARIANT_CAP) return;
    const t = s.trim().replace(/\s+/g, ' ');
    if (t.length < 2) return;
    const k = normCityNeedle(t);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  tryAdd(head);

  const cityTrim = String(cityLabel || '').trim();
  if (cityTrim) {
    tryAdd(`${head}, ${cityTrim}, Türkiye`);
    const nq = normalizePlaceQuery(head, cityTrim);
    if (nq) tryAdd(nq);
  }

  const nHead = normalizeText(head);
  if (effectiveCityKey === 'Ankara' && nHead.includes('cankaya')) {
    tryAdd('Çankaya, Ankara, Türkiye');
    tryAdd('Cankaya, Ankara, Türkiye');
    tryAdd(`${head}, Ankara, Türkiye`);
    tryAdd('Çankaya Mahallesi, Ankara, Türkiye');
    tryAdd('Cankaya Mahallesi, Ankara, Türkiye');
    tryAdd('Çankaya İlçesi, Ankara, Türkiye');
    tryAdd('Cankaya İlçesi, Ankara, Türkiye');
    tryAdd('Cankaya, Ankara, Turkey');
  }

  const headNk = normCityNeedle(head);
  if (/^\d{1,5}\b/.test(head)) {
    let numPicked = 0;
    for (const v of full) {
      if (out.length >= PLACES_SEARCH_VARIANT_CAP || numPicked >= 3) break;
      const vn = v.trim().replace(/\s+/g, ' ');
      if (vn.length < 2 || normCityNeedle(vn) === headNk) continue;
      if (!/^\d{1,5}\b/.test(vn)) continue;
      const lenBefore = out.length;
      tryAdd(vn);
      if (out.length > lenBefore) numPicked += 1;
    }
  }

  for (const v of full) {
    if (out.length >= PLACES_SEARCH_VARIANT_CAP) break;
    tryAdd(v.trim().replace(/\s+/g, ' '));
  }

  return out;
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
    [
      'neighbourhood',
      'suburb',
      'quarter',
      'road',
      'residential',
      'living_street',
      'pedestrian',
      'city',
      'town',
      'village',
      'hamlet',
      'municipality',
      'administrative',
    ].includes(t) ||
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
      return urbanRankTier(item) <= 8;
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
    if (
      types.some((t) =>
        [
          'street_address',
          'route',
          'premise',
          'subpremise',
          'intersection',
          'neighborhood',
          'sublocality',
          'sublocality_level_1',
          'sublocality_level_2',
          'sublocality_level_3',
        ].includes(t),
      )
    )
      tr = 0;
    else if (
      types.some((t) =>
        [
          'sublocality_level_1',
          'sublocality_level_2',
          'neighborhood',
          'sublocality',
          'locality',
          'administrative_area_level_2',
          'administrative_area_level_3',
          'administrative_area_level_4',
        ].includes(t),
      )
    )
      tr = 1;
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

const COMPACT_MERKEZ_CHIP_MAX = 3;

/** Muhabbet merkez chip → modal / listing doğrulaması için */
export type PlaceSelectionSource = 'merkez_chip';

function exactCityMerkezChips(rawQuery: string): MuhabbetQuickPickPlace[] {
  const q = normalizeText(rawQuery.trim());
  if (q.length < 2) return [];
  const hits: MuhabbetQuickPickPlace[] = [];
  for (const key of Object.keys(CITY_DATA)) {
    if (normalizeText(key) === q) {
      hits.push({
        label: `${key} Merkez`,
        latitude: CITY_DATA[key].lat,
        longitude: CITY_DATA[key].lng,
      });
    }
  }
  hits.sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  return hits;
}

/** Tam şehir eşleşmeleri çıkarılmış kısmi eşleşmeler (öncelik 3) */
function fallbackCityMerkezChips(
  rawQuery: string,
  limit: number,
  excludeNormalizedCityKeys: Set<string>,
): MuhabbetQuickPickPlace[] {
  const q = normalizeText(rawQuery.trim());
  if (q.length < 2 || limit <= 0) return [];
  const scored: { place: MuhabbetQuickPickPlace; score: number }[] = [];
  for (const key of Object.keys(CITY_DATA)) {
    const nk = normalizeText(key);
    if (excludeNormalizedCityKeys.has(nk)) continue;
    if (nk === q) continue;
    let score = 100;
    if (nk.startsWith(q)) score = 1 + nk.length * 0.001;
    else if (q.length >= 3 && nk.includes(q)) score = 10 + nk.length * 0.001;
    else continue;
    scored.push({
      score,
      place: {
        label: `${key} Merkez`,
        latitude: CITY_DATA[key].lat,
        longitude: CITY_DATA[key].lng,
      },
    });
  }
  scored.sort((a, b) => a.score - b.score || a.place.label.localeCompare(b.place.label, 'tr'));
  const seen = new Set<string>();
  const out: MuhabbetQuickPickPlace[] = [];
  for (const { place } of scored) {
    const id = normalizeText(place.label);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(place);
    if (out.length >= limit) break;
  }
  return out;
}

/** Seçili şehir bağlamındaki popüler ilçe/mahalle adları — koordinatlar ayrıca Nominatim ile çözülür */
function matchPopularDistrictMerkezHints(
  rawQuery: string,
  cityLabel: string,
  limit: number,
): { label: string; district: string; cityKey: string }[] {
  if (limit <= 0) return [];
  const cityKey = resolveCityDataKey(cityLabel.trim());
  if (!cityKey || !POPULAR_PLACES[cityKey]) return [];
  const q = normalizeText(rawQuery.trim());
  if (q.length < 2) return [];
  const scored: { label: string; district: string; cityKey: string; score: number }[] = [];
  for (const d of POPULAR_PLACES[cityKey]) {
    const nd = normalizeText(d);
    let score = 100;
    if (nd === q) score = 0;
    else if (nd.startsWith(q)) score = 1;
    else if (q.length >= 3 && nd.includes(q)) score = 8;
    else continue;
    scored.push({ label: `${d} Merkez`, district: d, cityKey, score });
  }
  scored.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, 'tr'));
  return scored.slice(0, limit);
}

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
  /** Ana arama sırası başarılı olunca son çare Nominatim turundan (yanıltıcı olmasın diye ikincil metin) */
  isSilentRefinement?: boolean;
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
  /** Muhabbet: şehir/ilçe merkez chip seçimi — Tam burası zorunluluğu muaf */
  selectionSource?: PlaceSelectionSource;
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
      radiusMeters: strictCityBounds ? 50000 : 42000,
      strictBounds: false,
    };
  }
  if (effectiveCityKey && CITY_DATA[effectiveCityKey]) {
    const d = CITY_DATA[effectiveCityKey];
    return {
      latitude: d.lat,
      longitude: d.lng,
      radiusMeters: strictCityBounds ? 56000 : 60000,
      strictBounds: false,
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

function nominatimRowLikelyTurkey(item: PlaceResult): boolean {
  const a = (item.address || {}) as Record<string, string | undefined>;
  const cc = (a.country_code || '').toLowerCase();
  if (cc === 'tr') return true;
  const ctry = typeof a.country === 'string' ? normalizeText(a.country) : '';
  if (ctry && (ctry.includes(normalizeText('Türkiye')) || ctry.includes('turkey'))) return true;
  const dnRaw = item.display_name || '';
  const dn = normalizeText(dnRaw);
  if (dn.includes(normalizeText('Türkiye'))) return true;
  if (/\bt[uü]rkiye\b/i.test(dnRaw) || /\bturkey\b/i.test(dnRaw)) return true;
  return false;
}

/** relaxed guard: liste dışına taşmış “şehir adı geçen” tuzakları kes — bbox/bias kutusu içi + TR + şehir etiketi */
function nominatimRelaxedPassesSafeGuard(
  item: PlaceResult,
  cityCtx: string,
  localityOptsBase: LocalityFilterOpts,
): boolean {
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (!nominatimRowLikelyTurkey(item)) return false;
  const ctx = cityCtx.trim();
  if (!(ctx ? nominatimResultInCityLabel(item, ctx) : true)) return false;
  const { effectiveCityKey, cityDataEffective, biasLatitude, biasLongitude, biasDeltaDeg } = localityOptsBase;
  if (cityDataEffective && effectiveCityKey) {
    return pointInStoredCityBbox(lat, lon, cityDataEffective.bbox);
  }
  if (
    localityOptsBase.usedBiasOnlyBbox &&
    biasLatitude != null &&
    biasLongitude != null &&
    Number.isFinite(biasLatitude) &&
    Number.isFinite(biasLongitude)
  ) {
    return pointInGpsBiasBox(lat, lon, biasLatitude, biasLongitude, biasDeltaDeg);
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
  if (t === 'town' || t === 'city' || t === 'administrative' || t === 'municipality') return 4;
  return 6;
}

/** Liste sırası: ilçe/mahalle → sokak/yol → konut → diğer */
function localityDisplayRank(item: PlaceResult): number {
  const t = (item.type || '').toLowerCase();
  const c = (item.class || '').toLowerCase();
  if (['neighbourhood', 'suburb', 'quarter'].includes(t)) return 0;
  if (['city', 'town', 'administrative', 'municipality'].includes(t)) return 0;
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
  /** Muhabbet şehir dışı: arama metnine şehir / Türkiye varyantları eklenir */
  forceCityInSearch?: boolean;
  /** Küçük tek satır şehir / ilçe merkez önerileri (büyük hızlı seçim paneli kapalı) */
  compactMerkezChips?: boolean;
  /** Muhabbet şehir dışı: kısa/boş sorguda harici koordinatlı hızlı seçimler */
  quickPickSuggestions?: MuhabbetQuickPickPlace[];
  /** quickPickSuggestions gösterimi için üst karakter sınırı (varsayılan 3) */
  quickPickShowMaxQueryLength?: number;
  /** TAG hedef modalı: city/bias değiştiğinde aktif query'yi tekrar ara */
  replayOnBiasChange?: boolean;
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
  compactMerkezChips = false,
  quickPickSuggestions,
  quickPickShowMaxQueryLength = 3,
  replayOnBiasChange = false,
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
  /** Kutu içindeki güncel metin — tamamlanan async aramanın yazdığı UI ile eşleşsin */
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;
  /** Son anlamlı sonuç; geçici boş / koruma kodlu HTTP için aynı sorguda liste kaybını keser */
  const lastSuccessfulPredictionsRef = useRef<{ key: string; rows: PlaceResult[] } | null>(null);

  /** Artan kimlik: tamamlanan arama yanıtı yalnızca en son isteğe aitse state günceller (yarış / boş liste). */
  const autocompleteRequestIdRef = useRef(0);
  const districtMerkezFetchGenRef = useRef(0);
  const districtMerkezCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const [districtMerkezCoords, setDistrictMerkezCoords] = useState<
    Record<string, { lat: number; lng: number }>
  >({});
  const [searchReplayTick, setSearchReplayTick] = useState(0);
  /** Popüler mahalle / Nominatim tek atış hata metni (Alert yok) */
  const [popularGeocodeError, setPopularGeocodeError] = useState<string | null>(null);
  /** Öneri seçimi (Places Details / koordinat) */
  const [predictionActionError, setPredictionActionError] = useState<string | null>(null);
  /** Aktif arama iptali — yeni istek veya unmount önceki fetch'leri keser */
  const placesSearchAbortRef = useRef<AbortController | null>(null);
  /** replayOnBiasChange: aynı semantik anahtarda searchReplayTick artırılmasın (abort/replan döngüsü) */
  const lastPlacesReplayKeyRef = useRef<string>('');

  const matchesActivePlacesJob = (jobRequestId: number, searchedTrim: string): boolean =>
    jobRequestId === autocompleteRequestIdRef.current && searchedTrim === latestQueryRef.current.trim();

  const compactMerkezEntries = useMemo(() => {
    const empty = {
      exactCities: [] as MuhabbetQuickPickPlace[],
      districts: [] as { label: string; district: string; cityKey: string }[],
      fallbackCities: [] as MuhabbetQuickPickPlace[],
    };
    if (!compactMerkezChips || query.trim().length < 2) return empty;

    const qc = query.trim();
    const exactCities = exactCityMerkezChips(qc);
    let budget = COMPACT_MERKEZ_CHIP_MAX;
    const takenExact = exactCities.slice(0, budget);
    budget -= takenExact.length;

    const excludeCityNorm = new Set(
      takenExact
        .map((p) => {
          const base = p.label.replace(/\s+Merkez\s*$/i, '').trim();
          const k = resolveCityDataKey(base);
          return normalizeText(k || base);
        })
        .filter(Boolean),
    );

    const districts = budget > 0 ? matchPopularDistrictMerkezHints(qc, city, budget) : [];
    budget -= districts.length;

    const fallbackCities =
      budget > 0 ? fallbackCityMerkezChips(qc, budget, excludeCityNorm) : [];

    return { exactCities: takenExact, districts, fallbackCities };
  }, [compactMerkezChips, query, city]);

  const quickPickList = quickPickSuggestions ?? [];
  const quickPickFewAutocomplete = predictions.length < 3;
  const showQuickPicks =
    !compactMerkezChips &&
    quickPickList.length > 0 &&
    (query.trim().length <= quickPickShowMaxQueryLength || quickPickFewAutocomplete);

  const showCompactMerkezRow =
    compactMerkezChips &&
    query.trim().length >= 2 &&
    (compactMerkezEntries.exactCities.length > 0 ||
      compactMerkezEntries.districts.length > 0 ||
      compactMerkezEntries.fallbackCities.length > 0);

  /** Şehir bağlamı değişince önceki şehir önerileri kalmasın (harita/bias güncellenmesiyle uyumlu). */
  useEffect(() => {
    placesSearchAbortRef.current?.abort();
    placesSearchAbortRef.current = null;
    autocompleteRequestIdRef.current += 1;
    lastSuccessfulPredictionsRef.current = null;
    setPredictions([]);
    setSearchRoundDone(false);
    districtMerkezCoordsRef.current = {};
    setDistrictMerkezCoords({});
  }, [city]);

  useEffect(() => {
    return () => {
      placesSearchAbortRef.current?.abort();
      placesSearchAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!replayOnBiasChange) return;
    if (query.trim().length < 2) return;
    const replayKey = JSON.stringify({
      q: normalizeText(query),
      city: normalizeText(city || ''),
      strict: !!strictCityBounds,
      biasLat: roundPlacesReplayCoord(biasLatitude ?? undefined),
      biasLng: roundPlacesReplayCoord(biasLongitude ?? undefined),
      biasDeltaDeg: Math.round(biasDeltaDeg * 10000) / 10000,
      forceCityInSearch: !!forceCityInSearch,
    });
    if (replayKey === lastPlacesReplayKeyRef.current) return;
    lastPlacesReplayKeyRef.current = replayKey;
    try {
      console.log(
        'TAG_PLACE_SEARCH_REPLAY_ON_BIAS_CHANGE',
        JSON.stringify({
          query_len: query.trim().length,
          has_city: !!city.trim(),
          strict_city_bounds: !!strictCityBounds,
          has_bias: !!(
            biasLatitude != null &&
            Number.isFinite(biasLatitude) &&
            biasLongitude != null &&
            Number.isFinite(biasLongitude)
          ),
          replay_key_len: replayKey.length,
        }),
      );
    } catch {
      /* noop */
    }
    setSearchReplayTick((n) => n + 1);
  }, [
    replayOnBiasChange,
    query,
    city,
    strictCityBounds,
    biasLatitude,
    biasLongitude,
    biasDeltaDeg,
    forceCityInSearch,
  ]);

  useEffect(() => {
    if (!compactMerkezChips || compactMerkezEntries.districts.length === 0) return undefined;
    const hints = compactMerkezEntries.districts;
    let cancelled = false;
    const gen = ++districtMerkezFetchGenRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        for (const h of hints) {
          if (cancelled || gen !== districtMerkezFetchGenRef.current) return;
          const key = `${h.district}|${h.cityKey}`;
          if (districtMerkezCoordsRef.current[key]) continue;
          try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              `${h.district}, ${h.cityKey}, Türkiye`,
            )}&limit=1&countrycodes=tr&accept-language=tr`;
            const response = await fetch(url, {
              headers: { 'User-Agent': 'LeylekTAG-App/1.0' },
            });
            if (!response.ok) continue;
            const data = (await response.json()) as { lat?: string; lon?: string }[];
            const row = Array.isArray(data) ? data[0] : undefined;
            const lat = Number(row?.lat);
            const lng = Number(row?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            if (cancelled || gen !== districtMerkezFetchGenRef.current) return;
            districtMerkezCoordsRef.current[key] = { lat, lng };
            setDistrictMerkezCoords((prev) => ({ ...prev, [key]: { lat, lng } }));
          } catch (e) {
            if (SHOW_PLACES_DIAG) {
              console.warn('[PlacesAutocomplete] districtMerkez nominatim', e);
            }
          }
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [compactMerkezChips, compactMerkezEntries.districts]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      placesSearchAbortRef.current?.abort();
      placesSearchAbortRef.current = null;
      autocompleteRequestIdRef.current += 1;
      lastSuccessfulPredictionsRef.current = null;
      setPredictions([]);
      setShowPredictions(false);
      setShowPopular(true);
      setLoading(false);
      setSearchRoundDone(false);
      if (SHOW_PLACES_DIAG) setSearchDiag(null);
      setPopularGeocodeError(null);
      setPredictionActionError(null);
      return;
    }

    setShowPopular(false);
    const debounceMs = getGoogleMapsApiKey() ? 200 : widerSearch ? 220 : 280;
    debounceRef.current = setTimeout(() => {
      void searchPlaces(query);
    }, debounceMs);

    return () => {
      const pendingTimerId = debounceRef.current;
      const hadScheduledTimer = pendingTimerId != null;
      if (hadScheduledTimer) {
        clearTimeout(pendingTimerId);
        debounceRef.current = null;
      }
      const hadInflightPlacesSearch = placesSearchAbortRef.current != null;
      if (hadInflightPlacesSearch) {
        placesSearchAbortRef.current?.abort();
        placesSearchAbortRef.current = null;
      }
      if (hadScheduledTimer || hadInflightPlacesSearch) {
        autocompleteRequestIdRef.current += 1;
        setLoading(false);
        setSearchRoundDone(false);
      }
    };
  }, [
    query,
    widerSearch,
    city,
    strictCityBounds,
    biasLatitude,
    biasLongitude,
    biasDeltaDeg,
    forceCityInSearch,
    searchReplayTick,
  ]);

  /** Önce Google Places (Autocomplete + Details ile koordinat); boş / hata → Nominatim (mevcut mantık). */
  const searchPlaces = async (input: string) => {
    const searchedTrim = input.trim();
    if (searchedTrim.length < 2) return;
    if (searchedTrim !== latestQueryRef.current.trim()) return;

    placesSearchAbortRef.current?.abort();
    const ac = new AbortController();
    placesSearchAbortRef.current = ac;
    const signal = ac.signal;
    const requestId = ++autocompleteRequestIdRef.current;

    if (!matchesActivePlacesJob(requestId, searchedTrim)) {
      return;
    }

    setSearchRoundDone(false);
    setLoading(true);
    setPopularGeocodeError(null);
    setPredictionActionError(null);
    const apiKey = getGoogleMapsApiKey();
    let googleHadError = false;
    let googleErrorHint: string | undefined;
    let googleRawLen: number | null = null;
    let enteredNominatim = false;
    let anyNomRaw = false;
    let nomFinalLenBeforeCap = 0;
    let nominatimRawTotal = 0;
    let diagFallbackUsed = false;
    if (SHOW_PLACES_DIAG) setSearchDiag(null);
    try {
      console.log(
        'TAG_PLACE_SEARCH_START',
        JSON.stringify({
          query_len: input.trim().length,
          has_city: !!city.trim(),
          strict_city_bounds: !!strictCityBounds,
          has_bias: !!(
            biasLatitude != null &&
            Number.isFinite(biasLatitude) &&
            biasLongitude != null &&
            Number.isFinite(biasLongitude)
          ),
          request_id: requestId,
        }),
      );
    } catch {
      /* noop */
    }
    try {
      const cityKeyHome = resolveCityDataKey(city);
      const cityLabel = cityKeyHome || city.trim();
      const explicitOtherKey = explicitOtherMajorCityKeyFromQuery(input, cityKeyHome);
      const effectiveCityKey = explicitOtherKey || cityKeyHome;
      const cityDataEffective = effectiveCityKey ? CITY_DATA[effectiveCityKey] : null;
      let searchVariantsUncapped = buildOrderedSearchVariants(input, cityLabel, explicitOtherKey, forceCityInSearch);
      searchVariantsUncapped = prependCityQualifiedSearchVariants(
        input,
        effectiveCityKey,
        explicitOtherKey,
        searchVariantsUncapped,
      );
      searchVariantsUncapped = prependNumericStreetSearchVariants(
        input,
        String(city || '').trim(),
        explicitOtherKey,
        effectiveCityKey,
        searchVariantsUncapped,
      );
      const searchVariants = capPlacesSearchVariants(
        searchVariantsUncapped,
        input,
        cityLabel,
        effectiveCityKey,
      );
      const googleAttemptVariants = searchVariants.slice(0, PLACES_GOOGLE_VARIANT_ATTEMPT_CAP);
      const nominatimAttemptVariants = searchVariants.slice(0, PLACES_NOMINATIM_VARIANT_ATTEMPT_CAP);
      let nominatimRateLimited = false;
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

          googleAuto: for (const qTry of googleAttemptVariants) {
            acDiag('AUTOCOMPLETE_PROVIDER_START', {
              provider: 'google_autocomplete',
              query: qTry,
              city_label: cityLabel || null,
              request_id: requestId,
            });
            const raw = await googlePlacesAutocompleteMerged(qTry, apiKey, gBias, signal);
            if (!matchesActivePlacesJob(requestId, searchedTrim)) {
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

            googleGeo: for (const qTry of googleAttemptVariants) {
              try {
                acDiag('AUTOCOMPLETE_PROVIDER_START', {
                  provider: 'google_geocode',
                  query: qTry,
                  city_label: cityLabel || null,
                  request_id: requestId,
                });
                const geocoded = await googleGeocodeText(qTry, apiKey, gBias, signal);
                if (!matchesActivePlacesJob(requestId, searchedTrim)) {
                  return;
                }
                googleRawLen = googleRawLen ?? geocoded.length;
                const geoMapped: PlaceResult[] = geocoded.map((r, ix) => ({
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
                  diagFallbackUsed = true;
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

            if (filtered.length === 0 && gBias) {
              const gBiasLoose: GoogleAutocompleteBias = { ...gBias, strictBounds: false };
              looseAuto: for (const qTry of googleAttemptVariants) {
                acDiag('AUTOCOMPLETE_PROVIDER_START', {
                  provider: 'google_autocomplete_loose',
                  query: qTry,
                  city_label: cityLabel || null,
                  request_id: requestId,
                });
                const rawLoose = await googlePlacesAutocompleteMerged(qTry, apiKey, gBiasLoose, signal);
                if (!matchesActivePlacesJob(requestId, searchedTrim)) {
                  return;
                }
                if (rawLoose.length > 0) {
                  googleRawLen = googleRawLen ?? rawLoose.length;
                  const nextLoose = rawLoose.map(mapGooglePredictionToPlaceResult);
                  nextLoose.sort(compareRows);
                  const gCapLoose = widerSearch && !strictCityBounds ? 24 : strictCityBounds ? 20 : 14;
                  filtered = nextLoose.slice(0, gCapLoose);
                  acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
                    provider: 'google',
                    query: qTry,
                    city_label: cityLabel || null,
                    raw_result_count: rawLoose.length,
                    final_result_count: filtered.length,
                    error_message: null,
                    request_id: requestId,
                    phase: 'autocomplete_loose_bounds',
                  });
                  break looseAuto;
                }
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

        const runFetch = async (queryText: string, bounded: boolean, lim: number): Promise<PlaceResult[]> => {
          if (nominatimRateLimited) return [];
          const { url } = buildUrl(queryText, bounded, lim);
          const response = await fetch(url, {
            headers: { 'User-Agent': 'LeylekTAG-App/1.0' },
            signal,
          });
          if (!response.ok) {
            if (response.status === 429 || response.status === 403) {
              nominatimRateLimited = true;
              return [];
            }
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
          let rowsIn = rows.filter(
            (item) => !['country', 'state'].includes(String(item.type || '').toLowerCase()),
          );
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
            diagFallbackUsed = true;
            rowsIn = pickRawFallbackTop(afterTypeFilter, input, sortNeedle, 10);
          }

          rowsIn.sort(compareRows);

          return rowsIn;
        };

        let nom: PlaceResult[] = [];
        const pooledBounded: PlaceResult[] = [];

        for (const variant of nominatimAttemptVariants) {
          const boundedRows = await runFetch(variant, true, Math.max(8, limitPrimary));
          if (!matchesActivePlacesJob(requestId, searchedTrim)) {
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

        const looseAccum: PlaceResult[] = [];
        if (nom.length < 5 && strictCityBounds) {
          for (const variant of nominatimAttemptVariants) {
            const looseRows = await runFetch(variant, false, 35);
            if (!matchesActivePlacesJob(requestId, searchedTrim)) {
              return;
            }
            looseAccum.push(...looseRows);
            anyNomRaw = anyNomRaw || looseRows.length > 0;
            if (looseRows.length > 0 && looseAccum.length >= 24) break;
          }
          const byId = new Map<string, PlaceResult>();
          for (const r of [...dedupePlaceResults(pooledBounded), ...looseAccum]) {
            const id = String(r.place_id || `${r.lat},${r.lon}`);
            if (!byId.has(id)) byId.set(id, r);
          }
          nom = filterAndRank(Array.from(byId.values()));
        }

        if (nom.length === 0 && strictCityBounds) {
          const unionRaw = dedupePlaceResults([...pooledBounded, ...looseAccum]).filter(
            (item) => !['country', 'state'].includes(String(item.type || '').toLowerCase()),
          );
          if (unionRaw.length > 0) {
            const cityCtx = (sortNeedle || cityLabel || '').trim();
            const relaxedRows = unionRaw.filter((item) =>
              nominatimRelaxedPassesSafeGuard(item, cityCtx, localityOptsBase),
            );
            if (relaxedRows.length > 0) {
              diagFallbackUsed = true;
              relaxedRows.sort(compareRows);
              nom = relaxedRows;
              acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
                provider: 'nominatim',
                query: input.trim(),
                city_label: cityLabel || null,
                raw_result_count: unionRaw.length,
                final_result_count: relaxedRows.length,
                phase: 'relaxed_tr_city_guard',
                request_id: requestId,
              });
            }
          }
        }

        nominatimRawTotal = dedupePlaceResults([...pooledBounded, ...looseAccum]).length;

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

      if (!matchesActivePlacesJob(requestId, searchedTrim)) {
        return;
      }

      if (filtered.length === 0 && searchedTrim.length >= 2 && !nominatimRateLimited) {
        const useRegisteredCityBboxSilent = !!(cityDataEffective && (!widerSearch || strictCityBounds));
        let usedBiasOnlyBboxSilent = false;
        if (
          !useRegisteredCityBboxSilent &&
          strictCityBounds &&
          biasLatitude != null &&
          biasLongitude != null &&
          Number.isFinite(biasLatitude) &&
          Number.isFinite(biasLongitude)
        ) {
          usedBiasOnlyBboxSilent = true;
        }
        const silentLocalityOpts: LocalityFilterOpts = {
          strictCityBounds,
          cityLabel,
          effectiveCityKey,
          cityDataEffective,
          biasLatitude,
          biasLongitude,
          biasDeltaDeg,
          usedBiasOnlyBbox: usedBiasOnlyBboxSilent,
          rawQueryLower: input.trim().toLocaleLowerCase('tr-TR'),
        };

        const normalizedCity = (cityLabel || '').trim();
        const q0 = searchedTrim;
        const silentSingleQuery = normalizedCity ? normalizePlaceQuery(q0, normalizedCity) : '';
        const nCapSilent =
          widerSearch && !strictCityBounds ? 20 : strictCityBounds ? 18 : 12;
        if (silentSingleQuery) {
          try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              silentSingleQuery,
            )}&countrycodes=tr&addressdetails=1&extratags=1&limit=${Math.max(
              10,
              nCapSilent,
            )}&accept-language=tr`;
            const response = await fetch(url, {
              headers: { 'User-Agent': 'LeylekTAG-App/1.0' },
              signal,
            });
            if (response.ok) {
              const data = (await response.json()) as PlaceResult[];
              const rows = Array.isArray(data) ? data : [];
              if (rows.length > 0) {
                if (!matchesActivePlacesJob(requestId, searchedTrim)) {
                  return;
                }
                let silentCand = rows.filter(
                  (item) => !['country', 'state'].includes(String(item.type || '').toLowerCase()),
                );
                let silentUsedSoftOnlyBranch = false;
                if (strictCityBounds) {
                  const strictRows = silentCand.filter((item) =>
                    passesStrictLocality(item, silentLocalityOpts),
                  );
                  const softRows = silentCand.filter((item) =>
                    passesSoftLocality(item, silentLocalityOpts),
                  );
                  if (strictRows.length > 0) {
                    silentCand = strictRows;
                    silentUsedSoftOnlyBranch = false;
                  } else {
                    silentCand = softRows;
                    silentUsedSoftOnlyBranch = true;
                  }
                }
                if (silentCand.length > 0) {
                  silentCand.sort(compareRows);
                  filtered = silentCand.slice(0, nCapSilent).map((item) => ({
                    ...item,
                    isSilentRefinement: strictCityBounds ? silentUsedSoftOnlyBranch : true,
                  }));
                }
              }
            } else if (response.status === 429 || response.status === 403) {
              nominatimRateLimited = true;
            }
          } catch (e) {
            if (SHOW_PLACES_DIAG) {
              console.warn('[PlacesAutocomplete] silent nominatim fallback failed', e);
            }
          }
        }
      }

      if (!matchesActivePlacesJob(requestId, searchedTrim)) {
        return;
      }

      let displayRows = filtered;
      if (filtered.length > 0) {
        lastSuccessfulPredictionsRef.current = {
          key: placesSearchStableKey(searchedTrim, city),
          rows: filtered.map((r) => ({ ...r })),
        };
      } else {
        const ck = placesSearchStableKey(searchedTrim, city);
        const hit = lastSuccessfulPredictionsRef.current;
        if (hit?.key === ck && hit.rows.length > 0) {
          displayRows = hit.rows.map((r) => ({ ...r }));
        }
      }

      if (SHOW_PLACES_DIAG) {
        console.log(
          '[places_search_diag]',
          JSON.stringify({
            query: input.trim(),
            city: (city || '').trim(),
            variants: searchVariants,
            googleCount: googleRawLen ?? 0,
            nominatimCount: nominatimRawTotal,
            filteredCount: filtered.length,
            fallbackUsed: diagFallbackUsed,
          }),
        );
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
        provider:
          displayRows.length > 0 && displayRows[0]?.source === 'google'
            ? 'google'
            : displayRows.length > 0
              ? 'nominatim'
              : 'none',
        raw_result_count: displayRows.length,
        final_result_count: displayRows.length,
        city_label: cityKeyHome || city.trim() || null,
        bias_lat_present: biasLatitude != null && Number.isFinite(biasLatitude),
        bias_lng_present: biasLongitude != null && Number.isFinite(biasLongitude),
        request_id: requestId,
      });
      if (displayRows.length > 0) {
        setPredictions(displayRows);
        setShowPredictions(true);
      } else {
        setPredictions([]);
        try {
          const payload: Record<string, unknown> = {
            request_id: requestId,
            query_len: input.trim().length,
            city_len: String(city || '').trim().length,
            has_city: !!String(city || '').trim(),
            google_key_present: !!apiKey,
            google_raw_count: googleRawLen ?? 0,
            nominatim_raw_count: nominatimRawTotal,
            filtered_count: displayRows.length,
            strict_city_bounds: !!strictCityBounds,
          };
          if (SHOW_PLACES_DIAG) {
            const qTrim = input.trim();
            const cityTrim = String(city || '').trim();
            payload.query = qTrim.length > 120 ? `${qTrim.slice(0, 120)}…` : qTrim;
            payload.city = cityTrim.length > 40 ? `${cityTrim.slice(0, 40)}…` : cityTrim;
          }
          console.log('TAG_PLACE_SEARCH_EMPTY', JSON.stringify(payload));
        } catch {
          /* noop */
        }
        /** Boş sonuçta da liste alanı açık kalsın; aksi halde "sonuç yok" UI hiç görünmez */
        setShowPredictions(true);
      }
      try {
        console.log(
          'TAG_PLACE_SEARCH_DONE',
          JSON.stringify({
            query_len: input.trim().length,
            request_id: requestId,
            result_count: displayRows.length,
            provider:
              displayRows.length > 0 && displayRows[0]?.source === 'google'
                ? 'google'
                : displayRows.length > 0
                  ? 'nominatim'
                  : 'none',
          }),
        );
      } catch {
        /* noop */
      }
    } catch (error) {
      const errName =
        error instanceof Error
          ? error.name
          : typeof error === 'object' && error !== null && 'name' in error
            ? String((error as { name?: unknown }).name)
            : '';
      const isAbort = errName === 'AbortError';
      if (isAbort) {
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      try {
        console.log(
          'TAG_PLACE_SEARCH_RECOVER',
          JSON.stringify({
            request_id: requestId,
            query_len: input.trim().length,
            error: msg.slice(0, 200),
          }),
        );
      } catch {
        /* noop */
      }
      acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
        provider: 'nominatim',
        query: input.trim(),
        raw_result_count: 0,
        final_result_count: 0,
        error_message: msg,
        request_id: requestId,
      });
      if (matchesActivePlacesJob(requestId, searchedTrim)) {
        const ck = placesSearchStableKey(searchedTrim, city);
        const hit = lastSuccessfulPredictionsRef.current;
        if (hit?.key === ck && hit.rows.length > 0) {
          /** Gerçek API yanıtlarından gelen önbellek; 429/403 için sahte isim/coord üretimi yok */
          setPredictions(hit.rows.map((r) => ({ ...r })));
          setShowPredictions(true);
        } else {
          setPredictions([]);
          setShowPredictions(true);
        }
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
      try {
        console.log(
          'TAG_PLACE_SEARCH_DONE',
          JSON.stringify({
            query_len: input.trim().length,
            request_id: requestId,
            result_count: 0,
            provider: 'error',
          }),
        );
      } catch {
        /* noop */
      }
    } finally {
      if (matchesActivePlacesJob(requestId, searchedTrim)) {
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

    setPredictionActionError(null);
    const formatted = formatAddress(item);

    if (item.source === 'google' && item.google_place_id) {
      const key = getGoogleMapsApiKey();
      if (!key) {
        setPredictionActionError('Adres seçilemedi. Lütfen tekrar deneyin.');
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
        setPredictionActionError('Adres doğrulanamadı. Başka bir sonuç seçin veya tekrar arayın.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const latitude = parseFloat(item.lat);
    const longitude = parseFloat(item.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setPredictionActionError('Bu konum seçilemedi. Başka bir sonuç deneyin.');
      return;
    }

    setQuery(formatted.main);
    setShowPredictions(false);
    setShowPopular(false);
    setPredictions([]);

    onPlaceSelected({
      address: item.display_name,
      latitude,
      longitude,
    });
  };

  const handleQuickPick = (qp: MuhabbetQuickPickPlace, selectionSource?: PlaceSelectionSource) => {
    if (!tech) {
      Keyboard.dismiss();
    }
    setQuery(qp.label);
    setShowPredictions(false);
    setShowPopular(false);
    setPredictions([]);
    onPlaceSelected({
      address: qp.label,
      latitude: qp.latitude,
      longitude: qp.longitude,
      ...(selectionSource ? { selectionSource } : {}),
    });
  };

  // Popüler mahalle seçimi
  const handleSelectPopular = async (placeName: string) => {
    setLoading(true);
    Keyboard.dismiss();
    setPopularGeocodeError(null);

    try {
      const searchQuery = city.trim()
        ? normalizePlaceQuery(placeName, city.trim())
        : `${placeName}, Türkiye`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=tr&limit=1&accept-language=tr`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'LeylekTAG-App/1.0' },
      });

      if (!response.ok) {
        if (SHOW_PLACES_DIAG) {
          console.warn('[PlacesAutocomplete] handleSelectPopular HTTP', response.status, searchQuery.slice(0, 80));
        }
        setPopularGeocodeError('Konum bulunamadı. Aramayı daha açık yazıp tekrar deneyin.');
        return;
      }

      const data: PlaceResult[] = await response.json();

      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setPopularGeocodeError('Konum bulunamadı. Aramayı daha açık yazıp tekrar deneyin.');
          return;
        }
        setQuery(placeName);
        setShowPredictions(false);
        setShowPopular(false);

        onPlaceSelected({
          address: item.display_name,
          latitude: lat,
          longitude: lng,
        });
      } else {
        if (SHOW_PLACES_DIAG) {
          console.warn('[PlacesAutocomplete] handleSelectPopular empty result', searchQuery.slice(0, 80));
        }
        setPopularGeocodeError('Konum bulunamadı. Aramayı daha açık yazıp tekrar deneyin.');
      }
    } catch (e) {
      if (SHOW_PLACES_DIAG) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[PlacesAutocomplete] handleSelectPopular', msg);
      }
      setPopularGeocodeError('Konum bulunamadı. Aramayı daha açık yazıp tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const clearInput = () => {
    placesSearchAbortRef.current?.abort();
    placesSearchAbortRef.current = null;
    autocompleteRequestIdRef.current += 1;
    lastSuccessfulPredictionsRef.current = null;
    setQuery('');
    setPredictions([]);
    setShowPredictions(false);
    setShowPopular(true);
    setSearchRoundDone(false);
    setPopularGeocodeError(null);
    setPredictionActionError(null);
  };

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
                        {item.isSilentRefinement ? (
                          <Text
                            style={[styles.predictionRefineHint, tech && styles.predictionRefineHintTech]}
                            numberOfLines={1}
                          >
                            Konumu haritadan doğrulamanız önerilir
                          </Text>
                        ) : null}
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
          onChangeText={(t) => {
            setPopularGeocodeError(null);
            setPredictionActionError(null);
            setQuery(t);
          }}
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

      {popularGeocodeError ? (
        <Text
          style={[styles.geocodeInlineError, tech && styles.geocodeInlineErrorTech]}
          numberOfLines={2}
        >
          {popularGeocodeError}
        </Text>
      ) : null}

      {predictionActionError ? (
        <Text
          style={[styles.geocodeInlineError, tech && styles.geocodeInlineErrorTech]}
          numberOfLines={2}
        >
          {predictionActionError}
        </Text>
      ) : null}

      {showCompactMerkezRow ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.compactMerkezScroll}
          contentContainerStyle={styles.compactMerkezScrollContent}
        >
          {compactMerkezEntries.exactCities.map((p) => (
            <TouchableOpacity
              key={`exact-${p.label}`}
              style={[styles.compactMerkezChip, tech && styles.compactMerkezChipTech]}
              onPress={() => handleQuickPick(p, 'merkez_chip')}
              activeOpacity={0.85}
            >
              <Text style={[styles.compactMerkezChipText, tech && styles.compactMerkezChipTextTech]} numberOfLines={1}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
          {compactMerkezEntries.districts.map((h) => {
            const dk = `${h.district}|${h.cityKey}`;
            const c = districtMerkezCoords[dk];
            const ready = !!(c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
            const districtPlace: MuhabbetQuickPickPlace = ready
              ? { label: h.label, latitude: c.lat, longitude: c.lng }
              : { label: h.label, latitude: NaN, longitude: NaN };
            return (
              <TouchableOpacity
                key={`dist-${h.label}`}
                style={[styles.compactMerkezChip, tech && styles.compactMerkezChipTech]}
                disabled={!ready}
                onPress={() => handleQuickPick(districtPlace, 'merkez_chip')}
                activeOpacity={0.85}
              >
                <View style={styles.compactMerkezChipInner}>
                  {!ready ? (
                    <ActivityIndicator
                      size="small"
                      color={tech ? '#94A3B8' : '#64748B'}
                      style={styles.compactMerkezChipSpinner}
                    />
                  ) : null}
                  <Text
                    style={[styles.compactMerkezChipText, tech && styles.compactMerkezChipTextTech]}
                    numberOfLines={1}
                  >
                    {h.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {compactMerkezEntries.fallbackCities.map((p) => (
            <TouchableOpacity
              key={`fb-${p.label}`}
              style={[styles.compactMerkezChip, tech && styles.compactMerkezChipTech]}
              onPress={() => handleQuickPick(p, 'merkez_chip')}
              activeOpacity={0.85}
            >
              <Text style={[styles.compactMerkezChipText, tech && styles.compactMerkezChipTextTech]} numberOfLines={1}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {showQuickPicks ? (
        <View style={[styles.quickPickWrap, tech && styles.quickPickWrapTech]}>
          <Text style={[styles.quickPickTitle, tech && styles.quickPickTitleTech]}>Hızlı seçim</Text>
          <View style={styles.quickPickGrid}>
            {quickPickList.map((qp) => (
              <TouchableOpacity
                key={qp.label}
                style={[styles.quickPickChip, tech && styles.quickPickChipTech]}
                activeOpacity={0.85}
                onPress={() => handleQuickPick(qp)}
              >
                <Text style={[styles.quickPickChipText, tech && styles.quickPickChipTextTech]} numberOfLines={2}>
                  {qp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

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
                    {item.isSilentRefinement ? (
                      <Text
                        style={[styles.predictionRefineHint, tech && styles.predictionRefineHintTech]}
                        numberOfLines={1}
                      >
                        Konumu haritadan doğrulamanız önerilir
                      </Text>
                    ) : null}
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
            Daha açık yazın: mahalle, cadde/sokak ve şehir adıyla deneyin.{'\n'}
            Örn: Çankaya, Ankara
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
    zIndex: 50,
    ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
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

  compactMerkezScroll: {
    marginTop: 8,
    maxHeight: 40,
  },
  compactMerkezScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  compactMerkezChip: {
    flexShrink: 0,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    maxWidth: 220,
  },
  compactMerkezChipTech: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  compactMerkezChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  compactMerkezChipTextTech: {
    color: '#E0F2FE',
  },
  compactMerkezChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
  },
  compactMerkezChipSpinner: {
    marginRight: 6,
  },

  quickPickWrap: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickPickWrapTech: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  quickPickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  quickPickTitleTech: {
    color: '#E2E8F0',
  },
  quickPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPickChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    maxWidth: '100%',
  },
  quickPickChipTech: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  quickPickChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  quickPickChipTextTech: {
    color: '#E0F2FE',
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
    zIndex: 60,
    ...(Platform.OS === 'android' ? { elevation: 16 } : {}),
  },
  predictionsAboveInput: {
    marginTop: 0,
    marginBottom: 10,
    flexGrow: 1,
    minHeight: 120,
    zIndex: 60,
    ...(Platform.OS === 'android' ? { elevation: 16 } : {}),
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
  predictionRefineHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
    fontWeight: '500',
  },
  predictionRefineHintTech: {
    color: '#64748B',
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
  geocodeInlineError: {
    marginTop: 8,
    fontSize: 13,
    color: '#DC2626',
    paddingHorizontal: 4,
  },
  geocodeInlineErrorTech: {
    color: '#FCA5A5',
  },
});
