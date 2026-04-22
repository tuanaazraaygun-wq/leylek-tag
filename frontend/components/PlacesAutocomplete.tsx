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
};

/** Kayıtlı şehir adı CITY_DATA anahtarıyla birebir olmayabilir (büyük/küçük harf vb.) */
function resolveCityDataKey(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (CITY_DATA[t]) return t;
  const lower = t.toLocaleLowerCase('tr-TR');
  for (const k of Object.keys(CITY_DATA)) {
    if (k.toLocaleLowerCase('tr-TR') === lower) return k;
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
  if (q.length < 3) return null;
  for (const k of Object.keys(CITY_DATA)) {
    if (homeKey && k === homeKey) continue;
    if (q.includes(k.toLocaleLowerCase('tr-TR'))) return k;
  }
  return null;
}

/** Sokak numarası + sokak/cadde ve genel aramalar için şehir bağlamı */
function buildNominatimSearchQuery(rawInput: string, cityLabel: string, forcedCityKey: string | null): string {
  const head = rawInput.trim().replace(/\s+/g, ' ');
  if (!head) return head;

  const effectiveLabel = (forcedCityKey || cityLabel || '').trim();
  const roadish =
    /^\d{1,5}\s*(?:\.|:)?\s*(?:no\.?|numara)?\s*(?:sokak|sokağı|sok\.?|sk\.?|cadde|caddesi|cd\.?|bulvar|bulvarı|blv\.?)\b/i.test(
      head,
    );

  if (roadish && effectiveLabel) {
    return `${head}, ${effectiveLabel}, Türkiye`;
  }
  if (effectiveLabel && !head.toLocaleLowerCase('tr-TR').includes(effectiveLabel.toLocaleLowerCase('tr-TR'))) {
    return `${head}, ${effectiveLabel}, Türkiye`;
  }
  return `${head}, Türkiye`;
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

function passesStrictLocality(
  item: PlaceResult,
  opts: {
    strictCityBounds: boolean;
    cityLabel: string;
    effectiveCityKey: string | null;
    cityDataEffective: { bbox: string } | null;
    biasLatitude?: number;
    biasLongitude?: number;
    biasDeltaDeg: number;
    usedBiasOnlyBbox: boolean;
  },
): boolean {
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

function computeLocalSortScore(
  item: PlaceResult,
  queryInput: string,
  biasLatitude?: number,
  biasLongitude?: number,
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
    return tr * 18 + prefixBoost;
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
      : qLower.length >= 3 && qLower.split(/\s+/).filter((w) => w.length > 2).some((w) => nameLower.includes(w))
        ? -0.6
        : 0;

  return tier * 12 + distKm * 0.92 - imp * 3.2 + streetBoost + tokenBoost;
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

interface PlaceDetails {
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
  const nl = cityNeedle.trim().toLocaleLowerCase('tr-TR');
  if (!nl) return true;
  const dn = (item.display_name || '').toLocaleLowerCase('tr-TR');
  if (dn.includes(nl)) return true;
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
    if (typeof v === 'string' && v.trim().toLocaleLowerCase('tr-TR').includes(nl)) return true;
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
}: PlacesAutocompleteProps) {
  const { height: windowHeight } = useWindowDimensions();
  const tech = visualVariant === 'tech';
  const ratio = tech ? Math.min(0.55, LAYOUT.predictionMaxHeightRatio + 0.14) : LAYOUT.predictionMaxHeightRatio;
  const predictionsMaxHeight = Math.round(
    Math.max(
      LAYOUT.predictionListMin,
      Math.min(
        LAYOUT.predictionListMax + (tech ? 100 : 0) + predictionMaxHeightBonus,
        windowHeight * ratio + predictionMaxHeightBonus,
      ),
    ),
  );
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showPopular, setShowPopular] = useState(true);
  /** Geçici: boş sonuç nedeni (yalnız SHOW_PLACES_DIAG açıkken dolar / gösterilir) */
  const [searchDiag, setSearchDiag] = useState<PlaceSearchDiag | null>(null);
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
  }, [query, widerSearch, city, strictCityBounds, biasLatitude, biasLongitude, biasDeltaDeg]);

  /** Önce Google Places (Autocomplete + Details ile koordinat); boş / hata → Nominatim (mevcut mantık). */
  const searchPlaces = async (input: string) => {
    const requestId = ++autocompleteRequestIdRef.current;
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
          acDiag('AUTOCOMPLETE_PROVIDER_START', {
            provider: 'google',
            query: input.trim(),
            city_label: cityLabel || null,
            request_id: requestId,
          });
          const gBias = buildGooglePlacesBias(
            effectiveCityKey,
            explicitOtherKey,
            biasLatitude,
            biasLongitude,
            strictCityBounds,
          );
          const raw = await googlePlacesAutocompleteMerged(input.trim(), apiKey, gBias);
          if (requestId !== autocompleteRequestIdRef.current) {
            return;
          }
          googleRawLen = raw.length;
          filtered = raw.map(mapGooglePredictionToPlaceResult);
          filtered.sort(
            (a, b) =>
              computeLocalSortScore(a, input, biasLatitude, biasLongitude) -
              computeLocalSortScore(b, input, biasLatitude, biasLongitude),
          );
          const gCap = widerSearch && !strictCityBounds ? 24 : strictCityBounds ? 20 : 14;
          filtered = filtered.slice(0, gCap);
          acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
            provider: 'google',
            query: input.trim(),
            city_label: cityLabel || null,
            raw_result_count: raw.length,
            final_result_count: filtered.length,
            error_message: null,
            request_id: requestId,
          });
        } catch (gErr) {
          const msg = gErr instanceof Error ? gErr.message : String(gErr);
          googleHadError = true;
          googleErrorHint = msg.slice(0, 160);
          acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
            provider: 'google',
            query: input.trim(),
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
          query: input.trim(),
          city_label: cityLabel || null,
          had_google_key: !!apiKey,
          request_id: requestId,
        });
        const searchQuery = buildNominatimSearchQuery(input, city, explicitOtherKey);
        const limitPrimary =
          widerSearch && !strictCityBounds ? 22 : strictCityBounds ? 20 : 12;

        const buildUrl = (bounded: boolean, lim: number) => {
          let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery,
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

        const runFetch = async (bounded: boolean, lim: number) => {
          const { url } = buildUrl(bounded, lim);
          const response = await fetch(url, {
            headers: { 'User-Agent': 'LeylekTAG-App/1.0' },
          });
          if (!response.ok) {
            throw new Error(`nominatim_http_${response.status}`);
          }
          const data: PlaceResult[] = await response.json();
          return Array.isArray(data) ? data : [];
        };

        const { usedBiasOnlyBbox } = buildUrl(true, limitPrimary);

        let data = await runFetch(true, limitPrimary);
        if (requestId !== autocompleteRequestIdRef.current) {
          return;
        }
        anyNomRaw = data.length > 0;

        const filterAndRank = (rows: PlaceResult[]) => {
          let rowsIn = rows.filter((item) => !['country', 'state', 'county'].includes(item.type));

          if (strictCityBounds) {
            const beforeStrict = rowsIn.length;
            rowsIn = rowsIn.filter((item) =>
              passesStrictLocality(item, {
                strictCityBounds,
                cityLabel,
                effectiveCityKey,
                cityDataEffective,
                biasLatitude,
                biasLongitude,
                biasDeltaDeg,
                usedBiasOnlyBbox,
              }),
            );
            if (beforeStrict > rowsIn.length) {
              acDiag('AUTOCOMPLETE_FILTERED_OUT', {
                provider: 'nominatim',
                query: input.trim(),
                city_label: cityLabel || null,
                raw_result_count: beforeStrict,
                final_result_count: rowsIn.length,
                reason: 'strict_city_bounds',
                filtered_out_count: beforeStrict - rowsIn.length,
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

          rowsIn.sort(
            (a, b) =>
              computeLocalSortScore(a, input, biasLatitude, biasLongitude) -
              computeLocalSortScore(b, input, biasLatitude, biasLongitude),
          );

          return rowsIn;
        };

        acDiag('AUTOCOMPLETE_PROVIDER_RESULT', {
          provider: 'nominatim',
          query: input.trim(),
          city_label: cityLabel || null,
          raw_result_count: data.length,
          final_result_count: data.length,
          phase: 'raw_fetch_bounded',
          request_id: requestId,
        });

        let nom = filterAndRank(data);

        if (nom.length < 5 && strictCityBounds) {
          const loose = await runFetch(false, 35);
          if (requestId !== autocompleteRequestIdRef.current) {
            return;
          }
          anyNomRaw = anyNomRaw || loose.length > 0;
          const byId = new Map<string, PlaceResult>();
          for (const r of [...data, ...loose]) {
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
          console.warn('[PLACES_DIAG]', payload.code, payload.hint ?? '');
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
          console.warn('[PLACES_DIAG]', payload.code, payload.hint ?? '');
        }
      }
    } finally {
      if (requestId === autocompleteRequestIdRef.current) {
        setLoading(false);
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
        console.warn('Google Place Details: anahtar yok');
        return;
      }
      setLoading(true);
      try {
        const det = await googlePlaceDetailsLatLng(item.google_place_id, key);
        console.log('✅ Seçildi (Google):', det.formattedAddress, det.lat, det.lng);
        setQuery(formatted.main);
        setShowPredictions(false);
        setShowPopular(false);
        setPredictions([]);
        onPlaceSelected({
          address: det.formattedAddress || item.display_name,
          latitude: det.lat,
          longitude: det.lng,
        });
      } catch (e) {
        console.warn('Google Place Details hatası:', e);
      } finally {
        setLoading(false);
      }
      return;
    }

    console.log('✅ Seçildi:', formatted.main, item.lat, item.lon);

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
      const searchQuery = city ? `${placeName}, ${city}, Türkiye` : `${placeName}, Türkiye`;
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
    } catch (error) {
      console.error('Popüler yer hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearInput = () => {
    setQuery('');
    setPredictions([]);
    setShowPredictions(false);
    setShowPopular(true);
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
                { maxHeight: predictionsMaxHeight },
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
            { maxHeight: predictionsMaxHeight },
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

      {/* Sonuç Bulunamadı */}
      {showPredictions && predictions.length === 0 && query.length >= 2 && !loading && (
        <View style={[styles.noResultsContainer, tech && styles.noResultsContainerTech]}>
          <Ionicons name="location-outline" size={48} color={tech ? '#475569' : '#DDD'} />
          <Text style={[styles.noResultsText, tech && styles.noResultsTextTech]}>
            {`"${query}" için sonuç bulunamadı`}
          </Text>
          <Text style={[styles.noResultsHint, tech && styles.noResultsHintTech]}>
            Farklı bir arama deneyin
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
